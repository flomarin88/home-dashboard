import { describe, it, expect } from "vitest";
import { formatPreview, formatRelativeTime } from "./summary-format";

describe("formatPreview", () => {
  it("shows up to 3 names + a +N tail for the rest", () => {
    expect(formatPreview(["Poivrons", "Lait", "Café", "Riz"], 12)).toBe(
      "Poivrons, Lait, Café +9",
    );
  });

  it("omits the tail when nothing remains beyond the shown names", () => {
    expect(formatPreview(["Poivrons", "Lait"], 2)).toBe("Poivrons, Lait");
  });

  it("is empty when the pending count is zero", () => {
    expect(formatPreview(["Poivrons"], 0)).toBe("");
  });

  it("is empty when no names are known even if a count is claimed", () => {
    expect(formatPreview([], 5)).toBe("");
  });

  it("respects a custom maxShown", () => {
    expect(formatPreview(["A", "B", "C"], 5, 1)).toBe("A +4");
  });
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-07-21T12:00:00Z");

  it("says 'à l'instant' under a minute", () => {
    expect(formatRelativeTime("2026-07-21T11:59:30Z", now)).toBe("à l'instant");
  });

  it("formats minutes", () => {
    expect(formatRelativeTime("2026-07-21T11:45:00Z", now)).toBe(
      "il y a 15 min",
    );
  });

  it("formats hours", () => {
    expect(formatRelativeTime("2026-07-21T09:00:00Z", now)).toBe("il y a 3 h");
  });

  it("formats days", () => {
    expect(formatRelativeTime("2026-07-19T12:00:00Z", now)).toBe("il y a 2 j");
  });

  it("returns '' for missing or invalid input", () => {
    expect(formatRelativeTime(undefined, now)).toBe("");
    expect(formatRelativeTime("not-a-date", now)).toBe("");
  });
});
