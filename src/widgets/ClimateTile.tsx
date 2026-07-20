import { useEffect, useRef, useState } from "react";
import { useEntity, useService } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import type { EntityEntry } from "../entities";
import { useOptimisticControl } from "../hakit/useOptimisticControl";
import { climateModel, type ClimateModeTarget } from "../state/control-model";
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
 * on a cyan-accented frosted tile, laid out top-down by decision priority (UX
 * redesign): header = state + power toggle; then the big central setpoint; then a
 * single row of icon'd mode chips; then Vitesse and Oscillation as segmented
 * controls. Mode/on-off flow through `useOptimisticControl` + `climateModel`
 * (state token, AD-5); the numeric/attr facets use a component-local overlay
 * (`useOptimisticAttr`). Offline → a non-interactive "Hors ligne" tile (AD-6); a
 * timed-out mode command → "Échec". Powered off → the whole control block dims
 * and its buttons disable, so no setting reads as active while the unit is off.
 *
 * Like `VacuumTile`, this is a bespoke container (not `DeviceTile`, whose
 * {label,value,onPress} contract is too small) — so the cyan accent comes from
 * explicit `accent-climate` utilities, not the `.device-tile[data-domain]` CSS.
 */
export function ClimateTile({ entry }: { entry: EntityEntry }) {
  const id = entry.entityId as EntityName;
  const entity = useEntity(id, { returnNullIfNotFound: true });
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

  const hasSetpoint = setpointValue != null;

  const fanModes = attrs.fan_modes ?? [];
  const swingModes = attrs.swing_modes ?? [];
  const showFan = fanModes.length > 0;
  const showSwing = swingModes.length > 0;

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

  return (
    <div
      data-domain="climate"
      className="flex flex-col gap-3 rounded-md border border-tile-border bg-tile-fill px-4 py-3"
    >
      {/* Header: title + running state + floor + power toggle */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-2">
          <ClimateIcon />
          <span className="text-label font-semibold text-text">
            Climatisation
          </span>
        </span>
        {failed ? (
          <span className="text-meta font-semibold text-security-alert">
            Échec
          </span>
        ) : !isOff ? (
          <StatePill mode={mode} />
        ) : null}
        <span className="flex-1" />
        <PowerToggle on={!isOff} onToggle={togglePower} />
      </div>

      {/* Control block — dims + disables as one unit when powered off */}
      <div className={`flex flex-col gap-3 ${isOff ? "opacity-50" : ""}`}>
        {/* Setpoint (−/+ around the central consigne) or a mode label */}
        {hasSetpoint ? (
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              aria-label="Diminuer la température"
              disabled={isOff}
              onClick={() => bump(-1)}
              className="inline-flex h-16 w-16 items-center justify-center rounded-md border border-accent-climate/50 bg-accent-climate/15 text-numeric-lg font-bold text-text"
            >
              −
            </button>
            <div className="text-numeric-xl font-bold tabular-nums text-accent-climate">
              <span>{formatSetpoint(setpointValue as number)}</span>
              <span className="ml-0.5 text-label text-text-muted">°C</span>
            </div>
            <button
              type="button"
              aria-label="Augmenter la température"
              disabled={isOff}
              onClick={() => bump(1)}
              className="inline-flex h-16 w-16 items-center justify-center rounded-md border border-accent-climate/50 bg-accent-climate/15 text-numeric-lg font-bold text-text"
            >
              +
            </button>
          </div>
        ) : (
          <div className="text-center text-title font-semibold text-text">
            {hvacModeLabel(mode)}
          </div>
        )}

        {/* Mode chips — icon + label, single "selected" language */}
        {modeChips.length > 0 ? (
          <div
            role="group"
            aria-label="Mode"
            className="grid grid-cols-5 gap-1.5"
          >
            {modeChips.map((m) => {
              const active = m === mode;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={isOff}
                  onClick={() => send(m as ClimateModeTarget)}
                  className={`flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-sm border text-meta font-semibold ${
                    active
                      ? "border-accent-climate/50 bg-accent-climate/15 text-accent-climate"
                      : "border-tile-border bg-tile-fill text-text"
                  }`}
                >
                  <ClimateModeIcon mode={m} />
                  {hvacModeLabel(m)}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Vitesse — its own full-width row so 7 speeds keep ≥48px targets */}
        {showFan ? (
          <Segmented
            label="Vitesse"
            values={fanModes}
            current={fanValue}
            render={fanLabel}
            onSelect={commitFan}
            disabled={isOff}
          />
        ) : null}

        {/* Oscillation */}
        {showSwing ? (
          <Segmented
            label="Oscillation"
            values={swingModes}
            current={swingValue}
            render={swingLabel}
            onSelect={commitSwing}
            disabled={isOff}
          />
        ) : null}
      </div>
    </div>
  );
}

/** A labelled row of mutually-exclusive segments (one per value, active tinted). */
function Segmented({
  label,
  values,
  current,
  render,
  onSelect,
  disabled,
}: {
  label: string;
  values: readonly string[];
  current: string | null;
  render: (v: string) => string;
  onSelect: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div role="group" aria-label={label}>
      <div className="mb-1.5 text-caption font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </div>
      <div className="flex gap-1.5">
        {values.map((v) => {
          const active = v === current;
          return (
            <button
              key={v}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(v)}
              className={`inline-flex min-h-[48px] min-w-0 flex-1 items-center justify-center rounded-sm border px-2 text-meta font-semibold ${
                active
                  ? "border-accent-climate/50 bg-accent-climate/15 text-accent-climate"
                  : "border-tile-border bg-tile-fill text-text"
              }`}
            >
              {render(v)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Running-state pill: glowing dot + "En marche · <mode>". Hidden when off. */
function StatePill({ mode }: { mode: string | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-climate/15 px-2.5 py-1 text-caption font-semibold text-accent-climate">
      <span className="h-1.5 w-1.5 rounded-full bg-accent-climate shadow-[0_0_6px_var(--color-accent-climate)]" />
      En marche · {hvacModeLabel(mode)}
    </span>
  );
}

/** On/off switch. The tappable area is ≥48px; the visual switch sits inside it. */
function PowerToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={on ? "Éteindre le climatiseur" : "Allumer le climatiseur"}
      className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center"
    >
      <span
        className={`relative h-8 w-14 rounded-full transition-colors ${
          on ? "bg-accent-climate" : "bg-stale"
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
            on ? "left-7" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-2">
        <ClimateIcon />
        <span className="text-label font-semibold text-text">
          Climatisation
        </span>
      </span>
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

/** hvac_mode → pictogram (snowflake / sun / droplet / fan / auto). */
function ClimateModeIcon({ mode }: { mode: string }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (mode) {
    case "cool":
      return (
        <svg {...common}>
          <path d="M12 2v20M4.2 7l15.6 10M19.8 7 4.2 17M12 5 9 3M12 5l3-2M12 19l-3 2M12 19l3 2" />
        </svg>
      );
    case "heat":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
        </svg>
      );
    case "dry":
      return (
        <svg {...common}>
          <path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />
        </svg>
      );
    case "fan_only":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="1.5" />
          <path d="M12 12c0-4 1-8 4-8s2 6-4 8c-4 0-8-1-8-4s6-2 8 4c0 4-1 8-4 8s-2-6 4-8c4 0 8 1 8 4s-6 2-8-4z" />
        </svg>
      );
    // heat_cool / auto and any fallthrough
    default:
      return (
        <svg {...common}>
          <path d="M4 18 9 6l5 12M5.5 14h7M15 6h4M17 6v12M15 18h4" />
        </svg>
      );
  }
}
