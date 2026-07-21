import { useNavigate } from "react-router-dom";
import { useGrocerySummary } from "../nutriclaude";
import {
  formatPreview,
  formatRelativeTime,
} from "../nutriclaude/summary-format";
import { OfflinePill } from "../ui/OfflinePill";
import { TileHeader } from "../ui/TileHeader";
import { Skeleton } from "../ui/Skeleton";

/** Shopping-cart glyph — inline SVG, matching the hand-rolled icon set (WeatherIcon). */
function CartIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
      <path d="M2 3h2l2.4 12a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L21 7H5" />
    </svg>
  );
}

/**
 * Courses tile (Story 8.1, FR-1/FR-5, UX-DR19) — the household grocery list at a
 * glance, from NutriClaude (a 2nd source of truth, isolated seam — AD-12). Same
 * device-tile mould as the room cards: three states sharing ONE footprint
 * (loading skeleton · offline last-known + "Hors ligne" pill · live count +
 * preview). Tinted with `accent-courses` (rose) when the list is non-empty.
 *
 * Lecture-only in this story; a tap opens the (stub) detail route `/courses`
 * (the real page is Story 8.2). Obsolescence is the non-HA variant (AD-6/AD-14):
 * when NutriClaude is unreachable the tile keeps the last-known count + pill,
 * never blank. Renders independent of Home Assistant (the two layers are isolated).
 */
export function CoursesTile() {
  const navigate = useNavigate();
  const { pendingCount, lastAdded, isStale, loading, since } =
    useGrocerySummary();

  const offline = !loading && isStale;
  const active = !loading && !offline && pendingCount > 0;
  const names = lastAdded.map((a) => a.name);
  const preview = formatPreview(names, pendingCount);
  const relative = formatRelativeTime(since, Date.now());

  return (
    <button
      type="button"
      onClick={() => navigate("/courses")}
      className={[
        "device-tile flex cursor-pointer flex-col gap-1 rounded-md border px-4 py-3 text-left",
        offline
          ? "border-dashed border-stale text-stale-text"
          : "border-tile-border bg-tile-fill text-text",
      ].join(" ")}
      data-domain="courses"
      data-state={active ? "on" : undefined}
    >
      <TileHeader icon={<CartIcon />} title="Courses" />

      {/* Count row — fixed height so loading/offline/live share one footprint (CLS). */}
      <div className="flex h-8 items-center gap-2">
        {loading ? (
          <Skeleton className="h-6 w-24" />
        ) : (
          <span className="text-numeric-lg font-semibold tabular-nums">
            {pendingCount}
            <span className="ml-2 text-meta font-normal text-text-muted">
              à acheter
            </span>
          </span>
        )}
      </div>

      {/* Preview row — recent adds (names only; provenance prénom is Story 8.2). */}
      <div className="flex h-4 items-center">
        {loading ? (
          <Skeleton className="h-3 w-28" />
        ) : offline ? null : (
          <span className="truncate text-meta text-text-muted">{preview}</span>
        )}
      </div>

      {/* Footer — offline pill, or the last-update relative time when live. */}
      <div className="mt-1 min-h-[2rem] flex-1">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : offline ? (
          <div className="flex h-full items-center">
            <OfflinePill since={since} />
          </div>
        ) : relative ? (
          <span className="text-caption text-text-muted">{relative}</span>
        ) : null}
      </div>
    </button>
  );
}
