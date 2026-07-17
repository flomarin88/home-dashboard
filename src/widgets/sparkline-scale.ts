/**
 * Pure geometry for a tiny temperature sparkline. Maps values to SVG points
 * ([x, y]) across `width`×`height`, y inverted (SVG origin is top-left). The
 * y-range always includes `threshold` so its dashed reference line stays in
 * view. Returns `thresholdY: null` (and no points) when there is no data.
 */
export function computeSparkline(
  values: number[],
  threshold: number,
  width: number,
  height: number,
): { points: number[][]; thresholdY: number | null } {
  if (values.length === 0) return { points: [], thresholdY: null };

  const lo = Math.min(...values, threshold);
  const hi = Math.max(...values, threshold);
  const span = hi - lo || 1;
  const yFor = (v: number) => height - ((v - lo) / span) * height;

  const n = values.length;
  const points = values.map((v, i) => [
    n === 1 ? 0 : (i / (n - 1)) * width,
    yFor(v),
  ]);

  return { points, thresholdY: yFor(threshold) };
}
