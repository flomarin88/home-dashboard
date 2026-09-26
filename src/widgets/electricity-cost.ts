/**
 * Electricity tariff derivation (Story 9.2, narrowed by 9.4, AD-16 amended).
 * PURE — no HA access, and above all NO tariff/time logic: which period it is
 * is answered by HA (AD-4), never here. No clock, no `Date.now()`, none of the
 * four window boundaries.
 *
 * Since Story 9.4 this module prices NOTHING. The cost on screen is a long-term
 * statistic COMPUTED BY HA (ha-linky `costs`) for the last complete day; the app
 * no longer multiplies kWh by a price. What remains is the tariff view for the
 * detail page's HC/HP tile: which period is current, both prices, and which one
 * applies right now — with the same rule as before: no fallback to the other
 * price, ever.
 */

/** Parse a raw HA state (string) or number into a finite number, else null. */
export function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** The tariff period currently in force, or null when HA hasn't said. */
export type TariffPeriod = "creuses" | "pleines";

/**
 * The period `binary_sensor`'s state → period. `on` = creuses is THE interface
 * contract (the entity itself is named in `entities/mapping.ts`, the HA side in
 * docs/home-assistant.md); casing and stray whitespace are tolerated because HA
 * states have arrived padded before.
 *
 * Everything else — `unavailable`, `unknown`, absent, or any word we did not
 * agree on — is `null`, deliberately. There is no sensible default: picking one
 * would price the day at a tariff nobody chose, and being wrong by 68% is worse
 * than showing "—".
 */
export function normalisePeriod(
  raw: string | null | undefined,
): TariffPeriod | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (s === "on") return "creuses";
  if (s === "off") return "pleines";
  return null;
}

export interface ElectricityInput {
  /** Unit price during heures creuses, €/kWh (raw helper state). */
  readonly priceCreuses: string | number | null | undefined;
  /** Unit price during heures pleines, €/kWh (raw helper state). */
  readonly pricePleines: string | number | null | undefined;
  /** Raw `binary_sensor` state for the current period (`on`/`off`). */
  readonly period: string | null | undefined;
}

export interface ElectricityView {
  /** Current tariff period, or null when HA hasn't said. */
  readonly period: TariffPeriod | null;
  /** Parsed heures-creuses price (€/kWh) — both are exposed for the detail page. */
  readonly priceCreuses: number | null;
  /** Parsed heures-pleines price (€/kWh). */
  readonly pricePleines: number | null;
  /** The price actually in force right now, or null if the period is unknown. */
  readonly appliedPrice: number | null;
}

/**
 * Derive the tariff view from the three reflected HA values.
 *
 * One rule carries it: `appliedPrice` follows the period and NOTHING else. No
 * `priceCreuses ?? pricePleines` fallback — if the applicable price is missing,
 * the answer is null. That fallback would quietly mark heures creuses as billed
 * at the full rate (+68 %); a wrong marker is worse than no marker (AD-16).
 *
 * No rounding here; formatting owns presentation (`consumption-format`).
 */
export function electricityView({
  priceCreuses,
  pricePleines,
  period,
}: ElectricityInput): ElectricityView {
  const hc = toNumber(priceCreuses);
  const hp = toNumber(pricePleines);
  const p = normalisePeriod(period);
  return {
    period: p,
    priceCreuses: hc,
    pricePleines: hp,
    appliedPrice: p === "creuses" ? hc : p === "pleines" ? hp : null,
  };
}
