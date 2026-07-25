/**
 * Tailwind column classes keyed by the number of tiles on a home floor's row.
 *
 * Written out as literals (never interpolated) because the Tailwind compiler
 * cannot see dynamically built class names. Deriving the count from the tile
 * LIST — instead of hardcoding one per floor — is what keeps "one row per floor"
 * true: the RDC row used to declare 3 columns while carrying 4 tiles (the
 * `LightTile` added by `lights()` was not counted), which wrapped it onto a
 * second row and pushed the content 56px past the iPad's 748px viewport, so
 * `KioskShell`'s `overflow-hidden` clipped the bottom card. With the column
 * count derived from the list, that desync cannot happen again.
 *
 * Above 6 the row wraps whatever we declare and the kiosk overflows anyway —
 * that would be a layout decision to take, not something this map can absorb.
 *
 * Lives in its own module (not `Home.tsx`) so that file only exports components
 * — a mixed module breaks React Fast Refresh.
 */
export const GRID_COLS: Record<number, string | undefined> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};
