import { lazy, Suspense, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useHistory } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import { isConfigured } from "../hakit";
import { electricityConfig } from "../entities";
import type { ElectricityConfig } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { formatSince } from "../hakit/stale";
import { electricityView } from "../widgets/electricity-cost";
import {
  formatEuro,
  formatKwh,
  formatPrice,
} from "../widgets/consumption-format";
import { BoltIcon } from "../widgets/ConsumptionIcons";
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
 * Left: Aujourd'hui (derived cost + consumption + unit price) + Historique
 * (cumulative daily-kWh chart). Right: the HC/HP tariff tile as an "à venir"
 * seam, filled by Story 9.2 (current period + two prices + next switch). All
 * reflect-only (AD-3); cost is a display derivation (AD-16), never persisted.
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
  const price = useEntityValue(cfg.priceEntityId as EntityName);
  const view = electricityView({ kwh: kwh.value, price: price.value });
  const anyStale = kwh.isStale || price.isStale;

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
              <span>{formatPrice(view.price)}</span>
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

        {/* Right column — HC/HP tariff seam, filled by Story 9.2. */}
        <div className="flex min-h-0 flex-col gap-grid-gap overflow-hidden">
          <Tile title="Heures creuses / pleines" className="min-h-0 flex-1">
            <ComingSoon note="Ajouté par la Story 9.2 : période courante (HA) + les deux tarifs HC/HP + la prochaine bascule." />
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

/** Placeholder for a capability awaiting a later story (here: HC/HP, Story 9.2). */
function ComingSoon({ note }: { note: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label font-semibold text-text">À venir</span>
      <span className="text-meta text-text-muted">{note}</span>
    </div>
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
