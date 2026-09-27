import { lazy, Suspense, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useHistory } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import { isConfigured } from "../hakit";
import { electricityConfig } from "../entities";
import type { ElectricityConfig } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { useStatistics, type StatisticsRead } from "../hakit/useStatistics";
import { formatSince } from "../hakit/stale";
import { shiftAnchor } from "../dates/range";
import {
  dayLabel,
  daysCoveredIn,
  dayWindow,
  monthLabel,
  monthShort,
  monthTag,
  monthsWindow,
  monthWindow,
  padDays,
  padHours,
  periodOfInterval,
  pointOn,
  selectLastCompleteDay,
  startOfDay,
  startOfMonth,
  truncatedMonthWindow,
  variation,
  type DayPoint,
  type HourPeriod,
  type StateSample,
} from "../energy/statistics";
import {
  electricityView,
  type TariffPeriod,
} from "../widgets/electricity-cost";
import {
  formatEuro,
  formatKwh,
  formatPrice,
  formatVariation,
  periodLabel,
  periodName,
  periodTone,
} from "../widgets/consumption-format";
import { formatSunTime } from "../widgets/weather-format";
import { BoltIcon, PeriodIcon } from "../widgets/ConsumptionIcons";

// Lazy so Recharts stays code-split off the home warm-start bundle (shared chunk
// with the /meteo + room-detail charts; AD-9 / PWA precache stays lean).
const SensorHistoryChart = lazy(() => import("../widgets/SensorHistoryChart"));

/** Unit conversion asked of HA: the Linky statistic is in Wh, the screen reads kWh. */
const UNITS = { energy: "kWh" } as const;

/**
 * History depth asked of the period sensor for the LATEST day. The shown day is
 * J-1 or J-2 (the daily window is [J-2, J)), so 72 h from any instant of J
 * always reaches its first minute. A CONSTANT on purpose: `useHistory`
 * re-subscribes whenever `hoursToShow` changes, and a value derived from the
 * clock would tear the stream down every hour (review 2026-09-27).
 */
const PERIOD_HISTORY_HOURS = 72;

/**
 * Cap on the depth asked for a PAST day (Story 9.5). HA's recorder keeps entity
 * history for `purge_keep_days` (10 by default): beyond that there is nothing
 * to read, and the bars of that day stay neutral rather than guessing a tariff
 * (AD-4). The value only moves when the ANCHOR moves — at a tap, not every hour.
 */
const PERIOD_HISTORY_MAX_HOURS = 240;

/** How many months one `period: "month"` request spans: M, M−1 and M−12 in one reply. */
const MONTHS_BACK = 13;

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** The bar colour of an hour, by the tariff HA was in — the pill's own tokens. */
function barFill(period: HourPeriod): string {
  if (period === "creuses") return "var(--color-tariff-creuses)";
  if (period === "pleines") return "var(--color-tariff-pleines)";
  return "var(--color-text)";
}

/** "hier, jeudi 24 septembre" → "Hier · jeudi 24 septembre" (a tile title). */
function titleCase(long: string): string {
  const s = long.replace(", ", " · ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The two views the page navigates by (Story 9.5). Local, never persisted. */
type View = "jour" | "mois";
const VIEWS: readonly { id: View; label: string }[] = [
  { id: "jour", label: "Jour" },
  { id: "mois", label: "Mois" },
];

/**
 * ElectricityDetail — deep page for the electricity consumption (Story 9.1 →
 * 9.4 → 9.5, AD-10/AD-16 amended), opened by tapping `ElectricityTile`.
 * Content-only — the ground + top bar belong to `KioskShell` (TD-1). Landscape
 * 2-column grid of frosted tiles under one 52 px control row, fits the 1024×748
 * kiosk viewport with NO scroll.
 *
 * Navigation (Story 9.5, UX-DR31): the same control row as `/agenda` — a Jour /
 * Mois toggle, ‹ › arrows, the period reminder in words and a « Dernier
 * relevé » button. The state is `view` + `anchor`, local to the page and reset
 * on every visit (AD-1/AD-3). `anchor === null` means "the last complete day"
 * (Jour) or "the current month" (Mois): a null follows the morning import,
 * where a frozen date would keep showing the day before yesterday after it.
 * The arrows never pass the last complete day nor the current month — a tap at
 * the bound is idempotent, never `disabled` (precedent 6.1/10.2).
 *
 * Three compositions of the left column, one mounted at a time so each asks HA
 * only for what it shows:
 *  - `LatestDayColumn` — Story 9.4 unchanged: the LAST COMPLETE DAY, named in
 *    full ("Hier · jeudi 24 septembre", UX-DR30), HA's own cost (ha-linky
 *    `costs`) and consumption, then its 24 hourly bars coloured by the tariff
 *    HA was in (history of the period `binary_sensor`, rounded by majority).
 *  - `PastDayColumn` — the same for a day D chosen with ‹ ›: `day` + `hour`
 *    queries on [D, D+1); bars coloured while the recorder still holds the
 *    period history, neutral beyond (never a guess, AD-4).
 *  - `MonthColumn` — a month M: HA's `month` buckets for M, M−1 and M−12 in one
 *    request, two variation lines (conso and cost, vs the previous month and vs
 *    the same month a year earlier), and the daily bars of M. The current,
 *    partial month compares « à date »: its references are asked of HA over
 *    TRUNCATED windows, so HA computes the portion — the app sums nothing
 *    (AD-17). A missing or zero reference renders « — », never 0 (AD-16).
 * Right: the HC/HP tariff tile of Story 9.2, untouched — the period that is
 * current NOW, both prices with the one in force marked, the next switch.
 *
 * Everything reads by query (`recorder.get_statistics`, AD-17) except the four
 * tariff entities; nothing is multiplied, summed or scheduled here (AD-4). The
 * only arithmetic added by 9.5 is `variation`, in `src/energy/statistics.ts`.
 *
 * Obsolescence: each composition dims itself and stamps the single "Hors ligne ·
 * HH:MM" pill with the time of its last successful REQUEST (`since`), because
 * a J-1 statistic has no `last_changed` worth showing.
 */
export function ElectricityDetail() {
  const cfg = electricityConfig();
  if (!isConfigured || !cfg) {
    return (
      <div className="flex h-full flex-col gap-2">
        <BackLink />
        <p className="text-meta text-text-muted">Électricité non configurée.</p>
      </div>
    );
  }
  return <ElectricityDetailContent cfg={cfg} />;
}

export function ElectricityDetailContent({ cfg }: { cfg: ElectricityConfig }) {
  const [view, setView] = useState<View>("jour");
  const [anchor, setAnchor] = useState<Date | null>(null);

  // Story 9.4's default two-day query — always mounted: it is what the latest
  // view shows AND the upper bound the arrows respect.
  const days = useStatistics({
    statisticIds: [cfg.consumptionStatisticId, cfg.costStatisticId],
    period: "day",
    units: UNITS,
  });
  const period = useEntityValue(cfg.periodEntityId as EntityName);
  const priceCreuses = useEntityValue(cfg.priceCreusesEntityId as EntityName);
  const pricePleines = useEntityValue(cfg.pricePleinesEntityId as EntityName);
  const nextSwitch = useEntityValue(cfg.nextSwitchEntityId as EntityName);

  // `new Date()` once, handed to pure functions — no clock in the render path.
  const today = startOfDay(new Date());
  const currentMonth = startOfMonth(today);
  const consoRows = days.rows[cfg.consumptionStatisticId] ?? [];
  const costRows = days.rows[cfg.costStatisticId] ?? [];
  const latest =
    selectLastCompleteDay(consoRows, today) ??
    selectLastCompleteDay(costRows, today);
  const lastComplete = latest?.start ?? null;

  // Where the anchor lands, per view. The bounds live in the two step handlers
  // below — and ONLY there: a step that would reach the last complete day or
  // the current month sets the anchor back to `null`, which is what keeps a
  // tap at the bound idempotent and lets the view follow the morning import.
  const pastDay = anchor === null ? null : startOfDay(anchor);
  const monthShown = startOfMonth(anchor ?? today);

  const stepDay = (delta: number) => {
    const base = pastDay ?? lastComplete;
    if (base === null) return; // nothing known yet — nowhere to step from
    const next = shiftAnchor(base, "day", delta);
    setAnchor(
      lastComplete !== null && next.getTime() >= lastComplete.getTime()
        ? null
        : next,
    );
  };
  const stepMonth = (delta: number) => {
    const next = shiftAnchor(monthShown, "month", delta);
    setAnchor(next.getTime() >= currentMonth.getTime() ? null : next);
  };

  // The period reminder wears the SHORT form; the tile title carries the long one.
  const reminder =
    view === "mois"
      ? monthTag(monthShown)
      : pastDay
        ? dayLabel(pastDay, today).short
        : latest
          ? dayLabel(latest.start, today).short
          : "—";

  const tariff = electricityView({
    priceCreuses: priceCreuses.value,
    pricePleines: pricePleines.value,
    period: period.value,
  });
  const tariffStale =
    period.isStale ||
    priceCreuses.isStale ||
    pricePleines.isStale ||
    nextSwitch.isStale;
  // The tariff tile says where we are NOW; it dims with its own entities and
  // with the default day query — the compositions dim themselves for the rest.
  const rightStale = days.isStale || days.unreadable || tariffStale;

  return (
    <div className="flex h-full flex-col gap-grid-gap overflow-hidden">
      <BackLink />

      {/* One 52 px control row (UX-DR29/UX-DR31): toggle, arrows, reminder,
          and the way back. Nothing here is ever `disabled` — a control in
          butée stays a live, idempotent target (precedent 6.1/10.2). */}
      <div className="flex h-[52px] flex-none items-center gap-3">
        <div
          role="tablist"
          aria-label="Vue affichée"
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
        <div className="flex items-center gap-1">
          <NavButton
            label="Période précédente"
            onClick={() => (view === "mois" ? stepMonth(-1) : stepDay(-1))}
          >
            ‹
          </NavButton>
          <span className="min-w-[120px] text-center text-label font-semibold text-text">
            {reminder}
          </span>
          <NavButton
            label="Période suivante"
            onClick={() => (view === "mois" ? stepMonth(1) : stepDay(1))}
          >
            ›
          </NavButton>
          {/* « Dernier relevé », not « Aujourd'hui » (there is none for a J-1
              source, UX-DR30) nor « Hier » (false before the morning import). */}
          <button
            type="button"
            onClick={() => setAnchor(null)}
            className="ml-1 flex h-[44px] items-center rounded-md border border-tile-border bg-tile-fill px-3 text-label font-semibold text-text-muted"
          >
            Dernier relevé
          </button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-grid-gap">
        {/* Left column — one composition at a time, each with its own queries. */}
        <div className="flex min-h-0 flex-col gap-grid-gap overflow-hidden">
          {view === "mois" ? (
            <MonthColumn
              cfg={cfg}
              month={monthShown}
              currentMonth={currentMonth}
              tariffStale={tariffStale}
            />
          ) : pastDay ? (
            <PastDayColumn
              cfg={cfg}
              day={pastDay}
              today={today}
              tariffStale={tariffStale}
            />
          ) : (
            <LatestDayColumn
              cfg={cfg}
              days={days}
              latest={latest}
              today={today}
              tariffStale={tariffStale}
            />
          )}
        </div>

        {/* Right column — the HC/HP tariff detail (Story 9.2), unchanged. */}
        <div className="flex min-h-0 flex-col gap-grid-gap overflow-hidden">
          {/* No second "Hors ligne" pill here: AC5 of 9.2 asks for one on the
              page, and the tile family already dims as a whole. */}
          <Tile title="Heures creuses / pleines" className="min-h-0 flex-1">
            {/* Current period — tinted per the mock, but the glyph and the word
                say it too: colour is never the sole carrier (UX-DR14). Stale
                overrides the tint, because an out-of-date period must not look
                as confident as a live one. */}
            <div className="flex items-center gap-2">
              <PeriodIcon
                period={tariff.period}
                size={22}
                className={
                  rightStale
                    ? "text-stale-text"
                    : periodTone(tariff.period).text
                }
              />
              <span
                className={`text-numeric-lg font-semibold ${
                  rightStale
                    ? "text-stale-text"
                    : periodTone(tariff.period).text
                }`}
              >
                {periodName(tariff.period)}
              </span>
              <span className="text-meta text-text-muted">en ce moment</span>
            </div>

            {/* Both tariffs, always both — the one in force is marked by a WORD.
                A border or a tint alone would fail UX-DR14, and the user needs
                to see the other rate to know what they are avoiding. */}
            <ul className="flex flex-col gap-1">
              <TariffRow
                period="creuses"
                price={tariff.priceCreuses}
                applied={tariff.period === "creuses"}
              />
              <TariffRow
                period="pleines"
                price={tariff.pricePleines}
                applied={tariff.period === "pleines"}
              />
            </ul>

            {/* Next switch: READ from a timestamp sensor and formatted with the
                same helper /meteo uses for sunrise. No deadline arithmetic, no
                window, no timer, no Date.now() (AD-4). */}
            <span className="text-meta tabular-nums text-text-muted">
              {`Passage en ${
                tariff.period === "creuses" ? "pleines" : "creuses"
              } à ${formatSunTime(nextSwitch.value)}`}
            </span>
          </Tile>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Left-column compositions
// ---------------------------------------------------------------------------

/** The last complete day — Story 9.4's left column, moved here unchanged. */
function LatestDayColumn({
  cfg,
  days,
  latest,
  today,
  tariffStale,
}: {
  cfg: ElectricityConfig;
  days: StatisticsRead;
  latest: DayPoint | null;
  today: Date;
  tariffStale: boolean;
}) {
  const consoRows = days.rows[cfg.consumptionStatisticId] ?? [];
  const costRows = days.rows[cfg.costStatisticId] ?? [];
  // One day, both figures read for THAT day only — a cost row for another day
  // renders "—", never a neighbour's euros under this day's title (UX-DR30).
  const conso = latest ? pointOn(consoRows, latest.start) : null;
  const cost = latest ? pointOn(costRows, latest.start) : null;
  const label = latest ? dayLabel(latest.start, today) : null;

  // Hourly rows over the SAME default two-day window as the daily query: one
  // request, no "guess yesterday" before the day is known, and no way for the
  // rows on screen to describe a day other than the one selected above.
  const hours = useStatistics({
    statisticIds: [cfg.consumptionStatisticId],
    period: "hour",
    units: UNITS,
  });
  const chartWindow = latest ? dayWindow(latest.start) : null;
  const hourRows = chartWindow
    ? padHours(hours.rows[cfg.consumptionStatisticId] ?? [], chartWindow)
    : [];

  // The tariff period over the shown day, from HA's history of the period
  // sensor (a fixed depth, see PERIOD_HISTORY_HOURS).
  const { entityHistory: periodHistory } = useHistory(
    cfg.periodEntityId as EntityName,
    { hoursToShow: PERIOD_HISTORY_HOURS },
  );
  const { series, unknownHours } = colourHours(hourRows, periodHistory);

  // The hourly rows are part of what the page shows: a failed hourly refresh
  // must dim it too, or old bars would look current under a new title.
  const anyStale =
    days.isStale || days.unreadable || hours.isStale || tariffStale;

  const dayTitle = label
    ? titleCase(label.long)
    : days.loading
      ? "—"
      : days.unreadable
        ? "Valeur illisible"
        : "Pas encore de relevé";

  return (
    <>
      <DayTile
        title={dayTitle}
        stale={anyStale}
        since={days.since}
        cost={cost?.value}
        subline={formatKwh(conso?.value)}
      />
      <HourlyChartTile
        title={`Conso horaire — ${label ? label.short : "—"}`}
        series={series}
        ariaLabel={`Consommation horaire, ${
          label ? label.long : "aucun jour disponible"
        }, colorée par période tarifaire${
          unknownHours > 0 && label
            ? " — période tarifaire non disponible pour tout ou partie du jour"
            : ""
        }`}
      />
    </>
  );
}

/** A day D chosen with the arrows (Story 9.5): its figures and its 24 bars. */
function PastDayColumn({
  cfg,
  day,
  today,
  tariffStale,
}: {
  cfg: ElectricityConfig;
  day: Date;
  today: Date;
  tariffStale: boolean;
}) {
  const window = dayWindow(day);
  const stats = useStatistics({
    statisticIds: [cfg.consumptionStatisticId, cfg.costStatisticId],
    period: "day",
    units: UNITS,
    range: window,
  });
  const hours = useStatistics({
    statisticIds: [cfg.consumptionStatisticId],
    period: "hour",
    units: UNITS,
    range: window,
  });
  // Deep enough to reach D's first minute from any instant of today, capped at
  // what the recorder can still hold. Derived from calendar days, so it only
  // changes at midnight or when the anchor moves — not every hour.
  const daysBack = Math.round((today.getTime() - day.getTime()) / DAY_MS);
  const hoursToShow = Math.min(PERIOD_HISTORY_MAX_HOURS, daysBack * 24 + 24);
  const { entityHistory: periodHistory } = useHistory(
    cfg.periodEntityId as EntityName,
    { hoursToShow },
  );

  const conso = pointOn(stats.rows[cfg.consumptionStatisticId] ?? [], day);
  const cost = pointOn(stats.rows[cfg.costStatisticId] ?? [], day);
  const label = dayLabel(day, today);
  const noRow = !stats.loading && conso === null && cost === null;
  const hourRows = padHours(
    hours.rows[cfg.consumptionStatisticId] ?? [],
    window,
  );
  const { series, unknownHours } = colourHours(hourRows, periodHistory);
  const anyStale =
    stats.isStale || stats.unreadable || hours.isStale || tariffStale;

  return (
    <>
      <DayTile
        title={titleCase(label.long)}
        stale={anyStale}
        since={stats.since}
        cost={cost?.value}
        subline={
          stats.unreadable
            ? "Valeur illisible"
            : noRow
              ? "Pas de relevé ce jour-là"
              : formatKwh(conso?.value)
        }
      />
      <HourlyChartTile
        title={`Conso horaire — ${label.short}`}
        series={series}
        ariaLabel={`Consommation horaire, ${label.long}, colorée par période tarifaire${
          unknownHours > 0
            ? " — période tarifaire non disponible pour tout ou partie du jour"
            : ""
        }`}
      />
    </>
  );
}

/** A month M (Story 9.5): HA's totals, two variation lines, the daily bars. */
function MonthColumn({
  cfg,
  month,
  currentMonth,
  tariffStale,
}: {
  cfg: ElectricityConfig;
  month: Date;
  currentMonth: Date;
  tariffStale: boolean;
}) {
  const isCurrent = month.getTime() === currentMonth.getTime();
  // M, M−1 and M−12 in ONE reply: HA cuts the buckets on its own local 1sts.
  const months = useStatistics({
    statisticIds: [cfg.consumptionStatisticId, cfg.costStatisticId],
    period: "month",
    units: UNITS,
    range: monthsWindow(month, MONTHS_BACK),
  });
  const dailies = useStatistics({
    statisticIds: [cfg.consumptionStatisticId],
    period: "day",
    units: UNITS,
    range: monthWindow(month),
  });

  const consoRows = months.rows[cfg.consumptionStatisticId] ?? [];
  const costRows = months.rows[cfg.costStatisticId] ?? [];
  const conso = pointOn(consoRows, month);
  const cost = pointOn(costRows, month);
  const prev = shiftAnchor(month, "month", -1);
  const yearAgo = new Date(month.getFullYear() - 1, month.getMonth(), 1);
  // How far the month's data goes — the N of « à date (N j) ».
  const covered = daysCoveredIn(
    dailies.rows[cfg.consumptionStatisticId] ?? [],
    month,
  );
  const atDate = isCurrent && covered > 0;

  const daySlots = padDays(
    dailies.rows[cfg.consumptionStatisticId] ?? [],
    monthWindow(month),
  );
  const anyStale =
    months.isStale || months.unreadable || dailies.isStale || tariffStale;

  const title = months.unreadable
    ? "Valeur illisible"
    : `${monthLabel(month)}${atDate ? ` · à date (${covered} j)` : ""}`;

  return (
    <>
      <DayTile
        title={title}
        stale={anyStale}
        since={months.since}
        cost={cost?.value}
        subline={formatKwh(conso?.value)}
      >
        {atDate ? (
          <AtDateVariations
            cfg={cfg}
            month={month}
            refs={[prev, yearAgo]}
            days={covered}
            current={{ conso: conso?.value ?? null, cost: cost?.value ?? null }}
          />
        ) : (
          <>
            <VariationLine
              label={monthShort(prev, month)}
              conso={variation(
                conso?.value ?? null,
                pointOn(consoRows, prev)?.value ?? null,
              )}
              cost={variation(
                cost?.value ?? null,
                pointOn(costRows, prev)?.value ?? null,
              )}
            />
            <VariationLine
              label={monthShort(yearAgo, month)}
              conso={variation(
                conso?.value ?? null,
                pointOn(consoRows, yearAgo)?.value ?? null,
              )}
              cost={variation(
                cost?.value ?? null,
                pointOn(costRows, yearAgo)?.value ?? null,
              )}
            />
          </>
        )}
      </DayTile>
      <Tile
        title={`Conso par jour — ${monthTag(month)}`}
        className="min-h-0 flex-1"
      >
        <div className="min-h-0 flex-1">
          <Suspense
            fallback={
              <span className="text-meta text-text-muted">Chargement…</span>
            }
          >
            <SensorHistoryChart
              kind="bar"
              series={daySlots}
              color="var(--color-text)"
              ariaLabel={`Consommation par jour, ${monthLabel(month).toLowerCase()}`}
              unit="kWh"
              decimals={1}
            />
          </Suspense>
        </div>
      </Tile>
    </>
  );
}

/**
 * The « à date » references of the CURRENT month: two `month` requests over
 * TRUNCATED windows — [M−1, M−1 + N) and [M−12, M−12 + N) — so HA computes the
 * change of the portion (AC5). Its own component so the two requests exist only
 * while a partial month is on screen.
 */
function AtDateVariations({
  cfg,
  month,
  refs,
  days,
  current,
}: {
  cfg: ElectricityConfig;
  month: Date;
  refs: readonly [Date, Date];
  days: number;
  current: { conso: number | null; cost: number | null };
}) {
  const ids = [cfg.consumptionStatisticId, cfg.costStatisticId];
  const prev = useStatistics({
    statisticIds: ids,
    period: "month",
    units: UNITS,
    range: truncatedMonthWindow(refs[0], days),
  });
  const yearAgo = useStatistics({
    statisticIds: ids,
    period: "month",
    units: UNITS,
    range: truncatedMonthWindow(refs[1], days),
  });
  const line = (read: StatisticsRead, ref: Date) => (
    <VariationLine
      label={`${monthShort(ref, month)} (à date)`}
      conso={variation(
        current.conso,
        pointOn(read.rows[cfg.consumptionStatisticId] ?? [], ref)?.value ??
          null,
      )}
      cost={variation(
        current.cost,
        pointOn(read.rows[cfg.costStatisticId] ?? [], ref)?.value ?? null,
      )}
      stale={read.isStale}
    />
  );
  return (
    <>
      {line(prev, refs[0])}
      {line(yearAgo, refs[1])}
    </>
  );
}

/**
 * "vs août : conso +12 % · coût +9 %" — ONE text node, so the sentence reads
 * (and is tested) as a whole. Signed numbers and words carry the meaning; no
 * colour is needed for it (UX-DR14). A missing reference reads "—" (AD-16).
 */
function VariationLine({
  label,
  conso,
  cost,
  stale = false,
}: {
  label: string;
  conso: number | null;
  cost: number | null;
  stale?: boolean;
}) {
  return (
    <span
      className={`text-meta tabular-nums ${
        stale ? "text-stale-text" : "text-text-muted"
      }`}
    >
      {`vs ${label} : conso ${formatVariation(conso)} · coût ${formatVariation(cost)}`}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

/**
 * Colour each hourly slot by the tariff HA was in, read off the period
 * sensor's history and rounded to the hour by majority — the app measures HA's
 * flips, it computes no schedule (AD-4). Hours the history does not cover stay
 * neutral, and are counted so the chart can SAY so.
 */
function colourHours(
  slots: readonly { t: number; value: number | null }[],
  periodHistory: readonly { s: unknown; lu: number; lc?: number }[],
): {
  series: { t: number; value: number | null; color: string; label: string }[];
  unknownHours: number;
} {
  const timeline: StateSample[] = periodHistory.map((h) => ({
    t: (h.lc ?? h.lu) * 1000,
    state: String(h.s),
  }));
  let unknownHours = 0;
  const series = slots.map((pt) => {
    const period = periodOfInterval(timeline, pt.t, pt.t + HOUR_MS);
    if (period === null) unknownHours++;
    return {
      ...pt,
      color: barFill(period),
      label: period === null ? "Valeur" : periodLabel(period),
    };
  });
  return { series, unknownHours };
}

/**
 * The figures tile: a dated title, the single "Hors ligne · HH:MM" pill of the
 * page, HA's cost as the hero and the consumption (or a rendered state) as the
 * subline, plus whatever lines the composition adds (the month's variations).
 */
function DayTile({
  title,
  stale,
  since,
  cost,
  subline,
  children,
}: {
  title: string;
  stale: boolean;
  since: string | undefined;
  cost: number | undefined;
  subline: string;
  children?: ReactNode;
}) {
  return (
    <Tile
      title={title}
      right={
        stale ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-stale/25 px-2 py-0.5 text-caption text-stale-text">
            Hors ligne{since ? ` · ${formatSince(since)}` : ""}
          </span>
        ) : undefined
      }
    >
      <div className="flex items-center gap-2">
        <BoltIcon
          size={22}
          className={stale ? "text-stale-text" : "text-text-muted"}
        />
        <span
          className={`text-numeric-lg font-semibold tabular-nums ${
            stale ? "text-stale-text" : "text-text"
          }`}
        >
          {formatEuro(cost)}
        </span>
        {/* No "× price" line: HA priced the period, half-hour by half-hour, at
            the tariff then in force (Story 9.4, AD-4). */}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta tabular-nums text-text-muted">
        <span>{subline}</span>
      </div>
      {children}
    </Tile>
  );
}

/** The 24 hourly bars of a day, with the glyph + word legend under them. */
function HourlyChartTile({
  title,
  series,
  ariaLabel,
}: {
  title: string;
  series: { t: number; value: number | null; color: string; label: string }[];
  ariaLabel: string;
}) {
  return (
    <Tile title={title} className="min-h-0 flex-1">
      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <span className="text-meta text-text-muted">Chargement…</span>
          }
        >
          <SensorHistoryChart
            kind="bar"
            series={series}
            color="var(--color-text)"
            ariaLabel={ariaLabel}
            unit="kWh"
            decimals={2}
          />
        </Suspense>
      </div>
      {/* Legend: the colours above are reinforcement, these words are the
          signal (UX-DR14). Same glyphs and tokens as the pill. */}
      <div
        data-testid="hourly-legend"
        className="flex items-center gap-4 text-caption text-text-muted"
      >
        <span className="inline-flex items-center gap-1">
          <PeriodIcon
            period="creuses"
            size={12}
            className={periodTone("creuses").text}
          />
          Creuses
        </span>
        <span className="inline-flex items-center gap-1">
          <PeriodIcon
            period="pleines"
            size={12}
            className={periodTone("pleines").text}
          />
          Pleines
        </span>
      </div>
    </Tile>
  );
}

/** One arrow. Named for screen readers, sized for fingers (NFR2). */
function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-[44px] w-[44px] items-center justify-center rounded-md border border-tile-border bg-tile-fill text-label font-semibold text-text-muted"
    >
      {children}
    </button>
  );
}

/** A frosted tile with an optional heading (cloned from WeatherDetail — the
 *  shared "content 2-col" shell extraction is deferred, deferred-work.md). */
function Tile({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 overflow-hidden rounded-md border border-tile-border bg-tile-fill p-4 ${className}`}
    >
      {title || right ? (
        <div className="flex items-center gap-2">
          {title ? (
            <span className="text-label font-semibold text-text-muted">
              {title}
            </span>
          ) : null}
          <span className="flex-1" />
          {right}
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * One tariff line: glyph, name, price, and — for the one currently billing — the
 * word "Appliqué". The marker is textual on purpose: a coloured border or a tint
 * would carry the meaning in colour alone (UX-DR14), and the neutral background
 * behind it is only reinforcement, never the signal (UX-DR24).
 */
function TariffRow({
  period,
  price,
  applied,
}: {
  period: TariffPeriod;
  price: number | null;
  applied: boolean;
}) {
  const tone = periodTone(period);
  return (
    <li
      className={`flex items-center gap-2 rounded-md px-2 py-1 text-meta ${
        applied ? `border ${tone.border} ${tone.soft}` : ""
      }`}
    >
      <PeriodIcon period={period} size={16} className={tone.text} />
      <span className={applied ? tone.text : "text-text-muted"}>
        {periodName(period)}
      </span>
      <span className="tabular-nums text-text">{formatPrice(price)}</span>
      <span className="flex-1" />
      {/* The marker stays a WORD. The tint and the border above are
          reinforcement; strip all colour and this row still tells you which
          tariff is billing (UX-DR14). */}
      {applied ? (
        <span className={`text-caption font-semibold ${tone.text}`}>
          Appliqué
        </span>
      ) : null}
    </li>
  );
}

function BackLink() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/")}
      className="inline-flex min-h-[44px] w-fit items-center gap-1 text-label font-semibold text-text-muted"
    >
      ‹ Accueil
    </button>
  );
}
