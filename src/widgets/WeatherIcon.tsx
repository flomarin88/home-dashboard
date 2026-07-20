import type { ReactNode } from "react";
import { conditionCategory } from "./weather-format";
import type { ConditionCategory } from "./weather-format";
import type { RoomKind } from "../entities";

/**
 * Weather condition icon (Story 6.2). Maps a HA `weather.*` condition state to a
 * hand-rolled inline SVG glyph via `conditionCategory`. Unknown/absent → the
 * thermometer (the pre-integration default). Decorative (`aria-hidden`); the
 * condition text/label carries the accessible meaning.
 */
export function WeatherIcon({
  condition,
  size = 20,
  className,
}: {
  condition: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const category = conditionCategory(condition);
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
      className={className ?? CATEGORY_COLOR[category]}
      aria-hidden
    >
      {GLYPH[category]}
    </svg>
  );
}

/** Humidity droplet — shared by the top-bar widget and the /meteo Actuel tile. */
export function DropletIcon({ size = 14 }: { size?: number }) {
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
      className="text-accent-shutters"
      aria-hidden
    >
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  );
}

/** Sunrise glyph — sun over the horizon with an up arrow. */
export function SunriseIcon({ size = 14 }: { size?: number }) {
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
      className="text-accent-lights"
      aria-hidden
    >
      <path d="M12 2v8" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="m8 6 4-4 4 4" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </svg>
  );
}

/** Sunset glyph — sun over the horizon with a down arrow. */
export function SunsetIcon({ size = 14 }: { size?: number }) {
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
      className="text-accent-lights"
      aria-hidden
    >
      <path d="M12 10V2" />
      <path d="m4.93 10.93 1.41 1.41" />
      <path d="M2 18h2" />
      <path d="M20 18h2" />
      <path d="m19.07 10.93-1.41 1.41" />
      <path d="M22 22H2" />
      <path d="m16 6-4 4-4-4" />
      <path d="M16 18a4 4 0 0 0-8 0" />
    </svg>
  );
}

/** Sound-level (noise) glyph — a speaker with waves. */
export function NoiseIcon({ size = 14 }: { size?: number }) {
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
      className="text-accent-vacuum"
      aria-hidden
    >
      <path d="M3 9v6h4l5 4V5L7 9H3z" />
      <path d="M16 8a5 5 0 0 1 0 8" />
    </svg>
  );
}

/** Air-quality leaf — CO₂ marker. Inherits `currentColor` so it can take the
 *  air-quality threshold colour (green/orange/red) from its parent. */
export function Co2Icon({
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
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}

/** Room-kind glyph next to the room name — bed for bedrooms, sofa for the living
 *  room. Decorative (`aria-hidden`); the room label carries the meaning. */
export function RoomIcon({
  kind,
  size = 14,
}: {
  kind: RoomKind;
  size?: number;
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
      className="text-text-muted"
      aria-hidden
      data-testid={`room-icon-${kind}`}
    >
      {ROOM_GLYPH[kind]}
    </svg>
  );
}

const ROOM_GLYPH: Record<RoomKind, ReactNode> = {
  bedroom: (
    <>
      <path d="M2 4v16" />
      <path d="M2 8h18a2 2 0 0 1 2 2v10" />
      <path d="M2 17h20" />
      <path d="M6 8v9" />
    </>
  ),
  living: (
    <>
      <path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2" />
      <path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0Z" />
      <path d="M4 18v2" />
      <path d="M20 18v2" />
    </>
  ),
};

const CATEGORY_COLOR: Record<ConditionCategory, string> = {
  sun: "text-accent-lights",
  cloud: "text-text-muted",
  rain: "text-accent-shutters",
  snow: "text-text",
  fog: "text-text-muted",
  thermo: "text-accent-climate",
};

const GLYPH: Record<ConditionCategory, ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  cloud: (
    <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 2.1A3.5 3.5 0 0 0 6.5 19z" />
  ),
  rain: (
    <>
      <path d="M17.5 15a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 2.1A3.5 3.5 0 0 0 6.5 15z" />
      <path d="M8 19v2M12 19v2M16 19v2" />
    </>
  ),
  snow: (
    <>
      <path d="M17.5 15a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.6 2.1A3.5 3.5 0 0 0 6.5 15z" />
      <path d="M8 19h.01M12 20h.01M16 19h.01" />
    </>
  ),
  fog: <path d="M4 9h16M4 13h16M6 17h12M7 5h10" />,
  thermo: <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />,
};
