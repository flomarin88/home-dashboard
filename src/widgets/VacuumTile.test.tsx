import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import type { EntityEntry } from "../entities";
import { usePendingStore } from "../state/pending";
import { VacuumTile } from "./VacuumTile";

const renderTile = (ui: ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

const hass = vi.hoisted(() => ({
  vacuumState: "docked" as string,
  battery: "100" as string | null,
  connectionStatus: "connected" as string,
  stop: vi.fn(),
  returnToBase: vi.fn(),
  press: vi.fn(),
}));

vi.mock("@hakit/core", () => ({
  useEntity: (id: string) => {
    if (id.includes("batterie")) return { state: hass.battery, attributes: {} };
    return {
      state: hass.vacuumState,
      attributes: {},
      service: { stop: hass.stop, returnToBase: hass.returnToBase },
    };
  },
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: hass.connectionStatus }),
  useService: () => ({ press: hass.press }),
}));

const ENTRY: EntityEntry = {
  entityId: "vacuum.roborock_s8",
  room: "salon",
  domain: "vacuum",
  service: "vacuum.start",
  batteryEntityId: "sensor.roborock_s8_batterie",
  startButtonEntityId: "button.salon_roborock_s8_quotidien",
};

describe("VacuumTile (Story 2.7)", () => {
  beforeEach(() => {
    usePendingStore.setState({ byId: {} });
    hass.vacuumState = "docked";
    hass.battery = "100";
    hass.connectionStatus = "connected";
    hass.stop.mockClear();
    hass.returnToBase.mockClear();
    hass.press.mockClear();
  });

  it('shows status + battery from the separate battery sensor (docked → "En charge", 100 %)', () => {
    renderTile(<VacuumTile entry={ENTRY} />);
    expect(screen.getByText(/en charge/i)).toBeInTheDocument();
    expect(screen.getByText(/100 %/)).toBeInTheDocument();
  });

  it('Lancer runs the "Quotidien" button (not vacuum.start) and shows "En ménage" optimistically', () => {
    renderTile(<VacuumTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: /lancer/i }));

    expect(hass.press).toHaveBeenCalledWith({
      target: "button.salon_roborock_s8_quotidien",
    });
    expect(screen.getByText(/en ménage/i)).toBeInTheDocument(); // optimistic
  });

  it("Retour base calls vacuum.return_to_base (shown when not docked)", () => {
    hass.vacuumState = "cleaning"; // not docked → Retour base is offered
    renderTile(<VacuumTile entry={ENTRY} />);
    fireEvent.click(screen.getByRole("button", { name: /retour base/i }));
    expect(hass.returnToBase).toHaveBeenCalledOnce();
  });

  it('shows "Retour à la base" for the transitional returning state (not a failure)', () => {
    hass.vacuumState = "returning";
    renderTile(<VacuumTile entry={ENTRY} />);
    expect(screen.getByText(/retour à la base/i)).toBeInTheDocument();
    expect(screen.queryByText(/échec/i)).toBeNull();
  });

  it('offline: "Hors ligne" tile with no control actions (AD-6)', () => {
    hass.connectionStatus = "disconnected";
    renderTile(<VacuumTile entry={ENTRY} />);
    expect(screen.getByText(/hors ligne/i)).toBeInTheDocument();
    // No control actions when offline (the info area still links to the detail).
    expect(screen.queryByRole("button", { name: /lancer/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /retour base/i })).toBeNull();
    expect(hass.press).not.toHaveBeenCalled();
  });
});
