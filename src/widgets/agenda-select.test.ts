import { describe, it, expect } from "vitest";
import {
  parseEvents,
  selectNext,
  relativeDelay,
  formatEventTime,
  untilLabel,
  dayRange,
  haDateTimeString,
} from "./agenda-select";
import type { CalendarRef } from "../entities";

// A stand-in mapping — deliberately NOT the real one, so these tests keep
// passing if Florian renames a calendar. Order matters: it breaks ties.
const CALS: readonly CalendarRef[] = [
  { entityId: "calendar.chats", label: "Chats", timed: true },
  { entityId: "calendar.anniversaires", label: "Anniversaires", timed: false },
  { entityId: "calendar.scolaire", label: "Vacances scolaires", timed: false },
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
  it("names the LAST day, accounting for the exclusive end", () => {
    // end = 4 nov (exclusive) ⇒ the event's last day is 3 nov.
    expect(untilLabel(at(2026, 11, 4), at(2026, 10, 25))).toMatch(/3 nov/);
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
