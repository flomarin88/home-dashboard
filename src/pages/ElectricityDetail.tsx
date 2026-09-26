import { lazy, Suspense, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useHistory } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import { isConfigured } from "../hakit";
import { electricityConfig } from "../entities";
import type { ElectricityConfig } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { useStatistics } from "../hakit/useStatistics";
import { formatSince } from "../hakit/stale";
import {
  dayLabel,
  dayWindow,
  hourlySeries,
  hoursToCover,
  periodOfInterval,
  selectLastCompleteDay,
  startOfDay,
  type HourPeriod,
} from "../energy/statistics";
import {
  electricityView,
  type TariffPeriod,
} from "../widgets/electricity-cost";
import {
  formatEuro,
  formatKwh,
  formatPrice,
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

/** The bar colour of an hour, by the tariff HA was in — the pill's own tokens. */
const HOUR_MS = 3_600_000;
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

/**
 * ElectricityDetail — deep page for the electricity consumption (Story 9.1 →
 * 9.4, AD-10/AD-16 amended), opened by tapping `ElectricityTile`. Content-only —
 * the ground + top bar belong to `KioskShell` (TD-1). Landscape 2-column grid
 * of frosted tiles, fits the 1024×748 kiosk viewport with NO scroll.
 *
 * Left: the LAST COMPLETE DAY, named in full ("Hier · jeudi 24 septembre",
 * UX-DR30) — HA's own cost for that day (ha-linky `costs`) and its consumption
 * — then the 24 HOURLY bars of that same day. Both come from long-term
 * statistics read by query (`recorder.get_statistics`, AD-17): two calls, one
 * per period, the hourly one windowed on the day the daily one selected. There
 * is no entity to subscribe to for the energy itself (Story 9.4). Each hourly
 * bar wears the colour of the tariff HA was in at that hour — read off the
 * HISTORY of the period `binary_sensor` over the shown day and rounded to the
 * hour by majority (Florian, 2026-09-26). The app still knows no schedule
 * (AD-4): it measures HA's flips, it does not compute them. Colour is never
 * alone — a glyph + word legend sits under the chart and the tooltip names the
 * period (UX-DR14).
 * Right: the HC/HP tariff tile of Story 9.2, untouched — the period that is
 * current NOW, both prices with the one in force marked, the next switch. All
 * reflect-only (AD-3); nothing is multiplied or scheduled here (AD-4).
 *
 * Obsolescence: the statistics' `isStale` means the last request failed or HA
 * is unreachable — the last known day stays, dimmed, and the single "Hors
 * ligne · HH:MM" pill is stamped with the time of the last successful REQUEST
 * (`since`), because a J-1 statistic has no `last_changed` worth showing.
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
  const conso = selectLastCompleteDay(
    days.rows[cfg.consumptionStatisticId] ?? [],
    today,
  );
  const cost = selectLastCompleteDay(
    days.rows[cfg.costStatisticId] ?? [],
    today,
  );
  const shown = conso ?? cost;
  const label = shown ? dayLabel(shown.start, today) : null;

  // The hourly chart follows the day the figures show. Before a day is known
  // it asks for yesterday — the chart then simply says "Pas d'historique".
  const chartDay =
    shown?.start ??
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const hours = useStatistics({
    statisticIds: [cfg.consumptionStatisticId],
    period: "hour",
    units: UNITS,
    range: dayWindow(chartDay),
  });
  const hourRows = hourlySeries(hours.rows[cfg.consumptionStatisticId] ?? []);

  // The tariff period over the shown day, from HA's history of the period
  // sensor. `useHistory` only knows "the last N hours", so ask for enough of
  // them to reach the day's first instant (and the state in force just before).
  const { entityHistory: periodHistory } = useHistory(
    cfg.periodEntityId as EntityName,
    { hoursToShow: hoursToCover(chartDay, new Date()) },
  );
  const periodTimeline = periodHistory.map((h) => ({
    t: (h.lc ?? h.lu) * 1000,
    state: String(h.s),
  }));
  const hourSeries = hourRows.map((pt) => {
    const period = periodOfInterval(periodTimeline, pt.t, pt.t + HOUR_MS);
    return {
      ...pt,
      color: barFill(period),
      label: period === null ? "Valeur" : periodLabel(period),
    };
  });

  const view = electricityView({
    priceCreuses: priceCreuses.value,
    pricePleines: pricePleines.value,
    period: period.value,
  });
  const anyStale =
    days.isStale ||
    period.isStale ||
    priceCreuses.isStale ||
    pricePleines.isStale ||
    nextSwitch.isStale;

  const dayTitle = label
    ? titleCase(label.long)
    : days.loading
      ? "—"
      : "Pas encore de relevé";

  return (
    <div className="flex h-full flex-col gap-grid-gap overflow-hidden">
      <BackLink />

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-grid-gap">
        {/* Left column — the last complete day + its hourly profile. */}
        <div className="flex min-h-0 flex-col gap-grid-gap overflow-hidden">
          <Tile
            title={dayTitle}
            right={
              anyStale ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-stale/25 px-2 py-0.5 text-caption text-stale-text">
                  Hors ligne{days.since ? ` · ${formatSince(days.since)}` : ""}
                </span>
              ) : undefined
            }
          >
            <div className="flex items-center gap-2">
              <BoltIcon
                size={22}
                className={anyStale ? "text-stale-text" : "text-text-muted"}
              />
              <span
                className={`text-numeric-lg font-semibold tabular-nums ${
                  anyStale ? "text-stale-text" : "text-text"
                }`}
              >
                {formatEuro(cost?.value)}
              </span>
              {/* No "× price" line any more: HA priced the day, half-hour by
                  half-hour, at the tariff then in force (Story 9.4, AD-4). */}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta tabular-nums text-text-muted">
              <span>{formatKwh(conso?.value)}</span>
            </div>
          </Tile>

          <Tile
            title={`Conso horaire — ${label ? label.short : "—"}`}
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
                  series={hourSeries}
                  color="var(--color-text)"
                  ariaLabel={`Consommation horaire, ${label ? label.long : "aucun jour disponible"}, colorée par période tarifaire`}
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
                period={view.period}
                size={22}
                className={
                  anyStale ? "text-stale-text" : periodTone(view.period).text
                }
              />
              <span
                className={`text-numeric-lg font-semibold ${
                  anyStale ? "text-stale-text" : periodTone(view.period).text
                }`}
              >
                {periodName(view.period)}
              </span>
              <span className="text-meta text-text-muted">en ce moment</span>
            </div>

            {/* Both tariffs, always both — the one in force is marked by a WORD.
                A border or a tint alone would fail UX-DR14, and the user needs
                to see the other rate to know what they are avoiding. */}
            <ul className="flex flex-col gap-1">
              <TariffRow
                period="creuses"
                price={view.priceCreuses}
                applied={view.period === "creuses"}
              />
              <TariffRow
                period="pleines"
                price={view.pricePleines}
                applied={view.period === "pleines"}
              />
            </ul>

            {/* Next switch: READ from a timestamp sensor and formatted with the
                same helper /meteo uses for sunrise. No deadline arithmetic, no
                window, no timer, no Date.now() (AD-4). */}
            <span className="text-meta tabular-nums text-text-muted">
              {`Passage en ${
                view.period === "creuses" ? "pleines" : "creuses"
              } à ${formatSunTime(nextSwitch.value)}`}
            </span>
          </Tile>
        </div>
      </div>
    </div>
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
