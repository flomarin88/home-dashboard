import { describe, it, expect, vi, beforeEach } from "vitest";
import { useUndoStore, buildUndo, offerUndo, undoCountdown } from "./undo";
import type { EntitySnapshot } from "./undo";

const reset = () => useUndoStore.setState({ current: null });

describe("undo store (NFR6)", () => {
  beforeEach(reset);

  it("offers a bounded undoable action keyed to a monotonic id", () => {
    const id = useUndoStore
      .getState()
      .offer("Tout éteindre", () => {}, 7000, 1000);
    const cur = useUndoStore.getState().current;
    expect(cur).toMatchObject({
      id,
      label: "Tout éteindre",
      offeredAt: 1000,
      expiresAt: 8000,
    });
  });

  it("last-wins: a second offer replaces the first (one active toast)", () => {
    useUndoStore.getState().offer("Tout éteindre", () => {}, 7000, 1000);
    const id2 = useUndoStore
      .getState()
      .offer("Tout fermer", () => {}, 7000, 2000);
    expect(useUndoStore.getState().current?.id).toBe(id2);
    expect(useUndoStore.getState().current?.label).toBe("Tout fermer");
  });

  it("ids are monotonic (not wall-clock), so distinct offers never collide", () => {
    const a = useUndoStore.getState().offer("A", () => {}, 7000, 1000);
    const b = useUndoStore.getState().offer("B", () => {}, 7000, 1000);
    expect(b).toBe(a + 1);
  });

  it("runUndo runs the closure then clears the toast", () => {
    const undo = vi.fn();
    useUndoStore.getState().offer("Tout éteindre", undo, 7000, 1000);
    useUndoStore.getState().runUndo();
    expect(undo).toHaveBeenCalledOnce();
    expect(useUndoStore.getState().current).toBeNull();
  });

  it("runUndo clears the toast even if the undo closure throws (error still surfaces)", () => {
    useUndoStore.getState().offer(
      "boom",
      () => {
        throw new Error("x");
      },
      7000,
      1000,
    );
    expect(() => useUndoStore.getState().runUndo()).toThrow("x");
    expect(useUndoStore.getState().current).toBeNull(); // not wedged
  });

  it("dismiss(id) does not clear a newer offer", () => {
    const old = useUndoStore.getState().offer("old", () => {}, 7000, 1000);
    useUndoStore.getState().offer("new", () => {}, 7000, 2000);
    useUndoStore.getState().dismiss(old);
    expect(useUndoStore.getState().current?.label).toBe("new"); // untouched
  });

  it("offerUndo is the shared entry point (writes to the store)", () => {
    const undo = vi.fn();
    offerUndo("Désarmer", undo);
    expect(useUndoStore.getState().current?.label).toBe("Désarmer");
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
