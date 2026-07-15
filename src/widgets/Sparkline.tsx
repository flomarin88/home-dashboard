import { computeSparkline } from './sparkline-scale'

/**
 * Tiny temperature sparkline (Ambiance tiles). Hand-rolled inline SVG — no
 * chart lib. Draws the trend curve (climate accent) plus a dashed reference
 * line at `threshold` (alert accent). Renders nothing without enough data.
 * Decorative: the numeric value carries the accessible data (aria-hidden).
 */
export function Sparkline({
  values,
  threshold,
  width = 96,
  height = 32,
}: {
  values: number[]
  threshold: number
  width?: number
  height?: number
}) {
  const { points, thresholdY } = computeSparkline(values, threshold, width, height)
  if (points.length < 2) return null

  const d =
    'M' + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-hidden
      className="h-full min-h-8 w-full"
    >
      {thresholdY !== null && (
        <line
          x1={0}
          y1={thresholdY}
          x2={width}
          y2={thresholdY}
          stroke="var(--color-security-alert)"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.7}
        />
      )}
      <path
        d={d}
        fill="none"
        stroke="var(--color-accent-climate)"
        strokeWidth={1.5}
      />
    </svg>
  )
}
