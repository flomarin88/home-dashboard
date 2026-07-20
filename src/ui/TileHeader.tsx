import type { ReactNode } from "react";

/**
 * TileHeader — the single shared top row for every home tile: an icon + title on
 * the left, an optional action/indicator on the right (battery pill, power
 * toggle). The left shrinks and truncates (`min-w-0`) so the right slot never
 * overflows a narrow tile. Pass `onOpen` when the title itself should tap through
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
    <div className="flex min-w-0 items-center gap-2">
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
      {right}
    </div>
  );
}
