import type { CSSProperties } from "react";
import { hvacModeLabel, fanLabel } from "./climate-status";
import {
  buildSegments,
  modeColor,
  fanOpacity,
  distinctValues,
  type TimeSegment,
} from "./climate-timeline";

export interface TimelinePoint {
  /** epoch ms */
  t: number;
  /** hvac_mode (the entity state) */
  mode: string;
  /** fan_mode (attribute), or null when not recorded */
  fan: string | null;
}

/**
 * ClimateTimeline (Intent B2) — two proportional-segment bands over a 24 h
 * window: hvac mode (coloured per mode) and fan speed (cyan intensity by speed),
 * with a mode legend. Bespoke SVG-free flex (Recharts is for line charts). Never
 * blank: too little history → a muted "indisponible" line (AD-6).
 */
export function ClimateTimeline({
  points,
  startMs,
  endMs,
}: {
  points: readonly TimelinePoint[];
  startMs: number;
  endMs: number;
}) {
  const modeSegs = buildSegments(
    points.map((p) => ({ t: p.t, value: p.mode })),
    startMs,
    endMs,
  );
  const fanSegs = buildSegments(
    points.map((p) => ({ t: p.t, value: p.fan })),
    startMs,
    endMs,
  );

  if (modeSegs.length === 0) {
    return <p className="text-meta text-text-muted">Historique indisponible</p>;
  }

  return (
    <div
      className="flex flex-col gap-2"
      role="img"
      aria-label="Historique du mode et de la vitesse sur 24 heures"
    >
      <Band
        label="Mode"
        segs={modeSegs}
        fill={(v) => ({ backgroundColor: modeColor(v) })}
        title={(v) => hvacModeLabel(v)}
      />
      <Band
        label="Vitesse"
        segs={fanSegs}
        fill={(v) => ({
          backgroundColor: "var(--color-accent-climate)",
          opacity: fanOpacity(v),
        })}
        title={(v) => fanLabel(v)}
      />
      <div className="flex justify-between text-caption text-text-muted">
        <span>−24 h</span>
        <span>maintenant</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {distinctValues(modeSegs).map((m) => (
          <span
            key={m}
            className="inline-flex items-center gap-1 text-caption text-text-muted"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: modeColor(m) }}
            />
            {hvacModeLabel(m)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Band({
  label,
  segs,
  fill,
  title,
}: {
  label: string;
  segs: TimeSegment[];
  fill: (v: string | null) => CSSProperties;
  title: (v: string | null) => string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-caption text-text-muted">
        {label}
      </span>
      <div className="flex h-5 flex-1 overflow-hidden rounded bg-tile-fill">
        {segs.map((s, i) => (
          <div
            key={i}
            title={title(s.value)}
            style={{ width: `${s.frac * 100}%`, ...fill(s.value) }}
          />
        ))}
      </div>
    </div>
  );
}
