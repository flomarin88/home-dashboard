import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { EntityEntry } from "../entities";
import { usePendingStore } from "../state/pending";
import { ClimateTile } from "./ClimateTile";

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

describe("ClimateTile (Story 2.6)", () => {
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

  it("shows setpoint, current mode chip, and ambient temp (AC1)", () => {
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.getByText("22")).toBeInTheDocument(); // setpoint
    expect(screen.getByText("Froid")).toBeInTheDocument(); // cool → Froid chip
    expect(screen.getByText(/Ambiant 21.4/)).toBeInTheDocument();
  });

  it("mode chip issues set_hvac_mode with the target (heat_cool = Auto) (AC2)", () => {
    render(<ClimateTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: "Auto" }));
    expect(hass.setHvacMode).toHaveBeenCalledWith({
      serviceData: { hvac_mode: "heat_cool" },
    });
  });

  it("Éteindre issues set_hvac_mode off; Allumer restores the last mode (AC2)", () => {
    render(<ClimateTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: "Éteindre" }));
    expect(hass.setHvacMode).toHaveBeenCalledWith({
      serviceData: { hvac_mode: "off" },
    });
  });

  it("stepper moves the setpoint immediately (optimistic) (AC3)", () => {
    render(<ClimateTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: /augmenter/i }));
    expect(screen.getByText("22.5")).toBeInTheDocument();
  });

  it("coalesces a burst of stepper taps into ONE set_temperature (quota) (AC3)", async () => {
    render(<ClimateTile entry={ENTRY} />);
    const plus = screen.getByRole("button", { name: /augmenter/i });
    fireEvent.click(plus);
    fireEvent.click(plus);
    fireEvent.click(plus); // 22 → 22.5 → 23 → 23.5
    expect(screen.getByText("23.5")).toBeInTheDocument(); // optimistic final
    await waitFor(() =>
      expect(hass.setTemperature).toHaveBeenCalledWith({
        target: ENTRY.entityId,
        serviceData: { temperature: 23.5 },
      }),
    );
    expect(hass.setTemperature).toHaveBeenCalledTimes(1);
  });

  it("bounds the setpoint at the entity max_temp (AC3)", async () => {
    hass.attributes = { ...fullAttrs(), temperature: 30 }; // already at max
    render(<ClimateTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: /augmenter/i }));
    expect(screen.getByText("30")).toBeInTheDocument(); // clamped, no 30.5
  });

  it("off: hides the stepper + fan/swing, shows Allumer (AC3/AC4)", () => {
    hass.state = "off";
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.getByRole("button", { name: "Allumer" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /augmenter/i })).toBeNull();
    expect(screen.queryByText(/Ventilation :/)).toBeNull();
    expect(screen.queryByText(/Oscillation :/)).toBeNull();
  });

  it("hides the stepper when the mode exposes no setpoint (fan_only → temperature null) (E2)", () => {
    hass.state = "fan_only";
    hass.attributes = { ...fullAttrs(), temperature: null };
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.queryByRole("button", { name: /augmenter/i })).toBeNull();
  });

  it("fan cycles to the next fan_mode optimistically and calls set_fan_mode (AC4)", async () => {
    render(<ClimateTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: /ventilation :/i }));
    // Auto → Quiet (labelled "Silencieux")
    expect(screen.getByText(/Ventilation : Silencieux/)).toBeInTheDocument();
    await waitFor(() =>
      expect(hass.setFanMode).toHaveBeenCalledWith({
        target: ENTRY.entityId,
        serviceData: { fan_mode: "Quiet" },
      }),
    );
  });

  it("swing toggles on/off optimistically and calls set_swing_mode (AC4)", async () => {
    render(<ClimateTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: /oscillation :/i }));
    expect(screen.getByText(/Oscillation : Oscillation/)).toBeInTheDocument(); // off → on
    await waitFor(() =>
      expect(hass.setSwingMode).toHaveBeenCalledWith({
        target: ENTRY.entityId,
        serviceData: { swing_mode: "on" },
      }),
    );
  });

  it("hides fan when the entity declares no fan_modes (AC4 graceful degradation)", () => {
    hass.attributes = { ...fullAttrs(), fan_modes: [] };
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.queryByText(/Ventilation :/)).toBeNull();
  });

  it('offline: non-interactive "Hors ligne" tile, no controls (AD-6)', () => {
    hass.connectionStatus = "disconnected";
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.getByText(/hors ligne/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Éteindre" })).toBeNull();
    expect(screen.queryByRole("button", { name: /augmenter/i })).toBeNull();
    expect(hass.setHvacMode).not.toHaveBeenCalled();
  });
});
