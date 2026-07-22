import { describe, it, expect, vi, beforeEach } from "vitest";
import { useUndoStore, buildUndo, offerUndo, undoCountdown } from "./undo";
import type { EntitySnapshot } from "./undo";

const reset = () => useUndoStore.setState({ queue: [] });
const queue = () => useUndoStore.getState().queue;

describe("undo store (NFR6)", () => {
  beforeEach(reset);

  it("offers a bounded undoable action keyed to a monotonic id", () => {
    const id = useUndoStore
      .getState()
      .offer("Tout éteindre", () => {}, 7000, 1000);
    expect(queue()).toHaveLength(1);
    expect(queue()[0]).toMatchObject({
      id,
      label: "Tout éteindre",
      offeredAt: 1000,
      expiresAt: 8000,
    });
  });

  it("concurrent offers coexist in the queue (a later offer no longer clobbers the first — D1)", () => {
    const id1 = useUndoStore
      .getState()
      .offer("Tout éteindre", () => {}, 7000, 1000);
    const id2 = useUndoStore
      .getState()
      .offer("Tout fermer", () => {}, 7000, 2000);
    expect(queue().map((u) => u.id)).toEqual([id1, id2]); // both, oldest first
    expect(queue().map((u) => u.label)).toEqual([
      "Tout éteindre",
      "Tout fermer",
    ]);
  });

  it("ids are monotonic (not wall-clock), so distinct offers never collide", () => {
    const a = useUndoStore.getState().offer("A", () => {}, 7000, 1000);
    const b = useUndoStore.getState().offer("B", () => {}, 7000, 1000);
    expect(b).toBe(a + 1);
  });

  it("runUndo() runs the most recent closure then removes it", () => {
    const undo = vi.fn();
    useUndoStore.getState().offer("Tout éteindre", undo, 7000, 1000);
    useUndoStore.getState().runUndo();
    expect(undo).toHaveBeenCalledOnce();
    expect(queue()).toHaveLength(0);
  });

  it("runUndo(id) targets a specific action, leaving the others queued", () => {
    const undoA = vi.fn();
    const undoB = vi.fn();
    const idA = useUndoStore.getState().offer("A", undoA, 7000, 1000);
    useUndoStore.getState().offer("B", undoB, 7000, 2000);
    useUndoStore.getState().runUndo(idA);
    expect(undoA).toHaveBeenCalledOnce();
    expect(undoB).not.toHaveBeenCalled();
    expect(queue().map((u) => u.label)).toEqual(["B"]); // B still undoable
  });

  it("runUndo removes the action even if the undo closure throws (error still surfaces)", () => {
    useUndoStore.getState().offer(
      "boom",
      () => {
        throw new Error("x");
      },
      7000,
      1000,
    );
    expect(() => useUndoStore.getState().runUndo()).toThrow("x");
    expect(queue()).toHaveLength(0); // not wedged
  });

  it("dismiss(id) removes only that action, never a sibling", () => {
    const old = useUndoStore.getState().offer("old", () => {}, 7000, 1000);
    useUndoStore.getState().offer("new", () => {}, 7000, 2000);
    useUndoStore.getState().dismiss(old);
    expect(queue().map((u) => u.label)).toEqual(["new"]); // untouched
  });

  it("dismiss of an already-gone id is an idempotent no-op", () => {
    const id = useUndoStore.getState().offer("a", () => {}, 7000, 1000);
    useUndoStore.getState().dismiss(id);
    const before = queue();
    useUndoStore.getState().dismiss(id); // second dismiss
    expect(queue()).toBe(before); // same reference — no state churn
  });

  it("offerUndo is the shared entry point (writes to the store)", () => {
    const undo = vi.fn();
    offerUndo("Désarmer", undo);
    expect(queue().at(-1)?.label).toBe("Désarmer");
  });
});

describe("buildUndo (snapshot → restoration)", () => {
  it("re-applies every snapshot entry to its prior confirmed state", () => {
    const snapshots: EntitySnapshot[] = [
      { entityId: "light.salon", priorState: "on" },
      { entityId: "light.cuisine", priorState: "off" },
    ];
    const reapply = vi.fn();
    const undo = buildUndo(snapshots, reapply);

    undo();

    expect(reapply).toHaveBeenCalledTimes(2);
    expect(reapply).toHaveBeenNthCalledWith(1, "light.salon", "on");
    expect(reapply).toHaveBeenNthCalledWith(2, "light.cuisine", "off");
  });

  it("continues restoring the rest after one entity fails (best-effort)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const restored: string[] = [];
    const reapply = (id: string) => {
      if (id === "b") throw new Error("boom");
      restored.push(id);
    };
    const undo = buildUndo(
      [
        { entityId: "a", priorState: "on" },
        { entityId: "b", priorState: "off" },
        { entityId: "c", priorState: "on" },
      ],
      reapply,
    );

    expect(() => undo()).not.toThrow();
    expect(restored).toEqual(["a", "c"]); // b failed, a and c still restored
    warn.mockRestore();
  });
});

describe("undoCountdown (clamped display)", () => {
  it("computes fraction + seconds within the window", () => {
    expect(undoCountdown(1000, 8000, 4500)).toEqual({
      fraction: 0.5,
      secondsLeft: 4,
    });
  });

  it("clamps a now that predates the offer (mount-time seed drift) — no flash", () => {
    const c = undoCountdown(1_000_000, 1_007_000, 0);
    expect(c.fraction).toBe(1); // never over 100%
    expect(c.secondsLeft).toBe(7); // never above the dwell
  });

  it("clamps an expired window to zero", () => {
    expect(undoCountdown(1000, 8000, 9000)).toEqual({
      fraction: 0,
      secondsLeft: 0,
    });
  });
});
