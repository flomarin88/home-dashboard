import { useRef } from 'react'
import { useEntity, useHass } from '@hakit/core'
import type { EntityName } from '@hakit/core'
import { isStale } from './stale'

export interface EntityValue {
  /** Current state, or the last-known value when stale (null if never seen). */
  readonly value: string | null
  readonly unit: string | undefined
  readonly isStale: boolean
  /** last_changed (ISO) of the last-known good value, for "dernière donnée HH:MM". */
  readonly since: string | undefined
}

/**
 * The single per-entity obsolescence read (AD-6). Wraps `@hakit` and adds:
 *  - stale detection (socket-independent — see isStale);
 *  - the last-known good value, held in an ephemeral ref (NOT a persistent
 *    cache — this is AD-6's carve-out over AD-3).
 * Reused by every data/control widget so the offline behaviour is uniform.
 */
export function useEntityValue(entityId: EntityName): EntityValue {
  const entity = useEntity(entityId, { returnNullIfNotFound: true })
  const connected = useHass((s) => s.connectionStatus) === 'connected'
  const lastGood = useRef<{ value: string; since: string } | null>(null)

  const raw = entity?.state ?? null
  const rawIsReal = raw != null && raw !== 'unavailable' && raw !== 'unknown'
  const stale = isStale(raw, connected)

  // Remember the last non-stale value in-session (ephemeral, no persistence).
  if (!stale && rawIsReal) {
    lastGood.current = { value: raw, since: entity?.last_changed ?? '' }
  }

  // When stale, prefer the remembered value; on socket loss the entity is
  // frozen at a still-real state, so fall back to that.
  const frozen = rawIsReal ? { value: raw, since: entity?.last_changed ?? '' } : null
  const known = lastGood.current ?? frozen

  return {
    value: stale ? (known?.value ?? null) : raw,
    unit: entity?.attributes?.unit_of_measurement,
    isStale: stale,
    since: known?.since,
  }
}
