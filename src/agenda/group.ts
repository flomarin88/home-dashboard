import type { AgendaEvent } from "./select";

/**
 * Agenda grouping (Story 10.2) — PURE. Like `select.ts`: no `@hakit`, no clock,
 * every instant comes in as a parameter. The three views (day, week, month) all
 * render the same shape, so the arithmetic lives here once instead of three
 * times in JSX.
 */

/** One day of a range, with the events covering it. Empty days are kept. */
export interface DayBucket {
  readonly date: Date;
  readonly events: AgendaEvent[];
}

interface Range {
  readonly start: Date;
  readonly end: Date;
}

/** Midnight of the local day `d` falls in. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/**
 * Split a range into one bucket per local day, and put each event in EVERY day
 * it covers.
 *
 * Two rules do all the work, and both are places this story could quietly go
 * wrong:
 *
 *  1. **A multi-day event belongs to every day it spans**, not just the one it
 *     starts on. Florian's calendar has "Enfants - Les croûtes" running 27 July
 *     → 17 August; grouping by `start` would show it on the 27th and hide it
 *     from the twenty cells it actually occupies.
 *  2. **`end` is EXCLUSIVE** (HA's convention, confirmed on the real payload).
 *     An event ending "2026-08-17" covers up to and including the 16th. Being
 *     one day out here spills every multi-day event onto one cell too many,
 *     every single month.
 *
 * Empty days are returned as empty buckets on purpose: a week view missing its
 * quiet days is a list, not a week.
 */
export function groupByDay(
  events: readonly AgendaEvent[],
  range: Range,
): DayBucket[] {
  const buckets: DayBucket[] = [];
  const cursor = startOfDay(range.start);
  const last = startOfDay(range.end);

  while (cursor < last) {
    const dayStart = new Date(cursor.getTime());
    const dayEnd = new Date(cursor.getTime());
    dayEnd.setDate(dayEnd.getDate() + 1);

    // Overlap test, both ends half-open: the event touches this day if it
    // starts before the day is over AND ends after the day begins. Written this
    // way, the exclusive `end` falls out naturally instead of needing a −1.
    const covering = events.filter(
      (e) =>
        e.start.getTime() < dayEnd.getTime() &&
        e.end.getTime() > dayStart.getTime(),
    );

    buckets.push({ date: dayStart, events: sortWithinDay(covering) });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

/**
 * Whole-day markers first, then timed events by start time. Matches how the day
 * actually reads: "what frames today" before "what happens at 17:30".
 */
function sortWithinDay(events: AgendaEvent[]): AgendaEvent[] {
  return [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return a.start.getTime() - b.start.getTime();
  });
}

/**
 * What a month cell can show, and how much it is hiding.
 *
 * The "+N" is NOT an edge case here. Florian's "Enfants - Audrey/Florian"
 * handovers run twice a day on every weekday, so a cell capped at two is
 * overflowing on most days of most months. Getting the count wrong is therefore
 * wrong constantly, not rarely.
 */
export function capEvents(
  events: readonly AgendaEvent[],
  max: number,
): { shown: AgendaEvent[]; overflow: number } {
  return {
    shown: events.slice(0, max),
    overflow: Math.max(0, events.length - max),
  };
}
