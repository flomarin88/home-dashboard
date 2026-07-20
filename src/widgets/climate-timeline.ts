/**
 * Pure helpers for the climate Mode/Vitesse 24 h timeline (Intent B2), tested
 * without React. A climate entity's history carries the hvac_mode as its state
 * (`s`) and the fan speed as an attribute (`a.fan_mode`), so one `useHistory`
 * call feeds both bands — these turn its time-ordered points into proportional
 * segments and theme colours.
 */

export interface TimeSegment {
  value: string | null;
  /** 0..1 fraction of the window width. */
  frac: number;
}

/**
 * Merge time-ordered `(t, value)` points into contiguous segments over the
 * window `[startMs, endMs]`. Each point holds until the next; the last holds to
 * `endMs`. Points before the window are clamped; adjacent equal values merge.
 */
export function buildSegments(
  points: readonly { t: number; value: string | null }[],
  startMs: number,
  endMs: number,
): TimeSegment[] {
  const total = endMs - startMs;
  if (total <= 0) return [];
  const raw: TimeSegment[] = [];
  for (let i = 0; i < points.length; i++) {
    const segStart = Math.max(points[i].t, startMs);
    const next = i + 1 < points.length ? points[i + 1].t : endMs;
    const segEnd = Math.min(next, endMs);
    if (segEnd <= segStart) continue;
    raw.push({ value: points[i].value, frac: (segEnd - segStart) / total });
  }
  const merged: TimeSegment[] = [];
  for (const s of raw) {
    const last = merged[merged.length - 1];
    if (last && last.value === s.value) last.frac += s.frac;
    else merged.push({ value: s.value, frac: s.frac });
  }
  return merged;
}

/** hvac_mode → segment colour (theme tokens; one accent per domain/state). */
const MODE_COLOR: Readonly<Record<string, string>> = {
  cool: "var(--color-accent-climate)",
  heat: "var(--color-accent-lights)",
  heat_cool: "var(--color-security-ok)",
  auto: "var(--color-security-ok)",
  dry: "var(--color-accent-shutters)",
  fan_only: "var(--color-stale-text)",
};

export function modeColor(mode: string | null): string {
  return (mode && MODE_COLOR[mode]) || "var(--color-stale-text)";
}

/** fan_mode → cyan intensity (0..1): faint for the wordy low modes, ramping up
 * across speeds 1..5. Gaps (null) are barely visible. */
export function fanOpacity(fan: string | null): number {
  if (fan == null) return 0.12;
  const n = Number(fan);
  if (Number.isFinite(n)) {
    const clamped = Math.min(5, Math.max(1, n));
    return 0.35 + (clamped - 1) * 0.16;
  }
  return 0.3; // Auto / Quiet
}

/** Distinct non-null values in first-seen order (for the mode legend). */
export function distinctValues(segments: readonly TimeSegment[]): string[] {
  const seen: string[] = [];
  for (const s of segments) {
    if (s.value != null && !seen.includes(s.value)) seen.push(s.value);
  }
  return seen;
}
