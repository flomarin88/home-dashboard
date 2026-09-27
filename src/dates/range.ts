/**
 * Calendar ranges and their labels (Story 10.2, moved here in Story 9.5) —
 * PURE. No `@hakit`, no `Date.now()`: the anchor is always a parameter, so every
 * rule is testable without fake timers.
 *
 * Extracted from `src/agenda/select.ts` the day a second domain (electricity,
 * `/electricite`) needed the same navigation. Two pages stepping through days
 * and months must agree on where a month starts and what "juillet 2026" reads
 * like — and a page must not import another domain's module to get that
 * (review 2026-07-28, D4, on the direction of dependencies). `src/agenda/`
 * keeps re-exporting these names, so its callers did not move.
 *
 * Everything below builds dates from CALENDAR FIELDS, never from millisecond
 * arithmetic: a DST day is 23 or 25 hours long.
 */
/**
 * The query window: [today 00:00 → tomorrow 00:00), in LOCAL time. Recomputed
 * on every request — the kiosk never restarts, so a window captured once at
 * mount would still describe yesterday after midnight.
 */
export function dayRange(now: Date): { start: Date; end: Date } {
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * The week the given instant falls in: [Monday 00:00 → next Monday 00:00), in
 * LOCAL time (Story 10.2).
 *
 * ⚠️ `getDay()` returns 0 for SUNDAY, not 7. The naive `date - getDay()` walks
 * back to the *following* week's Monday every Sunday — a bug that hides six days
 * out of seven and surfaces on the one day you are least likely to be testing.
 * Hence the explicit remap.
 */
export function weekRange(now: Date): { start: Date; end: Date } {
  const dow = now.getDay(); // 0 = dimanche … 6 = samedi
  const sinceMonday = dow === 0 ? 6 : dow - 1;
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - sinceMonday,
    0,
    0,
    0,
    0,
  );
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 7);
  return { start, end };
}

/**
 * The month the given instant falls in: [1st 00:00 → 1st of next month 00:00),
 * in LOCAL time (Story 10.2).
 *
 * STRICT month, not the 7×6 grid the view draws (Florian, 2026-07-29). The grid
 * therefore has cells outside this range with no data at all — they render as
 * their day number alone, heavily dimmed, and deliberately show no "nothing on"
 * state: saying nothing beats claiming a day is free when it was never asked
 * about. Switching to the grid range later is this one function.
 *
 * Built by month arithmetic, never by adding days: `setMonth` handles February,
 * leap years and December→January, which a 30/31-day offset cannot.
 */
export function monthRange(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

/** The three grains the page navigates by (Story 10.2). */
export type RangeUnit = "day" | "week" | "month";

/**
 * Move the page's anchor date by `delta` units — what the `‹` `›` arrows do
 * (Florian, 2026-07-29).
 *
 * ⚠️ The month step lands on the **1st**, never on the anchor's day-of-month.
 * `setMonth(m + 1)` on a 31st overflows: 31 January becomes 3 March, so three
 * clicks skip February entirely. Snapping to the 1st also matches what the month
 * view actually shows — a month, not a date.
 *
 * Day and week steps go through `setDate`, which already rolls months and years
 * over correctly.
 */
export function shiftAnchor(
  anchor: Date,
  unit: RangeUnit,
  delta: number,
): Date {
  if (unit === "month") {
    return new Date(
      anchor.getFullYear(),
      anchor.getMonth() + delta,
      1,
      0,
      0,
      0,
      0,
    );
  }
  const step = unit === "week" ? 7 * delta : delta;
  const next = new Date(anchor.getTime());
  next.setDate(next.getDate() + step);
  return next;
}

const LABEL_DAY_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const LABEL_SHORT_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});
const LABEL_MONTH_FMT = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

/**
 * What period is on screen, in words — the reminder beside the arrows. Once you
 * can navigate, "which week am I looking at?" stops being obvious, and a grid of
 * bare day numbers answers it badly.
 *
 * The week label names the REAL week bounds (Monday→Sunday), not the anchor: you
 * navigate from a Wednesday but you are looking at 27 July – 2 August.
 *
 * Named `rangeLabel`, deliberately not `periodLabel` — that one already exists
 * in `consumption-format` for the HC/HP tariff periods, and two functions with
 * the same name in the same app is a trap for whoever greps next.
 */
export function rangeLabel(anchor: Date, unit: RangeUnit): string {
  if (unit === "day") return LABEL_DAY_FMT.format(anchor);
  if (unit === "month") return LABEL_MONTH_FMT.format(anchor);
  const { start, end } = weekRange(anchor);
  const last = new Date(end.getTime());
  last.setDate(last.getDate() - 1); // `end` is exclusive
  return `${LABEL_SHORT_FMT.format(start)} – ${LABEL_SHORT_FMT.format(last)}`;
}
