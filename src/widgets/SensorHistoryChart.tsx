import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

export interface HistoryPoint {
  /** epoch ms */
  readonly t: number;
  readonly value: number;
  /** Bar mode only: this point's own fill (e.g. a tariff token); falls back to `color`. */
  readonly color?: string;
  /** Bar mode only: what the tooltip calls this point's series (e.g. "HC"); falls back to "Valeur". */
  readonly label?: string;
}

export interface SensorHistoryChartProps {
  readonly series: HistoryPoint[];
  /** CSS colour for the line (a theme token var, e.g. var(--color-accent-climate)). */
  readonly color: string;
  /** Accessible label, e.g. "Historique de la température sur 24 heures". */
  readonly ariaLabel: string;
  /** Y-axis tick suffix (e.g. "°" for temperature, "" for CO₂). */
  readonly tickSuffix?: string;
  /** Unit shown in the tooltip (e.g. "°C", "ppm", "%"). */
  readonly unit: string;
  /** Decimals for the tooltip value. */
  readonly decimals?: number;
  /**
   * Force Y-axis ticks (and gridlines) at this step — e.g. `1` for whole-degree
   * temperature. Omit for auto ticks (CO₂/humidity, where a fixed step is
   * nonsensical). Ignored if it would produce too many lines.
   */
  readonly tickStep?: number;
  /**
   * Horizontal reference lines (e.g. 26° red / 20° blue on temperature). Only
   * shown when within the visible Y range (`ifOverflow="hidden"`).
   */
  readonly referenceLines?: readonly { y: number; color: string }[];
  /**
   * `"line"` (default) for a continuous measure sampled over time; `"bar"` for
   * a quantity PER period (hourly kWh, Story 9.4), where a line would suggest
   * a value between two hours that does not exist. Same axes, same tooltip.
   */
  readonly kind?: "line" | "bar";
}

/**
 * Interactive 24 h sensor-history chart (Story 6.2 → reused for room detail).
 * Recharts (Florian's call, 2026-07-17): touch/hover shows a themed tooltip.
 * Measure-agnostic — temperature (/meteo) and room CO₂/humidity all share it.
 * Y-axis = values, dashed horizontal gridlines, NO threshold line (the home
 * `Sparkline` stays hand-rolled). Fills its block via `ResponsiveContainer`.
 * Default-exported so it can be lazy-loaded on the route (keeps Recharts off the
 * home warm-start bundle).
 */
export default function SensorHistoryChart({
  series,
  color,
  ariaLabel,
  tickSuffix = "",
  unit,
  decimals = 1,
  tickStep,
  referenceLines,
  kind = "line",
}: SensorHistoryChartProps) {
  if (series.length < 2) {
    return <span className="text-meta text-text-muted">Pas d'historique</span>;
  }

  const yTicks = tickStep ? stepTicks(series, tickStep) : undefined;
  const Chart = kind === "bar" ? BarChart : LineChart;

  return (
    <div
      // Recharts makes its wrapper/surface focusable (tabIndex) → a blue focus
      // ring on tap. Unwanted on a kiosk — suppress it on the chart + descendants.
      className="h-full w-full outline-none [&_*]:outline-none"
      role="img"
      aria-label={ariaLabel}
    >
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={series} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid
            vertical={false}
            strokeDasharray="4 4"
            stroke="var(--color-text-muted)"
            opacity={0.35}
          />
          {/* Bars need a categorical (band) axis to get a width; a continuous
              time axis gives them none. Both still tick as hours. */}
          {kind === "bar" ? (
            <XAxis
              dataKey="t"
              type="category"
              tickFormatter={hourTick}
              minTickGap={44}
              tickLine={false}
              stroke="var(--color-text-muted)"
              tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
            />
          ) : (
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={hourTick}
              minTickGap={44}
              tickLine={false}
              stroke="var(--color-text-muted)"
              tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
            />
          )}
          <YAxis
            dataKey="value"
            width={44}
            domain={
              yTicks ? [yTicks[0], yTicks[yTicks.length - 1]] : ["auto", "auto"]
            }
            ticks={yTicks}
            allowDecimals={!yTicks}
            tickFormatter={(v: number) => `${Math.round(v)}${tickSuffix}`}
            tickLine={false}
            stroke="var(--color-text-muted)"
            tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
          />
          <Tooltip
            isAnimationActive={false}
            labelFormatter={(t) => fullTick(Number(t))}
            formatter={(v, _name, item) => [
              `${Number(v).toFixed(decimals)} ${unit}`,
              (item?.payload as HistoryPoint | undefined)?.label ?? "Valeur",
            ]}
            contentStyle={{
              background: "var(--color-card-fill)",
              border: "1px solid var(--color-card-border)",
              borderRadius: 8,
              color: "var(--color-text)",
              backdropFilter: "blur(8px)",
            }}
            labelStyle={{ color: "var(--color-text-muted)" }}
          />
          {referenceLines?.map((r) => (
            <ReferenceLine
              key={r.y}
              y={r.y}
              stroke={r.color}
              strokeWidth={1}
              strokeDasharray="5 3"
              ifOverflow="hidden"
            />
          ))}
          {kind === "bar" ? (
            <Bar
              dataKey="value"
              fill={color}
              radius={[2, 2, 0, 0]}
              isAnimationActive={false}
            >
              {/* One Cell per bar so each hour can wear its own tariff colour;
                  a bar with no `color` keeps the series colour. */}
              {series.map((p) => (
                <Cell key={p.t} fill={p.color ?? color} />
              ))}
            </Bar>
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
            />
          )}
        </Chart>
      </ResponsiveContainer>
    </div>
  );
}

const HOUR_FMT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const FULL_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function hourTick(t: number): string {
  return HOUR_FMT.format(new Date(t));
}
function fullTick(t: number): string {
  return FULL_FMT.format(new Date(t));
}

/** Ticks at every `step` spanning the series' rounded range; undefined if it
 *  would produce too many gridlines (safety for large-range measures). */
function stepTicks(series: HistoryPoint[], step: number): number[] | undefined {
  const values = series.map((s) => s.value);
  const lo = Math.floor(Math.min(...values) / step) * step;
  const hi = Math.ceil(Math.max(...values) / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step * 1e-6; v += step) {
    ticks.push(Math.round(v * 100) / 100);
    if (ticks.length > 24) return undefined;
  }
  return ticks;
}
