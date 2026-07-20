import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BatteryPill } from "./BatteryPill";

const state = vi.hoisted(() => ({ battery: "80" as string | null }));

vi.mock("@hakit/core", () => ({
  useEntity: () =>
    state.battery == null ? null : { state: state.battery, attributes: {} },
}));

beforeEach(() => {
  state.battery = "80";
});

describe("BatteryPill", () => {
  it("shows the level, coloured green when healthy (≥50)", () => {
    render(<BatteryPill entityId="sensor.x_batterie" />);
    const el = screen.getByText(/80 %/);
    expect(el).toBeInTheDocument();
    expect(el.className).toContain("text-security-ok");
  });

  it("colours a low battery red (<20)", () => {
    state.battery = "12";
    render(<BatteryPill entityId="sensor.x_batterie" />);
    expect(screen.getByText(/12 %/).className).toContain("text-security-alert");
  });

  it("renders nothing when the value is non-numeric/unavailable (never '— %')", () => {
    state.battery = "unavailable";
    const { container } = render(<BatteryPill entityId="sensor.x_batterie" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no battery entity", () => {
    state.battery = null;
    const { container } = render(<BatteryPill />);
    expect(container).toBeEmptyDOMElement();
  });
});
