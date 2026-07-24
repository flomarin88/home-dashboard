import { useLayoutEffect, useRef, useState } from "react";

/**
 * DIAGNOSTIC BUILD — temporary. Renders a self-describing box in the tile
 * sparkline area to locate the iPad-only blank: a red outline (container
 * extent), the measured px size + point count, a bare SVG line (no viewBox),
 * and the real viewBox sparkline. To be reverted once we read the result.
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
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState("");
  useLayoutEffect(() => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setBox(`${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  });

  const pts = values.length;
  let d = "";
  let refY: number | null = null;
  if (pts >= 2) {
    const pool = refTemp != null ? [...values, refTemp] : values;
    const lo = Math.min(...pool) - 1;
    const hi = Math.max(...pool) + 1;
    const span = hi - lo || 1;
    const yFor = (v: number) => VIEW_H - ((v - lo) / span) * VIEW_H;
    d =
      "M" +
      values
        .map(
          (v, i) =>
            `${((i / (pts - 1)) * VIEW_W).toFixed(1)},${yFor(v).toFixed(1)}`,
        )
        .join(" L");
    if (refTemp != null) refY = yFor(refTemp);
  }

  return (
    <div
      ref={ref}
      className="absolute inset-0"
      role="img"
      aria-label="Température (24 h)"
      style={{
        outline: "2px solid #ff5d5d",
        background: "rgba(53,224,216,0.15)",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 0,
          left: 3,
          fontSize: 9,
          color: "#fff",
          zIndex: 2,
        }}
      >
        DIAG {box} {pts}pts
      </span>

      {/* Test A — SVG basique, pas de viewBox : la ligne blanche doit apparaître
          si le WebKit peint un SVG dans cette boîte. */}
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
      >
        <line
          x1="0"
          y1="100%"
          x2="100%"
          y2="0"
          stroke="#ffffff"
          strokeWidth="1"
        />
      </svg>

      {/* Test B — la sparkline viewBox (couleurs littérales, sans non-scaling). */}
      {pts >= 2 ? (
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {refY != null ? (
            <line
              x1={0}
              y1={refY}
              x2={VIEW_W}
              y2={refY}
              stroke="#ff5d5d"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          ) : null}
          <path d={d} fill="none" stroke="#35e0d8" strokeWidth={3} />
        </svg>
      ) : null}
    </div>
  );
}
