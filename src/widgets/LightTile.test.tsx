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
import { LightTile } from "./LightTile";

const hass = vi.hoisted(() => ({
  state: "on" as string,
  brightness: 204 as number | null, // 80% of 255
  colorTempK: 3000 as number | null,
  modes: ["color_temp"] as string[],
  connectionStatus: "connected" as string,
  turnOn: vi.fn(),
  turnOff: vi.fn(),
}));

vi.mock("@hakit/core", () => ({
  useEntity: () => ({
    state: hass.state,
    last_changed: "2026-07-20T10:00:00Z",
    attributes:
      hass.state === "on"
        ? {
            brightness: hass.brightness,
            color_temp_kelvin: hass.colorTempK,
            min_color_temp_kelvin: 2900,
            max_color_temp_kelvin: 7000,
            supported_color_modes: hass.modes,
          }
        : { supported_color_modes: hass.modes },
    service: { turnOn: hass.turnOn, turnOff: hass.turnOff },
  }),
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: hass.connectionStatus }),
  useService: () => ({ turnOn: hass.turnOn, turnOff: hass.turnOff }),
}));

const ENTRY: EntityEntry = {
  entityId: "light.bureau_elgato",
  room: "salon",
  domain: "light",
  service: "light.toggle",
  label: "Bureau",
};

describe("LightTile (Story 2.3 → 2.4)", () => {
  beforeEach(() => {
    usePendingStore.setState({ byId: {} });
    hass.state = "on";
    hass.brightness = 204;
    hass.colorTempK = 3000;
    hass.modes = ["color_temp"];
    hass.connectionStatus = "connected";
    hass.turnOn.mockClear();
    hass.turnOff.mockClear();
  });

  it("shows the label and 'Allumé · 80 %' when on", () => {
    render(<LightTile entry={ENTRY} />);
    expect(screen.getByText("Bureau")).toBeInTheDocument();
    expect(screen.getByText(/Allumé · 80 %/)).toBeInTheDocument();
  });

  it("toggles off from the header", () => {
    render(<LightTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: /éteindre bureau/i }));
    expect(hass.turnOff).toHaveBeenCalled();
  });

  it("a brightness palier updates optimistically and calls turn_on brightness_pct", async () => {
    render(<LightTile entry={ENTRY} />);
    const grp = within(screen.getByRole("group", { name: "Intensité" }));
    fireEvent.click(grp.getByRole("button", { name: "60 %" }));
    expect(screen.getByText(/Allumé · 60 %/)).toBeInTheDocument(); // optimistic
    await waitFor(() =>
      expect(hass.turnOn).toHaveBeenCalledWith({
        target: ENTRY.entityId,
        serviceData: { brightness_pct: 60 },
      }),
    );
  });

  it("a temperature preset calls turn_on color_temp_kelvin (Froid = max)", async () => {
    render(<LightTile entry={ENTRY} />);
    const grp = within(screen.getByRole("group", { name: "Température" }));
    fireEvent.click(grp.getByRole("button", { name: "Froid" }));
    await waitFor(() =>
      expect(hass.turnOn).toHaveBeenCalledWith({
        target: ENTRY.entityId,
        serviceData: { color_temp_kelvin: 7000 },
      }),
    );
  });

  it("off: status 'Éteint' and the paliers are disabled", () => {
    hass.state = "off";
    render(<LightTile entry={ENTRY} />);
    expect(screen.getByText("Éteint")).toBeInTheDocument();
    const grp = within(screen.getByRole("group", { name: "Intensité" }));
    expect(grp.getAllByRole("button")[0]).toBeDisabled();
  });

  it("hides the temperature row for a brightness-only light", () => {
    hass.modes = ["brightness"];
    render(<LightTile entry={ENTRY} />);
    expect(
      screen.getByRole("group", { name: "Intensité" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Température" })).toBeNull();
  });

  it("shows no attribute controls for an on/off-only light (still toggleable)", () => {
    hass.modes = ["onoff"];
    render(<LightTile entry={ENTRY} />);
    expect(screen.queryByRole("group", { name: "Intensité" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Température" })).toBeNull();
    expect(
      screen.getByRole("button", { name: /éteindre bureau/i }),
    ).toBeInTheDocument();
  });

  it('offline: non-interactive "Hors ligne" tile (AD-6)', () => {
    hass.connectionStatus = "disconnected";
    render(<LightTile entry={ENTRY} />);
    expect(screen.getByText(/hors ligne/i)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(hass.turnOff).not.toHaveBeenCalled();
  });
});
