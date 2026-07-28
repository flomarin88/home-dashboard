import { lazy, Suspense, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useHistory } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import { isConfigured } from "../hakit";
import { electricityConfig } from "../entities";
import type { ElectricityConfig } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { formatSince } from "../hakit/stale";
import {
  electricityView,
  type TariffPeriod,
} from "../widgets/electricity-cost";
import {
  formatEuro,
  formatKwh,
  formatPrice,
  periodName,
} from "../widgets/consumption-format";
import { formatSunTime } from "../widgets/weather-format";
import { BoltIcon, PeriodIcon } from "../widgets/ConsumptionIcons";
import { SPARKLINE_HOURS } from "../config";

// Lazy so Recharts stays code-split off the home warm-start bundle (shared chunk
// with the /meteo + room-detail charts; AD-9 / PWA precache stays lean).
const SensorHistoryChart = lazy(() => import("../widgets/SensorHistoryChart"));

/**
 * ElectricityDetail — deep page for the electricity consumption (Story 9.1,
 * AD-10/AD-16), opened by tapping `ElectricityTile`. Content-only — the ground +
 * top bar belong to `KioskShell` (TD-1). Landscape 2-column grid of frosted
 * tiles, fits the 1024×768 kiosk viewport with NO scroll.
 *
 * Left: Aujourd'hui (derived cost + consumption + applied tariff) + Historique
 * (cumulative daily-kWh chart). Right: the HC/HP tariff tile — current period,
 * BOTH prices with the one in force marked, and the next switch (Story 9.2,
 * filling the seam 9.1 left). All reflect-only (AD-3); cost is a display
 * derivation (AD-16), never persisted, and no tariff schedule is computed here
 * (AD-4) — the period and the switch time are both read from HA.
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
  const kwh = useEntityValue(cfg.dailyKwhEntityId as EntityName);
  const period = useEntityValue(cfg.periodEntityId as EntityName);
  const priceCreuses = useEntityValue(cfg.priceCreusesEntityId as EntityName);
  const pricePleines = useEntityValue(cfg.pricePleinesEntityId as EntityName);
  const nextSwitch = useEntityValue(cfg.nextSwitchEntityId as EntityName);

  const view = electricityView({
    kwh: kwh.value,
    priceCreuses: priceCreuses.value,
    pricePleines: pricePleines.value,
    period: period.value,
  });
  const anyStale =
    kwh.isStale ||
    period.isStale ||
    priceCreuses.isStale ||
    pricePleines.isStale ||
    nextSwitch.isStale;

  // Cumulative daily-kWh history. The sensor resets to 0 at midnight, so over a
  // 24 h window the curve climbs then drops at the midnight boundary — that
  // sawtooth is faithful ("conso depuis 00:00"), not a bug. A smooth power/rate
  // curve would need a separate instantaneous sensor (out of scope, 9.1).
  const { entityHistory } = useHistory(cfg.dailyKwhEntityId as EntityName, {
    hoursToShow: SPARKLINE_HOURS,
  });
  const consoSeries = entityHistory
    .map((h) => ({ t: (h.lc ?? h.lu) * 1000, value: Number(h.s) }))
    .filter((d) => Number.isFinite(d.value) && Number.isFinite(d.t));

  return (
    <div className="flex h-full flex-col gap-grid-gap overflow-hidden">
      <BackLink />

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-grid-gap">
        {/* Left column — Aujourd'hui + Historique (real HA data). */}
        <div className="flex min-h-0 flex-col gap-grid-gap overflow-hidden">
          <Tile
            title="Aujourd'hui"
            right={
              anyStale ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-stale/25 px-2 py-0.5 text-caption text-stale-text">
                  Hors ligne{kwh.since ? ` · ${formatSince(kwh.since)}` : ""}
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
                {formatEuro(view.cost)}
              </span>
              <span className="text-meta text-text-muted">aujourd'hui</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta tabular-nums text-text-muted">
              <span>{formatKwh(view.kwh)} · depuis 00:00</span>
              {/* The tariff actually billing right now, named — a bare price
                  would no longer say which of the two it is. */}
              <span>
                {`${formatPrice(view.appliedPrice)} · ${periodName(view.period)}`}
              </span>
            </div>
          </Tile>

          <Tile
            title="Historique — conso cumulée (24 h)"
            className="min-h-0 flex-1"
          >
            <div className="min-h-0 flex-1">
              <Suspense
                fallback={
                  <span className="text-meta text-text-muted">Chargement…</span>
                }
              >
                <SensorHistoryChart
                  series={consoSeries}
                  color="var(--color-text)"
                  ariaLabel="Historique de la consommation cumulée sur 24 heures"
                  unit="kWh"
                  decimals={1}
                />
              </Suspense>
            </div>
          </Tile>
        </div>

        {/* Right column — the HC/HP tariff detail (Story 9.2). */}
        <div className="flex min-h-0 flex-col gap-grid-gap overflow-hidden">
          {/* No second "Hors ligne" pill here: AC5 asks for one on the page,
              and the tile family already dims as a whole. Repeating it would be
              noise on a screen read from three metres away. */}
          <Tile title="Heures creuses / pleines" className="min-h-0 flex-1">
            {/* Current period — glyph AND word, never colour alone (UX-DR14). */}
            <div className="flex items-center gap-2">
              <PeriodIcon
                period={view.period}
                size={22}
                className={anyStale ? "text-stale-text" : "text-text-muted"}
              />
              <span
                className={`text-numeric-lg font-semibold ${
                  anyStale ? "text-stale-text" : "text-text"
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
  return (
    <li
      className={`flex items-center gap-2 rounded-md px-2 py-1 text-meta ${
        applied ? "border border-card-border bg-card-fill" : ""
      }`}
    >
      <PeriodIcon period={period} size={16} className="text-text-muted" />
      <span className="text-text-muted">{periodName(period)}</span>
      <span className="tabular-nums text-text">{formatPrice(price)}</span>
      <span className="flex-1" />
      {applied ? (
        <span className="text-caption font-semibold text-text">Appliqué</span>
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
