import { describe, it, expect } from "vitest";
import { groupByDay, capEvents } from "./group";
import type { AgendaEvent } from "./select";

/** Local-time Date, so tests never depend on the runner's timezone offset. */
const at = (y: number, m: number, d: number, h = 0, min = 0): Date =>
  new Date(y, m - 1, d, h, min);

const ev = (
  summary: string,
  start: Date,
  end: Date,
  allDay = false,
): AgendaEvent => ({
  summary,
  start,
  end,
  allDay,
  calendarId: "calendar.chats",
});

const iso = (d: Date) =>
  `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe("groupByDay (Story 10.2)", () => {
  it("produit UNE entrée par jour de la plage, y compris les jours vides", () => {
    // Les vues ont besoin des trous : une semaine sans mardi n'est pas une
    // semaine, c'est une liste.
    const buckets = groupByDay([], {
      start: at(2026, 7, 27),
      end: at(2026, 8, 3),
    });
    expect(buckets).toHaveLength(7);
    expect(iso(buckets[0].date)).toBe("2026-7-27");
    expect(iso(buckets[6].date)).toBe("2026-8-2");
    expect(buckets.every((b) => b.events.length === 0)).toBe(true);
  });

  it("range un événement horodaté dans SON jour", () => {
    const e = ev("Surprise", at(2026, 7, 29, 17, 30), at(2026, 7, 29, 23, 45));
    const buckets = groupByDay([e], {
      start: at(2026, 7, 27),
      end: at(2026, 8, 3),
    });
    expect(buckets.filter((b) => b.events.length > 0)).toHaveLength(1);
    expect(iso(buckets.find((b) => b.events.length > 0)!.date)).toBe(
      "2026-7-29",
    );
  });

  it("⚠️ étale un MULTI-JOURS sur chaque jour qu'il couvre", () => {
    // LE piège de cette story. Un groupement par `start` ferait disparaître
    // « Enfants - Les croûtes » de 20 des 21 cellules qu'il occupe.
    const e = ev(
      "Enfants - Les croûtes",
      at(2026, 7, 27),
      at(2026, 8, 17),
      true,
    );
    const buckets = groupByDay([e], {
      start: at(2026, 7, 27),
      end: at(2026, 8, 3),
    });
    expect(buckets.every((b) => b.events.length === 1)).toBe(true);
  });

  it("⚠️ s'arrête la VEILLE de `end` — la fin est exclusive", () => {
    // Un événement 27/07 → 17/08 couvre jusqu'au 16 inclus. Se tromper d'un jour
    // l'étale sur une cellule de trop, tous les mois.
    const e = ev("Vacances", at(2026, 7, 27), at(2026, 7, 30), true);
    const buckets = groupByDay([e], {
      start: at(2026, 7, 27),
      end: at(2026, 8, 3),
    });
    const withEvents = buckets
      .filter((b) => b.events.length > 0)
      .map((b) => iso(b.date));
    expect(withEvents).toEqual(["2026-7-27", "2026-7-28", "2026-7-29"]);
  });

  it("ne montre d'un multi-jours que la portion DANS la plage", () => {
    // Il a commencé avant la fenêtre demandée : il doit quand même apparaître
    // dès le premier jour de celle-ci.
    const e = ev("Déjà en cours", at(2026, 7, 20), at(2026, 7, 29), true);
    const buckets = groupByDay([e], {
      start: at(2026, 7, 27),
      end: at(2026, 8, 3),
    });
    const withEvents = buckets
      .filter((b) => b.events.length > 0)
      .map((b) => iso(b.date));
    expect(withEvents).toEqual(["2026-7-27", "2026-7-28"]);
  });

  it("met les journées entières AVANT les horodatés, puis trie par heure", () => {
    const jour = ev("Anniversaire", at(2026, 7, 29), at(2026, 7, 30), true);
    const tard = ev(
      "Surprise",
      at(2026, 7, 29, 17, 30),
      at(2026, 7, 29, 23, 45),
    );
    const tot = ev("Enfants", at(2026, 7, 29, 8, 15), at(2026, 7, 29, 9, 0));
    const buckets = groupByDay([tard, tot, jour], {
      start: at(2026, 7, 29),
      end: at(2026, 7, 30),
    });
    expect(buckets[0].events.map((e) => e.summary)).toEqual([
      "Anniversaire",
      "Enfants",
      "Surprise",
    ]);
  });

  it("ignore un événement entièrement hors de la plage", () => {
    const e = ev(
      "Le mois dernier",
      at(2026, 6, 10, 9, 0),
      at(2026, 6, 10, 10, 0),
    );
    const buckets = groupByDay([e], {
      start: at(2026, 7, 27),
      end: at(2026, 8, 3),
    });
    expect(buckets.every((b) => b.events.length === 0)).toBe(true);
  });

  it("couvre bien 42 jours pour une grille de mois", () => {
    const buckets = groupByDay([], {
      start: at(2026, 7, 1),
      end: at(2026, 8, 1),
    });
    expect(buckets).toHaveLength(31);
  });
});

describe("capEvents (le « +N » de la vue mois)", () => {
  const three = [
    ev("A", at(2026, 7, 29, 8, 0), at(2026, 7, 29, 9, 0)),
    ev("B", at(2026, 7, 29, 12, 0), at(2026, 7, 29, 13, 0)),
    ev("C", at(2026, 7, 29, 17, 0), at(2026, 7, 29, 18, 0)),
  ];

  it("montre les N premiers et compte le reste", () => {
    const { shown, overflow } = capEvents(three, 2);
    expect(shown.map((e) => e.summary)).toEqual(["A", "B"]);
    expect(overflow).toBe(1);
  });

  it("ne compte aucun surplus quand tout tient", () => {
    const { shown, overflow } = capEvents(three.slice(0, 2), 2);
    expect(shown).toHaveLength(2);
    expect(overflow).toBe(0);
  });

  it("gère une journée vide", () => {
    expect(capEvents([], 2)).toEqual({ shown: [], overflow: 0 });
  });

  it("compte juste sur une vraie journée chargée", () => {
    // Les récurrents « Enfants » de Florian sont biquotidiens : une journée à
    // 5 événements est le cas nominal, pas un cas limite.
    const five = [...three, ...three.slice(0, 2)];
    expect(capEvents(five, 2).overflow).toBe(3);
  });
});
