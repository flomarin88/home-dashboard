/**
 * Electricity display derivation (Story 9.1, tariff-aware since 9.2, AD-16).
 * PURE — no HA access, and above all NO tariff/time logic: which period it is
 * and when the next switch happens are answered by HA (AD-4), never here. This
 * module has no clock, reads no `Date.now()`, and knows none of the four window
 * boundaries. The daily cost is a display value (`kWh × €/kWh`), never a
 * persisted state.
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
  /** Daily cumulative consumption, kWh (raw sensor state). */
  readonly kwh: string | number | null | undefined;
  /** Unit price during heures creuses, €/kWh (raw helper state). */
  readonly priceCreuses: string | number | null | undefined;
  /** Unit price during heures pleines, €/kWh (raw helper state). */
  readonly pricePleines: string | number | null | undefined;
  /** Raw `binary_sensor` state for the current period (`on`/`off`). */
  readonly period: string | null | undefined;
}

export interface ElectricityView {
  /** Parsed daily consumption (kWh), or null if missing/non-numeric. */
  readonly kwh: number | null;
  /** Current tariff period, or null when HA hasn't said. */
  readonly period: TariffPeriod | null;
  /** Parsed heures-creuses price (€/kWh) — both are exposed for the detail page. */
  readonly priceCreuses: number | null;
  /** Parsed heures-pleines price (€/kWh). */
  readonly pricePleines: number | null;
  /** The price actually in force right now, or null if the period is unknown. */
  readonly appliedPrice: number | null;
  /** Derived daily cost (kWh × appliedPrice), or null when either is absent. */
  readonly cost: number | null;
}

/**
 * Derive the display view from the four reflected HA values.
 *
 * Two rules carry the whole story:
 *
 *  - `appliedPrice` follows the period and NOTHING else. No `priceCreuses ??
 *    pricePleines` fallback: if the applicable price is missing, the answer is
 *    null. That fallback would quietly bill heures creuses at the full rate
 *    (+68%) — a wrong number is worse than no number (AD-16).
 *  - `cost` is null whenever either factor is absent. No invented cost, no
 *    implicit zero.
 *
 * The cost is the whole day's kWh at the CURRENT tariff, so it jumps when the
 * period flips. That is specified, not a bug: Florian ruled out per-tariff
 * meters, and smoothing it would require persisted state (AD-1/AD-16) plus
 * tariff logic (AD-4). The remedy, if ever wanted, is `tariffs:` on the HA
 * `utility_meter` — see docs/home-assistant.md.
 *
 * No rounding here; formatting owns presentation (`consumption-format`).
 */
export function electricityView({
  kwh,
  priceCreuses,
  pricePleines,
  period,
}: ElectricityInput): ElectricityView {
  const k = toNumber(kwh);
  const hc = toNumber(priceCreuses);
  const hp = toNumber(pricePleines);
  const p = normalisePeriod(period);

  const appliedPrice = p === "creuses" ? hc : p === "pleines" ? hp : null;

  return {
    kwh: k,
    period: p,
    priceCreuses: hc,
    pricePleines: hp,
    appliedPrice,
    cost: k !== null && appliedPrice !== null ? k * appliedPrice : null,
  };
}
