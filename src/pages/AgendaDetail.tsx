import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { calendarsConfig } from "../entities";
import { useCalendarEvents } from "../hakit/useCalendarEvents";
import { formatSince } from "../hakit/stale";
import {
  dayRange,
  weekRange,
  monthRange,
  formatEventTime,
  type AgendaEvent,
} from "../agenda/select";
import { groupByDay, capEvents, type DayBucket } from "../agenda/group";

/** The three ranges the page can ask for. Local to the page, never persisted. */
type AgendaView = "jour" | "semaine" | "mois";

const VIEWS: readonly { id: AgendaView; label: string }[] = [
  { id: "jour", label: "Jour" },
  { id: "semaine", label: "Semaine" },
  { id: "mois", label: "Mois" },
];

/** How many event chips a month cell shows before collapsing into "+N". */
const MONTH_CHIP_CAP = 2;

const DAY_FMT = new Intl.DateTimeFormat("fr-FR", { weekday: "long" });
const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
});
const WEEKDAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * AgendaDetail — the deep page behind the top-bar agenda chip (Story 10.2,
 * AD-10/UX-DR29). Content only: the ground and the top bar belong to
 * `KioskShell` (TD-1).
 *
 * It rides the SAME query read path as Story 10.1 (`useCalendarEvents`,
 * AD-17) — only the requested range changes. That is the point of the story:
 * if the seam needed rewriting to serve three ranges, it was not a seam.
 *
 * The day view carries the WHOLE day, past included, which is exactly what the
 * micro-tile cannot show: the tile answers "what's next", the page answers "how
 * does my week fill up".
 *
 * No colour per calendar (Florian, 2026-07-29): the calendar NAME carries the
 * identity wherever it fits (UX-DR26 requires it anyway), and the month cells,
 * where it does not fit, simply do not show it. Today is marked by a WORD plus a
 * plain bright border — never by a domain accent (UX-DR14).
 *
 * Read only end to end: no write, no optimism, no undo, nothing persisted
 * (AD-1/AD-3) — including the selected view, which resets on every visit.
 */
export function AgendaDetail() {
  const [view, setView] = useState<AgendaView>("jour");
  const now = new Date();
  const range =
    view === "jour"
      ? dayRange(now)
      : view === "semaine"
        ? weekRange(now)
        : monthRange(now);

  const { events, isStale, loading, since, unreadable } =
    useCalendarEvents(range);
  const buckets = groupByDay(events, range);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      <Breadcrumb />

      {/* One 52px row for the toggle — and, from Story 10.3, the calendar
          filters beside it. Two rows would cost the month view its breathing
          room (UX-DR29). */}
      <div className="flex h-[52px] flex-none items-center gap-3">
        <div
          role="tablist"
          aria-label="Plage affichée"
          className="flex gap-1 rounded-md border border-tile-border bg-black/20 p-1"
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={`flex h-[44px] min-w-[96px] items-center justify-center rounded-[10px] text-label font-semibold ${
                view === v.id
                  ? "border border-card-border bg-white/10 text-text"
                  : "text-text-muted"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {isStale ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-stale/25 px-2 py-0.5 text-caption text-stale-text">
            Hors ligne{since ? ` · ${formatSince(since)}` : ""}
          </span>
        ) : null}
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
          isStale || unreadable ? "opacity-60" : ""
        }`}
      >
        <AgendaBody
          view={view}
          buckets={buckets}
          now={now}
          loading={loading}
          unreadable={unreadable}
        />
      </div>
    </div>
  );
}

/**
 * The states that must never look like an empty calendar, in the order that
 * matters: "nothing came back yet" and "the reply was unreadable" both outrank
 * "your day is free" (AD-17, and the guard the 10.1 review added).
 */
function AgendaBody({
  view,
  buckets,
  now,
  loading,
  unreadable,
}: {
  view: AgendaView;
  buckets: DayBucket[];
  now: Date;
  loading: boolean;
  unreadable: boolean;
}) {
  if (loading) return <Notice>Chargement…</Notice>;
  if (unreadable)
    return (
      <Notice>Agenda indisponible — réponse de Home Assistant illisible</Notice>
    );
  if (view === "jour") return <DayView bucket={buckets[0]} />;
  if (view === "semaine") return <WeekView buckets={buckets} now={now} />;
  return <MonthView buckets={buckets} now={now} />;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center text-meta text-text-muted">
      {children}
    </div>
  );
}

/** The calendar an event came from, by NAME — never a colour dot (UX-DR26). */
function calendarName(id: string): string {
  return calendarsConfig().find((c) => c.entityId === id)?.label ?? "—";
}

/** "17:30" for a timed event, the whole-day marker otherwise. */
function whenLabel(e: AgendaEvent): string {
  return e.allDay ? "Journée" : formatEventTime(e.start);
}

/**
 * Day view — the whole day, PAST INCLUDED. That is its reason to exist next to
 * the micro-tile, which only ever shows what is still ahead.
 */
function DayView({ bucket }: { bucket: DayBucket | undefined }) {
  if (!bucket || bucket.events.length === 0)
    return <Notice>Rien aujourd'hui</Notice>;

  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      {bucket.events.map((e, i) => (
        <li
          key={`${e.calendarId}-${e.start.getTime()}-${i}`}
          className="flex items-baseline gap-3 rounded-md border border-tile-border bg-tile-fill px-4 py-2"
        >
          <span className="w-[76px] flex-none text-label font-semibold tabular-nums text-text">
            {whenLabel(e)}
          </span>
          <span className="flex-1 truncate text-label text-text">
            {e.summary}
          </span>
          <span className="flex-none text-caption text-text-muted">
            {calendarName(e.calendarId)}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Week view — SEVEN ROWS, not seven columns (UX-DR29). At 134px wide a day
 * column truncates everything; as a row, each day gets its name, its date and
 * its events in the clear.
 */
function WeekView({ buckets, now }: { buckets: DayBucket[]; now: Date }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      {buckets.map((b) => {
        const today = isSameLocalDay(b.date, now);
        return (
          <div
            key={b.date.getTime()}
            className={`flex min-h-0 flex-1 items-stretch gap-3 overflow-hidden rounded-md border bg-tile-fill px-3 py-2 ${
              today ? "border-text/45 bg-white/[0.07]" : "border-tile-border"
            }`}
          >
            <div className="flex w-[132px] flex-none flex-col justify-center">
              <span className="text-label font-semibold capitalize text-text">
                {DAY_FMT.format(b.date)}
                {/* A WORD, not just the border: colour and weight alone would
                    fail UX-DR14. */}
                {today ? (
                  <span className="ml-1 text-caption font-bold uppercase tracking-wider text-text">
                    · aujourd'hui
                  </span>
                ) : null}
              </span>
              <span className="text-caption tabular-nums text-text-muted">
                {DATE_FMT.format(b.date)}
              </span>
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2 overflow-hidden">
              {b.events.length === 0 ? (
                <span className="text-caption text-text-muted">rien</span>
              ) : (
                b.events.map((e, i) => (
                  <span
                    key={`${e.calendarId}-${e.start.getTime()}-${i}`}
                    className="inline-flex h-8 max-w-full items-center gap-2 rounded-sm border border-card-border bg-card-fill px-3 text-caption"
                  >
                    <span className="font-bold tabular-nums text-text">
                      {whenLabel(e)}
                    </span>
                    <span className="truncate text-text-muted">
                      {e.summary}
                    </span>
                  </span>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Month view — a 7×6 grid of ~134×78px cells (UX-DR29, measured in a browser).
 * A density map, not an index: day number, up to two chips, then "+N".
 *
 * The grid always draws 42 cells, but the query asks for the STRICT month
 * (Florian, 2026-07-29). Cells outside it therefore hold no data at all — so
 * they render their day number alone, heavily dimmed, and deliberately show no
 * "rien" state. Saying nothing is honest; claiming a day is free when it was
 * never asked about is not.
 */
function MonthView({ buckets, now }: { buckets: DayBucket[]; now: Date }) {
  if (buckets.length === 0) return <Notice>Rien ce mois-ci</Notice>;

  const first = buckets[0].date;
  // Monday-first offset: getDay() is 0 on Sunday, the same trap `weekRange`
  // guards against.
  const dow = first.getDay();
  const lead = dow === 0 ? 6 : dow - 1;
  const cells: (DayBucket | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...buckets,
  ];
  while (cells.length < 42) cells.push(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="grid flex-none grid-cols-7 gap-1.5">
        {WEEKDAY_SHORT.map((d) => (
          <div
            key={d}
            className="pb-0.5 text-center text-caption font-bold uppercase tracking-wider text-text-muted"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1.5">
        {cells.map((b, i) =>
          b === null ? (
            // Outside the requested month: no data was ever fetched for this
            // day, so it asserts nothing about its contents.
            <div
              key={`out-${i}`}
              className="rounded-[10px] border border-tile-border bg-tile-fill opacity-30"
            />
          ) : (
            <MonthCell key={b.date.getTime()} bucket={b} now={now} />
          ),
        )}
      </div>
    </div>
  );
}

function MonthCell({ bucket, now }: { bucket: DayBucket; now: Date }) {
  const today = isSameLocalDay(bucket.date, now);
  const { shown, overflow } = capEvents(bucket.events, MONTH_CHIP_CAP);

  return (
    <div
      className={`flex flex-col gap-[3px] overflow-hidden rounded-[10px] border bg-tile-fill px-1.5 py-1 ${
        today ? "border-text/50 bg-white/[0.08]" : "border-tile-border"
      }`}
    >
      <span className="flex items-center gap-1 text-caption font-bold tabular-nums text-text">
        {bucket.date.getDate()}
        {today ? (
          <span className="text-[8.5px] font-bold uppercase tracking-wider text-text-muted">
            auj.
          </span>
        ) : null}
      </span>
      {shown.map((e, i) => (
        <span
          key={`${e.calendarId}-${e.start.getTime()}-${i}`}
          className="flex h-[17px] items-center gap-1 overflow-hidden whitespace-nowrap rounded-[5px] border border-card-border bg-card-fill px-1 text-[10px]"
        >
          <span className="font-bold tabular-nums text-text">
            {whenLabel(e)}
          </span>
          <span className="truncate text-text-muted">{e.summary}</span>
        </span>
      ))}
      {overflow > 0 ? (
        <span className="mt-auto text-[9.5px] text-text-muted">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function Breadcrumb() {
  const navigate = useNavigate();
  return (
    <div className="flex h-[34px] flex-none items-center gap-2 text-meta text-text-muted">
      <button
        type="button"
        onClick={() => navigate("/")}
        className="inline-flex min-h-[44px] items-center gap-1 text-label font-semibold text-text-muted"
      >
        ‹ Accueil
      </button>
      <span>·</span>
      <b className="text-label font-semibold text-text">Agenda</b>
    </div>
  );
}
