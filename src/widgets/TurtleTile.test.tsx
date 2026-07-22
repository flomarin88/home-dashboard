import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TurtleTile } from "./TurtleTile";
import { useUndoStore } from "../state/undo";

const hass = vi.hoisted(() => ({
  state: "0" as string,
  connectionStatus: "connected" as string,
  increment: vi.fn(),
  decrement: vi.fn(),
}));

vi.mock("@hakit/core", () => ({
  useEntity: () => ({
    state: hass.state,
    last_changed: "2026-07-17T08:00:00Z",
    attributes: {},
  }),
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: hass.connectionStatus }),
  useService: () => ({ increment: hass.increment, decrement: hass.decrement }),
}));

describe("TurtleTile (Story 6.3 — top-bar feeding counter)", () => {
  beforeEach(() => {
    hass.state = "0";
    hass.connectionStatus = "connected";
    hass.increment.mockClear();
    hass.decrement.mockClear();
    useUndoStore.setState({ queue: [] });
  });

  it("0 feedings → tappable, increments the HA counter", () => {
    render(<TurtleTile />);
    const btn = screen.getByRole("button", { name: /0 repas sur 2.*nourrir/i });
    fireEvent.click(btn);
    expect(hass.increment).toHaveBeenCalledWith({
      target: "counter.tortues_repas",
    });
  });

  it("tap offers a 5 s undo that decrements the counter on run (misclick net)", () => {
    render(<TurtleTile />);
    fireEvent.click(screen.getByRole("button", { name: /nourrir/i }));

    const undo = useUndoStore.getState().queue.at(-1);
    expect(undo).not.toBeNull();
    expect(undo!.expiresAt - undo!.offeredAt).toBe(5000);

    useUndoStore.getState().runUndo();
    expect(hass.decrement).toHaveBeenCalledWith({
      target: "counter.tortues_repas",
    });
  });

  it("blocked double-tap does not offer a second undo", () => {
    render(<TurtleTile />);
    const btn = screen.getByRole("button", { name: /nourrir/i });
    fireEvent.click(btn);
    const first = useUndoStore.getState().queue.at(-1);
    fireEvent.click(btn);
    // guard returns before offering again → same offer, not a newer one
    expect(useUndoStore.getState().queue.at(-1)).toBe(first);
  });

  it("rapid double-tap → increments only once (in-flight guard, counter is not idempotent)", () => {
    render(<TurtleTile />);
    const btn = screen.getByRole("button", { name: /0 repas sur 2.*nourrir/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(hass.increment).toHaveBeenCalledTimes(1);
  });

  it("1 feeding → half fill, still tappable", () => {
    hass.state = "1";
    render(<TurtleTile />);
    const btn = screen.getByRole("button", { name: /1 repas sur 2/i });
    const fill = btn.querySelector("span[aria-hidden]");
    expect(fill?.getAttribute("class") ?? "").toContain("h-1/2");
    fireEvent.click(btn);
    expect(hass.increment).toHaveBeenCalledWith({
      target: "counter.tortues_repas",
    });
  });

  it("2 feedings → full fill, disabled, no increment on click", () => {
    hass.state = "2";
    render(<TurtleTile />);
    const btn = screen.getByRole("button", { name: /2 repas sur 2/i });
    expect(btn).toBeDisabled();
    const fill = btn.querySelector("span[aria-hidden]");
    expect(fill?.getAttribute("class") ?? "").toContain("h-full");
    fireEvent.click(btn);
    expect(hass.increment).not.toHaveBeenCalled();
  });

  it("offline → dimmed + non-interactive (AD-6), never hidden", () => {
    hass.connectionStatus = "disconnected";
    render(<TurtleTile />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("opacity-60");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(hass.increment).not.toHaveBeenCalled();
  });
});
