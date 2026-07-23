import { describe, it, expect } from "vitest";
import { formatEuro, formatKwh, formatPrice } from "./consumption-format";

describe("consumption-format (Story 9.1)", () => {
  it("formats euros with 2 decimals (fr-FR)", () => {
    expect(formatEuro(1.84)).toBe("1,84 €");
    expect(formatEuro("2.3")).toBe("2,30 €");
    expect(formatEuro(0)).toBe("0,00 €");
  });

  it("formats kWh with 1 decimal (fr-FR)", () => {
    expect(formatKwh(8.2)).toBe("8,2 kWh");
    expect(formatKwh("11")).toBe("11,0 kWh");
  });

  it("formats the unit price as €/kWh", () => {
    expect(formatPrice(0.18)).toBe("0,18 €/kWh");
  });

  it('returns "—" for missing / non-numeric values (never blank, never NaN)', () => {
    expect(formatEuro(null)).toBe("—");
    expect(formatKwh("unavailable")).toBe("—");
    expect(formatPrice(undefined)).toBe("—");
    expect(formatEuro("")).toBe("—");
  });
});
