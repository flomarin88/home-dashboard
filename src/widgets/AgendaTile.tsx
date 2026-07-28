import { useEffect, useState } from "react";
import { useCalendarEvents } from "../hakit/useCalendarEvents";
import { formatSince } from "../hakit/stale";
import {
  selectNext,
  relativeDelay,
  formatEventTime,
  untilLabel,
} from "../agenda/select";
import { CalendarIcon } from "./AgendaIcons";

/** How often the relative delay is recomputed, so "dans 4h" ages with the clock. */
const TICK_MS = 30_000;

/** What the tile puts on its two content lines, plus what a screen reader hears. */
interface TileText {
  readonly when: string;
  readonly delay: string | null;
  readonly title: string;
  readonly aria: string;
}

/**
 * AgendaTile (Story 10.1, UX-DR28) — the "what's next" glance in the top bar.
 *
 * Read-only, and read by QUERY (`useCalendarEvents`, AD-17) rather than from
 * entity state — a `calendar.*` entity can't answer "what does today hold".
 *
 * The PROCHAIN label is mandatory (UX-DR28): a bare calendar icon would be
 * mystery meat. The mapped calendars are mostly whole-day — birthdays, public
 * holidays, school terms spanning weeks — so which event to show is a ranked
 * decision, not a sort; `selectNext` owns it and this component only renders the
 * outcome.
 *
 * Footprint is FIXED across every state (UX-DR27): loading, populated, empty and
 * offline all occupy the same box, so the top bar never dances when a refresh
 * lands. Obsolescence dims the whole chip (the top-bar family's single rule) and
 * keeps the last known answer — never a blank, never a spinner.
 *
 * Not interactive in 10.1: tapping through to `/agenda` is Story 10.2.
 */
export function AgendaTile() {
  const { events, isStale, loading, since, unreadable } = useCalendarEvents();
  const [now, setNow] = useState(() => new Date());

  // Same tick pattern as `Clock` (30 s is enough for minute-grain wording).
  // Deliberately local: extracting a shared hook for three lines would be scope
  // this story doesn't own.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const text = tileText({ events, now, loading, isStale, since, unreadable });

  return (
    <div
      role="status"
      aria-label={text.aria}
      className={`inline-flex min-h-[56px] items-center gap-2 rounded-lg border border-card-border bg-card-fill px-4 backdrop-blur-glass ${
        // An unparsable answer is a degraded state too — dim it like an offline
        // one, so a format drift can never look like a healthy empty day (D2).
        isStale || unreadable ? "opacity-60" : ""
      }`}
    >
      <CalendarIcon size={20} className="shrink-0 text-text-muted" />
      {/* Fixed width: the chip must not resize between states (UX-DR27). */}
      <span
        className="flex w-[150px] flex-col leading-tight"
        aria-hidden="true"
      >
        <span className="text-caption font-semibold uppercase tracking-wider text-text-muted">
          Prochain
        </span>
        <span className="flex items-baseline gap-1.5">
          <span className="text-label font-semibold tabular-nums text-text">
            {text.when}
          </span>
          {text.delay ? (
            <span className="text-caption text-text-muted">{text.delay}</span>
          ) : null}
        </span>
        <span className="truncate text-caption text-text-muted">
          {text.title || " "}
        </span>
      </span>
    </div>
  );
}

/**
 * Rendering rules, kept out of the JSX so each state is one readable branch.
 * Order matters: "never seen anything" must not be reported as "nothing today".
 */
function tileText({
  events,
  now,
  loading,
  isStale,
  since,
  unreadable,
}: {
  events: ReturnType<typeof useCalendarEvents>["events"];
  now: Date;
  loading: boolean;
  isStale: boolean;
  since: string | undefined;
  unreadable: boolean;
}): TileText {
  const offline =
    isStale && since ? ` — hors ligne · ${formatSince(since)}` : "";

  if (loading) {
    return {
      when: "—",
      delay: null,
      title: "",
      aria: "Agenda : chargement en cours",
    };
  }

  // Stale before any answer ever arrived: say so, rather than claim the day is
  // empty. An empty day and an unreachable HA are different facts.
  if (isStale && !since) {
    return {
      when: "Indisponible",
      delay: null,
      title: "",
      aria: "Agenda indisponible — Home Assistant injoignable",
    };
  }

  // HA answered, the answer had entries, none of them parsed. "Rien
  // aujourd'hui" would be a lie on a full day, so name the real fault — the
  // console carries the payload for whoever debugs it (D2).
  if (unreadable) {
    return {
      when: "Indisponible",
      delay: null,
      title: "",
      aria: "Agenda indisponible — réponse de Home Assistant illisible",
    };
  }

  const selection = selectNext(events, now);

  if (!selection) {
    return {
      when: "Rien aujourd'hui",
      delay: null,
      title: "",
      aria: `Prochain : rien d'ici la fin de la journée${offline}`,
    };
  }

  const { event, rank } = selection;

  if (rank === "timed") {
    const time = formatEventTime(event.start);
    const delay = relativeDelay(event.start, now);
    return {
      when: time,
      delay,
      title: event.summary,
      aria: `Prochain : ${time}, ${delay}, ${event.summary}${offline}`,
    };
  }

  if (rank === "allday-today") {
    return {
      when: "Aujourd'hui",
      delay: null,
      title: event.summary,
      aria: `Prochain : aujourd'hui, ${event.summary}${offline}`,
    };
  }

  // Rank 3 — already running. The label knows whether it is naming a day or an
  // hour; this branch just renders it (D1).
  const until = untilLabel(event);
  return {
    when: until,
    delay: null,
    title: event.summary,
    aria: `En cours : ${event.summary}, ${until.toLowerCase()}${offline}`,
  };
}
