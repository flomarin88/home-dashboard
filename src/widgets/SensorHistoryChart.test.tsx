import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Stub Recharts — we assert our own wrapper/branches, not the library's rendering.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: unknown }) => children,
  LineChart: ({ children }: { children: unknown }) => children,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}));

import SensorHistoryChart from "./SensorHistoryChart";

const props = {
  color: "var(--color-accent-climate)",
  ariaLabel: "Historique — Température (24 h)",
  unit: "°C",
  decimals: 1,
};

describe("SensorHistoryChart", () => {
  it("renders the labelled chart region when there are ≥2 points", () => {
    render(
      <SensorHistoryChart
        {...props}
        series={[
          { t: 1_752_000_000_000, value: 21 },
          { t: 1_752_003_600_000, value: 22 },
        ]}
      />,
    );
    expect(
      screen.getByRole("img", { name: /Historique — Température/i }),
    ).toBeInTheDocument();
  });

  it("shows a placeholder (never blank) with insufficient data", () => {
    render(
      <SensorHistoryChart
        {...props}
        series={[{ t: 1_752_000_000_000, value: 21 }]}
      />,
    );
    expect(screen.getByText(/Pas d'historique/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
