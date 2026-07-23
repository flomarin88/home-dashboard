/**
 * Consumption glyphs (Story 9.1) — hand-rolled inline SVGs, no external icon
 * dependency (build order: stdlib/codebase first). Decorative (`aria-hidden`);
 * the tile/page label carries the accessible meaning. Same gabarit as
 * `WeatherIcon` (24×24 viewBox, `currentColor`, strokeWidth 2). Water (`DropIcon`)
 * will join here for Story 9.3.
 */

/** Lightning bolt — electricity. Inherits `currentColor` from `className`. */
export function BoltIcon({
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
      <path d="M13 2 4 14h6l-1 8 10-12h-6z" />
    </svg>
  );
}
