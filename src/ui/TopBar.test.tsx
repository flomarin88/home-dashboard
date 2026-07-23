import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBar } from "./TopBar";

describe("TopBar (persistent chrome)", () => {
  it("renders the clock (HH:MM)", () => {
    render(<TopBar />);
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
  });

  it("no longer renders the (removed) alarm/cameras placeholders", () => {
    render(<TopBar />);
    expect(screen.queryByText(/désarmé/i)).toBeNull();
    expect(screen.queryByText(/caméras/i)).toBeNull();
  });
});
