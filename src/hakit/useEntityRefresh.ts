import { useCallback, useEffect, useRef, useState } from "react";
import { useHass } from "@hakit/core";

/**
 * On-demand freshness for an entity whose background polling is switched off
 * HA-side (Story 11.1, AD-18). The entity itself stays an ordinary pushed
 * `sensor.*` read through `useEntityValue` (AD-6) — this hook only owns the
 * TRIGGER and the wait around it.
 *
 * It is deliberately NOT `useOptimisticControl`: that hook converges towards a
 * known target state (`T extends string`) and `isConverged` decides when the
 * write landed. A refresh has no target — "the same value as before" is a
 * perfectly legitimate answer — so convergence is undecidable and its timeout
 * would flag a failure every single time.
 *
 * Two ways out of the wait, and BOTH are needed:
 *  - `settleKey` changes → a new state landed, settle immediately;
 *  - the guard delay elapses → settle anyway. HA suppresses `state_changed`
 *    when state and attributes are unchanged (it fires `state_reported`
 *    instead, which the entity subscription does not surface), and unchanged
 *    traffic is the NOMINAL case. Without the guard the tile would wait forever
 *    on the very outcome it exists to show.
 */

/**
 * 12 s: above the 10 s floor of HA's coordinator debouncer
 * (`REQUEST_REFRESH_DEFAULT_COOLDOWN`), which batches a second request behind
 * the first. A shorter guard would settle before a double tap could answer.
 */
export const REFRESH_GUARD_MS = 12_000;

export interface EntityRefresh {
  /** Ask HA to refresh the entity now. Safe to call while already pending. */
  readonly refresh: () => void;
  /** A refresh is in flight — neither settled nor rejected yet. */
  readonly pending: boolean;
  /** The last call was rejected by the transport. */
  readonly failed: boolean;
  /** Epoch ms of the last refresh that SETTLED, or null if none this session. */
  readonly requestedAt: number | null;
}

export function useEntityRefresh(
  entityId: string,
  /** Any value that changes when the entity's state does (e.g. `value|since`). */
  settleKey: string,
  guardMs: number = REFRESH_GUARD_MS,
): EntityRefresh {
  const callService = useHass((s) => s.helpers.callService);

  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [requestedAt, setRequestedAt] = useState<number | null>(null);

  // Bookkeeping refs — none of these should trigger a render.
  const requestSeq = useRef(0);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPending = useRef(false);
  const askedAt = useRef<number | null>(null);
  const lastSettleKey = useRef(settleKey);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimer();
    };
  }, [clearTimer]);

  const settle = useCallback(() => {
    clearTimer();
    isPending.current = false;
    setPending(false);
    // The stamp is the time of the REQUEST, not of the answer: HA may well have
    // replied with the same number, leaving `last_changed` frozen. What the
    // user needs to know is when we last asked.
    setRequestedAt(askedAt.current);
  }, [clearTimer]);

  const refresh = useCallback(() => {
    const seq = ++requestSeq.current;
    const at = Date.now();
    askedAt.current = at;
    isPending.current = true;
    setPending(true);
    setFailed(false);
    clearTimer();

    timer.current = setTimeout(() => {
      if (!alive.current || seq !== requestSeq.current) return;
      settle();
    }, guardMs);

    // No `returnResponse`: `homeassistant.update_entity` is registered without
    // `supports_response`, i.e. `SupportsResponse.NONE`, and for that level the
    // parameter MUST be absent — passing it makes HA refuse the call. So the
    // return is `void` and failure detection is best-effort, exactly like the
    // ritual tiles (`BinTile`). Losing the socket needs no detection here:
    // `isStale` already turns the tile to "Indisponible" on `connectionStatus`.
    void Promise.resolve(
      callService({
        domain: "homeassistant",
        service: "update_entity",
        target: { entity_id: entityId },
      }),
    ).catch((err: unknown) => {
      console.warn("trafic: homeassistant.update_entity failed", err);
      if (!alive.current || seq !== requestSeq.current) return;
      clearTimer();
      isPending.current = false;
      setPending(false);
      setFailed(true);
    });
  }, [callService, clearTimer, entityId, guardMs, settle]);

  // A new state landed. Only meaningful while a tap is in flight — a background
  // push must not fabricate a freshness stamp for a refresh nobody asked for.
  useEffect(() => {
    if (lastSettleKey.current === settleKey) return;
    lastSettleKey.current = settleKey;
    if (!isPending.current) return;
    settle();
  }, [settleKey, settle]);

  return { refresh, pending, failed, requestedAt };
}
