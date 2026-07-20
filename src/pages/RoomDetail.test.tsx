import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const state = vi.hoisted(() => ({
  connectionStatus: "connected" as string,
  temp: "21.5" as string,
  co2: "620" as string,
  humidity: "48" as string,
  noise: "42" as string,
}));

vi.mock("@hakit/core", () => ({
  useEntity: (id: string) => {
    const last_changed = "2026-07-17T08:00:00Z";
    // co2 id contains "dioxyde_de_carbone"; check it before "temperature".
    if (id.includes("carbone"))
      return {
        state: state.co2,
        last_changed,
        attributes: { unit_of_measurement: "ppm" },
      };
    if (id.includes("noise"))
      return {
        state: state.noise,
        last_changed,
        attributes: { unit_of_measurement: "dB" },
      };
    if (id.includes("temperature"))
      return {
        state: state.temp,
        last_changed,
        attributes: { unit_of_measurement: "°C" },
      };
    if (id.includes("humidite"))
      return {
        state: state.humidity,
        last_changed,
        attributes: { unit_of_measurement: "%" },
      };
    if (id.includes("batterie")) return { state: "75", last_changed };
    return null;
  },
  useHistory: () => ({
    entityHistory: [
      { s: "20", lu: 1_752_000_000 },
      { s: "21", lu: 1_752_003_600 },
      { s: "21.5", lu: 1_752_007_200 },
    ],
    coordinates: [],
    timeline: [],
    loading: false,
  }),
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: state.connectionStatus }),
}));

// Stub Recharts so the charts mount (with data) without ResizeObserver/canvas.
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

import { RoomDetailContent } from "./RoomDetail";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/room/salon"]}>
      <Routes>
        <Route
          path="/room/salon"
          element={
            <RoomDetailContent
              room={{ id: "salon", label: "Salon", kid: false }}
            />
          }
        />
        <Route path="/" element={<div>home-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.connectionStatus = "connected";
  state.temp = "21.5";
  state.co2 = "620";
  state.humidity = "48";
  state.noise = "42";
});

describe("RoomDetail (Story 6.2 → room history)", () => {
  it("renders a chart per mapped sensor with current values (Salon has the sonomètre)", async () => {
    renderPage();
    expect(screen.getByText("Salon")).toBeInTheDocument();
    expect(screen.getByText(/21\.5\s*°C/)).toBeInTheDocument();
    expect(screen.getByText(/620\s*ppm/)).toBeInTheDocument();
    expect(screen.getByText(/48\s*%/)).toBeInTheDocument();
    expect(screen.getByText(/42\s*dB/)).toBeInTheDocument(); // sonomètre
    // Salon: temperature + CO₂ + humidity + noise = 4 interactive charts (lazy).
    expect(
      await screen.findAllByRole("img", { name: /Historique/i }),
    ).toHaveLength(4);
  });

  it("colours the CO₂ current value by air-quality threshold (620 → green)", () => {
    renderPage();
    expect(screen.getByText(/620\s*ppm/).className).toContain(
      "text-security-ok",
    );
  });

  it("shows the module battery level in the header", () => {
    renderPage();
    expect(screen.getByText(/75 %/)).toBeInTheDocument();
  });

  it("back link navigates home", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Accueil/i }));
    expect(screen.getByText("home-page")).toBeInTheDocument();
  });
});
