import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Mutable mock state (vi.hoisted so the hoisted vi.mock factory can read it).
//
// The 9.1 mock dispatched on `id.includes("prix")`, which no longer
// discriminates: Story 9.2 reads TWO price helpers. Each entity now has its own
// slot, so a test can starve exactly one of them — the only way to prove the
// "no fallback to the other price" rule.
const state = vi.hoisted(() => ({
  connectionStatus: "connected" as string,
  kwh: "8.2" as string,
  period: "on" as string,
  priceCreuses: "0.0890" as string,
  pricePleines: "0.1491" as string,
  nextSwitch: "2026-07-28T06:08:00Z" as string,
}));

vi.mock("@hakit/core", () => ({
  useEntity: (id: string) => {
    const last_changed = "2026-07-23T09:00:00Z";
    if (id.includes("prix_kwh_creuses"))
      return { state: state.priceCreuses, last_changed, attributes: {} };
    if (id.includes("prix_kwh_pleines"))
      return { state: state.pricePleines, last_changed, attributes: {} };
    if (id.startsWith("binary_sensor."))
      return { state: state.period, last_changed, attributes: {} };
    if (id.includes("prochaine_bascule"))
      return { state: state.nextSwitch, last_changed, attributes: {} };
    // daily-kWh consumption sensor
    return {
      state: state.kwh,
      last_changed,
      attributes: { unit_of_measurement: "kWh" },
    };
  },
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: state.connectionStatus }),
}));

import { ElectricityTile } from "./ElectricityTile";

function renderTile() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<ElectricityTile />} />
        <Route path="/electricite" element={<div>electricite-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.connectionStatus = "connected";
  state.kwh = "8.2";
  state.period = "on";
  state.priceCreuses = "0.0890";
  state.pricePleines = "0.1491";
  state.nextSwitch = "2026-07-28T06:08:00Z";
});

describe("ElectricityTile (Story 9.1, tariff-aware since 9.2)", () => {
  it("prices the day at the CREUSES rate while the period is creuses", () => {
    renderTile();
    // 8.2 kWh × 0.0890 €/kWh = 0.7298 € → "0,73 €"
    expect(screen.getByText(/0,73\s*€/)).toBeInTheDocument();
    expect(screen.getByText(/8,2\s*kWh/)).toBeInTheDocument();
    expect(screen.getByText("HC")).toBeInTheDocument();
  });

  it("prices the day at the PLEINES rate while the period is pleines", () => {
    state.period = "off";
    renderTile();
    // 8.2 kWh × 0.1491 €/kWh = 1.22262 € → "1,22 €"
    expect(screen.getByText(/1,22\s*€/)).toBeInTheDocument();
    expect(screen.getByText("HP")).toBeInTheDocument();
  });

  it("the hero figure CHANGES between the two periods — specified, not accidental", () => {
    // Same kWh, different tariff: +68%. Florian ruled out per-tariff meters, so
    // this jump is the agreed behaviour. Asserted so a future "fix" that
    // smooths it has to delete a test that says why.
    const { unmount } = renderTile();
    expect(screen.getByText(/0,73\s*€/)).toBeInTheDocument();
    unmount();

    state.period = "off";
    renderTile();
    expect(screen.getByText(/1,22\s*€/)).toBeInTheDocument();
    expect(screen.queryByText(/0,73\s*€/)).toBeNull();
  });

  it("says the period in the aria-label, spelled out, not as 'HC'", () => {
    // AC1: the period must reach assistive tech too. The chip is compact for
    // room; the accessible name is not.
    renderTile();
    expect(
      screen.getByRole("button", {
        name: /Électricité : 0,73 € aujourd'hui, 8,2 kWh, heures creuses — ouvrir le détail/i,
      }),
    ).toBeInTheDocument();
  });

  it("navigates to /electricite on tap", () => {
    renderTile();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("electricite-page")).toBeInTheDocument();
  });

  it("offline → dimmed but keeps the last-known value, and still navigates (AD-6)", () => {
    state.connectionStatus = "disconnected";
    renderTile();
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("opacity-60");
    expect(screen.getByText(/8,2\s*kWh/)).toBeInTheDocument(); // never blank
    fireEvent.click(btn);
    expect(screen.getByText("electricite-page")).toBeInTheDocument();
  });

  it("a stale price helper still dims the chip, consumption kept", () => {
    state.priceCreuses = "unavailable";
    renderTile();
    expect(screen.getByRole("button").className).toContain("opacity-60");
    expect(screen.getByText(/8,2\s*kWh/)).toBeInTheDocument();
  });

  it("a period never seen → 'Période —' AND no cost (no default tariff)", () => {
    // Both prices are perfectly readable here. Showing a cost anyway would mean
    // picking a tariff on the user's behalf, and being wrong by 68%.
    state.period = "unavailable";
    renderTile();
    expect(screen.getByText(/Période/)).toBeInTheDocument();
    expect(screen.queryByText("HC")).toBeNull();
    expect(screen.queryByText("HP")).toBeNull();
    expect(screen.queryByText(/0,73\s*€/)).toBeNull();
    expect(screen.queryByText(/1,22\s*€/)).toBeNull();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("does NOT bill heures creuses at the full rate when the HC price is missing", () => {
    // The silent-fallback trap, at component level: pricePleines is present and
    // would produce a plausible 1,22 € that is simply wrong.
    state.priceCreuses = "unavailable";
    state.period = "on";
    renderTile();
    expect(screen.queryByText(/1,22\s*€/)).toBeNull();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders no domain accent — the pill stays neutral (UX-DR24)", () => {
    // The mock's green/orange tints were explicitly dropped: green is reserved
    // for safety (UX-DR18), and colour alone must never carry meaning (UX-DR14).
    const { container } = renderTile();
    expect(container.innerHTML).not.toMatch(
      /bg-(green|emerald|orange|amber|red)-/,
    );
  });
});
