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
