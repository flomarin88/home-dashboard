import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

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
  state.period = "on";
  state.priceCreuses = "0.0890";
  state.pricePleines = "0.1491";
  state.nextSwitch = "2026-07-28T06:08:00Z";
});

describe("ElectricityDetail (Story 9.1, tariff-aware since 9.2)", () => {
  it("renders Aujourd'hui (derived cost + consumption + unit price) and the history chart", async () => {
    renderPage();
    expect(screen.getByText(/0,73\s*€/)).toBeInTheDocument(); // 8.2 × 0.0890
    expect(screen.getByText(/8,2\s*kWh · depuis 00:00/)).toBeInTheDocument();
    expect(
      await screen.findByRole("img", {
        name: /Historique de la consommation cumulée/i,
      }),
    ).toBeInTheDocument();
  });

  it("fills the HC/HP tile — the 9.1 seam is gone (Story 9.2)", () => {
    // This test asserted the "À venir" placeholder in 9.1. Rewritten rather than
    // deleted: the seam was the spec then, the real content is the spec now.
    renderPage();
    expect(screen.getByText("Heures creuses / pleines")).toBeInTheDocument();
    expect(screen.queryByText("À venir")).toBeNull();
  });

  it("shows BOTH tariffs, spelled out, with four decimals", () => {
    renderPage();
    // The creuses price appears twice on purpose: once as the applied tariff on
    // the "Aujourd'hui" line, once in the two-row tariff list.
    expect(screen.getAllByText(/0,0890\s*€\/kWh/).length).toBeGreaterThan(0);
    expect(screen.getByText(/0,1491\s*€\/kWh/)).toBeInTheDocument();
    // "Creuses" appears twice while it is the current period: as the heading
    // and as its tariff row. Both are wanted.
    expect(screen.getAllByText("Creuses").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pleines").length).toBeGreaterThan(0);
  });

  it("marks the applied tariff with a WORD, not with colour alone (UX-DR14)", () => {
    renderPage();
    const applied = screen.getByText("Appliqué");
    expect(applied).toBeInTheDocument();
    // It sits on the creuses row while the period is creuses.
    expect(applied.closest("li")?.textContent).toMatch(/Creuses/);
  });

  it("tints the applied row with its OWN period colour, not a generic one", () => {
    // Creuses is billing → the marked row wears green; flipping the period must
    // move the amber, not repaint the same row.
    const { container, unmount } = renderPage();
    const li = screen.getByText("Appliqué").closest("li")!;
    expect(li.className).toMatch(/tariff-creuses/);
    expect(container.innerHTML).toMatch(/text-tariff-creuses/);
    unmount();

    state.period = "off";
    renderPage();
    expect(screen.getByText("Appliqué").closest("li")!.className).toMatch(
      /tariff-pleines/,
    );
  });

  it("keeps the 'Appliqué' WORD — strip the colour and the row still reads", () => {
    // The tint is reinforcement (UX-DR14); the marker itself is text.
    renderPage();
    expect(screen.getByText("Appliqué")).toBeInTheDocument();
  });

  it("moves the 'Appliqué' marker when the period flips", () => {
    state.period = "off";
    renderPage();
    expect(screen.getByText("Appliqué").closest("li")?.textContent).toMatch(
      /Pleines/,
    );
  });

  it("reads the next switch from HA and names the period it leads to", () => {
    // No deadline arithmetic in the app (AD-4): the hour is formatted from a
    // timestamp sensor, and the wording follows the CURRENT period.
    renderPage();
    expect(
      screen.getByText(/Passage en pleines à \d{2}h\d{2}/),
    ).toBeInTheDocument();
  });

  it("an invalid next-switch state degrades to the house dash, never 'Invalid Date'", () => {
    state.nextSwitch = "unavailable";
    renderPage();
    expect(screen.getByText(/Passage en pleines à —/)).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });

  it("a period never seen: no applied tariff, no cost, both prices still listed", () => {
    state.period = "unknown";
    renderPage();
    expect(screen.queryByText("Appliqué")).toBeNull();
    expect(screen.getByText(/0,0890\s*€\/kWh/)).toBeInTheDocument();
    expect(screen.getByText(/0,1491\s*€\/kWh/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("the 'Aujourd'hui' price line names the applied tariff, not a flat price", () => {
    renderPage();
    expect(screen.getByText(/0,0890\s*€\/kWh · Creuses/)).toBeInTheDocument();
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
    // 8.2 kWh × 0.0890 = 0.7298 € → "0,73 €", frozen at its last value.
    expect(screen.getByText(/0,73\s*€/)).toHaveClass("text-stale-text");
    expect(screen.queryByText(/NaN/)).toBeNull();
  });
});
