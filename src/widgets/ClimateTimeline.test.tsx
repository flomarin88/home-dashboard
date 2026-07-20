import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  buildSegments,
  modeColor,
  fanOpacity,
  distinctValues,
} from "./climate-timeline";
import { ClimateTimeline } from "./ClimateTimeline";

describe("buildSegments", () => {
  it("splits time-ordered points into proportional segments (last holds to end)", () => {
    const segs = buildSegments(
      [
        { t: 0, value: "cool" },
        { t: 50, value: "heat" },
      ],
      0,
      100,
    );
    expect(segs).toEqual([
      { value: "cool", frac: 0.5 },
      { value: "heat", frac: 0.5 },
    ]);
  });

  it("clamps points that start before the window", () => {
    const segs = buildSegments(
      [
        { t: -50, value: "cool" },
        { t: 50, value: "heat" },
      ],
      0,
      100,
    );
    expect(segs).toEqual([
      { value: "cool", frac: 0.5 },
      { value: "heat", frac: 0.5 },
    ]);
  });

  it("merges adjacent equal values", () => {
    const segs = buildSegments(
      [
        { t: 0, value: "cool" },
        { t: 25, value: "cool" },
        { t: 50, value: "heat" },
      ],
      0,
      100,
    );
    expect(segs).toEqual([
      { value: "cool", frac: 0.5 },
      { value: "heat", frac: 0.5 },
    ]);
  });

  it("returns [] for no points or a non-positive window", () => {
    expect(buildSegments([], 0, 100)).toEqual([]);
    expect(buildSegments([{ t: 0, value: "cool" }], 100, 100)).toEqual([]);
  });
});

describe("colours & intensity", () => {
  it("maps modes to distinct theme tokens; unknown/null → stale", () => {
    expect(modeColor("cool")).toContain("accent-climate");
    expect(modeColor("heat_cool")).toContain("security-ok");
    expect(modeColor("wat")).toContain("stale");
    expect(modeColor(null)).toContain("stale");
  });

  it("ramps fan opacity with numeric speed; faint for a gap", () => {
    expect(fanOpacity(null)).toBeLessThan(fanOpacity("1"));
    expect(fanOpacity("1")).toBeLessThan(fanOpacity("5"));
    expect(fanOpacity("Auto")).toBeGreaterThan(0);
  });

  it("lists distinct segment values in first-seen order", () => {
    expect(
      distinctValues([
        { value: "cool", frac: 0.5 },
        { value: "cool", frac: 0.1 },
        { value: "heat", frac: 0.4 },
        { value: null, frac: 0 },
      ]),
    ).toEqual(["cool", "heat"]);
  });
});

describe("ClimateTimeline", () => {
  const now = 100_000;
  const start = now - 100;
  const points = [
    { t: start, mode: "cool", fan: "Auto" },
    { t: start + 50, mode: "heat", fan: "3" },
  ];

  it("renders the two bands + a mode legend when history exists", () => {
    render(<ClimateTimeline points={points} startMs={start} endMs={now} />);
    expect(
      screen.getByRole("img", { name: /mode et de la vitesse/i }),
    ).toBeInTheDocument();
    // Legend carries both modes present.
    expect(screen.getByText("Froid")).toBeInTheDocument();
    expect(screen.getByText("Chaud")).toBeInTheDocument();
  });

  it("degrades to a muted line when there is no history (never blank)", () => {
    render(<ClimateTimeline points={[]} startMs={start} endMs={now} />);
    expect(screen.getByText(/indisponible/i)).toBeInTheDocument();
  });
});
