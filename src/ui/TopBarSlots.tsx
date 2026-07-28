import type { ReactNode } from "react";

/**
 * TopBarSlots — the top-bar composition layer (Story 6.4, pays TD-4).
 *
 * The HA-backed top-bar tiles can't live in `TopBar` (it stays ABOVE the
 * connection gate, TD-1), so they are mounted here, UNDER the provider. This is a
 * layout-only out-of-flow region that FLOWS its children in a row (flex) instead
 * of each tile hand-placing itself with `left-…` coordinates. So adding a tile
 * (turtle, 6.3) can't cause coordinate collisions, and a conditional tile that
 * renders `null` (e.g. `BinTile` when no bin is due) simply leaves no gap.
 *
 * Left-anchored next to the Clock (date/time), flowing rightward across the
 * (now free) top-bar space — the first child (weather) sits closest to the clock.
 * Offsets validated on the real iPad (TD-4).
 *
 * `absolute`, NOT `fixed`: the frame of reference must be the STAGE (`relative`,
 * `max-w-[1024px]`, centred — see `KioskShell`), not the viewport. Pinned to the
 * viewport, this region stayed 176px from the screen edge while the Clock
 * followed the stage's centring, so the two overlapped as soon as the window was
 * wider than 1024px. On the iPad (viewport = 1024 = stage) both frames coincide,
 * so the offsets validated on the device are unchanged. Same pattern as
 * `CommitTag`, which is already positioned against the stage.
 *
 * BOUNDED on the right (`right-6` + `overflow-hidden`), pays the "durcissement
 * collision top-bar" debt opened at 6.4 — whose stated trigger, "revisit when a
 * 5th element arrives", was reached when Story 10.1 made this a six-chip row
 * (review 2026-07-28, D3). Until now the row was left-anchored and unbounded:
 * one chip too many and the children simply ran past the stage edge, which on a
 * kiosk that must NEVER scroll means a horizontal overflow, not a tidy ellipsis.
 * Clipping is the deliberate failure mode — a visibly cut chip is a signal you
 * can act on; a scrollbar on a wall-mounted iPad is not. This bounds the box, it
 * does NOT prove the six chips fit: that is the device pass at 1024×748, still
 * owed, on a day `BinTile` is showing.
 */
export function TopBarSlots({ children }: { children: ReactNode }) {
  return (
    <div className="absolute left-44 right-6 top-6 z-40 flex items-center gap-3 overflow-hidden">
      {children}
    </div>
  );
}
