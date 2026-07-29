import { describe, it, expect } from "vitest";
import {
  parseEvents,
  countRawEntries,
  selectNext,
  relativeDelay,
  formatEventTime,
  untilLabel,
  dayRange,
  weekRange,
  monthRange,
  shiftAnchor,
  rangeLabel,
  haDateTimeString,
} from "./select";
import type { CalendarRef } from "../entities";

// A stand-in mapping — deliberately NOT the real one, so these tests keep
// passing if Florian renames a calendar. Order matters: it breaks ties.
const CALS: readonly CalendarRef[] = [
  { entityId: "calendar.chats", label: "Chats" },
  { entityId: "calendar.anniversaires", label: "Anniversaires" },
  { entityId: "calendar.scolaire", label: "Vacances scolaires" },
];

/** Local-time Date, so tests never depend on the runner's timezone offset. */
const at = (y: number, m: number, d: number, h = 0, min = 0): Date =>
  new Date(y, m - 1, d, h, min);

/** HA's response shape: keyed by entity_id, each with an `events` list. */
const response = (
  byCal: Record<string, { summary: string; start: string; end: string }[]>,
) =>
  Object.fromEntries(
    Object.entries(byCal).map(([id, events]) => [id, { events }]),
  );

describe("parseEvents (AD-17 payload → domain)", () => {
  it("parses a timed event, keeping the calendar it came from", () => {
    const evs = parseEvents(
      response({
        "calendar.chats": [
          {
            summary: "Vétérinaire",
            start: "2026-07-28 17:00:00",
            end: "2026-07-28 17:30:00",
          },
        ],
      }),
      CALS,
    );
    expect(evs).toHaveLength(1);
    expect(evs[0].summary).toBe("Vétérinaire");
    expect(evs[0].allDay).toBe(false);
    expect(evs[0].calendarId).toBe("calendar.chats");
    expect(evs[0].start.getHours()).toBe(17);
  });

  it("detects an all-day event from the payload SHAPE (date only, no hour)", () => {
    const evs = parseEvents(
      response({
        "calendar.anniversaires": [
          {
            summary: "Anniversaire de Nathan",
            start: "2026-07-28",
            end: "2026-07-29",
          },
        ],
      }),
      CALS,
    );
    expect(evs[0].allDay).toBe(true);
    // Local midnight — NOT UTC midnight, which would land on the previous day
    // for any negative-offset timezone.
    expect(evs[0].start.getHours()).toBe(0);
    expect(evs[0].start.getDate()).toBe(28);
  });

  it("accepts the ISO 'T' separator and an explicit offset (WebKit-safe parsing)", () => {
    const evs = parseEvents(
      response({
        "calendar.chats": [
          {
            summary: "Toilettage",
            start: "2026-07-28T09:15:00+02:00",
            end: "2026-07-28T10:00:00+02:00",
          },
        ],
      }),
      CALS,
    );
    expect(evs).toHaveLength(1);
    expect(Number.isNaN(evs[0].start.getTime())).toBe(false);
  });

  it("drops unparsable entries and keeps the rest — never an Invalid Date", () => {
    const evs = parseEvents(
      response({
        "calendar.chats": [
          { summary: "Cassé", start: "pas-une-date", end: "non plus" },
          {
            summary: "Bon",
            start: "2026-07-28 17:00:00",
            end: "2026-07-28 18:00:00",
          },
        ],
      }),
      CALS,
    );
    expect(evs.map((e) => e.summary)).toEqual(["Bon"]);
  });

  it("rejects an out-of-range date instead of letting it roll over (review P8)", () => {
    // `new Date(2026, 12, 45)` is NOT NaN — it silently becomes 2027-02-14. The
    // shape regex admits these, so only reading the components back catches
    // them. This is the one corruption class that produced a confident wrong
    // date on screen rather than being dropped.
    const evs = parseEvents(
      response({
        "calendar.anniversaires": [
          { summary: "Impossible", start: "2026-13-45", end: "2026-13-46" },
          {
            summary: "29 février inexistant",
            start: "2026-02-30",
            end: "2026-03-01",
          },
          { summary: "Valide", start: "2026-07-28", end: "2026-07-29" },
        ],
      }),
      CALS,
    );
    expect(evs.map((e) => e.summary)).toEqual(["Valide"]);
  });

  it("keeps an event whose summary is blank, rendering it '(sans titre)'", () => {
    // The dates are what the tile ranks on, so a nameless event still answers
    // "something is happening at 17:00". Documented behaviour, not an accident
    // (review P12).
    const evs = parseEvents(
      response({
        "calendar.chats": [
          {
            summary: "  ",
            start: "2026-07-28 17:00:00",
            end: "2026-07-28 18:00:00",
          },
        ],
      }),
      CALS,
    );
    expect(evs).toHaveLength(1);
    expect(evs[0].summary).toBe("(sans titre)");
  });

  it("survives a missing / malformed calendar key without throwing", () => {
    expect(() => parseEvents({}, CALS)).not.toThrow();
    expect(parseEvents({}, CALS)).toEqual([]);
    // A calendar present but with no `events` list at all.
    expect(parseEvents({ "calendar.chats": {} }, CALS)).toEqual([]);
  });

  it("ignores calendars absent from the mapping (only mapped ones are read, AD-7)", () => {
    const evs = parseEvents(
      response({
        "calendar.inconnu": [
          {
            summary: "Fantôme",
            start: "2026-07-28 10:00:00",
            end: "2026-07-28 11:00:00",
          },
        ],
      }),
      CALS,
    );
    expect(evs).toEqual([]);
  });
});

describe("countRawEntries — telling a format drift from an empty day (review D2)", () => {
  it("counts entries the response carried, parsable or not", () => {
    const payload = response({
      "calendar.chats": [
        {
          summary: "A",
          start: "2026-07-28 17:00:00",
          end: "2026-07-28 18:00:00",
        },
      ],
      "calendar.anniversaires": [
        { summary: "B", start: "pas une date", end: "pas une date" },
      ],
    });
    expect(countRawEntries(payload, CALS)).toBe(2);
    // One parsed, one not — so this is NOT the "nothing readable" case.
    expect(parseEvents(payload, CALS)).toHaveLength(1);
  });

  it("separates a genuinely empty day from a payload we cannot read", () => {
    const emptyDay = response({ "calendar.chats": [] });
    expect(countRawEntries(emptyDay, CALS)).toBe(0);
    expect(parseEvents(emptyDay, CALS)).toHaveLength(0);

    // A Google-shaped payload (objects instead of strings) is the drift we
    // cannot rule out while Task 0 bis is open: 1 entry in, 0 out.
    const unreadable = {
      "calendar.chats": {
        events: [{ summary: "X", start: { dateTime: "2026-07-28T17:00:00" } }],
      },
    };
    expect(countRawEntries(unreadable, CALS)).toBe(1);
    expect(parseEvents(unreadable, CALS)).toHaveLength(0);
  });

  it("ignores unmapped calendars, like the parser does", () => {
    expect(
      countRawEntries(
        response({
          "calendar.inconnu": [
            { summary: "X", start: "2026-07-28", end: "2026-07-29" },
          ],
        }),
        CALS,
      ),
    ).toBe(0);
  });
});

describe("selectNext — the 3-rank rule (Florian, 2026-07-27)", () => {
  const timed = (start: string, end: string, summary = "RDV") => ({
    summary,
    start,
    end,
  });

  it("rank 1: an upcoming timed event beats an all-day event of the same day", () => {
    const evs = parseEvents(
      response({
        "calendar.chats": [
          timed("2026-07-28 17:00:00", "2026-07-28 17:30:00", "Vétérinaire"),
        ],
        "calendar.anniversaires": [
          { summary: "Anniv Nathan", start: "2026-07-28", end: "2026-07-29" },
        ],
      }),
      CALS,
    );
    const sel = selectNext(evs, at(2026, 7, 28, 13, 0));
    expect(sel?.rank).toBe("timed");
    expect(sel?.event.summary).toBe("Vétérinaire");
  });

  it("rank 1 ignores a timed event already started — 'prochain' means still ahead", () => {
    const evs = parseEvents(
      response({
        "calendar.chats": [
          timed("2026-07-28 09:00:00", "2026-07-28 18:00:00", "Passé"),
        ],
        "calendar.anniversaires": [
          { summary: "Anniv Nathan", start: "2026-07-28", end: "2026-07-29" },
        ],
      }),
      CALS,
    );
    const sel = selectNext(evs, at(2026, 7, 28, 13, 0));
    expect(sel?.rank).toBe("allday-today");
    expect(sel?.event.summary).toBe("Anniv Nathan");
  });

  it("rank 1 picks the SOONEST upcoming timed event", () => {
    const evs = parseEvents(
      response({
        "calendar.chats": [
          timed("2026-07-28 20:00:00", "2026-07-28 21:00:00", "Tard"),
          timed("2026-07-28 17:00:00", "2026-07-28 18:00:00", "Tôt"),
        ],
      }),
      CALS,
    );
    expect(selectNext(evs, at(2026, 7, 28, 13, 0))?.event.summary).toBe("Tôt");
  });

  it("rank 2: an all-day starting TODAY beats a multi-day already running", () => {
    const evs = parseEvents(
      response({
        "calendar.anniversaires": [
          { summary: "Anniv Nathan", start: "2026-07-28", end: "2026-07-29" },
        ],
        "calendar.scolaire": [
          { summary: "Vacances d'été", start: "2026-07-04", end: "2026-09-01" },
        ],
      }),
      CALS,
    );
    const sel = selectNext(evs, at(2026, 7, 28, 13, 0));
    expect(sel?.rank).toBe("allday-today");
    expect(sel?.event.summary).toBe("Anniv Nathan");
  });

  it("rank 3: a running multi-day shows only when nothing else does", () => {
    const evs = parseEvents(
      response({
        "calendar.scolaire": [
          { summary: "Vacances d'été", start: "2026-07-04", end: "2026-09-01" },
        ],
      }),
      CALS,
    );
    const sel = selectNext(evs, at(2026, 7, 28, 13, 0));
    expect(sel?.rank).toBe("ongoing");
    expect(sel?.event.summary).toBe("Vacances d'été");
  });

  it("rank 3: a TIMED appointment already under way still shows (review D1)", () => {
    // The bug this pins down: the running filter had no all-day guard AND the
    // label subtracted a day, so a 09:00–18:00 vet visit at 13:00 rendered
    // "Jusqu'au <yesterday>". Rank 3 keeps it — falling through to "Rien
    // aujourd'hui" while the appointment runs would be a lie — and the label
    // now follows the kind.
    const evs = parseEvents(
      response({
        "calendar.chats": [
          {
            summary: "Vétérinaire",
            start: "2026-07-28 09:00:00",
            end: "2026-07-28 18:00:00",
          },
        ],
      }),
      CALS,
    );
    const sel = selectNext(evs, at(2026, 7, 28, 13, 0));
    expect(sel?.rank).toBe("ongoing");
    expect(sel?.event.allDay).toBe(false);
    expect(untilLabel(sel!.event)).toBe("Jusqu'à 18:00");
  });

  it("rank 1 ignores an event starting TOMORROW, however wide the response", () => {
    // The query window bounds the reply today, but nothing in the rule did:
    // a wider window (Story 10.2 reuses these helpers) would have promoted
    // tomorrow's 00:15 to "next today" (review P7).
    const evs = parseEvents(
      response({
        "calendar.chats": [
          {
            summary: "Trop tôt",
            start: "2026-07-29 00:15:00",
            end: "2026-07-29 01:00:00",
          },
        ],
      }),
      CALS,
    );
    expect(selectNext(evs, at(2026, 7, 28, 23, 0))).toBeNull();
  });

  it("returns null when nothing qualifies — the tile renders 'Rien aujourd'hui'", () => {
    expect(selectNext([], at(2026, 7, 28, 13, 0))).toBeNull();
  });

  it("treats `end` as EXCLUSIVE: a one-day all-day event is over the next day", () => {
    const evs = parseEvents(
      response({
        "calendar.anniversaires": [
          { summary: "Anniv Nathan", start: "2026-07-28", end: "2026-07-29" },
        ],
      }),
      CALS,
    );
    // On the 29th the event is finished: not today's, and not still running.
    expect(selectNext(evs, at(2026, 7, 29, 10, 0))).toBeNull();
  });

  it("breaks a tie by MAPPING ORDER, so the choice is deterministic", () => {
    const evs = parseEvents(
      response({
        "calendar.scolaire": [
          { summary: "Rentrée", start: "2026-07-28", end: "2026-07-29" },
        ],
        "calendar.anniversaires": [
          { summary: "Anniv Nathan", start: "2026-07-28", end: "2026-07-29" },
        ],
      }),
      CALS,
    );
    // Both all-day, both start at local midnight today → mapping order wins,
    // and `anniversaires` precedes `scolaire`.
    expect(selectNext(evs, at(2026, 7, 28, 13, 0))?.event.summary).toBe(
      "Anniv Nathan",
    );
  });

  it("rank 3 prefers the most recently started of several running events", () => {
    const evs = parseEvents(
      response({
        "calendar.scolaire": [
          { summary: "Ancien", start: "2026-07-01", end: "2026-09-01" },
          { summary: "Récent", start: "2026-07-20", end: "2026-09-01" },
        ],
      }),
      CALS,
    );
    expect(selectNext(evs, at(2026, 7, 28, 13, 0))?.event.summary).toBe(
      "Récent",
    );
  });

  it("crosses midnight correctly: today's pick differs either side of 00:00", () => {
    const evs = parseEvents(
      response({
        "calendar.anniversaires": [
          { summary: "Anniv du 29", start: "2026-07-29", end: "2026-07-30" },
        ],
      }),
      CALS,
    );
    // 23h59 on the 28th: the 29th's birthday is not today's business yet.
    expect(selectNext(evs, at(2026, 7, 28, 23, 59))).toBeNull();
    // 00h01 on the 29th: it is.
    expect(selectNext(evs, at(2026, 7, 29, 0, 1))?.rank).toBe("allday-today");
  });
});

describe("relativeDelay", () => {
  it("renders hours like the mock ('dans 4h')", () => {
    expect(relativeDelay(at(2026, 7, 28, 17, 0), at(2026, 7, 28, 13, 0))).toBe(
      "dans 4h",
    );
  });

  it("renders minutes under the hour", () => {
    expect(relativeDelay(at(2026, 7, 28, 13, 25), at(2026, 7, 28, 13, 0))).toBe(
      "dans 25 min",
    );
  });

  it("says 'maintenant' at (or past) the start instant", () => {
    expect(relativeDelay(at(2026, 7, 28, 13, 0), at(2026, 7, 28, 13, 0))).toBe(
      "maintenant",
    );
    expect(relativeDelay(at(2026, 7, 28, 12, 0), at(2026, 7, 28, 13, 0))).toBe(
      "maintenant",
    );
  });
});

describe("formatEventTime", () => {
  it("uses the kiosk's 24 h form", () => {
    expect(formatEventTime(at(2026, 7, 28, 17, 0))).toBe("17:00");
    expect(formatEventTime(at(2026, 7, 28, 9, 5))).toBe("09:05");
  });
});

describe("untilLabel (rank 3)", () => {
  const running = (allDay: boolean, end: Date) => ({
    summary: "X",
    start: at(2026, 10, 20),
    end,
    allDay,
    calendarId: "calendar.scolaire",
  });

  it("names the LAST day of an all-day event, accounting for the exclusive end", () => {
    // end = 4 nov (exclusive) ⇒ the event's last day is 3 nov.
    expect(untilLabel(running(true, at(2026, 11, 4)))).toMatch(/3 nov/);
  });

  it("names the HOUR of a timed event — the exclusive-end rule must not apply", () => {
    // The 2026-07-28 review bug: subtracting a day from a wall-clock end printed
    // a date in the past ("Jusqu'au 27 juil." for a visit ending at 18:00 today).
    expect(untilLabel(running(false, at(2026, 7, 28, 18, 0)))).toBe(
      "Jusqu'à 18:00",
    );
  });
});

describe("dayRange / haDateTimeString (AD-17 query window)", () => {
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

  it("formats for HA without drifting to UTC", () => {
    // toISOString() would shift by the local offset and could name another day.
    expect(haDateTimeString(at(2026, 7, 28, 0, 0))).toBe("2026-07-28 00:00:00");
  });
});

describe("the REAL calendar.get_events payload (Florian's HA, 2026-07-29)", () => {
  // Task 0 bis, finally answered. Story 10.1 required observing this BEFORE
  // writing the parser; it shipped on an assumption instead. These fixtures are
  // copied verbatim from the real reply, so the assumption can never silently
  // drift back in.
  //
  // What the real payload confirmed: keyed by entity_id, `events` list, all-day
  // as bare dates, `end` exclusive. What it CONTRADICTED: timed events do not
  // use the space-separated form the docs assumed — they are full ISO 8601 with
  // an explicit offset. And they carry a `description` field nobody knew about.
  const REAL = {
    "calendar.chats": {
      events: [
        {
          start: "2026-07-01",
          end: "2026-07-02",
          summary: "Gaspard - Centre aéré toute la journée",
        },
        {
          start: "2026-07-01T08:45:00+02:00",
          end: "2026-07-01T09:15:00+02:00",
          summary: "Enfants - Florian",
          description: "MARI\n5314",
        },
        { start: "2026-07-02", end: "2026-07-04", summary: "Florian @Paris " },
        {
          start: "2026-07-27",
          end: "2026-08-17",
          summary: "Enfants - Les croûtes",
        },
        {
          start: "2026-07-29T17:30:00+02:00",
          end: "2026-07-29T23:45:00+02:00",
          summary: "Surprise",
        },
      ],
    },
  };
  const CHATS: readonly CalendarRef[] = [
    { entityId: "calendar.chats", label: "Chats" },
  ];

  it("parses every entry — nothing in the real reply is dropped", () => {
    expect(parseEvents(REAL, CHATS)).toHaveLength(5);
  });

  it("reads full ISO with an offset, which is what HA actually sends", () => {
    // The docs claimed "2026-07-28 17:00:00". Reality is "…T08:45:00+02:00".
    const e = parseEvents(REAL, CHATS).find(
      (x) => x.summary === "Enfants - Florian",
    )!;
    expect(e.allDay).toBe(false);
    expect(Number.isNaN(e.start.getTime())).toBe(false);
  });

  it("still tells all-day from timed by shape alone", () => {
    const byName = Object.fromEntries(
      parseEvents(REAL, CHATS).map((e) => [e.summary, e.allDay]),
    );
    expect(byName["Gaspard - Centre aéré toute la journée"]).toBe(true);
    expect(byName["Enfants - Les croûtes"]).toBe(true);
    expect(byName["Surprise"]).toBe(false);
  });

  it("trims the trailing spaces the real titles are full of", () => {
    expect(parseEvents(REAL, CHATS).map((e) => e.summary)).toContain(
      "Florian @Paris",
    );
  });

  it("ignores the undocumented `description` field without choking", () => {
    expect(() => parseEvents(REAL, CHATS)).not.toThrow();
  });

  it("picks the timed event over the three-week holiday covering the same day", () => {
    // The exact scenario the 3-rank rule exists for: "Enfants - Les croûtes"
    // spans 27 Jul → 17 Aug and would otherwise own the tile for three weeks.
    const evs = parseEvents(REAL, CHATS);
    const sel = selectNext(evs, at(2026, 7, 29, 9, 0));
    expect(sel?.rank).toBe("timed");
    expect(sel?.event.summary).toBe("Surprise");
  });

  it("once that event is under way, names its HOUR — not a date in the past", () => {
    // Regression anchor for the review's D1 finding, on real data: before the
    // fix this rendered "Jusqu'au 28 juil.".
    const evs = parseEvents(REAL, CHATS);
    const sel = selectNext(evs, at(2026, 7, 29, 20, 0));
    expect(sel?.rank).toBe("ongoing");
    expect(untilLabel(sel!.event)).toBe("Jusqu'à 23:45");
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
    expect(haDateTimeString(start)).toBe("2026-07-01 00:00:00");
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
