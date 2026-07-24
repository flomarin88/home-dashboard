import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TileTempChart from "./TileTempChart";

// NOTE: diagnostic build — assertions kept minimal on purpose (reverted soon).
describe("TileTempChart (diagnostic)", () => {
  it("renders the diagnostic box", () => {
    render(<TileTempChart values={[20, 21, 22]} />);
    expect(
      screen.getByRole("img", { name: /température/i }),
    ).toBeInTheDocument();
  });

  it("draws the sparkline path with >=2 points", () => {
    const { container } = render(<TileTempChart values={[20, 21, 22]} />);
    expect(container.querySelector("path")).toBeInTheDocument();
  });

  it("draws no sparkline path with empty history", () => {
    const { container } = render(<TileTempChart values={[]} />);
    expect(container.querySelector("path")).toBeNull();
  });
});
