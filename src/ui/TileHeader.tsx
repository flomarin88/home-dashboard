import type { ReactNode } from "react";

/**
 * TileHeader — the single shared top row for every home tile: an icon + title on
 * the left, an optional action/indicator pinned to the tile's top-right CORNER
 * (battery pill, light state). The left shrinks and truncates (`min-w-0`) so the
 * right slot never overflows a narrow tile. Pass `onOpen` when the title itself should tap through
 * to a detail page (the left becomes a button, a sibling of the right slot — never
 * nested); otherwise the whole tile is usually the tap target and the left is
 * plain text.
 */
export function TileHeader({
  icon,
  title,
  right,
  onOpen,
  openLabel,
}: {
  icon: ReactNode;
  title: string;
  right?: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
}) {
  const inner = (
    <>
      {/* All tile-header icons render muted; the title keeps the tile's text. */}
      <span className="shrink-0 text-text-muted">{icon}</span>
      <span className="truncate">{title}</span>
    </>
  );
  return (
    // `w-full` rather than relying on cross-axis stretch: WebKit does not
    // stretch a flex item inside a `<button>` flex container (the room cards and
    // the vacuum tile are buttons), so the header row shrink-wrapped its content
    // on the iPad and the right slot ended up glued to the title instead of the
    // tile's edge. `justify-between` likewise does not rely on the left slot's
    // `flex-1` actually growing. Both are no-ops on Blink, where stretch and
    // flex-1 already do the job — see the same `w-full` workaround on the CO₂
    // row of `RoomSensorCard`.
    <div className="flex w-full min-w-0 items-center justify-between gap-2">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={openLabel}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-label font-semibold text-text"
        >
          {inner}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2 text-label font-semibold text-text">
          {inner}
        </span>
      )}
      {right ? (
        // Pinned to the tile's top-right CORNER: the negative margins pull the
        // slot out of the header's padded box (every tile is `px-4 py-3`)
        // WITHOUT taking it out of flow — the title keeps truncating against it
        // instead of running underneath, which absolute positioning would cause.
        // `self-start` sits it on the top edge instead of centred on the title.
        <span className="-mt-1.5 -mr-2 shrink-0 self-start">{right}</span>
      ) : null}
    </div>
  );
}
