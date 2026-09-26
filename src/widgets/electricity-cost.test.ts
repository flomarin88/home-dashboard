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

describe("electricityView (Story 9.2 tariff-aware — since 9.4 it prices NOTHING)", () => {
  // Story 9.4: the displayed cost is a long-term statistic computed by HA. This
  // view only answers "which period, which prices, which one applies" for the
  // HC/HP tile of the detail page. The six tests that asserted `cost` (creuses
  // rate, pleines rate, the +68 % jump, missing kWh, raw kWh strings, a zero
  // day) were REMOVED with the behaviour — see sprint-change-proposal-2026-09-25.
  const base = { priceCreuses: 0.089, pricePleines: 0.1491 };

  it("applies the CREUSES price while the period is creuses", () => {
    expect(electricityView({ ...base, period: "on" }).appliedPrice).toBe(0.089);
  });

  it("applies the PLEINES price while the period is pleines", () => {
    expect(electricityView({ ...base, period: "off" }).appliedPrice).toBe(
      0.1491,
    );
  });

  it("an unknown period yields NO applied price", () => {
    const v = electricityView({ ...base, period: "unavailable" });
    expect(v.period).toBeNull();
    expect(v.appliedPrice).toBeNull();
  });

  it("does NOT fall back to the other price when the applicable one is missing", () => {
    // A `priceCreuses ?? pricePleines` would quietly mark the wrong tariff as
    // applied — the +68 % trap, now on the tariff tile rather than on a cost.
    const hc = electricityView({
      priceCreuses: null,
      pricePleines: 0.1491,
      period: "on",
    });
    expect(hc.appliedPrice).toBeNull();
    const hp = electricityView({
      priceCreuses: 0.089,
      pricePleines: "unavailable",
      period: "off",
    });
    expect(hp.appliedPrice).toBeNull();
  });

  it("exposes BOTH prices for the detail page, whatever the period", () => {
    const v = electricityView({ ...base, period: "off" });
    expect(v.priceCreuses).toBe(0.089);
    expect(v.pricePleines).toBe(0.1491);
  });

  it("parses raw HA strings, like every other reflected state", () => {
    const v = electricityView({
      priceCreuses: "0.0890",
      pricePleines: "0.1491",
      period: " on ",
    });
    expect(v.appliedPrice).toBe(0.089);
    expect(v.period).toBe("creuses");
  });

  it("carries NO cost and NO kWh any more — the app does not multiply (Story 9.4, AD-4)", () => {
    const v = electricityView({ ...base, period: "on" }) as Record<
      string,
      unknown
    >;
    expect(v.cost).toBeUndefined();
    expect(v.kwh).toBeUndefined();
  });
});
