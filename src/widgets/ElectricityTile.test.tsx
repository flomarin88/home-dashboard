import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Mutable mock state (vi.hoisted so the hoisted vi.mock factory can read it).
const state = vi.hoisted(() => ({
  connectionStatus: "connected" as string,
  kwh: "8.2" as string,
  price: "0.20" as string,
}));

vi.mock("@hakit/core", () => ({
  useEntity: (id: string) => {
    const last_changed = "2026-07-23T09:00:00Z";
    if (id.includes("prix"))
      return { state: state.price, last_changed, attributes: {} };
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
  state.price = "0.20";
});

describe("ElectricityTile (Story 9.1)", () => {
  it("shows the derived daily cost (hero) and the consumption subline", () => {
    renderTile();
    // 8.2 kWh × 0.20 €/kWh = 1.64 €
    expect(screen.getByText(/1,64\s*€/)).toBeInTheDocument();
    expect(screen.getByText(/8,2\s*kWh/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Électricité : 1,64 € aujourd'hui, 8,2 kWh — ouvrir le détail/i,
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

  it("connected but the price helper is stale → still dimmed, consumption kept", () => {
    state.price = "unavailable";
    renderTile();
    expect(screen.getByRole("button").className).toContain("opacity-60");
    expect(screen.getByText(/8,2\s*kWh/)).toBeInTheDocument();
  });

  it('renders "—" (never NaN) for the cost when the price is missing', () => {
    state.price = "unavailable";
    renderTile();
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.getByText("—")).toBeInTheDocument(); // cost hero, no invented value
  });
});
