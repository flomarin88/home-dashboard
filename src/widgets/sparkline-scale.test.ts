import { describe, it, expect } from "vitest";
import { computeSparkline } from "./sparkline-scale";

describe("computeSparkline", () => {
  it("returns no points and null threshold for empty data", () => {
    expect(computeSparkline([], 26, 100, 40)).toEqual({
      points: [],
      thresholdY: null,
    });
  });

  it("scales values across the width and inverts y (SVG origin top-left)", () => {
    // range [20, 26], height 40 → 20 at bottom (y=40), 26 at top (y=0)
    const { points, thresholdY } = computeSparkline([20, 26], 20, 100, 40);
    expect(points).toEqual([
      [0, 40],
      [100, 0],
    ]);
    expect(thresholdY).toBe(40); // threshold 20 = min = bottom
  });

  it("keeps the threshold in view by extending the range to include it", () => {
    // values max 22, threshold 26 → range becomes [20, 26], threshold at top
    const { thresholdY } = computeSparkline([20, 22], 26, 100, 40);
    expect(thresholdY).toBe(0);
  });

  it("places a single point at x=0", () => {
    const { points } = computeSparkline([22], 26, 100, 40);
    expect(points).toHaveLength(1);
    expect(points[0][0]).toBe(0);
  });
});
