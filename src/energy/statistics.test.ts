import { describe, it, expect } from "vitest";
import {
  parseRows,
  countRawRows,
  selectLastCompleteDay,
  startOfDay,
  lastTwoDaysWindow,
  dayWindow,
  dayLabel,
  hourlySeries,
  periodOfInterval,
  hoursToCover,
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

describe("hourlySeries — rows → chart points", () => {
  it("maps start → t (ms) and change → value", () => {
    const pts = hourlySeries([
      { start: new Date("2026-09-23T22:00:00Z"), value: 0.31 },
      { start: new Date("2026-09-23T23:00:00Z"), value: 0.28 },
    ]);
    expect(pts).toEqual([
      { t: Date.parse("2026-09-23T22:00:00Z"), value: 0.31 },
      { t: Date.parse("2026-09-23T23:00:00Z"), value: 0.28 },
    ]);
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

describe("hoursToCover — how much history to ask for so the shown day is fully inside", () => {
  it("counts the hours from the day's start to now, rounded UP, plus one of margin", () => {
    const dayStart = new Date(2026, 8, 24);
    expect(hoursToCover(dayStart, new Date(2026, 8, 25, 10, 30))).toBe(36); // 34.5 → 35 + 1
    expect(hoursToCover(dayStart, new Date(2026, 8, 25, 0, 0))).toBe(25);
  });

  it("never asks for less than a day", () => {
    const dayStart = new Date(2026, 8, 24);
    expect(hoursToCover(dayStart, new Date(2026, 8, 24, 3))).toBe(24);
  });
});
