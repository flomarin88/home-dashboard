import { describe, it, expect } from "vitest";
import { plantView } from "./plant-state";

describe("plantView", () => {
  it("maps each watering count to a fill level", () => {
    expect(plantView("0")).toEqual({ count: 0, fill: "empty", done: false });
    expect(plantView("1")).toEqual({ count: 1, fill: "full", done: true });
  });

  it("clamps out-of-range counts to 0..1", () => {
    expect(plantView("2")).toEqual({ count: 1, fill: "full", done: true });
    expect(plantView("-1")).toEqual({ count: 0, fill: "empty", done: false });
  });

  it("treats unavailable / unknown / null / non-numeric as 0 (dimmed via isStale)", () => {
    const empty = { count: 0, fill: "empty", done: false };
    expect(plantView("unavailable")).toEqual(empty);
    expect(plantView("unknown")).toEqual(empty);
    expect(plantView(null)).toEqual(empty);
    expect(plantView(undefined)).toEqual(empty);
    expect(plantView("")).toEqual(empty);
  });
});
