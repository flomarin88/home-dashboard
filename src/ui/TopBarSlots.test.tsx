import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBarSlots } from "./TopBarSlots";

describe("TopBarSlots (Story 6.4 — top-bar composition, TD-4)", () => {
  it("flows its children in a fixed flex row", () => {
    const { container } = render(
      <TopBarSlots>
        <span>a</span>
        <span>b</span>
      </TopBarSlots>,
    );
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    const region = container.firstElementChild as HTMLElement;
    expect(region.className).toContain("fixed");
    expect(region.className).toContain("flex");
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
