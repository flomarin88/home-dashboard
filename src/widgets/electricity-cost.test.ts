import { describe, it, expect } from "vitest";
import { electricityView, normalisePeriod, toNumber } from "./electricity-cost";

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

describe("normalisePeriod (Story 9.2 — the binary_sensor contract)", () => {
  it("maps the contract states: on = creuses, off = pleines", () => {
    expect(normalisePeriod("on")).toBe("creuses");
    expect(normalisePeriod("off")).toBe("pleines");
  });

  it("tolerates casing and surrounding whitespace", () => {
    expect(normalisePeriod(" ON ")).toBe("creuses");
    expect(normalisePeriod("Off")).toBe("pleines");
  });

  it("returns null for ANY other state — an unknown period is not a period", () => {
    // Guessing here would mean billing at a price nobody chose.
    for (const v of [
      "unavailable",
      "unknown",
      "",
      "true",
      "1",
      null,
      undefined,
    ])
      expect(normalisePeriod(v)).toBeNull();
  });
});

describe("electricityView (Story 9.2 — tariff-aware)", () => {
  const base = { kwh: 8.2, priceCreuses: 0.089, pricePleines: 0.1491 };

  it("applies the CREUSES price while the period is creuses", () => {
    const v = electricityView({ ...base, period: "on" });
    expect(v.period).toBe("creuses");
    expect(v.appliedPrice).toBe(0.089);
    expect(v.cost).toBeCloseTo(0.7298, 6);
  });

  it("applies the PLEINES price while the period is pleines", () => {
    const v = electricityView({ ...base, period: "off" });
    expect(v.period).toBe("pleines");
    expect(v.appliedPrice).toBe(0.1491);
    expect(v.cost).toBeCloseTo(1.22262, 6);
  });

  it("the cost CHANGES across a switch — specified behaviour, asserted on purpose", () => {
    // Florian ruled out per-tariff meters, so the whole day's kWh is priced at
    // the current tariff: the hero figure jumps ~+68% at 06h08 without a single
    // kWh being consumed. Pinned here so nobody "fixes" it by smoothing.
    const creuses = electricityView({ ...base, period: "on" }).cost!;
    const pleines = electricityView({ ...base, period: "off" }).cost!;
    expect(pleines).toBeGreaterThan(creuses);
    expect(pleines / creuses).toBeCloseTo(0.1491 / 0.089, 6);
  });

  it("an unknown period yields NO applied price and NO cost", () => {
    const v = electricityView({ ...base, period: "unavailable" });
    expect(v.period).toBeNull();
    expect(v.appliedPrice).toBeNull();
    expect(v.cost).toBeNull();
  });

  it("does NOT fall back to the other price when the applicable one is missing", () => {
    // The trap: `priceCreuses ?? pricePleines` would silently bill heures
    // creuses at the full rate (+68%). Missing means missing.
    const v = electricityView({
      kwh: 8.2,
      priceCreuses: null,
      pricePleines: 0.1491,
      period: "on",
    });
    expect(v.appliedPrice).toBeNull();
    expect(v.cost).toBeNull();
    expect(v.pricePleines).toBe(0.1491);
  });

  it("returns cost null when consumption is missing, period and prices intact", () => {
    const v = electricityView({ ...base, kwh: null, period: "on" });
    expect(v.cost).toBeNull();
    expect(v.appliedPrice).toBe(0.089);
    expect(v.period).toBe("creuses");
  });

  it("exposes BOTH prices for the detail page, whatever the period", () => {
    const v = electricityView({ ...base, period: "off" });
    expect(v.priceCreuses).toBe(0.089);
    expect(v.pricePleines).toBe(0.1491);
  });

  it("parses raw HA strings, like every other reflected state", () => {
    const v = electricityView({
      kwh: "8.2",
      priceCreuses: "0.0890",
      pricePleines: "0.1491",
      period: "on",
    });
    expect(v.kwh).toBe(8.2);
    expect(v.appliedPrice).toBe(0.089);
  });

  it("handles a zero-consumption day (cost 0, not null)", () => {
    expect(electricityView({ ...base, kwh: 0, period: "on" }).cost).toBe(0);
  });
});
