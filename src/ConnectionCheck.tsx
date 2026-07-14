import { useHass, useEntity } from '@hakit/core'
import type { EntityName } from '@hakit/core'
import { isConfigured, hassUrl } from './hakit'

/**
 * Throwaway connection-control view (Story 1.1, AC4).
 *
 * Proves the live Home Assistant WebSocket link: it shows the connection
 * status, the number of entities HA has pushed, and the live state of one
 * witness entity. The witness is watched through `useEntity` — @hakit's
 * per-entity reactive primitive — so it re-renders whenever HA pushes a new
 * state for exactly that entity (AD-3: read live, never cached). That
 * self-updating value is the observable proof the WebSocket is live.
 *
 * This is a debug surface, not a product screen — it will be replaced by the
 * real kiosk shell / pages in later stories (1.3+).
 */

// Mirrors @hakit's internal ConnectionStatus union (not exported by the
// package). Typing the label map with it makes a missing/renamed status a
// compile error at the index below, rather than a silent fallthrough.
type ConnectionStatus =
  | 'pending'
  | 'disconnected'
  | 'pending-suspension'
  | 'suspended'
  | 'connected'

const CONNECTED_LABELS: Record<ConnectionStatus, string> = {
  connected: 'Connected',
  pending: 'Connecting…',
  'pending-suspension': 'Suspending…',
  suspended: 'Suspended',
  disconnected: 'Disconnected',
}

export function ConnectionCheck() {
  const connectionStatus = useHass((s) => s.connectionStatus)
  const ready = useHass((s) => s.ready)
  const entities = useHass((s) => s.entities)

  const entityIds = Object.keys(entities)
  const entityCount = entityIds.length

  // Witness entity: explicit override if provided, else first sensor, else
  // first entity. The override is honored verbatim (not silently dropped when
  // absent from the map) so a typo surfaces as "not found" below.
  const witnessOverride = import.meta.env.VITE_HA_WITNESS_ENTITY
  const witnessId =
    witnessOverride ??
    entityIds.find((id) => id.startsWith('sensor.')) ??
    entityIds[0]

  // useEntity subscribes to just this entity (AD-3). returnNullIfNotFound keeps
  // it from throwing while the id is absent/unresolved (incl. the 'unknown'
  // placeholder when there are no entities yet).
  const witness = useEntity((witnessId ?? 'unknown') as EntityName, {
    returnNullIfNotFound: true,
  })
  const overrideMissing = Boolean(witnessOverride) && !witness

  const connected = connectionStatus === 'connected'

  if (!isConfigured) {
    return (
      <main className="mx-auto max-w-lg p-8">
        <h1 className="text-xl font-semibold text-amber-600">
          Not configured
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Set <code className="font-mono">VITE_HA_URL</code> and{' '}
          <code className="font-mono">VITE_HA_TOKEN</code> in a local{' '}
          <code className="font-mono">.env.local</code> file, then restart the
          dev server. See <code className="font-mono">.env.example</code>.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold text-slate-800">
        Home Assistant connection
      </h1>

      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-slate-500">Status</dt>
        <dd className="flex items-center gap-2 font-medium">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              connected ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            aria-hidden
          />
          {CONNECTED_LABELS[connectionStatus] ?? connectionStatus}
          {ready ? ' · ready' : ''}
        </dd>

        <dt className="text-slate-500">HA URL</dt>
        <dd className="font-mono text-xs break-all text-slate-700">
          {hassUrl}
        </dd>

        <dt className="text-slate-500">Entities</dt>
        <dd className="font-medium tabular-nums">{entityCount}</dd>

        <dt className="text-slate-500">Witness</dt>
        <dd>
          {witness ? (
            <div className="font-mono text-xs text-slate-700">
              <div className="break-all">{witness.entity_id}</div>
              <div className="mt-1 text-sm text-slate-900">
                = <span className="font-semibold">{witness.state}</span>
              </div>
              <div className="mt-0.5 text-slate-400">
                updated {witness.last_changed}
              </div>
            </div>
          ) : overrideMissing ? (
            <span className="text-amber-600">
              entity{' '}
              <code className="font-mono">{witnessOverride}</code> not found
            </span>
          ) : (
            <span className="text-slate-400">— (no entities yet)</span>
          )}
        </dd>
      </dl>
    </main>
  )
}
