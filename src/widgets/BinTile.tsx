import { useEffect, useState } from 'react'
import { useService } from '@hakit/core'
import type { EntityName } from '@hakit/core'
import { binsConfig } from '../entities'
import { useEntityValue } from '../hakit/useEntityValue'
import { binView, haDateTime } from './bin-state'
import type { BinColor } from './bin-state'

/**
 * BinIndicator (Story 6.1) — the bin-out reminder, a compact icon in the TOP BAR.
 * Reflects `sensor.poubelle_a_sortir` (schedule + oubli logic live in HA, AD-4):
 * shows a coloured poubelle icon only while a bin is due (jaune/noire) or missed
 * (rouge), hidden otherwise. Tapping writes `now` to the bin's `input_datetime`
 * (`set_datetime`, HA service only) and hides it (optimistic).
 *
 * It NEEDS HA (`useEntity`) so it must live UNDER the provider — but the TopBar is
 * ABOVE the connection gate (TD-1). So it's mounted inside `HakitProvider`
 * (KioskShell) and `fixed`-positioned into the top-bar area (like UndoToast).
 */
const COLOR: Record<BinColor, string> = {
  jaune: 'text-yellow-400',
  noire: 'text-neutral-400', // "noire" bin, lightened for contrast on the dark ground
  rouge: 'text-security-alert',
  idle: 'text-text-muted',
}

const ARIA: Record<BinColor, string> = {
  jaune: 'Poubelle jaune à sortir',
  noire: 'Poubelle noire à sortir',
  rouge: 'Poubelle oubliée — à sortir',
  idle: '',
}

export function BinTile() {
  const cfg = binsConfig()
  const { value, isStale } = useEntityValue(cfg.stateEntityId as EntityName)
  const svc = useService('input_datetime')
  const [justDone, setJustDone] = useState(false)
  // Clear the optimistic flag once HA echoes a new sensor state.
  useEffect(() => setJustDone(false), [value])

  const view = binView(value)

  // Present only when there's a bin to deal with (active or oubli), online, and
  // not just marked done. Absent otherwise — an optional top-bar hint.
  if (isStale || view.bin == null || justDone) return null

  const mark = () => {
    if (!view.bin) return
    setJustDone(true)
    svc.setDatetime({
      target: cfg.sortie[view.bin],
      serviceData: { datetime: haDateTime(new Date()) },
    })
  }

  return (
    <button
      type="button"
      onClick={mark}
      aria-label={`${ARIA[view.color]} — marquer sortie`}
      className="fixed left-1/2 top-5 z-40 inline-flex min-h-[56px] min-w-[56px] -translate-x-1/2 items-center justify-center gap-1 rounded-md border border-tile-border bg-tile-fill px-3 backdrop-blur-glass"
    >
      <PoubelleIcon className={COLOR[view.color]} />
      {view.color === 'rouge' ? (
        <span aria-hidden className="text-caption font-bold text-security-alert">
          !
        </span>
      ) : null}
    </button>
  )
}

function PoubelleIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      width="36"
      height="36"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}
