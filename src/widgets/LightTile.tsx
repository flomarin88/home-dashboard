import type { EntityName } from '@hakit/core'
import type { EntityEntry } from '../entities'
import { getRoom } from '../entities'
import { useOptimisticControl } from '../hakit/useOptimisticControl'
import { lightModel } from '../state/control-model'
import { DeviceTile } from '../ui/DeviceTile'

/**
 * LightTile (FR2, UX-DR2) — the first control widget, and the vertical slice
 * that exercises the Epic 2 control infra end-to-end via `useOptimisticControl`
 * + `lightModel` (Story 2.1): a tap flips on/off optimistically (<200ms) then
 * converges on HA's echo (AD-5/AD-11), and an offline entity (`isStale`) renders
 * a non-interactive "Hors ligne" tile — you can't command what you can't see
 * (AD-6, obsolescence primitive shared with Story 1.6's `isStale`).
 *
 * It only dresses `DeviceTile` (Story 1.2) with state; the accent (ambre) comes
 * from `domain="lights"`. `entity_id` comes from the central mapping (AD-7).
 */
export function LightTile({ entry }: { entry: EntityEntry }) {
  const id = entry.entityId as EntityName
  const room = getRoom(entry.room)
  const { displayState, send, isStale, failed } = useOptimisticControl(id, lightModel)

  if (isStale) {
    return (
      <DeviceTile domain="lights" label={room.label} state="stale" kid={room.kid} />
    )
  }

  const on = displayState === 'on'
  // A timed-out command surfaces "Échec" (text, not colour alone) instead of a
  // silent snap-back (Story 2.2, closes the 2.1 review finding). Still pressable
  // — the next tap retries and clears `failed`.
  return (
    <DeviceTile
      domain="lights"
      label={room.label}
      state={on ? 'on' : 'default'}
      value={failed ? 'Échec' : on ? 'Allumé' : 'Éteint'}
      kid={room.kid}
      onPress={() => send(on ? 'off' : 'on')}
    />
  )
}
