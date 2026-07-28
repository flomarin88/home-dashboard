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

/**
 * Crescent moon — heures creuses (Story 9.2). Decorative: the pill's text
 * carries the meaning, because UX-DR14 forbids leaning on a glyph or a colour
 * alone to tell the two periods apart.
 */
export function MoonIcon({
  size = 14,
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
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

/** Sun — heures pleines (Story 9.2). Decorative, same rule as `MoonIcon`. */
export function SunIcon({
  size = 14,
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/**
 * The glyph for a tariff period, or nothing when HA hasn't said which it is.
 * Kept here so the tile and the detail page can't drift on which shape means
 * what.
 */
export function PeriodIcon({
  period,
  size = 14,
  className,
}: {
  period: "creuses" | "pleines" | null;
  size?: number;
  className?: string;
}) {
  if (period === "creuses")
    return <MoonIcon size={size} className={className} />;
  if (period === "pleines")
    return <SunIcon size={size} className={className} />;
  return null;
}
