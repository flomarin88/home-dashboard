import { useEffect, useRef } from "react";
import { useEntity, useService } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import type { EntityEntry } from "../entities";
import { useOptimisticControl } from "../hakit/useOptimisticControl";
import { useOptimisticAttr } from "../hakit/useOptimisticAttr";
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
