import { describe, it, expect } from "vitest";
import {
  hvacModeLabel,
  fanLabel,
  swingLabel,
  parseTemp,
  clampSetpoint,
  formatSetpoint,
} from "./climate-status";

describe("hvacModeLabel", () => {
  it("maps known hvac_modes to French (heat_cool = Auto)", () => {
    expect(hvacModeLabel("off")).toBe("Éteint");
    expect(hvacModeLabel("heat")).toBe("Chaud");
    expect(hvacModeLabel("cool")).toBe("Froid");
    expect(hvacModeLabel("heat_cool")).toBe("Auto");
    expect(hvacModeLabel("auto")).toBe("Auto");
    expect(hvacModeLabel("dry")).toBe("Sec");
    expect(hvacModeLabel("fan_only")).toBe("Ventilation");
  });
  it("falls through to raw for unknown, — for null/undefined", () => {
    expect(hvacModeLabel("boost")).toBe("boost");
    expect(hvacModeLabel(null)).toBe("—");
    expect(hvacModeLabel(undefined)).toBe("—");
  });
});

describe("fanLabel", () => {
  it("maps Quiet → Silencieux, keeps speeds/Auto as-is", () => {
    expect(fanLabel("Quiet")).toBe("Silencieux");
    expect(fanLabel("Auto")).toBe("Auto");
    expect(fanLabel("3")).toBe("3");
    expect(fanLabel(null)).toBe("—");
  });
});

describe("swingLabel", () => {
  it("maps both HA value shapes (on/off and Swing/Stop)", () => {
    expect(swingLabel("on")).toBe("Balayage");
    expect(swingLabel("off")).toBe("Fixe");
    expect(swingLabel("Swing")).toBe("Balayage");
    expect(swingLabel("Stop")).toBe("Fixe");
    expect(swingLabel("weird")).toBe("weird");
    expect(swingLabel(null)).toBe("—");
  });
});

describe("parseTemp", () => {
  it("parses numeric strings and numbers", () => {
    expect(parseTemp("21.5")).toBe(21.5);
    expect(parseTemp(20)).toBe(20);
  });
  it("returns null for non-numeric / missing", () => {
    expect(parseTemp("unavailable")).toBeNull();
    expect(parseTemp(null)).toBeNull();
    expect(parseTemp(undefined)).toBeNull();
  });
});

describe("clampSetpoint", () => {
  it("keeps in-range values, snapping to the step", () => {
    expect(clampSetpoint(25, 16, 30, 0.5)).toBe(25);
    expect(clampSetpoint(21.3, 16, 30, 0.5)).toBe(21.5);
    expect(clampSetpoint(21.2, 16, 30, 0.5)).toBe(21);
  });
  it("bounds to the entity min/max", () => {
    expect(clampSetpoint(40, 16, 30, 0.5)).toBe(30);
    expect(clampSetpoint(5, 16, 30, 0.5)).toBe(16);
  });
  it("uses 16/30/0.5 fallbacks when min/max/step are missing", () => {
    expect(clampSetpoint(22)).toBe(22);
    expect(clampSetpoint(99)).toBe(30);
    expect(clampSetpoint(0)).toBe(16);
  });
});

describe("formatSetpoint", () => {
  it("drops a trailing .0, keeps a real decimal", () => {
    expect(formatSetpoint(21)).toBe("21");
    expect(formatSetpoint(21.5)).toBe("21.5");
  });
});
