import { OfflineIcon } from './OfflineIcon'
import { formatSince } from '../hakit/stale'

/**
 * "Hors ligne" pill — the PRIMARY obsolescence cue (UX-DR10 / AD-6): icon +
 * label, plus "dernière donnée HH:MM" when a timestamp is known. State carried
 * by text + icon, never colour alone. `since` is the raw last_changed (ISO).
 */
export function OfflinePill({ since }: { since?: string }) {
  const time = formatSince(since)
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-stale px-2 py-0.5 text-caption text-stale-text">
      <OfflineIcon />
      Hors ligne{time && ` · dernière donnée ${time}`}
    </span>
  )
}
