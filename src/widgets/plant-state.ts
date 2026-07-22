/**
 * Maps the HA `counter.plantes_arrosees` state to a view for the tile (Story 7.1).
 * Pure — NO schedule/reset logic here (the daily reset is an HA automation, AD-4);
 * this only translates the reflected counter (0..1 waterings today) into a fill.
 *
 * The `maximum: 1` twin of `turtleView` (Story 6.3): a single daily gesture, so
 * the fill is binary (empty → full) with no "half" step.
 */
export type PlantFill = "empty" | "full";

export interface PlantView {
  /** Waterings done today, clamped 0..1. */
  readonly count: 0 | 1;
  /** Tile fill level derived from count. */
  readonly fill: PlantFill;
  /** Watering done → tile disabled (stays visible full until midnight reset). */
  readonly done: boolean;
}

export function plantView(state: string | null | undefined): PlantView {
  const n = Number(state);
  // Non-numeric / unavailable / null → 0 (the tile also dims via isStale).
  const count = (
    Number.isFinite(n) ? Math.max(0, Math.min(1, Math.trunc(n))) : 0
  ) as 0 | 1;
  const fill: PlantFill = count === 0 ? "empty" : "full";
  return { count, fill, done: count >= 1 };
}
