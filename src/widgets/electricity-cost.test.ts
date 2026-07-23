import { describe, it, expect } from "vitest";
import { electricityView, toNumber } from "./electricity-cost";

describe("toNumber", () => {
  it("parses numeric strings and numbers", () => {
    expect(toNumber("8.2")).toBe(8.2);
    expect(toNumber(0)).toBe(0);
    expect(toNumber("0")).toBe(0);
  });

  it("returns null for missing / non-numeric input", () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber("")).toBeNull();
    expect(toNumber("unavailable")).toBeNull();
    expect(toNumber("unknown")).toBeNull();
  });
});

describe("electricityView (Story 9.1, AD-16)", () => {
  it("derives cost = kWh × price", () => {
    const v = electricityView({ kwh: "8.2", price: "0.18" });
    expect(v.kwh).toBe(8.2);
    expect(v.price).toBe(0.18);
    expect(v.cost).toBeCloseTo(1.476, 5);
  });

  it("returns cost null when consumption is missing (no invented cost)", () => {
    const v = electricityView({ kwh: "unavailable", price: "0.18" });
    expect(v.kwh).toBeNull();
    expect(v.price).toBe(0.18);
    expect(v.cost).toBeNull();
  });

  it("returns cost null when price is missing", () => {
    const v = electricityView({ kwh: "8.2", price: null });
    expect(v.kwh).toBe(8.2);
    expect(v.price).toBeNull();
    expect(v.cost).toBeNull();
  });

  it("handles a zero-consumption day (cost 0, not null)", () => {
    const v = electricityView({ kwh: "0", price: "0.18" });
    expect(v.kwh).toBe(0);
    expect(v.cost).toBe(0);
  });
});
