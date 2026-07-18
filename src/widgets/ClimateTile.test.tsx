import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import type { EntityEntry } from "../entities";
import { usePendingStore } from "../state/pending";
import { ClimateTile } from "./ClimateTile";

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

  it("shows setpoint and current mode chip (AC1)", () => {
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.getByText("22")).toBeInTheDocument(); // setpoint
    expect(modeChip("Froid")).toBeInTheDocument(); // cool → Froid chip
  });

  it("shows the running-state pill with the current mode when on (C3)", () => {
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.getByText(/En marche · Froid/)).toBeInTheDocument();
  });

  it("mode chip issues set_hvac_mode with the target (heat_cool = Auto) (AC2)", () => {
    render(<ClimateTile entry={ENTRY} />);
    fireEvent.click(modeChip("Auto"));
    expect(hass.setHvacMode).toHaveBeenCalledWith({
      serviceData: { hvac_mode: "heat_cool" },
    });
  });

  it("the power toggle issues set_hvac_mode off when on (C2)", () => {
    render(<ClimateTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: /éteindre/i }));
    expect(hass.setHvacMode).toHaveBeenCalledWith({
      serviceData: { hvac_mode: "off" },
    });
  });

  it("the power toggle restores the last mode when off (C2)", () => {
    hass.state = "off";
    render(<ClimateTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: /allumer/i }));
    expect(hass.setHvacMode).toHaveBeenCalledWith({
      serviceData: { hvac_mode: "heat" }, // lastMode default
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

  it("off: everything dims — controls disabled, no running-state pill (C3)", () => {
    hass.state = "off";
    render(<ClimateTile entry={ENTRY} />);
    // The power toggle stays interactive (to turn back on)…
    expect(
      screen.getByRole("button", { name: /allumer/i }),
    ).toBeInTheDocument();
    // …but the setpoint stepper and mode chips are disabled, not gone.
    expect(screen.getByRole("button", { name: /augmenter/i })).toBeDisabled();
    expect(modeChip("Froid")).toBeDisabled();
    // No "En marche" while off.
    expect(screen.queryByText(/En marche/)).toBeNull();
  });

  it("hides the stepper when the mode exposes no setpoint (fan_only → temperature null) (E2)", () => {
    hass.state = "fan_only";
    hass.attributes = { ...fullAttrs(), temperature: null };
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.queryByRole("button", { name: /augmenter/i })).toBeNull();
  });

  it("Vitesse segment picks the fan_mode optimistically and calls set_fan_mode (AC4)", async () => {
    render(<ClimateTile entry={ENTRY} />);
    const speed = within(screen.getByRole("group", { name: "Vitesse" }));
    // Current is Auto; pick Quiet (labelled "Silencieux").
    fireEvent.click(speed.getByRole("button", { name: "Silencieux" }));
    await waitFor(() =>
      expect(hass.setFanMode).toHaveBeenCalledWith({
        target: ENTRY.entityId,
        serviceData: { fan_mode: "Quiet" },
      }),
    );
  });

  it("exposes every real fan speed as a segment (7 modes, C1)", () => {
    render(<ClimateTile entry={ENTRY} />);
    const speed = within(screen.getByRole("group", { name: "Vitesse" }));
    // Auto, Silencieux, 1, 2, 3, 4, 5
    expect(speed.getAllByRole("button")).toHaveLength(7);
  });

  it("Oscillation segment picks the swing_mode and calls set_swing_mode (AC4)", async () => {
    render(<ClimateTile entry={ENTRY} />);
    const swing = within(screen.getByRole("group", { name: "Oscillation" }));
    // off (Fixe) → on (Balayage)
    fireEvent.click(swing.getByRole("button", { name: "Balayage" }));
    await waitFor(() =>
      expect(hass.setSwingMode).toHaveBeenCalledWith({
        target: ENTRY.entityId,
        serviceData: { swing_mode: "on" },
      }),
    );
  });

  it("hides Vitesse when the entity declares no fan_modes (AC4 graceful degradation)", () => {
    hass.attributes = { ...fullAttrs(), fan_modes: [] };
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.queryByRole("group", { name: "Vitesse" })).toBeNull();
  });

  it('offline: non-interactive "Hors ligne" tile, no controls (AD-6)', () => {
    hass.connectionStatus = "disconnected";
    render(<ClimateTile entry={ENTRY} />);
    expect(screen.getByText(/hors ligne/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /éteindre|allumer/i }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /augmenter/i })).toBeNull();
    expect(hass.setHvacMode).not.toHaveBeenCalled();
  });
});
