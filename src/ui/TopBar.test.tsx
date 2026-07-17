import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBar } from "./TopBar";

describe("TopBar (persistent chrome)", () => {
  it("renders alarm + cameras affordances with text labels (UX-DR14)", () => {
    render(<TopBar />);
    // State carried by text + icon, not colour alone.
    expect(screen.getByText(/désarmé/i)).toBeInTheDocument();
    expect(screen.getByText(/caméras/i)).toBeInTheDocument();
  });
});
