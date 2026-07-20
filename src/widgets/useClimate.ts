import { useEffect, useRef, useState } from "react";
import { useEntity, useService } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import type { EntityEntry } from "../entities";
import { useOptimisticControl } from "../hakit/useOptimisticControl";
import { climateModel, type ClimateModeTarget } from "../state/control-model";
import { parseTemp, clampSetpoint } from "./climate-status";

/** The climate attributes we read (see mapping / device-proof). */
interface ClimateAttrs {
  temperature?: number | string;
  current_temperature?: number | string;
  fan_mode?: string;
  swing_mode?: string;
  hvac_modes?: string[];
  fan_modes?: string[];
  swing_modes?: string[];
  min_temp?: number;
  max_temp?: number;
  target_temp_step?: number;
}

const SETPOINT_DEBOUNCE_MS = 500;
// Onecta is a polled cloud entity: the overlay must outlive the poll interval, so
// its only time-based clear is a long safety net (never a short snap-back).
const OVERLAY_SAFETY_MS = 120000;

/**
 * Local optimistic overlay for a climate ATTRIBUTE (setpoint / fan / swing), the
 * write-side that `useOptimisticControl` deliberately doesn't cover (it owns the
 * hvac_mode state token + the single per-entity pending slot; AD-11). A single
 * owner (one home tile OR the detail page — never both mounted at once) touches
 * the entity, so there's no cross-widget race — a component-local overlay is
 * legitimate ephemeral UI state (AD-1/AD-3), not a cache.
 *
 *  - optimistic value shows immediately; the HA service call is debounced so a
 *    burst of taps coalesces into one cloud command (quota, Onecta);
 *  - the overlay is HELD until the confirmed value moves off the base it was set
 *    against — reaching our target (converged) OR an external change (confirmed
 *    wins). No short revert that would flash backwards before the slow poll echo;
 *  - a long safety net drops a truly stuck overlay. Never a "failure" — the
 *    service call was accepted.
 */
function useOptimisticAttr<T extends string | number>(
  confirmed: T | null,
  apply: (target: T) => void,
  debounceMs: number,
): readonly [T | null, (target: T) => void, boolean] {
  const [pending, setPending] = useState<T | null>(null);
  const base = useRef<T | null>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (pending == null) return;
    if (confirmed != null && confirmed !== base.current) setPending(null);
  }, [confirmed, pending]);

  useEffect(
    () => () => {
      if (sendTimer.current) clearTimeout(sendTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    },
    [],
  );

  const commit = (target: T) => {
    if (pending == null) base.current = confirmed;
    setPending(target);
    if (sendTimer.current) clearTimeout(sendTimer.current);
    sendTimer.current = setTimeout(() => applyRef.current(target), debounceMs);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    safetyTimer.current = setTimeout(() => setPending(null), OVERLAY_SAFETY_MS);
  };

  return [pending ?? confirmed, commit, pending != null] as const;
}

/**
 * The full climate state + intents, shared by the compact home tile (which shows
 * only the temperature stepper + a read-only summary) and the `/climatisation`
 * detail page (which renders the whole control surface). Extracting it here keeps
 * the optimistic wiring in ONE place (DRY) — the two views are pure renderers of
 * this state.
 */
export interface ClimateState {
  /** Offline/stale (socket lost or entity unavailable) — render the offline cue. */
  isStale: boolean;
  /** The last mode command timed out. */
  failed: boolean;
  /** Current hvac mode (display), or null/undefined when unknown. */
  mode: string | null | undefined;
  isOff: boolean;
  /** Selectable hvac modes, minus "off". */
  modeChips: string[];
  /** Optimistic setpoint, or null when the mode exposes none (e.g. fan_only). */
  setpointValue: number | null;
  hasSetpoint: boolean;
  /** Measured room temperature (current_temperature, else the ambient sensor). */
  ambient: number | null;
  fanModes: string[];
  swingModes: string[];
  showFan: boolean;
  showSwing: boolean;
  fanValue: string | null;
  swingValue: string | null;
  /** Set the hvac mode (state token, AD-5). */
  send: (mode: ClimateModeTarget) => void;
  /** Toggle power: off when running, restore the last real mode when off. */
  togglePower: () => void;
  /** Step the setpoint by one `target_temp_step`, clamped to the entity range. */
  bump: (dir: 1 | -1) => void;
  commitFan: (v: string) => void;
  commitSwing: (v: string) => void;
}

export function useClimate(entry: EntityEntry): ClimateState {
  const id = entry.entityId as EntityName;
  const entity = useEntity(id, { returnNullIfNotFound: true });
  // Dedicated ambient sensor (Onecta cloud: current_temperature is often null).
  const ambientEntity = useEntity(
    (entry.ambientEntityId ?? entry.entityId) as EntityName,
    { returnNullIfNotFound: true },
  );
  const climateSvc = useService("climate");
  const { displayState, send, isStale, failed } = useOptimisticControl(
    id,
    climateModel,
  );

  const attrs = (entity?.attributes ?? {}) as unknown as ClimateAttrs;
  const confirmedSetpoint = parseTemp(attrs.temperature);
  const confirmedFan = attrs.fan_mode ?? null;
  const confirmedSwing = attrs.swing_mode ?? null;

  const [setpointValue, commitSetpoint] = useOptimisticAttr<number>(
    confirmedSetpoint,
    (t) =>
      climateSvc.setTemperature({
        target: id,
        serviceData: { temperature: t },
      }),
    SETPOINT_DEBOUNCE_MS,
  );
  const [fanValue, commitFan] = useOptimisticAttr<string>(
    confirmedFan,
    (t) => climateSvc.setFanMode({ target: id, serviceData: { fan_mode: t } }),
    SETPOINT_DEBOUNCE_MS,
  );
  const [swingValue, commitSwing] = useOptimisticAttr<string>(
    confirmedSwing,
    (t) =>
      climateSvc.setSwingMode({ target: id, serviceData: { swing_mode: t } }),
    SETPOINT_DEBOUNCE_MS,
  );

  // Remember the last real mode so "Allumer" restores it instead of guessing.
  const lastMode = useRef<ClimateModeTarget>("heat");
  useEffect(() => {
    if (displayState && displayState !== "off") {
      lastMode.current = displayState as ClimateModeTarget;
    }
  }, [displayState]);

  const mode = displayState;
  const isOff = mode == null || mode === "off";
  const modeChips = (attrs.hvac_modes ?? []).filter((m) => m !== "off");
  const step =
    Number.isFinite(attrs.target_temp_step) &&
    (attrs.target_temp_step as number) > 0
      ? (attrs.target_temp_step as number)
      : 0.5;

  const bump = (dir: 1 | -1) => {
    if (setpointValue == null) return;
    commitSetpoint(
      clampSetpoint(
        setpointValue + dir * step,
        attrs.min_temp,
        attrs.max_temp,
        step,
      ),
    );
  };

  const togglePower = () => (isOff ? send(lastMode.current) : send("off"));

  const ambient =
    parseTemp(attrs.current_temperature) ?? parseTemp(ambientEntity?.state);

  const fanModes = attrs.fan_modes ?? [];
  const swingModes = attrs.swing_modes ?? [];

  return {
    isStale,
    failed,
    mode,
    isOff,
    modeChips,
    setpointValue,
    hasSetpoint: setpointValue != null,
    ambient,
    fanModes,
    swingModes,
    showFan: fanModes.length > 0,
    showSwing: swingModes.length > 0,
    fanValue,
    swingValue,
    send,
    togglePower,
    bump,
    commitFan,
    commitSwing,
  };
}
