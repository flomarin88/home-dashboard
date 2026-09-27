import { describe, it, expect } from "vitest";
import {
  dayRange,
  weekRange,
  monthRange,
  shiftAnchor,
  rangeLabel,
} from "./range";

// Moved from `src/agenda/select.test.ts` with the helpers (Story 9.5). The suite
// runs with TZ=Europe/Paris pinned (vitest.config.ts).

/** Local-time Date, so tests never depend on the runner's timezone offset. */
const at = (y: number, m: number, d: number, h = 0, min = 0): Date =>
  new Date(y, m - 1, d, h, min);

describe("dayRange (AD-17 query window)", () => {
  it("spans [today 00:00 → tomorrow 00:00) in LOCAL time", () => {
    const { start, end } = dayRange(at(2026, 7, 28, 13, 45));
    expect(start.getDate()).toBe(28);
    expect(start.getHours()).toBe(0);
    expect(end.getDate()).toBe(29);
    expect(end.getHours()).toBe(0);
  });

  it("rolls over month ends", () => {
    expect(dayRange(at(2026, 7, 31, 23, 0)).end.getMonth()).toBe(7); // August
  });
});

describe("weekRange (Story 10.2 — semaine ISO, lundi → lundi)", () => {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  it("part du LUNDI, pas du dimanche", () => {
    // Mercredi 29 juillet 2026 → semaine du lundi 27 au lundi 3 août.
    const { start, end } = weekRange(at(2026, 7, 29, 13, 0));
    expect(iso(start)).toBe("2026-7-27");
    expect(start.getHours()).toBe(0);
    expect(iso(end)).toBe("2026-8-3");
  });

  it("traite DIMANCHE comme le dernier jour, pas le premier", () => {
    // Le piège: getDay() rend 0 pour dimanche. Un calcul naïf
    // `date - getDay()` renverrait la semaine SUIVANTE.
    const { start, end } = weekRange(at(2026, 8, 2, 23, 0)); // dimanche
    expect(iso(start)).toBe("2026-7-27");
    expect(iso(end)).toBe("2026-8-3");
  });

  it("traite LUNDI comme le premier jour, sans reculer d'une semaine", () => {
    const { start } = weekRange(at(2026, 7, 27, 0, 30));
    expect(iso(start)).toBe("2026-7-27");
  });

  it("enjambe une bascule de mois sans broncher", () => {
    const { start, end } = weekRange(at(2026, 8, 1, 12, 0)); // samedi 1er août
    expect(iso(start)).toBe("2026-7-27");
    expect(iso(end)).toBe("2026-8-3");
  });

  it("couvre exactement 7 jours, bornes en minuit LOCAL", () => {
    const { start, end } = weekRange(at(2026, 7, 29, 13, 0));
    for (const d of [start, end]) {
      expect(d.getHours()).toBe(0);
      expect(d.getMinutes()).toBe(0);
      expect(d.getSeconds()).toBe(0);
    }
    // Pas de soustraction de timestamps: un changement d'heure fausserait le
    // compte. On recompte en jours de calendrier.
    const walk = new Date(start.getTime());
    let days = 0;
    while (walk < end) {
      walk.setDate(walk.getDate() + 1);
      days++;
    }
    expect(days).toBe(7);
  });
});

describe("monthRange (Story 10.2 — mois STRICT, choix de Florian)", () => {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  it("va du 1er au 1er du mois suivant", () => {
    const { start, end } = monthRange(at(2026, 7, 29, 13, 0));
    expect(iso(start)).toBe("2026-7-1");
    expect(iso(end)).toBe("2026-8-1");
  });

  it("passe de décembre à janvier de l'année suivante", () => {
    const { start, end } = monthRange(at(2026, 12, 15, 10, 0));
    expect(iso(start)).toBe("2026-12-1");
    expect(iso(end)).toBe("2027-1-1");
  });

  it("gère février d'une année bissextile", () => {
    // 2028 est bissextile: février compte 29 jours, mars commence quand même
    // le 1er — c'est justement ce qu'une arithmétique en jours casserait.
    const { start, end } = monthRange(at(2028, 2, 10, 8, 0));
    expect(iso(start)).toBe("2028-2-1");
    expect(iso(end)).toBe("2028-3-1");
  });

  it("gère un mois de 31 jours suivi d'un mois de 30", () => {
    const { end } = monthRange(at(2026, 3, 31, 23, 59));
    expect(iso(end)).toBe("2026-4-1");
  });

  it("borne à minuit LOCAL, jamais UTC", () => {
    const { start } = monthRange(at(2026, 7, 29, 13, 0));
    expect(start.getHours()).toBe(0);
    expect(start.getDate()).toBe(1);
    expect(start.getMinutes()).toBe(0);
  });
});

describe("shiftAnchor (Story 10.2 — navigation temporelle, Florian 2026-07-29)", () => {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

  it("déplace d'un jour", () => {
    expect(iso(shiftAnchor(at(2026, 7, 29), "day", 1))).toBe("2026-7-30");
    expect(iso(shiftAnchor(at(2026, 7, 29), "day", -1))).toBe("2026-7-28");
  });

  it("déplace d'une semaine entière", () => {
    expect(iso(shiftAnchor(at(2026, 7, 29), "week", 1))).toBe("2026-8-5");
    expect(iso(shiftAnchor(at(2026, 7, 29), "week", -1))).toBe("2026-7-22");
  });

  it("⚠️ le pas mensuel s'ancre au 1er — 31 janvier + 1 mois n'est PAS le 3 mars", () => {
    // Le piège classique : `setMonth(m+1)` sur un 31 déborde sur le mois
    // suivant. Trois clics d'affilée et on saute février entièrement.
    expect(iso(shiftAnchor(at(2026, 1, 31), "month", 1))).toBe("2026-2-1");
    expect(iso(shiftAnchor(at(2026, 3, 31), "month", -1))).toBe("2026-2-1");
  });

  it("le pas mensuel reste stable si on l'enchaîne", () => {
    let a = at(2026, 1, 31);
    for (let i = 0; i < 3; i++) a = shiftAnchor(a, "month", 1);
    expect(iso(a)).toBe("2026-4-1"); // jan → fév → mars → avril, aucun saut
  });

  it("passe d'une année à l'autre dans les deux sens", () => {
    expect(iso(shiftAnchor(at(2026, 12, 15), "month", 1))).toBe("2027-1-1");
    expect(iso(shiftAnchor(at(2026, 1, 15), "month", -1))).toBe("2025-12-1");
    expect(iso(shiftAnchor(at(2026, 12, 31), "day", 1))).toBe("2027-1-1");
  });

  it("gère février d'une année bissextile", () => {
    expect(iso(shiftAnchor(at(2028, 1, 15), "month", 1))).toBe("2028-2-1");
    expect(iso(shiftAnchor(at(2028, 2, 29), "day", 1))).toBe("2028-3-1");
  });

  it("un delta nul ne bouge pas", () => {
    expect(iso(shiftAnchor(at(2026, 7, 29), "week", 0))).toBe("2026-7-29");
  });
});

describe("rangeLabel (Story 10.2 — le rappel de période)", () => {
  it("nomme le jour en toutes lettres", () => {
    expect(rangeLabel(at(2026, 7, 29), "day")).toMatch(/mercredi/i);
    expect(rangeLabel(at(2026, 7, 29), "day")).toMatch(/29/);
  });

  it("borne la semaine du lundi au dimanche, pas la date d'ancrage", () => {
    // Ancré un mercredi : le rappel doit dire 27 → 2, la semaine réelle.
    const l = rangeLabel(at(2026, 7, 29), "week");
    expect(l).toMatch(/27/);
    expect(l).toMatch(/2/);
    expect(l).toMatch(/août/i);
  });

  it("nomme le mois et l'année", () => {
    expect(rangeLabel(at(2026, 7, 29), "month")).toMatch(/juillet/i);
    expect(rangeLabel(at(2026, 7, 29), "month")).toMatch(/2026/);
  });

  it("suit l'ancrage quand on navigue", () => {
    expect(rangeLabel(at(2026, 12, 1), "month")).toMatch(/décembre/i);
  });
});
