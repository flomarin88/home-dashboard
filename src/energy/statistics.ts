import { formatClock } from "../ui/clock-format";

/**
 * Long-term statistics, the pure part (Story 9.4, AD-16 amended / AD-17).
 *
 * The house's electricity data is not an entity: ha-linky writes two long-term
 * statistics into HA's recorder (`linky:<PRM>` in Wh, `linky:<PRM>_cost` in €),
 * hourly, imported each morning for the day before. This module owns everything
 * that can be reasoned about without HA: validating the service's reply,
 * choosing WHICH day to show (the last complete one, never today), building the
 * query windows, and naming that day so the screen never passes an old figure
 * off as today's (UX-DR30).
 *
 * PURE and clock-free: every function takes `now`/`today` as a parameter and
 * none reads `Date.now()` (lesson 9.2/11.1 — a module without a clock is tested
 * without fake timers). It lives in `src/energy/`, not `src/widgets/`, because
 * `src/hakit/` needs it to validate the payload and must never import a widget
 * (precedent `src/agenda/select.ts`).
 */

/** One row of `recorder.get_statistics`, as HA formats it (ISO UTC strings). */
export interface StatRow {
  readonly start: string;
  readonly end?: string;
  /** Energy (or €) OF the period = sum(end) − sum(start), computed by HA. Absent on the first row ever. */
  readonly change?: number;
}

/** A validated row: local-agnostic instant + finite value. */
export interface DayPoint {
  readonly start: Date;
  readonly value: number;
}

/** A query window, [start, end). */
export interface StatisticsWindow {
  readonly start: Date;
  readonly end: Date;
}

const DAY_MS = 86_400_000;

function rowsOf(response: unknown, statisticId: string): readonly unknown[] {
  if (typeof response !== "object" || response === null) return [];
  const stats = (response as { statistics?: unknown }).statistics;
  if (typeof stats !== "object" || stats === null) return [];
  const rows = (stats as Record<string, unknown>)[statisticId];
  return Array.isArray(rows) ? rows : [];
}

/**
 * The single place a `recorder.get_statistics` payload is trusted. A row
 * survives only with a parsable `start` and a FINITE NUMBER `change`. Absent,
 * null, string or NaN `change` all mean "no value for this period" — HA omits
 * `change` on a statistic's very first row, and treating that as 0 would print
 * a free day. Output sorted by `start`.
 */
export function parseRows(response: unknown, statisticId: string): DayPoint[] {
  const out: DayPoint[] = [];
  for (const raw of rowsOf(response, statisticId)) {
    if (typeof raw !== "object" || raw === null) continue;
    const { start, change } = raw as { start?: unknown; change?: unknown };
    if (typeof start !== "string") continue;
    const t = new Date(start);
    if (Number.isNaN(t.getTime())) continue;
    if (typeof change !== "number" || !Number.isFinite(change)) continue;
    out.push({ start: t, value: change });
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** How many rows HA sent for this id — readable or not (a reply with rows but
 *  none parsable is a format mismatch, not an empty day; review 10.1, D2). */
export function countRawRows(response: unknown, statisticId: string): number {
  return rowsOf(response, statisticId).length;
}

/** Local midnight of the day containing `d`. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * The day to show: the most recent row strictly BEFORE today's local midnight.
 * Today is never a candidate — with a J-1 source it can only be partial, and a
 * partial day read as a whole one is exactly the lie UX-DR30 forbids. Before
 * the morning import this is the day before yesterday; that is nominal.
 */
export function selectLastCompleteDay(
  rows: readonly DayPoint[],
  todayStart: Date,
): DayPoint | null {
  let pick: DayPoint | null = null;
  for (const r of rows) {
    if (r.start.getTime() >= todayStart.getTime()) continue;
    if (pick === null || r.start.getTime() > pick.start.getTime()) pick = r;
  }
  return pick;
}

/**
 * [J-2 00:00, J 00:00) in local time, from the `now` given. Two days, so a
 * morning without yesterday's import still has a complete day to show.
 * Built from calendar fields, not from `now - 2 × 24 h`: a DST day is 23 or
 * 25 hours long and a millisecond subtraction would miss its midnight.
 */
export function lastTwoDaysWindow(now: Date): StatisticsWindow {
  const end = startOfDay(now);
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 2);
  return { start, end };
}

/** [day 00:00, day+1 00:00) in local time — the hourly chart's window. */
export function dayWindow(dayStart: Date): StatisticsWindow {
  const start = startOfDay(dayStart);
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 1,
  );
  return { start, end };
}

const SHORT_WEEKDAY_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
});

/**
 * How the shown day is named (UX-DR30). `short` is for the top-bar chip, where
 * every character costs: "Hier" when it IS yesterday, else the short date
 * ("mar. 22") — the date REPLACES the word, it never piles on top of it.
 * `long` is for the detail page and the accessible name: "hier, jeudi 24
 * septembre", "avant-hier, …", or the bare date beyond that. The long date
 * reuses the kiosk clock's own formatter, so the two never disagree on French.
 */
export function dayLabel(
  dayStart: Date,
  today: Date,
): { short: string; long: string } {
  const day = startOfDay(dayStart);
  const diffDays = Math.round(
    (startOfDay(today).getTime() - day.getTime()) / DAY_MS,
  );
  const longDate = formatClock(day).date;
  if (diffDays === 1) return { short: "Hier", long: `hier, ${longDate}` };
  const short = `${SHORT_WEEKDAY_FMT.format(day)} ${day.getDate()}`;
  if (diffDays === 2) return { short, long: `avant-hier, ${longDate}` };
  return { short, long: longDate };
}

/** One sample of an entity's history: the instant (ms) a state took effect. */
export interface StateSample {
  readonly t: number;
  readonly state: string;
}

/** The tariff an interval of the past was — or null when history does not say. */
export type HourPeriod = "creuses" | "pleines" | null;

/**
 * Which tariff period an interval [startMs, endMs) of the PAST was, read off the
 * history of the period `binary_sensor` (Story 9.4, colour of the hourly bars).
 *
 * Rounded "à l'heure près" by MAJORITY: the state in force is integrated over
 * the interval, and creuses wins when it covers at least half of the KNOWN
 * time (`on` ≥ `off`). So the hour in which creuses BEGINS a few minutes past
 * the hour is creuses, and the hour in which it ENDS a few minutes past the hour
 * is pleines. Time with no sample yet, or spent in a state
 * that is neither `on` nor `off` (`unavailable`, `unknown`), is excluded; if
 * nothing is known, the answer is null — a bar without a tariff, never a guess.
 *
 * The schedule itself stays where AD-4 puts it: the flips come from HA's
 * history payload, this function only measures them.
 */
export function periodOfInterval(
  timeline: readonly StateSample[],
  startMs: number,
  endMs: number,
): HourPeriod {
  if (endMs <= startMs) return null;
  const samples = [...timeline].sort((a, b) => a.t - b.t);
  // State in force when the interval opens: the last sample at or before it.
  let current: string | null = null;
  let i = 0;
  while (i < samples.length && samples[i].t <= startMs) {
    current = samples[i].state;
    i++;
  }
  let on = 0;
  let off = 0;
  let cursor = startMs;
  const account = (until: number) => {
    const span = Math.max(0, until - cursor);
    if (current === "on") on += span;
    else if (current === "off") off += span;
    cursor = until;
  };
  for (; i < samples.length && samples[i].t < endMs; i++) {
    account(samples[i].t);
    current = samples[i].state;
  }
  account(endMs);
  if (on + off === 0) return null;
  return on >= off ? "creuses" : "pleines";
}

/** The row of exactly this day (by its start instant), or null — never a neighbour's. */
export function pointOn(
  rows: readonly DayPoint[],
  dayStart: Date,
): DayPoint | null {
  const t = dayStart.getTime();
  return rows.find((r) => r.start.getTime() === t) ?? null;
}

/**
 * One chart slot per hour of the window, from the calendar (23, 24 or 25 on a
 * DST day): rows found keep their value, missing hours get `null`, rows outside
 * the window are dropped. A bar chart on a categorical axis packs whatever it
 * is given edge to edge, so a day with 20 rows would look exactly like a full
 * one; padding keeps the missing hours VISIBLE as gaps (review 2026-09-27).
 */
export function padHours(
  rows: readonly DayPoint[],
  window: StatisticsWindow,
): { t: number; value: number | null }[] {
  const byStart = new Map(rows.map((r) => [r.start.getTime(), r.value]));
  const out: { t: number; value: number | null }[] = [];
  const d = new Date(window.start.getTime());
  while (d.getTime() < window.end.getTime()) {
    const t = d.getTime();
    out.push({ t, value: byStart.get(t) ?? null });
    d.setTime(t + 3_600_000);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Story 9.5 — months, comparisons, navigation bounds. Same rules as above:
// calendar fields (never `× 24 h`), `now`/anchors as parameters, no clock.
// ---------------------------------------------------------------------------

/** Local midnight of the 1st of the month containing `d`. */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** [1st 00:00, next 1st 00:00) in local time — a month's daily chart. */
export function monthWindow(monthStart: Date): StatisticsWindow {
  const start = startOfMonth(monthStart);
  return {
    start,
    end: new Date(start.getFullYear(), start.getMonth() + 1, 1),
  };
}

/**
 * [M − backMonths, M + 1) in local time: one `period: "month"` request that
 * returns the anchor month AND its two references (13 back reaches M−12).
 */
export function monthsWindow(
  monthStart: Date,
  backMonths: number,
): StatisticsWindow {
  const m = startOfMonth(monthStart);
  return {
    start: new Date(m.getFullYear(), m.getMonth() - backMonths, 1),
    end: new Date(m.getFullYear(), m.getMonth() + 1, 1),
  };
}

/**
 * [M, M + days) in local time — the « à date » reference window. HA reduces the
 * rows of exactly this range into ONE month bucket, so its `change` is the
 * consumption of the first `days` days, computed by HA (AC5). The app never
 * sums days to get there.
 */
export function truncatedMonthWindow(
  monthStart: Date,
  days: number,
): StatisticsWindow {
  const m = startOfMonth(monthStart);
  return { start: m, end: new Date(m.getFullYear(), m.getMonth(), 1 + days) };
}

/**
 * One chart slot per calendar day of the window (28 to 31): rows found keep
 * their value, missing days get `null`, rows outside the window are dropped.
 * Same reason as `padHours`: on a categorical axis a month with 26 rows would
 * look complete. Steps by calendar day, so the 25-hour DST day is one slot.
 */
export function padDays(
  rows: readonly DayPoint[],
  window: StatisticsWindow,
): { t: number; value: number | null }[] {
  const byStart = new Map(rows.map((r) => [r.start.getTime(), r.value]));
  const out: { t: number; value: number | null }[] = [];
  const d = new Date(
    window.start.getFullYear(),
    window.start.getMonth(),
    window.start.getDate(),
  );
  while (d.getTime() < window.end.getTime()) {
    const t = d.getTime();
    out.push({ t, value: byStart.get(t) ?? null });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * How many days of the month the data covers: the day-of-month of the LAST
 * daily row inside it, 0 when there is none. This is the N of « à date (N j) »,
 * and the length of the truncated reference windows.
 */
export function daysCoveredIn(
  rows: readonly DayPoint[],
  monthStart: Date,
): number {
  const { start, end } = monthWindow(monthStart);
  let last = 0;
  for (const r of rows) {
    const t = r.start.getTime();
    if (t < start.getTime() || t >= end.getTime()) continue;
    last = Math.max(last, r.start.getDate());
  }
  return last;
}

/**
 * (cur − ref) / ref — the ONE piece of arithmetic this story adds to the app.
 * Unrounded (the formatter rounds). `null` when either figure is missing, and
 * when the reference is 0: a division by zero dressed up as "+∞ %" or hidden
 * as 0 would both be invented numbers (AD-16).
 */
export function variation(
  cur: number | null,
  ref: number | null,
): number | null {
  if (cur === null || ref === null || ref === 0) return null;
  return (cur - ref) / ref;
}

const MONTH_YEAR_FMT = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});
const MONTH_FMT = new Intl.DateTimeFormat("fr-FR", { month: "long" });
const MONTH_SHORT_YEAR_FMT = new Intl.DateTimeFormat("fr-FR", {
  month: "short",
  year: "numeric",
});

/** "Août 2026" — a tile title, so capitalised (fr-FR months are lower-case). */
export function monthLabel(monthStart: Date): string {
  const s = MONTH_YEAR_FMT.format(monthStart);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * The reference month named as briefly as it can be without ambiguity: "août"
 * when it shares the anchor's year, "sept. 2025" when it does not. Lower-case,
 * because it follows "vs" inside a sentence.
 */
export function monthShort(monthStart: Date, relativeTo: Date): string {
  return monthStart.getFullYear() === relativeTo.getFullYear()
    ? MONTH_FMT.format(monthStart)
    : MONTH_SHORT_YEAR_FMT.format(monthStart);
}

/** "sept. 2026" — the month as the control row's period reminder wears it. */
export function monthTag(monthStart: Date): string {
  return MONTH_SHORT_YEAR_FMT.format(monthStart);
}
