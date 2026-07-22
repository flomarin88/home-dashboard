import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useUndoStore } from "../state/undo";
import { UndoToast } from "./UndoToast";

const reset = () => useUndoStore.setState({ queue: [] });

describe("UndoToast (UX-DR9 / NFR6)", () => {
  beforeEach(reset);
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when there is no active undo", () => {
    const { container } = render(<UndoToast />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the action label + a ≥52px "Annuler" button with a countdown', () => {
    useUndoStore.getState().offer("Tout éteindre", () => {}, 7000);
    render(<UndoToast />);

    expect(screen.getByText("Tout éteindre")).toBeInTheDocument();
    const btn = screen.getByRole("button", { name: /annuler tout éteindre/i });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("min-h-[52px]");
    expect(btn.textContent).toMatch(/Annuler/); // text label, not colour alone
  });

  it('"Annuler" runs the undo closure and closes the toast', () => {
    const undo = vi.fn();
    useUndoStore.getState().offer("Tout éteindre", undo, 7000);
    render(<UndoToast />);

    fireEvent.click(screen.getByRole("button", { name: /annuler/i }));

    expect(undo).toHaveBeenCalledOnce();
    expect(screen.queryByText("Tout éteindre")).not.toBeInTheDocument();
    expect(useUndoStore.getState().queue).toHaveLength(0);
  });

  it("auto-dismisses at the end of the dwell without running undo", () => {
    vi.useFakeTimers();
    const undo = vi.fn();
    render(<UndoToast />);
    act(() => {
      useUndoStore.getState().offer("Tout fermer", undo, 7000);
    });
    expect(screen.getByText("Tout fermer")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(7000 + 50);
    });

    expect(screen.queryByText("Tout fermer")).not.toBeInTheDocument();
    expect(undo).not.toHaveBeenCalled(); // expiry ≠ undo
    expect(useUndoStore.getState().queue).toHaveLength(0);
  });

  it("stacks concurrent toasts; cancelling one leaves the other intact (D1)", () => {
    const undoA = vi.fn();
    const undoB = vi.fn();
    render(<UndoToast />);
    act(() => {
      useUndoStore.getState().offer("Tortues nourries", undoA, 7000);
      useUndoStore.getState().offer("Plantes arrosées", undoB, 7000);
    });

    // Both toasts coexist (no clobber).
    expect(screen.getByText("Tortues nourries")).toBeInTheDocument();
    expect(screen.getByText("Plantes arrosées")).toBeInTheDocument();

    // Cancel only the turtle one.
    fireEvent.click(
      screen.getByRole("button", { name: /annuler tortues nourries/i }),
    );

    expect(undoA).toHaveBeenCalledOnce();
    expect(undoB).not.toHaveBeenCalled();
    expect(screen.queryByText("Tortues nourries")).not.toBeInTheDocument();
    expect(screen.getByText("Plantes arrosées")).toBeInTheDocument(); // survives
  });
});
