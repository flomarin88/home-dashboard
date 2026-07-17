/**
 * App display config (single source for tunable UI values).
 *
 * Temperature threshold drawn as the dashed reference line on the Ambiance
 * sparklines. One global value for all rooms — change it here.
 */
export const TEMPERATURE_THRESHOLD_C = 26;

/** "Cold" temperature reference (blue line on detail charts). */
export const TEMPERATURE_COLD_C = 20;

/**
 * Reference lines drawn on the detail-page TEMPERATURE history charts: 26° hot
 * (red) and 20° cold (blue). Only shown when within the visible range
 * (`ifOverflow="hidden"`). Shared by /meteo and room detail.
 */
export const TEMP_REFERENCE_LINES: readonly { y: number; color: string }[] = [
  { y: TEMPERATURE_THRESHOLD_C, color: "var(--color-security-alert)" },
  { y: TEMPERATURE_COLD_C, color: "var(--color-accent-shutters)" },
];

/** CO₂ air-quality thresholds (ppm): warn ≥ 1000, alert ≥ 2000. */
export const CO2_WARN_PPM = 1000;
export const CO2_ALERT_PPM = 2000;

/**
 * Reference lines on the detail-page CO₂ history charts: 1000 ppm (orange) and
 * 2000 ppm (red). Only shown when within the visible range.
 */
export const CO2_REFERENCE_LINES: readonly { y: number; color: string }[] = [
  { y: CO2_WARN_PPM, color: "var(--color-accent-lights)" },
  { y: CO2_ALERT_PPM, color: "var(--color-security-alert)" },
];

/** Hours of history shown in the Ambiance temperature sparklines. */
export const SPARKLINE_HOURS = 24;
