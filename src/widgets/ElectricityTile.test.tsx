import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Mutable mock state (vi.hoisted so the hoisted vi.mock factory can read it).
//
// Story 9.4: the consumption and the cost are no longer entities — they come
// back from `recorder.get_statistics` through `callService`. Only the HC/HP
// pill still reads an entity (the period binary_sensor).
const state = vi.hoisted(() => ({
  connectionStatus: "connected" as string,
  period: "on" as string,
  callService: vi.fn(),
}));

vi.mock("@hakit/core", () => ({
  useEntity: (id: string) => {
    const last_changed = "2026-09-25T09:00:00Z";
    if (id.startsWith("binary_sensor."))
      return { state: state.period, last_changed, attributes: {} };
    return null;
  },
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

import { ElectricityTile } from "./ElectricityTile";

const CONSO = "linky:24305788525104";
const COST = "linky:24305788525104_cost";
// Local Paris days start at 22:00Z the evening before (CEST, September).
const D23 = "2026-09-22T22:00:00+00:00";
const D24 = "2026-09-23T22:00:00+00:00";
const D25 = "2026-09-24T22:00:00+00:00"; // today — must never be shown

const reply = (
  conso: { start: string; change?: number }[],
  cost: { start: string; change?: number }[],
) => ({ response: { statistics: { [CONSO]: conso, [COST]: cost } } });

const bothDays = () =>
  reply(
    [
      { start: D23, change: 6.1 },
      { start: D24, change: 8.2 },
    ],
    [
      { start: D23, change: 0.8 },
      { start: D24, change: 1.07 },
    ],
  );

async function renderTile() {
  const utils = render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<ElectricityTile />} />
        <Route path="/electricite" element={<div>electricite-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
  // Let the query effect fire and settle under fake timers.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  return utils;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 25, 10, 30)); // Fri 25 Sept 2026, 10:30 local
  state.connectionStatus = "connected";
  state.period = "on";
  state.callService.mockReset();
  state.callService.mockResolvedValue(bothDays());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ElectricityTile (Story 9.4 — yesterday, from the Linky statistics)", () => {
  it("shows yesterday's cost as hero, and « Hier · conso » as the dated subline (UX-DR30)", async () => {
    await renderTile();
    expect(screen.getByText(/1,07\s*€/)).toBeInTheDocument();
    expect(screen.getByTestId("electricity-day").textContent).toBe(
      "Hier · 8,2 kWh",
    );
    expect(screen.getByText("HC")).toBeInTheDocument();
  });

  it("before the morning import: falls back to the day before, DATED — never « Hier » for the wrong day", async () => {
    state.callService.mockResolvedValue(
      reply([{ start: D23, change: 6.1 }], [{ start: D23, change: 0.8 }]),
    );
    await renderTile();
    expect(screen.getByText(/0,80\s*€/)).toBeInTheDocument();
    expect(screen.getByTestId("electricity-day").textContent).toBe(
      "mer. 23 · 6,1 kWh",
    );
    expect(screen.queryByText(/Hier/)).toBeNull();
  });

  it("NEVER shows today, even when HA returns a partial row for it", async () => {
    state.callService.mockResolvedValue(
      reply(
        [
          { start: D24, change: 8.2 },
          { start: D25, change: 0.4 },
        ],
        [
          { start: D24, change: 1.07 },
          { start: D25, change: 0.05 },
        ],
      ),
    );
    await renderTile();
    expect(screen.getByText(/1,07\s*€/)).toBeInTheDocument();
    expect(screen.queryByText(/0,05\s*€/)).toBeNull();
    expect(screen.queryByText(/0,4\s*kWh/)).toBeNull();
  });

  it("cost and consumption are independent: no cost statistic yet → « — » hero, conso still shown", async () => {
    state.callService.mockResolvedValue(
      reply([{ start: D24, change: 8.2 }], []),
    );
    await renderTile();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByTestId("electricity-day").textContent).toBe(
      "Hier · 8,2 kWh",
    );
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("no complete day at all → « Pas encore de relevé », same footprint, no blank, no NaN (UX-DR27)", async () => {
    state.callService.mockResolvedValue(reply([], []));
    await renderTile();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByTestId("electricity-day").textContent).toBe(
      "Pas encore de relevé",
    );
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.getByText("HC")).toBeInTheDocument();
  });

  it("says the day in full in the aria-label, plus the period spelled out", async () => {
    await renderTile();
    expect(
      screen.getByRole("button", {
        name: /Électricité : 1,07 € hier, jeudi 24 septembre, 8,2 kWh, heures creuses — ouvrir le détail/i,
      }),
    ).toBeInTheDocument();
  });

  it("navigates to /electricite on tap", async () => {
    await renderTile();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("electricite-page")).toBeInTheDocument();
  });

  it("a failed refresh keeps the LAST KNOWN day, dims the chip and says « hors ligne » (AD-17)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await renderTile();
    expect(screen.getByText(/1,07\s*€/)).toBeInTheDocument();

    state.callService.mockRejectedValue(new Error("HA injoignable"));
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });

    const btn = screen.getByRole("button");
    expect(btn.className).toContain("opacity-60");
    expect(btn.getAttribute("aria-label")).toMatch(/hors ligne/);
    expect(screen.getByText(/1,07\s*€/)).toBeInTheDocument(); // never blank
    warn.mockRestore();
  });

  it("disconnected from the start → dimmed placeholder « — », still tappable, nothing asked", async () => {
    state.connectionStatus = "disconnected";
    await renderTile();
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("opacity-60");
    // Hero AND subline are placeholders — same footprint, nothing blank.
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.getByTestId("electricity-day").textContent).toBe("—");
    expect(state.callService).not.toHaveBeenCalled();
    fireEvent.click(btn);
    expect(screen.getByText("electricite-page")).toBeInTheDocument();
  });

  it("a stale period entity dims the chip too — the pill is part of the glance", async () => {
    state.period = "unavailable";
    await renderTile();
    expect(screen.getByRole("button").className).toContain("opacity-60");
    expect(screen.getByText(/Période/)).toBeInTheDocument();
    expect(screen.getByText(/1,07\s*€/)).toBeInTheDocument();
  });

  it("tints the pill per period — green for creuses, amber for pleines (unchanged from 9.2)", async () => {
    const { container, unmount } = await renderTile();
    expect(container.innerHTML).toMatch(/bg-tariff-creuses-soft/);
    expect(container.innerHTML).not.toMatch(/tariff-pleines/);
    unmount();

    state.period = "off";
    const second = await renderTile();
    expect(second.container.innerHTML).toMatch(/bg-tariff-pleines-soft/);
    expect(screen.getByText("HP")).toBeInTheDocument();
  });

  it("never leans on the tint alone — glyph and letters say it too (UX-DR14)", async () => {
    const { container } = await renderTile();
    expect(screen.getByText("HC")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("an unknown period gets the muted treatment, not a third colour", async () => {
    state.period = "unavailable";
    const { container } = await renderTile();
    expect(container.innerHTML).not.toMatch(/tariff-(creuses|pleines)/);
  });
});
