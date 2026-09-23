/**
 * Traffic glyphs (Story 11.1) — hand-rolled inline SVG, no external icon
 * dependency (build order: stdlib/codebase first). Decorative (`aria-hidden`);
 * the button's accessible name carries the meaning. Same gabarit as
 * `ConsumptionIcons`/`AgendaIcons` (24×24 viewBox, `currentColor`, strokeWidth 2).
 */

/** A winding road — home → work. Inherits `currentColor` from `className`. */
export function RouteIcon({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
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
      className={className}
      aria-hidden
    >
      {/* Two endpoints and the road between them. */}
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M6 17V9a3 3 0 0 1 3-3h6" />
      <path d="M18 7v8a3 3 0 0 1-3 3H9" />
    </svg>
  );
}
