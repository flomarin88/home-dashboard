import { describe, it, expect } from "vitest";
import {
  formatEuro,
  formatKwh,
  formatPrice,
  periodLabel,
  periodName,
  periodTone,
} from "./consumption-format";

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
    // FOUR decimals: the real tariffs are 0,0890 and 0,1491 €/kWh, and the
    // story renders them in full. Rounded to two, 0,0890 and 0,0899 would
    // print identically — precision the user is entitled to see.
    expect(formatPrice(0.089)).toBe("0,0890 €/kWh");
    expect(formatPrice(0.1491)).toBe("0,1491 €/kWh");
    expect(formatPrice(0.18)).toBe("0,1800 €/kWh");
  });

  it('returns "—" for missing / non-numeric values (never blank, never NaN)', () => {
    expect(formatEuro(null)).toBe("—");
    expect(formatKwh("unavailable")).toBe("—");
    expect(formatPrice(undefined)).toBe("—");
    expect(formatEuro("")).toBe("—");
  });
});

describe("periodLabel / periodName (Story 9.2)", () => {
  it("periodLabel is the COMPACT form — the top bar is out of room", () => {
    // Florian's call (2026-07-28): the bar already carries six chips since
    // Story 10.1, so 9.2 ships UX-DR23's compact fallback from the start
    // rather than keeping it in reserve. Single point of change if it ever
    // goes back to the long form.
    expect(periodLabel("creuses")).toBe("HC");
    expect(periodLabel("pleines")).toBe("HP");
  });

  it("periodName is the SPOKEN form — for the page and for screen readers", () => {
    // "HC" read aloud says nothing; the aria-label and the detail page use this.
    expect(periodName("creuses")).toBe("Creuses");
    expect(periodName("pleines")).toBe("Pleines");
  });

  it("both degrade to the house dash when the period is unknown", () => {
    expect(periodLabel(null)).toBe("—");
    expect(periodName(null)).toBe("—");
  });
});

describe("periodTone (Story 9.2 — the mock's tints, Florian 2026-07-28)", () => {
  it("gives each period its own hue", () => {
    expect(periodTone("creuses").text).toBe("text-tariff-creuses");
    expect(periodTone("pleines").text).toBe("text-tariff-pleines");
    expect(periodTone("creuses").soft).not.toBe(periodTone("pleines").soft);
  });

  it("leaves an unknown period muted rather than inventing a third colour", () => {
    // "We don't know" is not a tariff; giving it a hue would suggest it is.
    const t = periodTone(null);
    expect(t.text).toBe("text-text-muted");
    expect(t.soft).not.toMatch(/tariff/);
    expect(t.border).not.toMatch(/tariff/);
  });
});
