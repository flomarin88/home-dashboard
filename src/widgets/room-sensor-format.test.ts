import { describe, it, expect } from "vitest";
import {
  formatSensorValue,
  co2ColorClass,
  co2Color,
} from "./room-sensor-format";

describe("formatSensorValue", () => {
  it("rounds to the requested decimals", () => {
    expect(formatSensorValue("21.53", 1)).toBe("21.5");
    expect(formatSensorValue("21", 1)).toBe("21.0");
    expect(formatSensorValue("620", 0)).toBe("620");
    expect(formatSensorValue("47.6", 0)).toBe("48");
  });

  it("returns the em-dash placeholder for missing / non-numeric state", () => {
    for (const bad of ["unavailable", "unknown", "", undefined, null, "abc"]) {
      expect(formatSensorValue(bad, 1)).toBe("—");
    }
  });
});

describe("co2ColorClass", () => {
  it("green < 1000, orange 1000–2000, red ≥ 2000 (ppm)", () => {
    expect(co2ColorClass("620")).toBe("text-security-ok");
    expect(co2ColorClass("999")).toBe("text-security-ok");
    expect(co2ColorClass("1000")).toBe("text-accent-lights");
    expect(co2ColorClass("1500")).toBe("text-accent-lights");
    expect(co2ColorClass("2000")).toBe("text-security-alert");
    expect(co2ColorClass("2500")).toBe("text-security-alert");
  });
  it("neutral for missing / non-numeric", () => {
    for (const bad of ["unavailable", "unknown", "", null, undefined]) {
      expect(co2ColorClass(bad)).toBe("text-text");
    }
  });
});

describe("co2Color (chart stroke — same thresholds as the value)", () => {
  it("maps ppm to the matching CSS colour var (green / orange / red)", () => {
    expect(co2Color("620")).toBe("var(--color-security-ok)");
    expect(co2Color("999")).toBe("var(--color-security-ok)");
    expect(co2Color("1000")).toBe("var(--color-accent-lights)");
    expect(co2Color("1999")).toBe("var(--color-accent-lights)");
    expect(co2Color("2000")).toBe("var(--color-security-alert)");
    expect(co2Color("2500")).toBe("var(--color-security-alert)");
  });
  it("neutral (muted) for missing / non-numeric", () => {
    for (const bad of ["unavailable", "unknown", "", null, undefined]) {
      expect(co2Color(bad)).toBe("var(--color-text-muted)");
    }
  });
});
