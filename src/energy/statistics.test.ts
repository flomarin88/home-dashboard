import { describe, it, expect } from "vitest";
import {
  parseRows,
  countRawRows,
  selectLastCompleteDay,
  startOfDay,
  lastTwoDaysWindow,
  dayWindow,
  dayLabel,
  periodOfInterval,
  pointOn,
  padHours,
  startOfMonth,
  monthWindow,
  monthsWindow,
  truncatedMonthWindow,
  padDays,
  daysCoveredIn,
  variation,
  monthLabel,
  monthShort,
  monthTag,
} from "./statistics";

// The suite runs with TZ=Europe/Paris pinned (vitest.config.ts). HA answers in
// UTC ISO: local midnight on 2026-09-24 is 22:00Z the day before (CEST).
const ID = "linky:24305788525104";
const response = (rows: unknown[], id = ID) => ({ statistics: { [id]: rows } });

// 2026-09-25 is a Friday.
const today = new Date(2026, 8, 25, 10, 30); // local
const row = (isoStart: string, change?: number) => ({
  start: isoStart,
  end: isoStart,
  ...(change === undefined ? {} : { change }),
});

describe("parseRows — the only place an HA payload is trusted", () => {
  it("keeps rows with a parsable start and a finite change, sorted by start", () => {
    const rows = parseRows(
      response([
        row("2026-09-23T22:00:00+00:00", 8.2),
        row("2026-09-22T22:00:00+00:00", 6.1),
      ]),
      ID,
    );
    expect(rows.map((r) => r.value)).toEqual([6.1, 8.2]);
    expect(rows[1].start.getTime()).toBe(Date.parse("2026-09-23T22:00:00Z"));
  });

  it("ignores rows whose change is absent or not a finite number — an absence is not a zero", () => {
    const rows = parseRows(
      response([
        row("2026-09-22T22:00:00+00:00"), // first-ever row: HA omits `change`
        { start: "2026-09-23T22:00:00+00:00", change: "8.2" },
        { start: "2026-09-24T22:00:00+00:00", change: Number.NaN },
        { start: "2026-09-20T22:00:00+00:00", change: null },
      ]),
      ID,
    );
    expect(rows).toEqual([]);
  });

  it("keeps a zero — a day at 0 kWh is a value", () => {
    expect(
      parseRows(response([row("2026-09-23T22:00:00+00:00", 0)]), ID),
    ).toHaveLength(1);
  });

  it("drops rows with an unparsable start", () => {
    expect(parseRows(response([row("hier", 1)]), ID)).toEqual([]);
  });

  it("returns [] when the statistic id is missing, when `statistics` is missing, and when the payload is not an object", () => {
    expect(
      parseRows(response([row("2026-09-23T22:00:00+00:00", 1)]), "linky:autre"),
    ).toEqual([]);
    expect(parseRows({}, ID)).toEqual([]);
    expect(parseRows(undefined, ID)).toEqual([]);
    expect(parseRows("nope", ID)).toEqual([]);
    expect(parseRows({ statistics: { [ID]: "nope" } }, ID)).toEqual([]);
  });
});

describe("countRawRows — how many rows HA sent, readable or not", () => {
  it("counts the rows under the id, 0 otherwise", () => {
    expect(countRawRows(response([row("x"), row("y")]), ID)).toBe(2);
    expect(countRawRows({}, ID)).toBe(0);
  });
});

describe("selectLastCompleteDay — never today, the most recent before it", () => {
  const todayStart = startOfDay(today);
  const d = (isoStart: string, value: number) => ({
    start: new Date(isoStart),
    value,
  });

  it("picks yesterday when present", () => {
    const pick = selectLastCompleteDay(
      [d("2026-09-22T22:00:00Z", 6.1), d("2026-09-23T22:00:00Z", 8.2)],
      todayStart,
    );
    expect(pick?.value).toBe(8.2);
  });

  it("falls back to the day before when yesterday has not been imported yet", () => {
    const pick = selectLastCompleteDay(
      [d("2026-09-22T22:00:00Z", 6.1)],
      todayStart,
    );
    expect(pick?.value).toBe(6.1);
  });

  it("NEVER picks today, even if HA returned a partial row for it", () => {
    const pick = selectLastCompleteDay(
      [d("2026-09-23T22:00:00Z", 8.2), d("2026-09-24T22:00:00Z", 0.4)],
      todayStart,
    );
    expect(pick?.value).toBe(8.2);
  });

  it("returns null when nothing complete exists", () => {
    expect(selectLastCompleteDay([], todayStart)).toBeNull();
    expect(
      selectLastCompleteDay([d("2026-09-24T22:00:00Z", 0.4)], todayStart),
    ).toBeNull();
  });
});

describe("windows — local midnights, computed from the `now` given", () => {
  it("lastTwoDaysWindow covers [J-2 00:00, J 00:00) local", () => {
    const { start, end } = lastTwoDaysWindow(today);
    expect([start.getDate(), start.getHours(), start.getMinutes()]).toEqual([
      23, 0, 0,
    ]);
    expect([end.getDate(), end.getHours()]).toEqual([25, 0]);
  });

  it("stays on local midnights across the autumn DST change (25 h day)", () => {
    // DST ends 2026-10-25 in Europe/Paris. J-2 = 2026-10-24 (CEST), J = 2026-10-26 (CET).
    const { start, end } = lastTwoDaysWindow(new Date(2026, 9, 26, 9));
    expect([start.getDate(), start.getHours()]).toEqual([24, 0]);
    expect([end.getDate(), end.getHours()]).toEqual([26, 0]);
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(49);
  });

  it("dayWindow covers [day 00:00, day+1 00:00) local", () => {
    const { start, end } = dayWindow(new Date(2026, 8, 24, 0, 0));
    expect(start.getDate()).toBe(24);
    expect([end.getDate(), end.getHours()]).toEqual([25, 0]);
  });
});

describe("dayLabel — a deferred value is a dated value (UX-DR30)", () => {
  it("J-1 → « Hier » on the chip, « hier, jeudi 24 septembre » in full", () => {
    expect(dayLabel(new Date(2026, 8, 24), today)).toEqual({
      short: "Hier",
      long: "hier, jeudi 24 septembre",
    });
  });

  it("J-2 → the short date on the chip, « avant-hier, … » in full", () => {
    expect(dayLabel(new Date(2026, 8, 23), today)).toEqual({
      short: "mer. 23",
      long: "avant-hier, mercredi 23 septembre",
    });
  });

  it("older → the date, nothing relative", () => {
    expect(dayLabel(new Date(2026, 8, 22), today)).toEqual({
      short: "mar. 22",
      long: "mardi 22 septembre",
    });
  });

  it("reads the day from a UTC-midnight instant as the LOCAL day", () => {
    // HA's `start` for 2026-09-24 local is 2026-09-23T22:00Z.
    expect(dayLabel(new Date("2026-09-23T22:00:00Z"), today).short).toBe(
      "Hier",
    );
  });
});

describe("periodOfInterval — which tariff an hour of the past was, from HA's own history", () => {
  // Local 24 Sept 2026. HA's binary_sensor flips at 01:08, 06:08, 12:38, 15:38 —
  // those instants come from the HISTORY payload, never from this code.
  const day = new Date(2026, 8, 24);
  const at = (h: number, m = 0) => new Date(2026, 8, 24, h, m).getTime();
  const H = 3_600_000;
  const timeline = [
    { t: new Date(2026, 8, 23, 23, 0).getTime(), state: "off" }, // state at window start
    { t: at(1, 8), state: "on" },
    { t: at(6, 8), state: "off" },
    { t: at(12, 38), state: "on" },
    { t: at(15, 38), state: "off" },
  ];
  const hour = (h: number) => periodOfInterval(timeline, at(h), at(h) + H);

  it("rounds each hour to its MAJORITY: 01h–02h is creuses (52 min on), 06h–07h is pleines (8 min on)", () => {
    expect(hour(0)).toBe("pleines");
    expect(hour(1)).toBe("creuses");
    expect(hour(5)).toBe("creuses");
    expect(hour(6)).toBe("pleines");
    expect(hour(12)).toBe("pleines"); // 22 min on
    expect(hour(13)).toBe("creuses");
    expect(hour(15)).toBe("creuses"); // 38 min on
    expect(hour(16)).toBe("pleines");
    expect(hour(23)).toBe("pleines");
  });

  it("exactly half an hour on counts as creuses (>=)", () => {
    const tl = [
      { t: at(0), state: "off" },
      { t: at(2, 30), state: "on" },
    ];
    expect(periodOfInterval(tl, at(2), at(3))).toBe("creuses");
    expect(periodOfInterval(tl, at(1), at(2))).toBe("pleines");
  });

  it("an hour the history does not cover is unknown (null), never a guess", () => {
    const tl = [{ t: at(3), state: "on" }]; // nothing known before 03:00
    expect(periodOfInterval(tl, at(0), at(1))).toBeNull();
    expect(periodOfInterval(tl, at(2), at(3))).toBeNull();
    expect(periodOfInterval(tl, at(3), at(4))).toBe("creuses");
    expect(periodOfInterval([], at(0), at(1))).toBeNull();
  });

  it("time spent unavailable/unknown is excluded; a fully unavailable hour is null", () => {
    const tl = [
      { t: at(0), state: "unavailable" },
      { t: at(1, 40), state: "on" },
    ];
    expect(periodOfInterval(tl, at(0), at(1))).toBeNull();
    // 01:00–01:40 unavailable (excluded), 01:40–02:00 on → majority of KNOWN time
    expect(periodOfInterval(tl, at(1), at(2))).toBe("creuses");
  });

  it("does not depend on sample order", () => {
    const shuffled = [
      timeline[3],
      timeline[0],
      timeline[4],
      timeline[1],
      timeline[2],
    ];
    expect(periodOfInterval(shuffled, at(1), at(2))).toBe("creuses");
    expect(periodOfInterval(shuffled, at(6), at(7))).toBe("pleines");
  });

  it("a partial-hour interval (DST or a truncated row) is judged on its own length", () => {
    expect(periodOfInterval(timeline, at(6), at(6, 30))).toBe("pleines"); // 8 of 30 min on
    expect(periodOfInterval(timeline, at(6), at(6, 15))).toBe("creuses"); // 8 of 15 min on
    void day;
  });
});

describe("pointOn — the row of ONE given day, or nothing", () => {
  const d = (isoStart: string, value: number) => ({
    start: new Date(isoStart),
    value,
  });
  const rows = [d("2026-09-22T22:00:00Z", 6.1), d("2026-09-23T22:00:00Z", 8.2)];

  it("returns the row whose start matches the day exactly", () => {
    expect(pointOn(rows, new Date("2026-09-23T22:00:00Z"))?.value).toBe(8.2);
  });

  it("returns null when that day has no row — never a neighbour's value (UX-DR30)", () => {
    expect(pointOn(rows, new Date("2026-09-24T22:00:00Z"))).toBeNull();
    expect(pointOn([], new Date("2026-09-23T22:00:00Z"))).toBeNull();
  });
});

describe("padHours — one slot per hour of the window, gaps kept visible", () => {
  const start = new Date(2026, 8, 24, 0, 0);
  const end = new Date(2026, 8, 25, 0, 0);
  const H = 3_600_000;

  it("keeps the rows it has and fills missing hours with a null value", () => {
    const rows = [
      { start: new Date(start.getTime()), value: 0.3 },
      { start: new Date(start.getTime() + 2 * H), value: 0.5 },
    ];
    const slots = padHours(rows, { start, end });
    expect(slots).toHaveLength(24);
    expect(slots[0]).toEqual({ t: start.getTime(), value: 0.3 });
    expect(slots[1]).toEqual({ t: start.getTime() + H, value: null });
    expect(slots[2].value).toBe(0.5);
    expect(slots.filter((p) => p.value === null)).toHaveLength(22);
  });

  it("drops rows outside the window — another day's hours never leak in", () => {
    const rows = [{ start: new Date(2026, 8, 23, 5), value: 9 }];
    const slots = padHours(rows, { start, end });
    expect(slots.every((p) => p.value === null)).toBe(true);
  });

  it("follows the calendar on a 25-hour DST day", () => {
    // 2026-10-25, Europe/Paris: 03:00 CEST → 02:00 CET.
    const s = new Date(2026, 9, 25, 0, 0);
    const e = new Date(2026, 9, 26, 0, 0);
    expect(padHours([], { start: s, end: e })).toHaveLength(25);
  });
});

// ---------------------------------------------------------------------------
// Story 9.5 — months, comparisons, navigation bounds.
// ---------------------------------------------------------------------------

/** Local-time Date from calendar fields (month is 1-based here, like a human). */
const local = (y: number, m: number, d: number, h = 0): Date =>
  new Date(y, m - 1, d, h);
const ymd = (d: Date) =>
  `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
/** A daily row starting at LOCAL midnight of that day, as HA would send it (UTC ISO). */
const dayRow = (y: number, m: number, d: number, change: number) => ({
  start: local(y, m, d).toISOString(),
  end: local(y, m, d + 1).toISOString(),
  change,
});

describe("month windows (Story 9.5) — calendar fields, never × 24 h", () => {
  it("startOfMonth drops the day and the time", () => {
    expect(ymd(startOfMonth(local(2026, 8, 19, 14)))).toBe("2026-8-1");
    expect(startOfMonth(local(2026, 8, 19, 14)).getHours()).toBe(0);
  });

  it("monthWindow spans [1st 00:00, next 1st 00:00) in local time", () => {
    const w = monthWindow(local(2026, 8, 1));
    expect(ymd(w.start)).toBe("2026-8-1");
    expect(ymd(w.end)).toBe("2026-9-1");
    expect(w.end.getHours()).toBe(0);
  });

  it("monthWindow rolls December into the next year", () => {
    expect(ymd(monthWindow(local(2026, 12, 1)).end)).toBe("2027-1-1");
  });

  it("monthsWindow reaches BACK n months and ends after the anchor month", () => {
    // 13 months back from September 2026 = August 2025 → the window serves
    // M, M−1 and M−12 in one request.
    const w = monthsWindow(local(2026, 9, 1), 13);
    expect(ymd(w.start)).toBe("2025-8-1");
    expect(ymd(w.end)).toBe("2026-10-1");
  });

  it("truncatedMonthWindow covers exactly n days from the 1st", () => {
    const w = truncatedMonthWindow(local(2026, 8, 1), 26);
    expect(ymd(w.start)).toBe("2026-8-1");
    expect(ymd(w.end)).toBe("2026-8-27");
    // 29 days of a leap February land on 1 March, not on a phantom 30 Feb.
    expect(ymd(truncatedMonthWindow(local(2028, 2, 1), 29).end)).toBe(
      "2028-3-1",
    );
  });

  it("keeps midnight boundaries across the October DST change (25 h day)", () => {
    const w = monthWindow(local(2026, 10, 1));
    expect(ymd(w.end)).toBe("2026-11-1");
    expect(w.end.getHours()).toBe(0);
    expect(ymd(truncatedMonthWindow(local(2026, 10, 1), 27).end)).toBe(
      "2026-10-28",
    );
    expect(truncatedMonthWindow(local(2026, 10, 1), 27).end.getHours()).toBe(0);
  });
});

describe("padDays — one slot per calendar day of the window, gaps kept visible", () => {
  it("30 rows in a 31-day month still make 31 slots, the missing day null", () => {
    const rows = parseRows(
      response(
        Array.from({ length: 31 }, (_, i) => i + 1)
          .filter((d) => d !== 15)
          .map((d) => dayRow(2026, 8, d, 5 + d / 100)),
      ),
      ID,
    );
    const slots = padDays(rows, monthWindow(local(2026, 8, 1)));
    expect(slots).toHaveLength(31);
    expect(slots[14]).toEqual({ t: local(2026, 8, 15).getTime(), value: null });
    expect(slots[0].value).toBeCloseTo(5.01);
    expect(slots[30].value).toBeCloseTo(5.31);
  });

  it("drops rows outside the window and survives the 25-hour DST day", () => {
    const rows = parseRows(
      response([
        dayRow(2026, 9, 30, 9),
        dayRow(2026, 10, 25, 7),
        dayRow(2026, 10, 26, 6),
      ]),
      ID,
    );
    const slots = padDays(rows, monthWindow(local(2026, 10, 1)));
    expect(slots).toHaveLength(31);
    expect(slots.find((p) => p.value === 9)).toBeUndefined();
    expect(slots[24]).toEqual({ t: local(2026, 10, 25).getTime(), value: 7 });
    expect(slots[25]).toEqual({ t: local(2026, 10, 26).getTime(), value: 6 });
  });
});

describe("daysCoveredIn — how far the month's data goes (the N of « à date »)", () => {
  it("is the day-of-month of the LAST row inside the month, whatever the order", () => {
    const rows = parseRows(
      response([
        dayRow(2026, 9, 26, 8),
        dayRow(2026, 9, 3, 7),
        dayRow(2026, 9, 12, 6),
      ]),
      ID,
    );
    expect(daysCoveredIn(rows, local(2026, 9, 1))).toBe(26);
  });

  it("ignores rows of other months and is 0 with nothing", () => {
    const rows = parseRows(
      response([dayRow(2026, 8, 31, 8), dayRow(2026, 10, 1, 8)]),
      ID,
    );
    expect(daysCoveredIn(rows, local(2026, 9, 1))).toBe(0);
    expect(daysCoveredIn([], local(2026, 9, 1))).toBe(0);
  });
});

describe("variation — the ONLY arithmetic the app adds (AD-16/AD-17)", () => {
  it("is (cur − ref) / ref, unrounded", () => {
    expect(variation(112, 100)).toBeCloseTo(0.12);
    expect(variation(95, 100)).toBeCloseTo(-0.05);
    expect(variation(0, 100)).toBe(-1);
  });

  it("is null when either side is missing — never an invented 0", () => {
    expect(variation(null, 100)).toBeNull();
    expect(variation(112, null)).toBeNull();
  });

  it("is null when the reference is 0 — no Infinity, no NaN", () => {
    expect(variation(112, 0)).toBeNull();
    expect(variation(0, 0)).toBeNull();
  });
});

describe("month labels (fr-FR)", () => {
  it("monthLabel names the month and year, capitalised (a tile title)", () => {
    expect(monthLabel(local(2026, 8, 1))).toBe("Août 2026");
    expect(monthLabel(local(2026, 9, 1))).toBe("Septembre 2026");
  });

  it("monthShort names the month alone within the same year as the anchor", () => {
    expect(monthShort(local(2026, 8, 1), local(2026, 9, 1))).toBe("août");
  });

  it("monthTag is the compact form for the control row: « sept. 2026 »", () => {
    expect(monthTag(local(2026, 9, 1))).toBe("sept. 2026");
    expect(monthTag(local(2026, 8, 1))).toBe("août 2026");
  });

  it("monthShort adds the year when it differs from the anchor's", () => {
    expect(monthShort(local(2025, 9, 1), local(2026, 9, 1))).toBe("sept. 2025");
  });
});
