import type { ReactNode } from 'react'
import { OfflinePill } from './OfflinePill'

export type DeviceDomain =
  | 'lights'
  | 'shutters'
  | 'climate'
  | 'vacuum'
  | 'security'

export type DeviceTileState = 'default' | 'on' | 'stale'

/**
 * DeviceTile — the base device control tile (Story 1.2, UX-DR2), 4 states:
 *   default · on (accent tint + glow) · stale · kid (taller target).
 *
 * The accent is keyed to `domain` through a single mechanism: `data-domain`
 * sets `--tile-accent` in CSS and the "on" state derives its tint/border/glow
 * from it (see index.css). No dynamically-built Tailwind class names.
 *
 * A11y floor (NFR2 / UX-DR14): the whole tile is a ≥74px (≥92px kid) target;
 * state is carried by TEXT + ICON, never colour alone — the "on" state changes
 * the state text, and the stale state shows a "Hors ligne" pill (icon + label)
 * as the PRIMARY cue, the dashed border being secondary.
 *
 * This renders the visual `stale` state on demand; it contains NO obsolescence
 * detection logic (that is Story 1.6).
 */
export function DeviceTile({
  domain,
  label,
  value,
  state = 'default',
  kid = false,
  icon,
  onPress,
}: {
  domain: DeviceDomain
  label: string
  /** State/value text (e.g. "Allumé", "72 %"). Carries state, not colour alone. */
  value?: ReactNode
  state?: DeviceTileState
  kid?: boolean
  icon?: ReactNode
  onPress?: () => void
}) {
  const stale = state === 'stale'
  const interactive = Boolean(onPress)

  // Per-state visuals (on tint/glow, stale dashed border + muted colors) are
  // driven by unlayered `.device-tile[data-state='…']` CSS, which wins the
  // cascade deterministically — do NOT add state color utilities here, they
  // conflict with the base ones and lose on source order.
  const classes = [
    'device-tile flex flex-col justify-between gap-2 rounded-md border px-4 py-3 text-left',
    'bg-tile-fill border-tile-border text-text transition-shadow',
    kid ? 'min-h-tile-h-kid' : 'min-h-tile-h',
    interactive ? 'cursor-pointer' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const body = (
    <>
      <div className="flex items-center gap-2">
        {icon}
        <span
          className={
            kid ? 'text-title font-bold' : 'text-label font-semibold'
          }
        >
          {label}
        </span>
      </div>

      {stale ? (
        <div className="flex items-center gap-2">
          {/* '—' placeholder (DESIGN) + "Hors ligne" pill as the PRIMARY cue */}
          <span className="text-meta tabular-nums">—</span>
          <OfflinePill />
        </div>
      ) : (
        <span className="device-tile__state text-meta tabular-nums text-text-muted">
          {value ?? '—'}
        </span>
      )}
    </>
  )

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onPress}
        data-domain={domain}
        data-state={state}
        className={classes}
      >
        {body}
      </button>
    )
  }

  return (
    <div data-domain={domain} data-state={state} className={classes}>
      {body}
    </div>
  )
}
