/**
 * Weather display helpers (Story 6.2). Pure — no forecast/schedule logic.
 */

/** Netatmo `temperature_trend` state → arrow. Unknown/absent → ''. */
export function trendArrow(state: string | null | undefined): string {
  switch (state) {
    case "up":
      return "↑";
    case "down":
      return "↓";
    case "stable":
      return "→";
    default:
      return "";
  }
}

/**
 * Trend → Tailwind text-colour class: warming (up) reads red, cooling (down)
 * reads blue (Florian, 2026-07-17); stable/unknown stay muted.
 */
export function trendColorClass(state: string | null | undefined): string {
  switch (state) {
    case "up":
      return "text-security-alert";
    case "down":
      return "text-accent-shutters";
    default:
      return "text-text-muted";
  }
}

/** HA `weather.*` condition state → French label. Unknown/absent → '—'. */
export function conditionLabel(condition: string | null | undefined): string {
  switch (condition) {
    case "sunny":
      return "Ensoleillé";
    case "clear-night":
      return "Ciel dégagé";
    case "partlycloudy":
      return "Partiellement nuageux";
    case "cloudy":
      return "Nuageux";
    case "windy":
    case "windy-variant":
      return "Venteux";
    case "rainy":
      return "Pluie";
    case "pouring":
      return "Fortes pluies";
    case "lightning":
    case "lightning-rainy":
      return "Orages";
    case "hail":
      return "Grêle";
    case "snowy":
      return "Neige";
    case "snowy-rainy":
      return "Pluie et neige";
    case "fog":
      return "Brouillard";
    case "exceptional":
      return "Exceptionnel";
    default:
      return "—";
  }
}

const DAY_FMT = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const HOUR_FMT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  hour12: false,
});

/** Forecast `datetime` (ISO) → short weekday (e.g. "lun."); '' if invalid. */
export function forecastDayLabel(iso: string | null | undefined): string {
  if (iso == null) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return DAY_FMT.format(d);
}

/** Forecast `datetime` (ISO) → hour label (e.g. "14 h"); '' if invalid. */
export function forecastHourLabel(iso: string | null | undefined): string {
  if (iso == null) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // fr-FR 2-digit hour renders as "14" or "14 h" by ICU version — normalise to "14 h".
  return `${HOUR_FMT.format(d).replace(/\D/g, "")} h`;
}

const TIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * A timestamp sensor's ISO state (e.g. `sensor.sun_next_setting`) → local time
 * "HHhMM" (e.g. "20h12"); '—' if invalid/absent (never blank). Uses
 * `formatToParts` so the "h" separator is stable across ICU versions.
 */
export function formatSunTime(iso: string | null | undefined): string {
  if (iso == null) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const parts = TIME_FMT.formatToParts(d);
  const h = parts.find((p) => p.type === "hour")?.value ?? "";
  const m = parts.find((p) => p.type === "minute")?.value ?? "";
  return `${h}h${m}`;
}

export type ConditionCategory =
  "sun" | "cloud" | "rain" | "snow" | "fog" | "thermo";

/**
 * Maps a HA `weather.*` condition state to an icon category (for the future
 * condition icon — seam until a weather entity is mapped). Unknown → 'thermo'.
 */
export function conditionCategory(
  condition: string | null | undefined,
): ConditionCategory {
  switch (condition) {
    case "sunny":
    case "clear-night":
      return "sun";
    case "partlycloudy":
    case "cloudy":
    case "windy":
    case "windy-variant":
      return "cloud";
    case "rainy":
    case "pouring":
    case "lightning":
    case "lightning-rainy":
    case "hail":
      return "rain";
    case "snowy":
    case "snowy-rainy":
      return "snow";
    case "fog":
      return "fog";
    default:
      return "thermo";
  }
}
