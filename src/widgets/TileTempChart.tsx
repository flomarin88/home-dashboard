/**
 * TileTempChart — the read-only glance temperature sparkline on the home room
 * cards. Hand-rolled inline SVG (no chart lib) on purpose: the Recharts version
 * (introduced in 84d2f8b) rendered blank on the kiosk's older iPad WebkKit —
 * ResponsiveContainer measures the tiny flex-sized tile box as 0 there, so
 * nothing paints (the detail-page charts, in a large fixed-height block, render
 * fine, so Recharts itself is not the problem — the tile's constraints are). A
 * bare <svg> has no async measurement and no clip, so that WebKit paints it
 * reliably; it's also the tile's original, known-good design and keeps Recharts
 * off the warm-start bundle.
 *
 * One trend line (climate accent) plus an optional dashed reference line at
 * `refTemp` (the upstairs A/C setpoint on the étage rooms, a static 26° on the
 * RDC). The y-range always includes `refTemp`, so the reference line stays
 * visible even when the room sits below it (that gap is the point).
 * `preserveAspectRatio="none"` stretches the fixed viewBox to the tile; a
 * `non-scaling-stroke` keeps the line crisp despite the non-uniform scaling.
 */
const VIEW_W = 100;
const VIEW_H = 40;

export default function TileTempChart({
  values,
  refTemp,
}: {
  values: number[];
  refTemp?: number | null;
}) {
  // Empty/single-point history: nothing to draw. Surface it explicitly (a blank
  // block would read as a render failure), mirroring SensorHistoryChart.
  if (values.length < 2) {
    return (
      <div className="absolute inset-0 flex items-center">
        <span className="text-meta text-text-muted">Pas d'historique</span>
      </div>
    );
  }

  // y-range spans the data AND the reference line so the latter is always drawn.
  const pool = refTemp != null ? [...values, refTemp] : values;
  const lo = Math.min(...pool) - 1;
  const hi = Math.max(...pool) + 1;
  const span = hi - lo || 1;
  const yFor = (v: number) => VIEW_H - ((v - lo) / span) * VIEW_H;

  const d =
    "M" +
    values
      .map(
        (v, i) =>
          `${((i / (values.length - 1)) * VIEW_W).toFixed(1)},${yFor(v).toFixed(1)}`,
      )
      .join(" L");

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="Température (24 h)"
    >
      {refTemp != null ? (
        <line
          x1={0}
          y1={yFor(refTemp)}
          x2={VIEW_W}
          y2={yFor(refTemp)}
          stroke="var(--color-security-alert)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke="var(--color-accent-climate)"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
