import { CO2_WARN_PPM, CO2_ALERT_PPM } from "../config";

/**
 * Format a raw HA sensor state into a display string.
 * Returns the em-dash placeholder for missing / non-numeric states
 * (`unavailable`, `unknown`, null, empty, …) — the full obsolescence pill is
 * Story 1.6; here a stale/absent value just reads as "—".
 */
export function formatSensorValue(
  state: string | number | null | undefined,
  decimals: number,
): string {
  if (state === null || state === undefined || state === "") return "—";
  const n = Number(state);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

/**
 * CO₂ air-quality level (ppm): ok < 1000, warn 1000–2000, alert ≥ 2000.
 * `none` for non-numeric/absent. Thresholds from `config` (CO2_WARN/ALERT).
 * Single source for both the value colour class and the chart colour var.
 */
type Co2Level = "ok" | "warn" | "alert" | "none";

function co2Level(state: string | number | null | undefined): Co2Level {
  const n = Number(state);
  if (
    state === null ||
    state === undefined ||
    state === "" ||
    !Number.isFinite(n)
  )
    return "none";
  if (n < CO2_WARN_PPM) return "ok";
  if (n < CO2_ALERT_PPM) return "warn";
  return "alert";
}

const CO2_TEXT_CLASS: Record<Co2Level, string> = {
  ok: "text-security-ok",
  warn: "text-accent-lights",
  alert: "text-security-alert",
  none: "text-text",
};

const CO2_COLOR_VAR: Record<Co2Level, string> = {
  ok: "var(--color-security-ok)",
  warn: "var(--color-accent-lights)",
  alert: "var(--color-security-alert)",
  none: "var(--color-text-muted)",
};

/** CO₂ air-quality colour as a Tailwind text class (green / orange / red). */
export function co2ColorClass(
  state: string | number | null | undefined,
): string {
  return CO2_TEXT_CLASS[co2Level(state)];
}

/**
 * CO₂ air-quality colour as a CSS var (green / orange / red) — for the detail
 * chart stroke, so the curve matches the current value's colour. Same thresholds.
 */
export function co2Color(state: string | number | null | undefined): string {
  return CO2_COLOR_VAR[co2Level(state)];
}
