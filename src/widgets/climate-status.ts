/**
 * Pure climate display/formatting helpers (FR6, Story 2.6), tested without React
 * — mirrors `vacuum-status.ts`. Labels are French (Voice FR); unknown values fall
 * through to the raw HA value rather than hiding information.
 */

/** hvac_mode → French label. `heat_cool` is HA's "Auto". `—` for null. */
const HVAC_LABELS: Readonly<Record<string, string>> = {
  off: "Éteint",
  heat: "Chaud",
  cool: "Froid",
  auto: "Auto",
  heat_cool: "Auto",
  dry: "Sec",
  fan_only: "Ventilation",
};

export function hvacModeLabel(state: string | null | undefined): string {
  if (state == null) return "—";
  return HVAC_LABELS[state] ?? state;
}

/** fan_mode → French label (Quiet→Silencieux); speeds 1..5 stay as-is. */
const FAN_LABELS: Readonly<Record<string, string>> = {
  Quiet: "Silencieux",
  quiet: "Silencieux",
};

export function fanLabel(mode: string | null | undefined): string {
  if (mode == null) return "—";
  return FAN_LABELS[mode] ?? mode;
}

/** swing_mode → French label. Maps both HA value shapes (on/off and Swing/Stop). */
const SWING_LABELS: Readonly<Record<string, string>> = {
  on: "Oscillation",
  Swing: "Oscillation",
  swing: "Oscillation",
  off: "Fixe",
  Stop: "Fixe",
  stop: "Fixe",
};

export function swingLabel(mode: string | null | undefined): string {
  if (mode == null) return "—";
  return SWING_LABELS[mode] ?? mode;
}

/** Parse a temperature attribute ("21.5") to a number, or null if not numeric. */
export function parseTemp(
  value: string | number | null | undefined,
): number | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Bound a setpoint to the entity's [min, max] and snap it to `target_temp_step`.
 * The entity's own min/max/step win; the 16/30/0.5 defaults are fallbacks for
 * when the attribute is missing (never guess past the device's real limits).
 */
export function clampSetpoint(
  value: number,
  min?: number,
  max?: number,
  step?: number,
): number {
  const lo = Number.isFinite(min) ? (min as number) : 16;
  const hi = Number.isFinite(max) ? (max as number) : 30;
  const st =
    Number.isFinite(step) && (step as number) > 0 ? (step as number) : 0.5;
  const clamped = Math.min(hi, Math.max(lo, value));
  const snapped = lo + Math.round((clamped - lo) / st) * st;
  // Kill binary float drift (e.g. 21.500000000000004) before re-bounding.
  const fixed = Math.round(snapped * 100) / 100;
  return Math.min(hi, Math.max(lo, fixed));
}

/** Format a setpoint for the tabular display: drop a trailing ".0". */
export function formatSetpoint(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
