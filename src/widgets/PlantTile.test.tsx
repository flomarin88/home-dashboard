import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlantTile } from "./PlantTile";
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
    last_changed: "2026-07-22T08:00:00Z",
    attributes: {},
  }),
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: hass.connectionStatus }),
  useService: () => ({ increment: hass.increment, decrement: hass.decrement }),
}));

describe("PlantTile (Story 7.1 — top-bar watering, maximum:1)", () => {
  beforeEach(() => {
    hass.state = "0";
    hass.connectionStatus = "connected";
    hass.increment.mockClear();
    hass.decrement.mockClear();
    useUndoStore.setState({ queue: [] });
  });

  it("0 → empty fill, tappable, increments the HA counter", () => {
    render(<PlantTile />);
    const btn = screen.getByRole("button", { name: /à faire.*arroser/i });
    const fill = btn.querySelector("span[aria-hidden]");
    expect(fill?.getAttribute("class") ?? "").toContain("h-0");
    fireEvent.click(btn);
    expect(hass.increment).toHaveBeenCalledWith({
      target: "counter.plantes_arrosees",
    });
  });

  it("tap offers a 5 s undo that decrements the counter on run (misclick net)", () => {
    render(<PlantTile />);
    fireEvent.click(screen.getByRole("button", { name: /arroser/i }));

    const undo = useUndoStore.getState().queue.at(-1);
    expect(undo).not.toBeNull();
    expect(undo!.expiresAt - undo!.offeredAt).toBe(5000);

    useUndoStore.getState().runUndo();
    expect(hass.decrement).toHaveBeenCalledWith({
      target: "counter.plantes_arrosees",
    });
  });

  it("rapid double-tap → increments only once (in-flight guard, counter is not idempotent)", () => {
    render(<PlantTile />);
    const btn = screen.getByRole("button", { name: /arroser/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(hass.increment).toHaveBeenCalledTimes(1);
  });

  it("failed increment releases the in-flight guard so a retry works", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    hass.increment.mockRejectedValueOnce(new Error("network"));
    render(<PlantTile />);
    const btn = screen.getByRole("button", { name: /arroser/i });

    fireEvent.click(btn); // increment rejects → .catch releases the guard
    await Promise.resolve(); // flush the rejection microtask chain
    await Promise.resolve();

    fireEvent.click(btn); // guard released → retry actually writes again
    expect(hass.increment).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("1 → full fill, disabled, no increment on click (done, aria says fait)", () => {
    hass.state = "1";
    render(<PlantTile />);
    const btn = screen.getByRole("button", { name: /arrosage : fait/i });
    expect(btn).toBeDisabled();
    const fill = btn.querySelector("span[aria-hidden]");
    expect(fill?.getAttribute("class") ?? "").toContain("h-full");
    fireEvent.click(btn);
    expect(hass.increment).not.toHaveBeenCalled();
  });

  it("offline → dimmed + non-interactive (AD-6), never hidden", () => {
    hass.connectionStatus = "disconnected";
    render(<PlantTile />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("opacity-60");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(hass.increment).not.toHaveBeenCalled();
  });
});
