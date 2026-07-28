import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBarSlots } from "./TopBarSlots";

describe("TopBarSlots (Story 6.4 — top-bar composition, TD-4)", () => {
  it("flows its children in an out-of-flow flex row positioned against the stage", () => {
    const { container } = render(
      <TopBarSlots>
        <span>a</span>
        <span>b</span>
      </TopBarSlots>,
    );
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    const region = container.firstElementChild as HTMLElement;
    // `absolute`, NOT `fixed`: the region is positioned against the stage
    // (max-w-[1024px], centred), not the viewport. Pinned to the viewport it
    // overlapped the Clock on any window wider than 1024px — the Clock follows
    // the stage's centring while the region did not.
    expect(region.className).toContain("absolute");
    expect(region.className).toContain("flex");
  });

  it("is bounded on the right — a row too wide clips, it never scrolls the kiosk", () => {
    // Pays the "durcissement collision top-bar" debt opened at 6.4, whose
    // trigger ("revisit when a 5th element arrives") was reached when Story
    // 10.1 made this a six-chip row (review 2026-07-28, D3). Unbounded and
    // left-anchored, one chip too many ran past the stage edge — a horizontal
    // overflow on a kiosk whose first rule is that it never scrolls. Clipping
    // is the chosen failure mode: a visibly cut chip is actionable, a scrollbar
    // on a wall-mounted iPad is not.
    const { container } = render(
      <TopBarSlots>
        <span>a</span>
      </TopBarSlots>,
    );
    const region = container.firstElementChild as HTMLElement;
    expect(region.className).toContain("right-6");
    expect(region.className).toContain("overflow-hidden");
  });

  it("a null child (conditional tile absent) leaves no gap and does not crash", () => {
    render(
      <TopBarSlots>
        {null}
        <span>only</span>
      </TopBarSlots>,
    );
    expect(screen.getByText("only")).toBeInTheDocument();
  });
});
