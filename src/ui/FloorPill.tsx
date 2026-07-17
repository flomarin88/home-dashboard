/**
 * FloorPill — a small floor indicator (0 = rez-de-chaussée, 1 = étage), shown
 * top-right of a home tile. One colour per floor so the two levels read apart at
 * a glance. Static structural info (from the AD-7 mapping), not live HA state.
 */
export function FloorPill({ floor }: { floor: 0 | 1 }) {
  const cls =
    floor === 0
      ? "bg-accent-shutters/20 text-accent-shutters"
      : "bg-accent-climate/20 text-accent-climate";
  return (
    <span
      aria-label={`Étage ${floor}`}
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-caption font-semibold tabular-nums ${cls}`}
    >
      {floor}
    </span>
  );
}
