import type { ReactNode } from 'react'

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
          <span className="inline-flex w-fit items-center gap-1 rounded-full border border-stale px-2 py-0.5 text-caption text-stale-text">
            <OfflineIcon />
            Hors ligne
          </span>
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

/** Minimal inline "offline" glyph; the "Hors ligne" text is the real cue. */
function OfflineIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 2 L22 22" />
      <path d="M5 12.5a10 10 0 0 1 4-2.4M12 5c2.5 0 4.9.9 6.8 2.5" />
      <path d="M8.5 16a5 5 0 0 1 5-1.3" />
    </svg>
  )
}
