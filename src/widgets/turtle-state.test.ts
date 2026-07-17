import { describe, it, expect } from "vitest";
import { turtleView } from "./turtle-state";

describe("turtleView", () => {
  it("maps each feeding count to a fill level", () => {
    expect(turtleView("0")).toEqual({ count: 0, fill: "empty", done: false });
    expect(turtleView("1")).toEqual({ count: 1, fill: "half", done: false });
    expect(turtleView("2")).toEqual({ count: 2, fill: "full", done: true });
  });

  it("clamps out-of-range counts to 0..2", () => {
    expect(turtleView("3")).toEqual({ count: 2, fill: "full", done: true });
    expect(turtleView("-1")).toEqual({ count: 0, fill: "empty", done: false });
  });

  it("treats unavailable / unknown / null / non-numeric as 0 (dimmed via isStale)", () => {
    const empty = { count: 0, fill: "empty", done: false };
    expect(turtleView("unavailable")).toEqual(empty);
    expect(turtleView("unknown")).toEqual(empty);
    expect(turtleView(null)).toEqual(empty);
    expect(turtleView(undefined)).toEqual(empty);
    expect(turtleView("")).toEqual(empty);
  });
});
