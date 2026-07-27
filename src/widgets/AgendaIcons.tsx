/**
 * Agenda icons (Story 10.1) — local SVG, no icon dependency (build order:
 * stdlib/codebase before a library). Same 24×24 stroke template as
 * `WeatherIcon` / `ConsumptionIcons`, so the top-bar family stays coherent.
 */

/** Calendar glyph — path taken from the approved mock (mock-agenda-approches). */
export function CalendarIcon({
  size = 20,
  className = "",
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
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
