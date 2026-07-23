/**
 * Electricity display derivation (Story 9.1, AD-16). PURE — no HA access, no
 * tariff/time logic (the HC/HP schedule lives in HA, AD-4; Story 9.2 extends
 * this to pick the applicable price). The daily cost is a display value
 * (`kWh × €/kWh`), never a persisted state.
 */

/** Parse a raw HA state (string) or number into a finite number, else null. */
export function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface ElectricityInput {
  /** Daily cumulative consumption, kWh (raw sensor state). */
  readonly kwh: string | number | null | undefined;
  /** Unit price, €/kWh (raw helper state). */
  readonly price: string | number | null | undefined;
}

export interface ElectricityView {
  /** Parsed daily consumption (kWh), or null if missing/non-numeric. */
  readonly kwh: number | null;
  /** Parsed unit price (€/kWh), or null if missing/non-numeric. */
  readonly price: number | null;
  /** Derived daily cost (kWh × price), or null when either input is absent. */
  readonly cost: number | null;
}

/**
 * Derive the display view from the two reflected HA values. `cost` is null
 * whenever either input is missing — no invented cost (AD-16). No rounding here;
 * formatting owns presentation (`consumption-format`).
 */
export function electricityView({
  kwh,
  price,
}: ElectricityInput): ElectricityView {
  const k = toNumber(kwh);
  const p = toNumber(price);
  return {
    kwh: k,
    price: p,
    cost: k !== null && p !== null ? k * p : null,
  };
}
