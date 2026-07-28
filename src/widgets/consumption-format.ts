import { toNumber, type TariffPeriod } from "./electricity-cost";

/**
 * Consumption display formatters (Story 9.1). fr-FR (comma decimal), fixed
 * decimals, `tabular-nums` applied by the caller. Missing/non-numeric → "—"
 * (parity with `room-sensor-format`), so a stale/absent value never blanks.
 * Shared by the electricity tile and the /electricite page (and water in 9.3).
 */

const EURO_FMT = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const KWH_FMT = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Daily cost, e.g. "1,84 €". "—" when null/non-numeric. */
export function formatEuro(v: string | number | null | undefined): string {
  const n = toNumber(v);
  return n === null ? "—" : `${EURO_FMT.format(n)} €`;
}

/** Consumption, e.g. "8,2 kWh". "—" when null/non-numeric. */
export function formatKwh(v: string | number | null | undefined): string {
  const n = toNumber(v);
  return n === null ? "—" : `${KWH_FMT.format(n)} kWh`;
}

/**
 * Unit price, e.g. "0,0890 €/kWh". "—" when null/non-numeric.
 *
 * FOUR decimals, not the two `formatEuro` uses: the real tariffs are 0,0890 and
 * 0,1491 €/kWh, and rounding them to the cent would print 0,0890 and 0,0899
 * identically. A cost is money the user reads at a glance; a unit price is a
 * figure they compare — the trailing digits carry meaning here (Story 9.2).
 */
const PRICE_FMT = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

export function formatPrice(v: string | number | null | undefined): string {
  const n = toNumber(v);
  return n === null ? "—" : `${PRICE_FMT.format(n)} €/kWh`;
}

/**
 * The tariff period, COMPACT — "HC" / "HP". What the top-bar chip wears.
 *
 * UX-DR23 lists this as the responsive fallback for a crowded bar, to be
 * activated only if a device pass shows a collision. Florian activated it up
 * front (2026-07-28): Story 10.1 had just taken the bar to six chips, and
 * spending ~45px on "Creuses" to say what "HC" says is a poor trade on a screen
 * only he reads. Reverting to the long form is this one function.
 */
export function periodLabel(p: TariffPeriod | null): string {
  return p === "creuses" ? "HC" : p === "pleines" ? "HP" : "—";
}

/**
 * The tariff period, SPOKEN — "Creuses" / "Pleines". For the detail page (which
 * has the room) and for every `aria-label`: a screen reader saying "HC" conveys
 * nothing, and AC1 requires the period to reach assistive tech, not just eyes.
 */
export function periodName(p: TariffPeriod | null): string {
  return p === "creuses" ? "Creuses" : p === "pleines" ? "Pleines" : "—";
}

/**
 * The Tailwind classes that tint a period — green for creuses, amber for
 * pleines, straight from the mock (Florian, 2026-07-28). Lives here so the tile
 * and the detail page cannot drift on which shade means what; the values
 * themselves are four tokens in `index.css`.
 *
 * An unknown period gets the muted treatment, NOT a third colour: "we don't
 * know" is not a tariff, and inventing a hue for it would suggest it is.
 *
 * Colour is always an addition here, never the message — every caller also
 * renders the glyph and the word (UX-DR14).
 */
export function periodTone(p: TariffPeriod | null): {
  text: string;
  soft: string;
  border: string;
} {
  if (p === "creuses")
    return {
      text: "text-tariff-creuses",
      soft: "bg-tariff-creuses-soft",
      border: "border-tariff-creuses",
    };
  if (p === "pleines")
    return {
      text: "text-tariff-pleines",
      soft: "bg-tariff-pleines-soft",
      border: "border-tariff-pleines",
    };
  return {
    text: "text-text-muted",
    soft: "bg-card-fill",
    border: "border-card-border",
  };
}
