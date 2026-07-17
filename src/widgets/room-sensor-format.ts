import { CO2_WARN_PPM, CO2_ALERT_PPM } from '../config'

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
  if (state === null || state === undefined || state === '') return '—'
  const n = Number(state)
  if (!Number.isFinite(n)) return '—'
  return n.toFixed(decimals)
}

/**
 * CO₂ air-quality colour (ppm): green < 1000, orange 1000–2000, red ≥ 2000.
 * Non-numeric/absent → neutral text. Thresholds from `config` (CO2_WARN/ALERT).
 */
export function co2ColorClass(
  state: string | number | null | undefined,
): string {
  const n = Number(state)
  if (state === null || state === undefined || state === '' || !Number.isFinite(n))
    return 'text-text'
  if (n < CO2_WARN_PPM) return 'text-security-ok'
  if (n < CO2_ALERT_PPM) return 'text-accent-lights'
  return 'text-security-alert'
}
