import { create } from "zustand";

/**
 * The single "pending" layer for in-flight control intents (AD-11).
 *
 * One entry per `entity_id`, **last-command-wins**, **bounded** by an expiry.
 * It holds ONLY the intention awaiting HA's echo — it is NOT a cache of
 * confirmed entity state (that is forbidden by AD-3; this is AD-11's explicit
 * carve-out). Every Epic 2 control widget shares this one store via
 * `useOptimisticControl`, so two widgets driving the same entity (e.g. a room
 * tile and "Tout éteindre") can never race with competing optimistic overlays.
 *
 * The store lives at module scope (outside the React tree), so an in-flight
 * intent survives a shell remount by construction.
 */
export interface PendingEntry {
  /** Domain-specific desired state (e.g. 'on' | 'off' for a light). */
  readonly target: unknown;
  /** Epoch ms the intent was sent — also the last-command-wins tiebreaker. */
  readonly sentAt: number;
  /** Epoch ms after which the intent is considered timed-out (bounded). */
  readonly expiresAt: number;
}

interface PendingState {
  readonly byId: Readonly<Record<string, PendingEntry>>;
  /** Record (or overwrite — last-command-wins) the in-flight intent for `entityId`. */
  setPending: (
    entityId: string,
    target: unknown,
    timeoutMs: number,
    now?: number,
  ) => void;
  /** Resolve/drop the in-flight intent for `entityId`. */
  clearPending: (entityId: string) => void;
}

export const usePendingStore = create<PendingState>((set) => ({
  byId: {},
  setPending: (entityId, target, timeoutMs, now = Date.now()) =>
    set((state) => ({
      byId: {
        ...state.byId,
        [entityId]: { target, sentAt: now, expiresAt: now + timeoutMs },
      },
    })),
  clearPending: (entityId) =>
    set((state) => {
      if (!(entityId in state.byId)) return state;
      const byId = { ...state.byId };
      delete byId[entityId];
      return { byId };
    }),
}));
