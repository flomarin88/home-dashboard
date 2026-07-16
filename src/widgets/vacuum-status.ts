/**
 * Maps a HA vacuum state to a readable French status label (UX-DR17, Voice FR).
 * Unknown states fall through to the raw value rather than hiding information.
 */
const LABELS: Readonly<Record<string, string>> = {
  cleaning: 'En ménage',
  docked: 'En charge',
  returning: 'Retour à la base',
  paused: 'En pause',
  idle: 'Arrêté',
  error: 'Erreur',
}

export function vacuumStatusLabel(state: string | null): string {
  if (state == null) return '—'
  return LABELS[state] ?? state
}

/** Parse a battery sensor state ("100") to a number, or null if not numeric. */
export function parseBattery(state: string | null | undefined): number | null {
  if (state == null) return null
  const n = Number(state)
  return Number.isFinite(n) ? n : null
}

/** Battery colour by level (token utility class): green ≥50, amber ≥20, red <20. */
export function batteryColorClass(level: number | null): string {
  if (level == null) return 'text-text-muted'
  if (level >= 50) return 'text-security-ok'
  if (level >= 20) return 'text-accent-lights'
  return 'text-security-alert'
}
