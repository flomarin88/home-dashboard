import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { EntityEntry } from "../entities";
import { usePendingStore } from "../state/pending";
import { ClimateTile } from "./ClimateTile";

const nav = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("react-router-dom", () => ({ useNavigate: () => nav.fn }));

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
    // The dedicated ambient sensor (a `sensor.*` entity).
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

describe("ClimateTile — compact home tile (Intent B)", () => {
  beforeEach(() => {
    usePendingStore.setState({ byId: {} });
    hass.state = "cool";
    hass.attributes = fullAttrs();
    hass.ambient = "21.4";
    hass.connectionStatus = "connected";
    nav.fn.mockClear();
    hass.setHvacMode.mockClear();
    hass.setTemperature.mockClear();
    hass.setFanMode.mockClear();
    hass.setSwingMode.mockClear();
  });

  it("shows the setpoint, a read-only mode·speed summary, and ambient", () => {
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.getByText("22")).toBeInTheDocument(); // setpoint
    expect(screen.getByText("Froid · Auto")).toBeInTheDocument(); // read-only
    expect(screen.getByText("lecture")).toBeInTheDocument();
    expect(screen.getByText("21.4°")).toBeInTheDocument(); // ambient
  });

  it("moves mode/speed/oscillation/power OFF the tile (they live on the detail)", () => {
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.queryByRole("group", { name: "Mode" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Vitesse" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Oscillation" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /éteindre|allumer/i }),
    ).toBeNull();
  });

  it("opens the detail page when the header is tapped", () => {
    render(<ClimateTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: /ouvrir le détail/i }));
    expect(nav.fn).toHaveBeenCalledWith("/climatisation");
  });

  it("steps the setpoint immediately (optimistic)", () => {
    render(<ClimateTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: /augmenter/i }));
    expect(screen.getByText("22.5")).toBeInTheDocument();
  });

  it("coalesces a burst of stepper taps into ONE set_temperature (quota)", async () => {
    render(<ClimateTile entry={ENTRY} />);
    const plus = screen.getByRole("button", { name: /augmenter/i });
    fireEvent.click(plus);
    fireEvent.click(plus);
    fireEvent.click(plus); // 22 → 22.5 → 23 → 23.5
    expect(screen.getByText("23.5")).toBeInTheDocument();
    await waitFor(() =>
      expect(hass.setTemperature).toHaveBeenCalledWith({
        target: ENTRY.entityId,
        serviceData: { temperature: 23.5 },
      }),
    );
    expect(hass.setTemperature).toHaveBeenCalledTimes(1);
  });

  it("bounds the setpoint at the entity max_temp", () => {
    hass.attributes = { ...fullAttrs(), temperature: 30 };
    render(<ClimateTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: /augmenter/i }));
    expect(screen.getByText("30")).toBeInTheDocument(); // clamped
  });

  it("off: shows 'Éteinte', disables the stepper, no running-state", () => {
    hass.state = "off";
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.getByText("Éteinte")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /augmenter/i })).toBeDisabled();
    expect(screen.queryByText(/En marche/)).toBeNull();
  });

  it("hides the stepper when the mode exposes no setpoint (fan_only)", () => {
    hass.state = "fan_only";
    hass.attributes = { ...fullAttrs(), temperature: null };
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.queryByRole("button", { name: /augmenter/i })).toBeNull();
    expect(screen.getByText("Ventilation")).toBeInTheDocument();
  });

  it('offline: non-interactive "Hors ligne" tile, no controls (AD-6)', () => {
    hass.connectionStatus = "disconnected";
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.getByText(/hors ligne/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /augmenter/i })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /ouvrir le détail/i }),
    ).toBeNull();
    expect(hass.setHvacMode).not.toHaveBeenCalled();
  });
});
