/**
 * Maps the HA `counter.tortues_repas` state to a view for the tile (Story 6.3).
 * Pure — NO schedule/reset logic here (the daily reset is an HA automation, AD-4);
 * this only translates the reflected counter (0..2 feedings today) into a fill.
 */
export type TurtleFill = "empty" | "half" | "full";

export interface TurtleView {
  /** Feedings done today, clamped 0..2. */
  readonly count: 0 | 1 | 2;
  /** Tile fill level derived from count. */
  readonly fill: TurtleFill;
  /** Both feedings done → tile disabled (stays visible until midnight reset). */
  readonly done: boolean;
}

export function turtleView(state: string | null | undefined): TurtleView {
  const n = Number(state);
  // Non-numeric / unavailable / null → 0 (the tile also dims via isStale).
  const count = (
    Number.isFinite(n) ? Math.max(0, Math.min(2, Math.trunc(n))) : 0
  ) as 0 | 1 | 2;
  const fill: TurtleFill =
    count === 0 ? "empty" : count === 1 ? "half" : "full";
  return { count, fill, done: count >= 2 };
}
