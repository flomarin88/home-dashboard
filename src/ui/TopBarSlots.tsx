import type { ReactNode } from "react";

/**
 * TopBarSlots — the top-bar composition layer (Story 6.4, pays TD-4).
 *
 * The HA-backed top-bar tiles can't live in `TopBar` (it stays ABOVE the
 * connection gate, TD-1), so they are mounted here, UNDER the provider. This is a
 * layout-only `fixed` region that FLOWS its children in a row (flex) instead of
 * each tile hand-placing itself with `fixed left-…` coordinates. So adding a tile
 * (turtle, 6.3) can't cause coordinate collisions, and a conditional tile that
 * renders `null` (e.g. `BinTile` when no bin is due) simply leaves no gap.
 *
 * Left-anchored next to the Clock (date/time), flowing rightward across the
 * (now free) top-bar space — the first child (weather) sits closest to the clock.
 * Offsets validated on the real iPad (TD-4).
 */
export function TopBarSlots({ children }: { children: ReactNode }) {
  return (
    <div className="fixed left-44 top-6 z-40 flex items-center gap-3">
      {children}
    </div>
  );
}
