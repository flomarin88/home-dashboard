import { useEffect, useRef, useState } from "react";
import { useEntity, useService } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import type { EntityEntry } from "../entities";
import { useOptimisticControl } from "../hakit/useOptimisticControl";
import { climateModel, type ClimateModeTarget } from "../state/control-model";
import { FloorPill } from "../ui/FloorPill";
import { OfflinePill } from "../ui/OfflinePill";
import {
  hvacModeLabel,
  fanLabel,
  swingLabel,
  parseTemp,
  clampSetpoint,
  formatSetpoint,
} from "./climate-status";

/** The climate attributes ClimateTile reads (see mapping / device-proof). */
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
 * tile owns the entity, so there's no cross-widget race — a component-local
 * overlay is legitimate ephemeral UI state (AD-1/AD-3), not a cache.
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
 * ClimateTile (FR6, Story 2.6, UX-DR6/UX-DR11) — the upstairs A/C control cluster
 * on a cyan-accented frosted tile: setpoint stepper (−/+) + mode chips + on/off,
 * plus fan (cycle) and swing (toggle). Mode/on-off flow through
 * `useOptimisticControl` + `climateModel` (state token, AD-5); the numeric/attr
 * facets use a component-local overlay (`useOptimisticAttr`). Offline → a
 * non-interactive "Hors ligne" tile (AD-6); a timed-out mode command → "Échec".
 *
 * Like `VacuumTile`, this is a bespoke container (not `DeviceTile`, whose
 * {label,value,onPress} contract is too small) — so the cyan accent comes from
 * explicit `accent-climate` utilities, not the `.device-tile[data-domain]` CSS.
 */
export function ClimateTile({ entry }: { entry: EntityEntry }) {
  const id = entry.entityId as EntityName;
  const ambientId = (entry.ambientEntityId ?? entry.entityId) as EntityName;
  const entity = useEntity(id, { returnNullIfNotFound: true });
  const ambientSensor = useEntity(ambientId, { returnNullIfNotFound: true });
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

  if (isStale) {
    return (
      <div
        data-domain="climate"
        className="flex flex-col gap-2 rounded-md border border-dashed border-stale bg-tile-fill px-4 py-3 text-stale-text"
      >
        <Header />
        <OfflinePill />
      </div>
    );
  }

  const mode = displayState;
  const isOff = mode == null || mode === "off";
  const modeChips = (attrs.hvac_modes ?? []).filter((m) => m !== "off");
  const step =
    Number.isFinite(attrs.target_temp_step) &&
    (attrs.target_temp_step as number) > 0
      ? (attrs.target_temp_step as number)
      : 0.5;

  const adjustable = !isOff && confirmedSetpoint != null;
  const ambient =
    parseTemp(attrs.current_temperature) ?? parseTemp(ambientSensor?.state);

  const fanModes = attrs.fan_modes ?? [];
  const swingModes = attrs.swing_modes ?? [];
  const showFan = !isOff && fanModes.length > 0;
  const showSwing = !isOff && swingModes.length > 0;

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

  const cycleFan = () => {
    if (fanModes.length === 0) return;
    const i = fanValue == null ? -1 : fanModes.indexOf(fanValue);
    commitFan(fanModes[(i + 1) % fanModes.length]);
  };

  const toggleSwing = () => {
    const other = swingModes.find((m) => m !== swingValue);
    if (other != null) commitSwing(other);
  };

  const togglePower = () => (isOff ? send(lastMode.current) : send("off"));

  return (
    <div
      data-domain="climate"
      className="flex flex-col gap-2 rounded-md border border-tile-border bg-tile-fill px-4 py-3"
    >
      <Header />

      {/* Setpoint (or off label) + ambient / failure */}
      <div className="flex items-center justify-between gap-2">
        {adjustable ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Diminuer la température"
              onClick={() => bump(-1)}
              className="inline-flex min-h-[48px] min-w-[56px] items-center justify-center rounded-[12px] border border-accent-climate/50 bg-accent-climate/15 text-title font-bold text-text"
            >
              −
            </button>
            <span className="text-numeric-xl font-semibold tabular-nums text-accent-climate">
              <span>{formatSetpoint(setpointValue as number)}</span>
              <span className="ml-0.5 text-label text-text-muted">°C</span>
            </span>
            <button
              type="button"
              aria-label="Augmenter la température"
              onClick={() => bump(1)}
              className="inline-flex min-h-[48px] min-w-[56px] items-center justify-center rounded-[12px] border border-accent-climate/50 bg-accent-climate/15 text-title font-bold text-text"
            >
              +
            </button>
          </div>
        ) : (
          <span className="text-title font-semibold text-text">
            {hvacModeLabel(mode)}
          </span>
        )}
        <div className="flex flex-col items-end gap-0.5">
          {ambient != null ? (
            <span className="text-meta tabular-nums text-text-muted">
              Ambiant {formatSetpoint(ambient)}°C
            </span>
          ) : null}
          {failed ? (
            <span className="text-meta font-semibold text-security-alert">
              Échec
            </span>
          ) : null}
        </div>
      </div>

      {/* Mode chips + power */}
      <div className="flex flex-wrap gap-tile-gap">
        {modeChips.map((m) => {
          const active = m === mode;
          return (
            <button
              key={m}
              type="button"
              onClick={() => send(m as ClimateModeTarget)}
              className={`inline-flex min-h-[48px] items-center justify-center rounded-sm border px-3 text-label font-semibold ${
                active
                  ? "border-accent-climate/50 bg-accent-climate/15 text-accent-climate"
                  : "border-tile-border bg-tile-fill text-text"
              }`}
            >
              {hvacModeLabel(m)}
            </button>
          );
        })}
        <button
          type="button"
          onClick={togglePower}
          className="inline-flex min-h-[48px] items-center justify-center rounded-sm border border-tile-border bg-tile-fill px-3 text-label font-semibold text-text"
        >
          {isOff ? "Allumer" : "Éteindre"}
        </button>
      </div>

      {/* Fan + swing (hidden when off or unsupported) */}
      {showFan || showSwing ? (
        <div className="flex gap-tile-gap">
          {showFan ? (
            <button
              type="button"
              onClick={cycleFan}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-sm border border-tile-border bg-tile-fill px-3 text-meta font-semibold text-text"
            >
              Ventilation : {fanLabel(fanValue)}
            </button>
          ) : null}
          {showSwing ? (
            <button
              type="button"
              onClick={toggleSwing}
              className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-sm border border-tile-border bg-tile-fill px-3 text-meta font-semibold text-text"
            >
              Oscillation : {swingLabel(swingValue)}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2">
        <ClimateIcon />
        <span className="text-label font-semibold text-text">
          Climatisation
        </span>
      </span>
      {/* The A/C unit lives on the étage (floor 1). */}
      <FloorPill floor={1} />
    </div>
  );
}

function ClimateIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-accent-climate"
    >
      <rect x="2" y="4" width="20" height="9" rx="2" />
      <path d="M6 17v1M10 17v2M14 17v1M18 17v2" />
    </svg>
  );
}
