import { toNumber } from "./electricity-cost";

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

/** Unit price, e.g. "0,18 €/kWh". "—" when null/non-numeric. */
export function formatPrice(v: string | number | null | undefined): string {
  const n = toNumber(v);
  return n === null ? "—" : `${EURO_FMT.format(n)} €/kWh`;
}
