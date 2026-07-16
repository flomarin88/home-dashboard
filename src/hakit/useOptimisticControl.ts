import { useCallback, useEffect, useRef, useState } from 'react'
import { useEntity, useHass } from '@hakit/core'
import type { AllDomains, EntityName, HassEntityWithService } from '@hakit/core'
import { usePendingStore } from '../state/pending'
import { isStale } from './stale'
import type { ControlModel } from '../state/control-model'

export interface OptimisticControl<T extends string> {
  /**
   * State to render: the optimistic target while a non-transitional intent is
   * in flight, otherwise the confirmed HA state (null if never seen).
   */
  readonly displayState: string | null
  /** An intent is in flight (awaiting HA convergence). */
  readonly isPending: boolean
  /** Confirmed state is a legitimate in-progress state for this domain (AD-5). */
  readonly isTransitional: boolean
  /** Entity is offline (socket lost or unavailable/unknown) — cannot be commanded (AD-6). */
  readonly isStale: boolean
  /** Last intent timed out without converging → reverted to confirmed (AD-5). */
  readonly failed: boolean
  /** Apply an intent: optimistic display now + HA service call, then converge. */
  send: (target: T) => void
}

/**
 * The single optimistic-control primitive for Epic 2 (AD-5 + AD-11), the
 * write-side counterpart to `useEntityValue` (read-side, AD-6). A control widget
 * supplies its entity id and a per-domain `ControlModel`; this hook:
 *
 *  1. on `send`, writes the intent to the shared pending layer (AD-11) and calls
 *     the HA service (AD-4) — the optimistic display flips immediately (<200ms,
 *     NFR1), before HA echoes;
 *  2. converges on the HA echo — target reached ⇒ resolve; a transitional state
 *     keeps the intent alive (not a failure); otherwise wait;
 *  3. on timeout, re-checks the live state: converged ⇒ resolve; still
 *     transitional ⇒ leave in flight (AD-5); otherwise drop the intent and
 *     signal `failed`, letting the display fall back to the confirmed state.
 *
 * Offline precedence (AD-6): a stale entity cannot be commanded — `send` is a
 * no-op — so no optimistic overlay is ever shown on an entity we can't see.
 *
 * It never caches confirmed state (AD-3) and never runs automation logic (AD-4).
 */
export function useOptimisticControl<D extends AllDomains, T extends string>(
  entityId: EntityName,
  model: ControlModel<D, T>,
): OptimisticControl<T> {
  const entity = useEntity(entityId, { returnNullIfNotFound: true })
  const connected = useHass((s) => s.connectionStatus) === 'connected'
  const pending = usePendingStore((s) => s.byId[entityId])
  const setPending = usePendingStore((s) => s.setPending)
  const clearPending = usePendingStore((s) => s.clearPending)
  const [failed, setFailed] = useState(false)
  // The sentAt of the intent THIS hook instance last issued, so unmount cleanup
  // only clears its own in-flight intent (never a sibling's / a newer one's).
  const ownSentAt = useRef<number | null>(null)

  const confirmedState = entity?.state ?? null
  const stale = isStale(confirmedState, connected)

  // Convergence (AD-5): resolve the intent once the confirmed state reaches the
  // target. Transitional / not-yet-there states are left pending for the timeout.
  useEffect(() => {
    if (!pending || confirmedState == null) return
    if (model.isConverged(pending.target as T, confirmedState)) {
      clearPending(entityId)
      setFailed(false)
    }
  }, [pending, confirmedState, entityId, model, clearPending])

  // Timeout (AD-5): at the deadline, re-check the LIVE confirmed state — a state
  // that just converged is not a failure, and a legitimately transitional state
  // (cover opening/closing, clim target≠current) is not a failure either. Only a
  // genuinely stuck intent is dropped + signalled. Re-reads the live store so a
  // newer `send` that replaced this intent is never failed.
  useEffect(() => {
    if (!pending) return
    const delay = Math.max(0, pending.expiresAt - Date.now())
    const timer = setTimeout(() => {
      const current = usePendingStore.getState().byId[entityId]
      if (!current || current.sentAt !== pending.sentAt) return
      if (confirmedState != null) {
        if (model.isConverged(current.target as T, confirmedState)) {
          clearPending(entityId)
          setFailed(false)
          return
        }
        // Still legitimately in progress — keep the intent; the convergence
        // effect resolves it when the device finally reaches the target.
        if (model.isTransitional?.(confirmedState)) return
      }
      clearPending(entityId)
      setFailed(true)
    }, delay)
    return () => clearTimeout(timer)
  }, [pending, entityId, clearPending, model, confirmedState])

  // Drop our own in-flight intent on unmount so it never orphans in the module
  // store (which would fast-fail / flash on a later remount).
  useEffect(
    () => () => {
      const own = ownSentAt.current
      if (own == null) return
      const current = usePendingStore.getState().byId[entityId]
      if (current && current.sentAt === own) {
        usePendingStore.getState().clearPending(entityId)
      }
    },
    [entityId],
  )

  const send = useCallback(
    (target: T) => {
      // Offline precedence (AD-6): never command an entity we can't see.
      if (!entity || stale) return
      setFailed(false)
      const now = Date.now()
      setPending(entityId, target, model.timeoutMs, now)
      ownSentAt.current = now
      // The mapping (AD-7) guarantees the model's domain matches this entity's
      // domain; @hakit can't prove it from the broad EntityName type, hence this
      // one localized cast (widen through unknown — the two domain unions don't
      // overlap structurally).
      model.apply(entity as unknown as HassEntityWithService<D>, target)
    },
    [entity, stale, entityId, model, setPending],
  )

  const isPending = Boolean(pending)
  const isTransitional =
    confirmedState != null && (model.isTransitional?.(confirmedState) ?? false)
  const displayState =
    pending && isPending && !isTransitional
      ? (pending.target as T)
      : confirmedState

  return { displayState, isPending, isTransitional, isStale: stale, failed, send }
}
