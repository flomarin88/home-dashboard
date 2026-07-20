import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { EntityEntry } from "../entities";
import { usePendingStore } from "../state/pending";
import { ClimateDetailContent } from "./ClimateDetail";

/** The mode chip for `name`, scoped to the Mode group (fan segments reuse labels
 * like "Auto", so an unscoped query would be ambiguous). */
const modeChip = (name: string) =>
  within(screen.getByRole("group", { name: "Mode" })).getByRole("button", {
    name,
  });

const hass = vi.hoisted(() => ({
  state: "cool" as string,
  attributes: {} as Record<string, unknown>,
  ambient: "21.4" as string | null,
  connectionStatus: "connected" as string,
  setHvacMode: vi.fn(),
  setTemperature: vi.fn(),
  setFanMode: vi.fn(),
  setSwingMode: vi.fn(),
}));

vi.mock("@hakit/core", () => ({
  useEntity: (entityId: string) => {
    if (entityId.startsWith("sensor."))
      return { state: hass.ambient, attributes: {} };
    return {
      state: hass.state,
      attributes: hass.attributes,
      service: { setHvacMode: hass.setHvacMode },
    };
  },
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: hass.connectionStatus }),
  useService: () => ({
    setTemperature: hass.setTemperature,
    setFanMode: hass.setFanMode,
    setSwingMode: hass.setSwingMode,
  }),
  useHistory: () => ({
    entityHistory: [
      { s: "20", lu: 1_752_000_000 },
      { s: "21", lu: 1_752_003_600 },
      { s: "21.4", lu: 1_752_007_200 },
    ],
    coordinates: [],
    timeline: [],
    loading: false,
  }),
}));

// Stub Recharts so the chart mounts (with data) without ResizeObserver/canvas.
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

const ENTRY: EntityEntry = {
  entityId: "climate.climatiseur_etage_room_temperature",
  room: "chambre_parents",
  domain: "climate",
  service: "climate.set_hvac_mode",
  ambientEntityId: "sensor.climatiseur_etage_climatecontrol_room_temperature",
};

const fullAttrs = () => ({
  temperature: 22,
  current_temperature: 21.4,
  hvac_modes: ["heat_cool", "heat", "cool", "dry", "fan_only", "off"],
  fan_modes: ["Auto", "Quiet", "1", "2", "3", "4", "5"],
  swing_modes: ["on", "off"],
  fan_mode: "Auto",
  swing_mode: "off",
  min_temp: 16,
  max_temp: 30,
  target_temp_step: 0.5,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/climatisation"]}>
      <Routes>
        <Route
          path="/climatisation"
          element={<ClimateDetailContent entry={ENTRY} />}
        />
        <Route path="/" element={<div>home-page</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("ClimateDetail (Intent B)", () => {
  beforeEach(() => {
    usePendingStore.setState({ byId: {} });
    hass.state = "cool";
    hass.attributes = fullAttrs();
    hass.ambient = "21.4";
    hass.connectionStatus = "connected";
    hass.setHvacMode.mockClear();
    hass.setTemperature.mockClear();
    hass.setFanMode.mockClear();
    hass.setSwingMode.mockClear();
  });

  it("shows the setpoint, the current mode chip, and the running-state pill", () => {
    renderPage();
    expect(screen.getByText("22")).toBeInTheDocument();
    expect(modeChip("Froid")).toBeInTheDocument();
    expect(screen.getByText(/En marche · Froid/)).toBeInTheDocument();
  });

  it("shows the ambient temperature", () => {
    renderPage();
    // Shown twice — under the setpoint ("Ambiant") and in the chart header.
    expect(screen.getAllByText("21.4°C").length).toBeGreaterThan(0);
  });

  it("a mode chip issues set_hvac_mode with the target (heat_cool = Auto)", () => {
    renderPage();
    fireEvent.click(modeChip("Auto"));
    expect(hass.setHvacMode).toHaveBeenCalledWith({
      serviceData: { hvac_mode: "heat_cool" },
    });
  });

  it("the power toggle issues set_hvac_mode off when on", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /éteindre/i }));
    expect(hass.setHvacMode).toHaveBeenCalledWith({
      serviceData: { hvac_mode: "off" },
    });
  });

  it("the power toggle restores the last mode when off", () => {
    hass.state = "off";
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /allumer/i }));
    expect(hass.setHvacMode).toHaveBeenCalledWith({
      serviceData: { hvac_mode: "heat" },
    });
  });

  it("Vitesse picks the fan_mode optimistically and calls set_fan_mode", async () => {
    renderPage();
    const speed = within(screen.getByRole("group", { name: "Vitesse" }));
    fireEvent.click(speed.getByRole("button", { name: "Silencieux" }));
    await waitFor(() =>
      expect(hass.setFanMode).toHaveBeenCalledWith({
        target: ENTRY.entityId,
        serviceData: { fan_mode: "Quiet" },
      }),
    );
  });

  it("exposes every real fan speed as a segment (7 modes)", () => {
    renderPage();
    const speed = within(screen.getByRole("group", { name: "Vitesse" }));
    expect(speed.getAllByRole("button")).toHaveLength(7);
  });

  it("Oscillation picks the swing_mode and calls set_swing_mode", async () => {
    renderPage();
    const swing = within(screen.getByRole("group", { name: "Oscillation" }));
    fireEvent.click(swing.getByRole("button", { name: "Balayage" }));
    await waitFor(() =>
      expect(hass.setSwingMode).toHaveBeenCalledWith({
        target: ENTRY.entityId,
        serviceData: { swing_mode: "on" },
      }),
    );
  });

  it("off: controls disabled, no running-state pill", () => {
    hass.state = "off";
    renderPage();
    expect(
      screen.getByRole("button", { name: /allumer/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /augmenter/i })).toBeDisabled();
    expect(modeChip("Froid")).toBeDisabled();
    expect(screen.queryByText(/En marche/)).toBeNull();
  });

  it("hides Vitesse when the entity declares no fan_modes (graceful degradation)", () => {
    hass.attributes = { ...fullAttrs(), fan_modes: [] };
    renderPage();
    expect(screen.queryByRole("group", { name: "Vitesse" })).toBeNull();
  });

  it("renders the 24 h temperature history chart", async () => {
    renderPage();
    expect(
      await screen.findByRole("img", { name: /Historique/i }),
    ).toBeInTheDocument();
  });

  it("back link navigates home", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Accueil/i }));
    expect(screen.getByText("home-page")).toBeInTheDocument();
  });
});
