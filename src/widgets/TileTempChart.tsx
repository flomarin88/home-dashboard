import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  ReferenceLine,
} from "recharts";

/**
 * TileTempChart (Intent G) — the read-only glance temperature sparkline on the
 * home room cards, drawn with Recharts (replacing the hand-rolled SVG so the
 * tiles and the detail charts share one rendering + reference-line treatment).
 * Deliberately bare: a single line, NO axes / grid / tooltip / interaction — it
 * is read-only. `refTemp` draws a red dashed reference line (the upstairs A/C
 * setpoint, on the étage rooms); `ifOverflow="extendDomain"` keeps it visible
 * even when the room sits below the setpoint (that gap is the point).
 */
export default function TileTempChart({
  values,
  refTemp,
}: {
  values: number[];
  refTemp?: number | null;
}) {
  // Empty/single-point history draws nothing in Recharts (a silent blank block).
  // Surface it explicitly so a missing sparkline reads as "no data" rather than
  // an invisible render failure — mirrors SensorHistoryChart's guard.
  if (values.length < 2) {
    return (
      <div className="absolute inset-0 flex items-center">
        <span className="text-meta text-text-muted">Pas d'historique</span>
      </div>
    );
  }

  const data = values.map((value) => ({ value }));
  return (
    // `absolute inset-0` (parent is `relative`) gives a definite px box so
    // ResponsiveContainer measures a real height — a %-height chain collapses to
    // 0 inside a flex item on WebKit (iPad / iOS), rendering nothing.
    <div
      className="absolute inset-0"
      role="img"
      aria-label="Température (24 h)"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 2, bottom: 2, left: 2 }}
        >
          <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
          {refTemp != null ? (
            <ReferenceLine
              y={refTemp}
              stroke="var(--color-security-alert)"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              ifOverflow="extendDomain"
            />
          ) : null}
          <Line
            dataKey="value"
            type="monotone"
            stroke="var(--color-accent-climate)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
