import type { CalendarRef } from "../entities";

/**
 * Agenda domain logic (Story 10.1, AD-17) — PURE. No `@hakit`, no `Date.now()`:
 * `now` is always a parameter, so every rule below is testable without fake
 * timers and renders deterministically. No recurrence expansion and no timezone
 * arithmetic either (AD-4): `calendar.get_events` already returns the expanded
 * occurrences, we only read them.
 *
 * It lives in `src/agenda/` — NOT in `src/widgets/` — because both layers read
 * it: `hakit/useCalendarEvents` needs the parser and the query window, the tile
 * needs the ranking and the labels. Parked under `widgets/`, the HA seam would
 * have had to import upward from the view layer (review 2026-07-28, D4). Same
 * shape as `src/nutriclaude/`: a feature folder that owns its pure logic.
 */

/** Which rule picked the displayed event — it drives how the tile renders. */
export type EventRank = "timed" | "allday-today" | "ongoing";

export interface AgendaEvent {
  readonly summary: string;
  readonly start: Date;
  /** EXCLUSIVE, per HA: an all-day event on the 28th ends "2026-07-29". */
  readonly end: Date;
  /** True when the payload carried a date with no hour (whole-day event). */
  readonly allDay: boolean;
  /** The mapped calendar this came from — Story 10.3 filters on it. */
  readonly calendarId: string;
}

export interface Selection {
  readonly event: AgendaEvent;
  readonly rank: EventRank;
}

/** `calendar.get_events` response: keyed by entity_id, each with an event list. */
export type CalendarResponse = Record<string, unknown>;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse one HA datetime string.
 *
 * Two shapes must be handled, and the difference IS the all-day signal — the HA
 * docs don't formalise it, so we detect it from the payload rather than assume:
 *   - "2026-07-28"            → all-day
 *   - "2026-07-28 17:00:00"   → timed (may also carry a "T" and/or an offset)
 *
 * Both paths avoid two real traps:
 *   - a date-only string fed to `new Date()` is read as UTC midnight, which
 *     lands on the PREVIOUS day west of Greenwich — so we build it from local
 *     components instead;
 *   - WebKit (the kiosk is Safari 16.6) rejects the space-separated form, so
 *     the separator is normalised to "T" before parsing.
 */
function parseHaDate(raw: unknown): { date: Date; allDay: boolean } | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (s === "") return null;

  if (DATE_ONLY_RE.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    // `new Date(2026, 12, 45)` does NOT produce NaN — it rolls over to
    // 2027-02-14, so the shape check above is not enough to call the value
    // sane. Reading the components back is the only way to reject an
    // out-of-range date instead of rendering a confidently wrong day
    // (review 2026-07-28, P8). `setFullYear` also guards years < 100, which
    // the two-digit legacy mapping would otherwise send to the 1900s.
    date.setFullYear(y);
    const roundTrips =
      date.getFullYear() === y &&
      date.getMonth() === m - 1 &&
      date.getDate() === d;
    return roundTrips ? { date, allDay: true } : null;
  }

  // Only the FIRST space is the date/time separator; a later one could belong
  // to an offset.
  const date = new Date(s.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : { date, allDay: false };
}

function readEvents(bucket: unknown): unknown[] {
  if (typeof bucket !== "object" || bucket === null) return [];
  const events = (bucket as { events?: unknown }).events;
  return Array.isArray(events) ? events : [];
}

/**
 * Flatten the keyed response into domain events, walking the calendars in
 * MAPPING ORDER so ties stay deterministic downstream. Only mapped calendars
 * are read (AD-7). Anything unparsable is dropped silently — a corrupt entry
 * must never surface as "Invalid Date", and must never take its siblings down.
 *
 * ONE exception to "unparsable is dropped": a missing or blank `summary` is
 * NOT fatal. The dates are what the tile ranks on; a nameless event still
 * answers "something is happening at 17:00", so it is kept and rendered
 * "(sans titre)" rather than silently vanishing (review 2026-07-28, P12).
 */
export function parseEvents(
  response: CalendarResponse,
  calendars: readonly CalendarRef[],
): AgendaEvent[] {
  const out: AgendaEvent[] = [];
  for (const cal of calendars) {
    for (const raw of readEvents(response[cal.entityId])) {
      if (typeof raw !== "object" || raw === null) continue;
      const { summary, start, end } = raw as Record<string, unknown>;
      const s = parseHaDate(start);
      const e = parseHaDate(end);
      if (!s || !e) continue;
      out.push({
        summary:
          typeof summary === "string" && summary.trim() !== ""
            ? summary
            : "(sans titre)",
        start: s.date,
        end: e.date,
        allDay: s.allDay,
        calendarId: cal.entityId,
      });
    }
  }
  return out;
}

/**
 * How many raw entries the response carried, parsable or not.
 *
 * The one signal that separates "today is genuinely empty" from "the payload
 * isn't the shape we parse". Both make `parseEvents` return `[]`, and without
 * this the second renders as a confident "Rien aujourd'hui" on a full day —
 * with a successful request, no dimming and no trace (review 2026-07-28, D2).
 * Task 0 bis (observing a real reply) is still open, so this guard is what
 * stands between a format drift and a silent lie.
 */
export function countRawEntries(
  response: CalendarResponse,
  calendars: readonly CalendarRef[],
): number {
  let n = 0;
  for (const cal of calendars) n += readEvents(response[cal.entityId]).length;
  return n;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Closest-to-`now` first, then mapping order (which `parseEvents` preserved, so
 * a stable sort is enough). "Closest" works in both directions: for upcoming
 * events it means the soonest, for already-running ones the most recent start.
 */
function nearestFirst(events: AgendaEvent[], now: Date): AgendaEvent[] {
  return [...events].sort(
    (a, b) =>
      Math.abs(a.start.getTime() - now.getTime()) -
      Math.abs(b.start.getTime() - now.getTime()),
  );
}

/**
 * The 3-rank rule (Florian, 2026-07-27). The mapped calendars are mostly
 * whole-day — birthdays, public holidays, and school terms that span weeks — so
 * a plain chronological sort would pin "Vacances de la Toussaint" to the tile
 * for a fortnight and bury the 17:00 appointment. Hence the ranking:
 *
 *   1. a TIMED event still ahead today          → "17:00 · dans 4h"
 *   2. else a whole-day event starting TODAY    → "Aujourd'hui"
 *   3. else anything still running              → "Jusqu'à 18:00" (timed)
 *                                                 "Jusqu'au 3 nov." (all-day)
 *   4. else null                                → "Rien aujourd'hui"
 *
 * Rank 3 covers BOTH kinds on purpose (Florian, review 2026-07-28, D1). An
 * appointment that has already started is no longer "next", but the tile still
 * has to answer "what's on" while it runs — falling through to "Rien
 * aujourd'hui" at 13:00 during a 09:00–18:00 vet visit would be a lie. What
 * changes with the kind is the LABEL, not the rank: see `untilLabel`.
 *
 * Events are assumed pre-filtered to today's window by the query (AD-17). Rank
 * 1 re-checks the day itself so a wider response can't promote tomorrow's
 * 00:15 to "next today"; ranks 2 and 3 are bounded by their own predicates.
 */
export function selectNext(
  events: readonly AgendaEvent[],
  now: Date,
): Selection | null {
  const upcomingTimed = events.filter(
    (e) =>
      !e.allDay &&
      e.start.getTime() >= now.getTime() &&
      isSameLocalDay(e.start, now),
  );
  if (upcomingTimed.length > 0) {
    return { event: nearestFirst(upcomingTimed, now)[0], rank: "timed" };
  }

  const startingToday = events.filter(
    (e) => e.allDay && isSameLocalDay(e.start, now),
  );
  if (startingToday.length > 0) {
    return { event: nearestFirst(startingToday, now)[0], rank: "allday-today" };
  }

  const running = events.filter(
    (e) => e.start.getTime() < now.getTime() && e.end.getTime() > now.getTime(),
  );
  if (running.length > 0) {
    return { event: nearestFirst(running, now)[0], rank: "ongoing" };
  }

  return null;
}

const MINUTE = 60_000;

/**
 * "dans 25 min" / "dans 4h" / "maintenant". Recomputed on the tile's own tick so
 * the wording ages with the clock.
 *
 * RANK 1 ONLY — hence a plain `string`, not `string | null`. The story's Task 2
 * sketched a nullable return for "ranks 2 and 3", but those ranks never call
 * this: rank 2 renders the bare word "Aujourd'hui" and rank 3 delegates to
 * `untilLabel`. A null branch no caller can reach is dead weight
 * (review 2026-07-28, P11).
 */
export function relativeDelay(start: Date, now: Date): string {
  const minutes = Math.floor((start.getTime() - now.getTime()) / MINUTE);
  if (minutes < 1) return "maintenant";
  if (minutes < 60) return `dans ${minutes} min`;
  return `dans ${Math.floor(minutes / 60)}h`;
}

const TIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** "17:00" — same 24 h form as the kiosk clock (`clock-format.ts`). */
export function formatEventTime(d: Date): string {
  return TIME_FMT.format(d);
}

const DAY_MONTH_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

/**
 * How a rank-3 (already running) event names its end. The kind decides the
 * wording, and getting this wrong is exactly the bug the 2026-07-28 review
 * caught (D1): the day-before arithmetic below is the EXCLUSIVE-end convention,
 * which only holds for whole-day events. Applied to a timed appointment ending
 * at 18:00 today it printed "Jusqu'au <yesterday>".
 *
 *   - all-day  → "Jusqu'au 3 nov."  (`end` exclusive ⇒ last covered day is −1)
 *   - timed    → "Jusqu'à 18:00"    (a wall-clock hour, no arithmetic at all)
 *
 * Takes the event rather than a bare `Date` precisely so the two cases can't be
 * confused again at a call site.
 */
export function untilLabel(event: AgendaEvent): string {
  if (!event.allDay) return `Jusqu'à ${formatEventTime(event.end)}`;
  const lastDay = new Date(event.end.getTime());
  lastDay.setDate(lastDay.getDate() - 1);
  return `Jusqu'au ${DAY_MONTH_FMT.format(lastDay)}`;
}

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

const pad = (n: number): string => String(n).padStart(2, "0");

/**
 * "YYYY-MM-DD HH:mm:ss" from LOCAL components — the form HA's docs use for
 * `start_date_time`. Deliberately not `toISOString()`, which converts to UTC and
 * can name a different day than the one we mean.
 *
 * ⚠️ ASSUMES the kiosk and the HA instance share a timezone. A naive datetime
 * carries no offset, so HA resolves it in ITS configured zone: send "00:00:00"
 * from a browser an hour ahead and the window silently shifts. True today (both
 * live in this house) and the one place AD-4's "no timezone arithmetic in the
 * app" is leaned on rather than avoided — so it is written down rather than
 * assumed (review 2026-07-28, P13).
 */
export function haDateTimeString(d: Date): string {
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
