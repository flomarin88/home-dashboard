import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";

const state = vi.hoisted(() => ({
  connectionStatus: "connected" as string,
  value: "34.2" as string,
  lastChanged: "2026-07-30T06:00:00Z",
  callService: vi.fn(),
}));

vi.mock("@hakit/core", () => ({
  useEntity: () => ({
    state: state.value,
    last_changed: state.lastChanged,
    attributes: { unit_of_measurement: "min" },
  }),
  useHass: (
    selector: (s: {
      connectionStatus: string;
      helpers: { callService: unknown };
    }) => unknown,
  ) =>
    selector({
      connectionStatus: state.connectionStatus,
      helpers: { callService: state.callService },
    }),
}));

import { TrafficTile } from "./TrafficTile";

/** 2026-07-30T06:14:00Z → 08:14 in Europe/Paris (the suite's pinned TZ). */
const NOW = Date.UTC(2026, 6, 30, 6, 14);

beforeEach(() => {
  state.connectionStatus = "connected";
  state.value = "34.2";
  state.lastChanged = "2026-07-30T06:00:00Z";
  state.callService.mockReset();
  state.callService.mockResolvedValue(undefined);
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function tile() {
  return screen.getByRole("button");
}

describe("TrafficTile (Story 11.1)", () => {
  it("shows a call to action and NO duration before any refresh (AD-18b)", () => {
    render(<TrafficTile />);
    expect(screen.getByText(/Toucher pour actualiser/i)).toBeInTheDocument();
    // HA is already pushing "34.2" and we still refuse to render it: a stale
    // duration is indistinguishable from a fresh one.
    expect(screen.queryByText(/34/)).not.toBeInTheDocument();
    expect(tile()).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/non relevé/i),
    );
  });

  it("asks HA to refresh the entity on tap — no returnResponse", () => {
    render(<TrafficTile />);
    fireEvent.click(tile());

    expect(state.callService).toHaveBeenCalledTimes(1);
    const arg = state.callService.mock.calls[0][0];
    expect(arg.domain).toBe("homeassistant");
    expect(arg.service).toBe("update_entity");
    expect(arg).not.toHaveProperty("returnResponse");
  });

  it("shows a waiting state after the tap — words, never a spinner", () => {
    render(<TrafficTile />);
    fireEvent.click(tile());

    expect(screen.getByText(/Relevé en cours/i)).toBeInTheDocument();
    // UX-DR19/23/27 and DESIGN.md all forbid a spinner in place of data.
    expect(document.querySelector(".animate-spin")).toBeNull();
    expect(document.querySelector('[role="progressbar"]')).toBeNull();
  });

  it("shows the duration and the time it was ASKED once the guard settles", async () => {
    render(<TrafficTile />);
    fireEvent.click(tile());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13_000);
    });

    // 34.2 rounds to 34; the stamp is the request time (08:14), not last_changed
    // (08:00) — which would not have moved had HA returned the same value.
    expect(screen.getByText("34 min")).toBeInTheDocument();
    expect(screen.getByText(/08:14/)).toBeInTheDocument();
    expect(screen.queryByText(/08:00/)).not.toBeInTheDocument();
  });

  it("falls back to Indisponible and dims when the socket is lost", () => {
    state.connectionStatus = "disconnected";
    render(<TrafficTile />);

    expect(screen.getByText(/Indisponible/i)).toBeInTheDocument();
    expect(tile().className).toContain("opacity-60");
    expect(tile()).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/indisponible/i),
    );
  });

  it("does not dim while merely waiting — pending is not an outage", () => {
    render(<TrafficTile />);
    fireEvent.click(tile());
    expect(tile().className).not.toContain("opacity-60");
  });

  it("wears the top-bar mould and a ≥48px target (NFR2)", () => {
    render(<TrafficTile />);
    const c = tile().className;
    // 56px, matching its neighbours — the code wins over UX-DR28's 52px mock
    // dimension, because the invariant that matters is alignment.
    expect(c).toContain("min-h-[56px]");
    expect(c).toContain("rounded-lg");
    expect(c).toContain("bg-card-fill");
    expect(c).toContain("backdrop-blur-glass");
  });

  it("is a real button — it acts, unlike the read-only chips", () => {
    render(<TrafficTile />);
    expect(tile().tagName).toBe("BUTTON");
    expect(tile()).toHaveAttribute("type", "button");
  });

  it("pins the text block width so the chip cannot resize between states", () => {
    // The bar is clipped, not scrollable: a chip that grows pushes a neighbour
    // out of sight rather than overflowing visibly.
    const { container } = render(<TrafficTile />);
    const block = container.querySelector('[data-testid="traffic-lines"]');
    expect(block?.className).toMatch(/w-\[\d+px\]/);
  });

  it("carries no domain accent — neutral chip (UX-DR24)", () => {
    render(<TrafficTile />);
    expect(tile()).not.toHaveAttribute("data-domain");
    expect(tile().className).not.toMatch(/bg-(green|emerald|security)/);
  });

  it("never renders NaN, whatever HA reports", async () => {
    state.value = "n'importe quoi";
    render(<TrafficTile />);
    fireEvent.click(tile());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(13_000);
    });

    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
    expect(screen.getByText(/illisible/i)).toBeInTheDocument();
  });

  it("stays tappable while pending — a stuck wait must be recoverable", () => {
    render(<TrafficTile />);
    fireEvent.click(tile());
    expect(tile()).not.toBeDisabled();
    fireEvent.click(tile());
    expect(state.callService).toHaveBeenCalledTimes(2);
  });
});
