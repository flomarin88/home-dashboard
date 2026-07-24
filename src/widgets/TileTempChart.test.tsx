import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: unknown }) => children,
  LineChart: ({ children }: { children: unknown }) => children,
  Line: () => null,
  YAxis: () => null,
  ReferenceLine: (props: { y?: number }) =>
    props.y != null ? (
      <div data-testid="ref-line" data-y={String(props.y)} />
    ) : null,
}));

import TileTempChart from "./TileTempChart";

describe("TileTempChart", () => {
  it("renders a read-only temperature chart with no reference line by default", () => {
    render(<TileTempChart values={[20, 21, 22]} />);
    expect(
      screen.getByRole("img", { name: /température/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("ref-line")).toBeNull();
  });

  it("draws a red dashed reference line at the given setpoint", () => {
    render(<TileTempChart values={[20, 21, 22]} refTemp={26} />);
    const line = screen.getByTestId("ref-line");
    expect(line).toBeInTheDocument();
    expect(line.getAttribute("data-y")).toBe("26");
  });

  it("shows 'Pas d'historique' instead of a blank chart when history is empty", () => {
    render(<TileTempChart values={[]} />);
    expect(screen.getByText(/pas d'historique/i)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /température/i })).toBeNull();
  });
});
