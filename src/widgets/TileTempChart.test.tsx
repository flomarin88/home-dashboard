import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import TileTempChart from "./TileTempChart";

describe("TileTempChart", () => {
  it("draws the trend path with no reference line by default", () => {
    const { container } = render(<TileTempChart values={[20, 21, 22]} />);
    expect(
      screen.getByRole("img", { name: /température/i }),
    ).toBeInTheDocument();
    expect(container.querySelector("path")).toBeInTheDocument();
    expect(container.querySelector("line")).toBeNull();
  });

  it("draws a red dashed reference line at the given setpoint", () => {
    const { container } = render(
      <TileTempChart values={[20, 21, 22]} refTemp={26} />,
    );
    // Drawn even though the setpoint (26) is above the data max (22): the y-range
    // extends to include it so it never falls out of view.
    const line = container.querySelector("line");
    expect(line).toBeInTheDocument();
    expect(line?.getAttribute("stroke-dasharray")).toBe("4 3");
  });

  it("shows 'Pas d'historique' instead of a blank chart when history is empty", () => {
    render(<TileTempChart values={[]} />);
    expect(screen.getByText(/pas d'historique/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /température/i })).toBeNull();
  });
});
