import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

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
    return {
      state: state.kwh,
      last_changed,
      attributes: { unit_of_measurement: "kWh" },
    };
  },
  useHistory: () => ({
    entityHistory: [
      { s: "0.5", lu: 1_753_000_000 },
      { s: "4.1", lu: 1_753_003_600 },
      { s: "8.2", lu: 1_753_007_200 },
    ],
    coordinates: [],
    timeline: [],
    loading: false,
  }),
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: state.connectionStatus }),
}));

// Recharts stubbed — the chart mounts (with data) without ResizeObserver/canvas.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: unknown }) => children,
  LineChart: ({ children }: { children: unknown }) => children,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}));

import { ElectricityDetailContent } from "./ElectricityDetail";
import { electricityConfig } from "../entities";

function renderPage(cfg = electricityConfig()) {
  return render(
    <MemoryRouter initialEntries={["/electricite"]}>
      <Routes>
        <Route
          path="/electricite"
          element={<ElectricityDetailContent cfg={cfg} />}
        />
        <Route path="/" element={<div>home-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.connectionStatus = "connected";
  state.kwh = "8.2";
  state.price = "0.20";
});

describe("ElectricityDetail (Story 9.1)", () => {
  it("renders Aujourd'hui (derived cost + consumption + unit price) and the history chart", async () => {
    renderPage();
    expect(screen.getByText(/1,64\s*€/)).toBeInTheDocument(); // 8.2 × 0.20
    expect(screen.getByText(/8,2\s*kWh · depuis 00:00/)).toBeInTheDocument();
    expect(screen.getByText(/0,20\s*€\/kWh/)).toBeInTheDocument();
    expect(
      await screen.findByRole("img", {
        name: /Historique de la consommation cumulée/i,
      }),
    ).toBeInTheDocument();
  });

  it('shows the HC/HP tariff tile as an "À venir" seam (Story 9.2)', () => {
    renderPage();
    expect(screen.getByText("Heures creuses / pleines")).toBeInTheDocument();
    expect(screen.getByText("À venir")).toBeInTheDocument();
  });

  it("back link navigates home", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Accueil/i }));
    expect(screen.getByText("home-page")).toBeInTheDocument();
  });

  it("offline → keeps the last-known values (never blank) + 'Hors ligne' pill (AD-6)", () => {
    state.connectionStatus = "disconnected";
    renderPage();
    expect(screen.getByText(/Hors ligne/)).toBeInTheDocument();
    // Values frozen, not blanked.
    expect(screen.getByText(/1,64\s*€/)).toHaveClass("text-stale-text");
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});
