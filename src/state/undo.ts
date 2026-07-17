import { create } from "zustand";

/**
 * The single "undo" layer for high-impact actions (NFR6, UX-DR9) — the safety
 * net that lets a mistaken group action ("Tout éteindre", "Tout fermer",
 * "Désarmer", a scene apply — including an accidental kid tap) be reverted for a
 * few seconds. One active undoable at a time, last-wins, bounded by a dwell.
 *
 * It holds ONLY the transient undo offer (an ephemeral UI concern, AD-1) — the
 * captured prior state lives inside the `undo` closure the caller builds. It is
 * NOT a cache of confirmed state (AD-3) and does NOT touch HA (the toast renders
 * outside the connection gate); the caller's `undo` closure is what re-applies
 * state via HA services through the pending layer (AD-4/AD-11).
 *
 * Module-level (outside the React tree), consistent with the pending store (2.1).
 */
export interface UndoableAction {
  readonly id: number;
  readonly label: string;
  readonly undo: () => void;
  readonly offeredAt: number;
  readonly expiresAt: number;
}

/** One entity's confirmed state before a high-impact action, for restoration. */
export interface EntitySnapshot {
  readonly entityId: string;
  readonly priorState: string;
}

interface UndoState {
  readonly current: UndoableAction | null;
  /** Register an undoable action (last-wins). Returns its id. */
  offer: (
    label: string,
    undo: () => void,
    dwellMs?: number,
    now?: number,
  ) => number;
  /** Clear the toast. With `id`, only if it still matches (never clears a newer offer). */
  dismiss: (id?: number) => void;
  /** Run the active undo closure then clear. */
  runUndo: () => void;
}

// Monotonic id — NOT Date.now() (review lesson from 2.1: a wall-clock value is
// not a reliable unique/tiebreaker token).
let nextId = 1;

export const useUndoStore = create<UndoState>((set, get) => ({
  current: null,
  offer: (label, undo, dwellMs = 7000, now = Date.now()) => {
    const id = nextId++;
    set({
      current: { id, label, undo, offeredAt: now, expiresAt: now + dwellMs },
    });
    return id;
  },
  dismiss: (id) =>
    set((s) => {
      if (s.current == null) return s;
      if (id != null && s.current.id !== id) return s; // a newer offer replaced it
      return { current: null };
    }),
  runUndo: () => {
    const cur = get().current;
    if (!cur) return;
    // Always clear the toast, even if the undo closure throws — otherwise the
    // safety-net UI wedges and the error escapes the click handler uncaught.
    try {
      cur.undo();
    } finally {
      set({ current: null });
    }
  },
}));

/**
 * Build an undo closure from a captured snapshot: on run, re-apply each entity
 * to its prior confirmed state. The caller supplies HOW to re-apply one entity
 * (`reapply`) — typically `usePendingStore.setPending(...)` + an HA service call
 * (see Dev Notes) — so this stays HA-agnostic and pure.
 */
export function buildUndo(
  snapshots: readonly EntitySnapshot[],
  reapply: (entityId: string, priorState: string) => void,
): () => void {
  return () => {
    // Best-effort restore: one entity failing to re-apply must not abort the
    // revert of the rest of a group action.
    for (const s of snapshots) {
      try {
        reapply(s.entityId, s.priorState);
      } catch (err) {
        console.warn(`undo: failed to restore ${s.entityId}`, err);
      }
    }
  };
}

/**
 * Countdown display values for the toast, clamped to `[0, total]` so a `now`
 * that predates the offer (e.g. the toast's mount-time seed on a long-running
 * kiosk) can never flash a nonsensical seconds value or an over-100% bar.
 */
export function undoCountdown(
  offeredAt: number,
  expiresAt: number,
  now: number,
): { fraction: number; secondsLeft: number } {
  const total = expiresAt - offeredAt;
  const remaining = Math.min(total, Math.max(0, expiresAt - now));
  return {
    fraction: total > 0 ? remaining / total : 0,
    secondsLeft: Math.ceil(remaining / 1000),
  };
}

/**
 * The single entry point for offering an undo (AD: every Epic 2+ high-impact
 * trigger calls this — master light 2.3, "Tout fermer" 2.5, "Désarmer" 4.1,
 * scenes 3.1 — no duplicated undo logic).
 */
export function offerUndo(
  label: string,
  undo: () => void,
  dwellMs?: number,
): number {
  return useUndoStore.getState().offer(label, undo, dwellMs);
}
