import { describe, it, expect } from "vitest";
import {
  trendArrow,
  trendColorClass,
  conditionCategory,
  conditionLabel,
  forecastDayLabel,
  forecastHourLabel,
} from "./weather-format";

describe("trendArrow", () => {
  it("maps Netatmo trend states to arrows", () => {
    expect(trendArrow("up")).toBe("↑");
    expect(trendArrow("down")).toBe("↓");
    expect(trendArrow("stable")).toBe("→");
  });
  it("empty for unknown/absent", () => {
    expect(trendArrow("unknown")).toBe("");
    expect(trendArrow(null)).toBe("");
  });
});

describe("conditionCategory", () => {
  it("maps known HA conditions", () => {
    expect(conditionCategory("sunny")).toBe("sun");
    expect(conditionCategory("cloudy")).toBe("cloud");
    expect(conditionCategory("rainy")).toBe("rain");
    expect(conditionCategory("pouring")).toBe("rain");
    expect(conditionCategory("snowy")).toBe("snow");
    expect(conditionCategory("fog")).toBe("fog");
  });
  it("falls back to thermo for unknown/absent", () => {
    expect(conditionCategory("exceptional")).toBe("thermo");
    expect(conditionCategory(null)).toBe("thermo");
  });
});

describe("trendColorClass", () => {
  it("warming = red, cooling = blue, else muted", () => {
    expect(trendColorClass("up")).toBe("text-security-alert");
    expect(trendColorClass("down")).toBe("text-accent-shutters");
    expect(trendColorClass("stable")).toBe("text-text-muted");
    expect(trendColorClass(null)).toBe("text-text-muted");
  });
});

describe("conditionLabel", () => {
  it("maps known HA conditions to French", () => {
    expect(conditionLabel("sunny")).toBe("Ensoleillé");
    expect(conditionLabel("rainy")).toBe("Pluie");
    expect(conditionLabel("snowy")).toBe("Neige");
  });
  it("em-dash for unknown/absent", () => {
    expect(conditionLabel("nope")).toBe("—");
    expect(conditionLabel(null)).toBe("—");
  });
});

describe("forecast date labels", () => {
  it("formats a valid ISO datetime (tz-independent shape)", () => {
    // Value depends on the runner tz; assert the SHAPE, not the exact hour/day.
    expect(forecastDayLabel("2026-07-17T09:00:00+00:00")).toMatch(/[a-zà-ÿ]/i);
    expect(forecastHourLabel("2026-07-17T09:00:00+00:00")).toMatch(
      /^\d{1,2} h$/,
    );
  });
  it("empty string for invalid/absent input", () => {
    expect(forecastDayLabel("not-a-date")).toBe("");
    expect(forecastDayLabel(null)).toBe("");
    expect(forecastHourLabel("nope")).toBe("");
    expect(forecastHourLabel(undefined)).toBe("");
  });
});
