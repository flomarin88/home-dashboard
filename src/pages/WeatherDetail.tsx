import { lazy, Suspense, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useHistory, useWeather } from "@hakit/core";
import type { EntityName, FilterByDomain } from "@hakit/core";
import { isConfigured } from "../hakit";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { weatherConfig } from "../entities";
import type { WeatherConfig } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { formatSensorValue } from "../widgets/room-sensor-format";
import { WeatherIcon, DropletIcon } from "../widgets/WeatherIcon";

// Lazy so Recharts is code-split off the home warm-start bundle (shared chunk
// with the room-detail charts; AD-9 / PWA precache stays lean).
const SensorHistoryChart = lazy(() => import("../widgets/SensorHistoryChart"));
import { parseBattery, batteryColorClass } from "../widgets/vacuum-status";
import {
  trendArrow,
  trendColorClass,
  conditionLabel,
  forecastDayLabel,
  forecastHourLabel,
} from "../widgets/weather-format";
import { SPARKLINE_HOURS, TEMP_REFERENCE_LINES } from "../config";

type WeatherEntityId = FilterByDomain<EntityName, "weather">;

/**
 * WeatherDetail — deep page for the outdoor weather (Story 6.2, AD-10), opened by
 * tapping `TopBarWeather`. Content-only — the ground + top bar belong to
 * `KioskShell` (TD-1). Landscape 2-column grid of frosted tiles, fits the
 * 1024×768 kiosk viewport with NO scroll (memory: target-device-and-layout).
 *
 * Left: Actuel (condition + temp/humidité/batterie/tendance) + Historique 24 h
 * (labelled temperature chart, no threshold line). Right: 7-day daily forecast +
 * hourly forecast — both from the HA `weather.*` entity (`useWeather`). Without a
 * mapped weather entity the forecasts fall back to an "à venir" seam.
 */
export function WeatherDetail() {
  const cfg = weatherConfig();
  if (!isConfigured || !cfg) {
    return (
      <div className="flex h-full flex-col gap-2">
        <BackLink />
        <p className="text-meta text-text-muted">Météo non configurée.</p>
      </div>
    );
  }
  return <WeatherDetailContent cfg={cfg} />;
}

export function WeatherDetailContent({ cfg }: { cfg: WeatherConfig }) {
  const temp = useEntityValue(cfg.tempEntityId as EntityName);
  const humidity = useEntityValue(cfg.humidityEntityId as EntityName);
  const battery = useEntityValue(cfg.batteryEntityId as EntityName);
  const trend = useEntityValue(cfg.trendEntityId as EntityName);
  const condition = useEntityValue(
    (cfg.conditionEntityId ?? cfg.tempEntityId) as EntityName,
  );

  const { entityHistory } = useHistory(cfg.tempEntityId as EntityName, {
    hoursToShow: SPARKLINE_HOURS,
  });
  const tempSeries = entityHistory
    .map((h) => ({ t: (h.lc ?? h.lu) * 1000, value: Number(h.s) }))
    .filter((d) => Number.isFinite(d.value) && Number.isFinite(d.t));

  const bat = parseBattery(battery.value);
  const arrow = trendArrow(trend.value);
  const hasCondition = Boolean(cfg.conditionEntityId);
  const forecastId = cfg.forecastEntityId as WeatherEntityId | undefined;

  return (
    <div className="flex h-full flex-col gap-grid-gap overflow-hidden">
      <BackLink />

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-grid-gap">
        {/* Left column — Actuel + Historique (real Netatmo data). */}
        <div className="flex min-h-0 flex-col gap-grid-gap overflow-hidden">
          <Tile title="Actuel">
            {hasCondition ? (
              <div className="flex items-center gap-2">
                <WeatherIcon condition={condition.value} size={28} />
                <span
                  className={`text-label ${condition.isStale ? "text-stale-text" : "text-text-muted"}`}
                >
                  {conditionLabel(condition.value)}
                </span>
              </div>
            ) : null}
            <div className="flex items-baseline gap-2">
              <span
                className={`text-numeric-lg font-semibold tabular-nums ${
                  temp.isStale ? "text-stale-text" : "text-text"
                }`}
              >
                {formatSensorValue(temp.value, 1)} {temp.unit ?? "°C"}
              </span>
              {arrow ? (
                <span
                  className={`text-numeric-lg tabular-nums ${
                    trend.isStale
                      ? "text-stale-text"
                      : trendColorClass(trend.value)
                  }`}
                >
                  {arrow}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta tabular-nums text-text-muted">
              <span
                className={`inline-flex items-center gap-1 ${humidity.isStale ? "text-stale-text" : ""}`}
              >
                <DropletIcon size={16} />
                {formatSensorValue(humidity.value, 0)} %
              </span>
              <span>
                Batterie{" "}
                <span
                  className={
                    battery.isStale ? "text-stale-text" : batteryColorClass(bat)
                  }
                >
                  {bat ?? "—"} %
                </span>
              </span>
            </div>
          </Tile>

          <Tile
            title="Historique — température (24 h)"
            className="min-h-0 flex-1"
          >
            <div className="min-h-0 flex-1">
              <Suspense
                fallback={
                  <span className="text-meta text-text-muted">Chargement…</span>
                }
              >
                <SensorHistoryChart
                  series={tempSeries}
                  color="var(--color-accent-climate)"
                  ariaLabel="Historique de la température sur 24 heures"
                  tickSuffix="°"
                  unit="°C"
                  decimals={1}
                  tickStep={1}
                  referenceLines={TEMP_REFERENCE_LINES}
                />
              </Suspense>
            </div>
          </Tile>
        </div>

        {/* Right column — hourly (top) + daily (bottom) forecast from the HA
            weather entity (Florian, 2026-07-17: hourly above daily). */}
        <div className="flex min-h-0 flex-col gap-grid-gap overflow-hidden">
          <Tile title="Prévisions horaires" className="min-h-0 flex-1">
            {forecastId ? (
              <ErrorBoundary fallback={<ForecastUnavailable />}>
                <HourlyForecast weatherId={forecastId} />
              </ErrorBoundary>
            ) : (
              <ComingSoon note="Nécessite une intégration météo HA (prévisions horaires)." />
            )}
          </Tile>

          <Tile title="Prévisions 7 jours" className="min-h-0 flex-1">
            {forecastId ? (
              <ErrorBoundary fallback={<ForecastUnavailable />}>
                <DailyForecast weatherId={forecastId} />
              </ErrorBoundary>
            ) : (
              <ComingSoon note="Ajouter une intégration météo à Home Assistant (ex. Météo-France)." />
            )}
          </Tile>
        </div>
      </div>
    </div>
  );
}

/** 7-day forecast row from `weather.*` (daily). */
function DailyForecast({ weatherId }: { weatherId: WeatherEntityId }) {
  const weather = useWeather(weatherId, { type: "daily" });
  const days = (weather.forecast?.forecast ?? []).slice(0, 7);
  if (days.length === 0) {
    return (
      <span className="text-meta text-text-muted">
        Prévisions indisponibles
      </span>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 items-stretch gap-1 overflow-hidden">
      {days.map((f) => (
        <div
          key={f.datetime}
          className="flex flex-1 flex-col items-center justify-center gap-1"
        >
          <span className="text-meta text-text-muted">
            {forecastDayLabel(f.datetime)}
          </span>
          <WeatherIcon condition={f.condition} size={22} />
          <span className="text-meta tabular-nums text-text">
            {Number.isFinite(f.temperature)
              ? `${Math.round(f.temperature)}°`
              : "—"}
            {f.templow != null ? (
              <span className="text-text-muted">
                {" "}
                / {Math.round(f.templow)}°
              </span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Next-hours forecast row from `weather.*` (hourly) — replaces "pluie dans 1h". */
function HourlyForecast({ weatherId }: { weatherId: WeatherEntityId }) {
  const weather = useWeather(weatherId, { type: "hourly" });
  const hours = (weather.forecast?.forecast ?? []).slice(0, 8);
  if (hours.length === 0) {
    return (
      <span className="text-meta text-text-muted">
        Prévisions indisponibles
      </span>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 items-stretch gap-1 overflow-hidden">
      {hours.map((f) => (
        <div
          key={f.datetime}
          className="flex flex-1 flex-col items-center justify-center gap-1"
        >
          <span className="text-meta text-text-muted">
            {forecastHourLabel(f.datetime)}
          </span>
          <WeatherIcon condition={f.condition} size={20} />
          <span className="text-meta tabular-nums text-text">
            {Number.isFinite(f.temperature)
              ? `${Math.round(f.temperature)}°`
              : "—"}
          </span>
          {f.precipitation_probability != null ? (
            <span className="text-meta tabular-nums text-accent-shutters">
              {Math.round(f.precipitation_probability)}%
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** A frosted tile with an optional heading. */
function Tile({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 overflow-hidden rounded-md border border-tile-border bg-tile-fill p-4 ${className}`}
    >
      {title ? (
        <span className="text-label font-semibold text-text-muted">
          {title}
        </span>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Fallback rendered by the forecast ErrorBoundary when `useWeather` throws (e.g.
 * the entity doesn't support the requested forecast type, or a transient HA
 * subscription error). Degrades the tile instead of blanking the page (AD-6).
 */
function ForecastUnavailable() {
  return (
    <span className="text-meta text-text-muted">Prévisions indisponibles</span>
  );
}

/** Placeholder for a seam awaiting the HA weather integration (Task 0). */
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
