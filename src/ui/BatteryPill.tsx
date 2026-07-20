import { useEntity } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import { parseBattery, batteryColorClass } from "../widgets/vacuum-status";

/**
 * BatteryPill — a small top-right battery indicator: glyph (proportional fill) +
 * level %, coloured by level (`batteryColorClass`: green ≥50, amber ≥20, red).
 * Reads the given battery sensor live and renders NOTHING when there's no
 * battery entity or its value is non-numeric/unavailable (e.g. a mains-powered
 * module) — never an empty "— %". The pure parse/colour helpers come from
 * `vacuum-status` (they are generic, not vacuum-specific).
 */
export function BatteryPill({
  entityId,
  charging = false,
}: {
  entityId?: string;
  charging?: boolean;
}) {
  const entity = useEntity((entityId ?? "unknown") as EntityName, {
    returnNullIfNotFound: true,
  });
  const level = parseBattery(entity?.state);
  if (level == null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-caption tabular-nums ${batteryColorClass(
        level,
      )}`}
      aria-label={`Batterie ${level} %`}
    >
      {charging ? <BoltIcon /> : null}
      <BatteryGlyph level={level} />
      {level} %
    </span>
  );
}

/** Battery outline with a proportional fill; colour is inherited (currentColor). */
function BatteryGlyph({ level }: { level: number }) {
  const fill = (Math.max(0, Math.min(100, level)) / 100) * 13;
  return (
    <svg width={22} height={14} viewBox="0 0 24 16" fill="none" aria-hidden>
      <rect
        x="1.5"
        y="3.5"
        width="17"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect x="20" y="6" width="2.5" height="4" rx="1" fill="currentColor" />
      <rect
        x="3.5"
        y="5.5"
        width={fill}
        height="5"
        rx="0.5"
        fill="currentColor"
      />
    </svg>
  );
}

/** Charging bolt shown before the glyph when the module is on power. */
function BoltIcon() {
  return (
    <svg
      width={10}
      height={12}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M13 2 4 14h6l-1 8 10-12h-6z" />
    </svg>
  );
}
