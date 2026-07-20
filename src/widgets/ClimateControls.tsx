import type { ReactNode } from "react";
import type { ClimateState } from "./useClimate";
import type { ClimateModeTarget } from "../state/control-model";
import {
  hvacModeLabel,
  fanLabel,
  swingLabel,
  formatSetpoint,
} from "./climate-status";

/**
 * The climate control surface, shared presentational layer over a `useClimate`
 * state. The `/climatisation` detail page renders the full block; the home tile
 * reuses only `SetpointStepper` (temperature is all it controls) — everything
 * else (mode, speed, oscillation) lives on the detail page (UX-DR6 revised,
 * Intent B). Powered off → the block dims and its buttons disable, so no setting
 * reads as active while the unit is off.
 */
export function ClimateControls({ c }: { c: ClimateState }) {
  return (
    <div className={`flex flex-col gap-3 ${c.isOff ? "opacity-50" : ""}`}>
      {c.hasSetpoint ? (
        <SetpointStepper
          value={c.setpointValue as number}
          disabled={c.isOff}
          onBump={c.bump}
        />
      ) : (
        <div className="text-center text-title font-semibold text-text">
          {hvacModeLabel(c.mode)}
        </div>
      )}

      {c.ambient != null ? (
        <div className="text-center text-meta text-text-muted">
          Ambiant{" "}
          <span className="font-semibold tabular-nums text-text">
            {formatSetpoint(c.ambient)}°C
          </span>
        </div>
      ) : null}

      {/* Mode chips — icon + label, single "selected" language */}
      {c.modeChips.length > 0 ? (
        <div
          role="group"
          aria-label="Mode"
          className="grid grid-cols-5 gap-1.5"
        >
          {c.modeChips.map((m) => {
            const active = m === c.mode;
            return (
              <button
                key={m}
                type="button"
                disabled={c.isOff}
                onClick={() => c.send(m as ClimateModeTarget)}
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
      {c.showFan ? (
        <Segmented
          label="Vitesse"
          values={c.fanModes}
          current={c.fanValue}
          render={fanRender}
          ariaLabelFor={fanLabel}
          onSelect={c.commitFan}
          disabled={c.isOff}
        />
      ) : null}

      {/* Oscillation */}
      {c.showSwing ? (
        <Segmented
          label="Oscillation"
          values={c.swingModes}
          current={c.swingValue}
          render={swingLabel}
          onSelect={c.commitSwing}
          disabled={c.isOff}
        />
      ) : null}
    </div>
  );
}

/** The −/+ setpoint stepper around the central consigne. Shared by the home tile
 * (its only control) and the detail page. */
export function SetpointStepper({
  value,
  disabled,
  onBump,
}: {
  value: number;
  disabled: boolean;
  onBump: (dir: 1 | -1) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        aria-label="Diminuer la température"
        disabled={disabled}
        onClick={() => onBump(-1)}
        className="inline-flex h-16 w-16 items-center justify-center rounded-md border border-accent-climate/50 bg-accent-climate/15 text-numeric-lg font-bold text-text"
      >
        −
      </button>
      <div className="text-numeric-xl font-bold tabular-nums text-accent-climate">
        <span>{formatSetpoint(value)}</span>
        <span className="ml-0.5 text-label text-text-muted">°C</span>
      </div>
      <button
        type="button"
        aria-label="Augmenter la température"
        disabled={disabled}
        onClick={() => onBump(1)}
        className="inline-flex h-16 w-16 items-center justify-center rounded-md border border-accent-climate/50 bg-accent-climate/15 text-numeric-lg font-bold text-text"
      >
        +
      </button>
    </div>
  );
}

/** A labelled row of mutually-exclusive segments (one per value, active tinted). */
function Segmented({
  label,
  values,
  current,
  render,
  ariaLabelFor,
  onSelect,
  disabled,
}: {
  label: string;
  values: readonly string[];
  current: string | null;
  render: (v: string) => ReactNode;
  /** Accessible name per segment when `render` returns an icon (else the text
   * content is the name). */
  ariaLabelFor?: (v: string) => string;
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
              aria-label={ariaLabelFor ? ariaLabelFor(v) : undefined}
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

/** Fan-speed segment content: icons for the wordy modes (Auto / Silencieux),
 * digits for the numeric speeds — keeps 7 segments legible in the narrow
 * column. The accessible name is preserved via `ariaLabelFor={fanLabel}`. */
function fanRender(v: string): ReactNode {
  if (v === "Auto" || v === "auto") return <FanAutoIcon />;
  if (v === "Quiet" || v === "quiet") return <FanQuietIcon />;
  return fanLabel(v);
}

/** "Auto" fan speed — the auto zigzag (same language as the Auto hvac mode). */
function FanAutoIcon() {
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
    >
      <path d="M4 18 9 6l5 12M5.5 14h7M15 6h4M17 6v12M15 18h4" />
    </svg>
  );
}

/** "Silencieux" (Quiet) — a crescent moon, the AC remote's sleep/quiet glyph. */
function FanQuietIcon() {
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
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

/** Running-state pill: glowing dot + "En marche · <mode>". Hidden when off. */
export function StatePill({ mode }: { mode: string | null | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-climate/15 px-2.5 py-1 text-caption font-semibold text-accent-climate">
      <span className="h-1.5 w-1.5 rounded-full bg-accent-climate shadow-[0_0_6px_var(--color-accent-climate)]" />
      En marche · {hvacModeLabel(mode)}
    </span>
  );
}

/** On/off switch. The tappable area is ≥48px; the visual switch sits inside it. */
export function PowerToggle({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: () => void;
}) {
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

export function ClimateIcon() {
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
