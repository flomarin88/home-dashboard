import { lazy, Suspense, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useHistory } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import { isConfigured } from "../hakit";
import { climate } from "../entities";
import type { EntityEntry } from "../entities";
import { useClimate } from "../widgets/useClimate";
import {
  ClimateControls,
  ClimateIcon,
  StatePill,
  PowerToggle,
} from "../widgets/ClimateControls";
import { ClimateTimeline } from "../widgets/ClimateTimeline";
import { OfflinePill } from "../ui/OfflinePill";
import { SPARKLINE_HOURS } from "../config";

// Shared lazy chunk with /meteo and room detail — Recharts stays off the home
// warm-start bundle.
const SensorHistoryChart = lazy(() => import("../widgets/SensorHistoryChart"));

/**
 * ClimateDetail — deep page for the upstairs A/C (Intent B, AD-10). The full
 * control surface the compact home tile deliberately doesn't carry: mode, speed,
 * oscillation, power — plus the 24 h temperature history. Content-only — the
 * ground + top bar are owned by `KioskShell` (TD-1). Opened by tapping the home
 * Climatisation tile.
 *
 * Layout: a landscape 2-column grid (controls | history) of frosted tiles that
 * fits the 1024×768 kiosk with NO scroll (memory: target-device-and-layout).
 */
export function ClimateDetail() {
  const entry = climate();
  if (!isConfigured || !entry) {
    return (
      <div className="flex h-full flex-col gap-2">
        <BackLink />
        <p className="text-meta text-text-muted">
          Climatisation non configurée.
        </p>
      </div>
    );
  }
  return <ClimateDetailContent entry={entry} />;
}

export function ClimateDetailContent({ entry }: { entry: EntityEntry }) {
  const c = useClimate(entry);

  return (
    <div className="flex h-full flex-col gap-grid-gap overflow-hidden">
      <div className="flex items-center gap-3">
        <BackLink />
        <h1 className="flex items-center gap-2 text-title font-bold">
          <ClimateIcon />
          Climatisation · Étage
        </h1>
        {c.failed ? (
          <span className="text-meta font-semibold text-security-alert">
            Échec
          </span>
        ) : !c.isOff && !c.isStale ? (
          <StatePill mode={c.mode} />
        ) : null}
        <span className="flex-1" />
        {!c.isStale ? (
          <PowerToggle on={!c.isOff} onToggle={c.togglePower} />
        ) : null}
      </div>

      {c.isStale ? (
        <Tile className="min-h-0 flex-1 items-center justify-center">
          <OfflinePill />
        </Tile>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[0.82fr_1.18fr] gap-grid-gap">
          <Tile>
            <ClimateControls c={c} />
          </Tile>
          <div className="flex min-h-0 flex-col gap-grid-gap">
            <Tile className="min-h-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-label font-semibold text-text-muted">
                  Température · 24 h
                </span>
                {c.ambient != null ? (
                  <span className="text-label font-semibold tabular-nums text-accent-climate">
                    {c.ambient}°C
                  </span>
                ) : null}
              </div>
              <div className="min-h-0 flex-1">
                <TempHistory entry={entry} setpoint={c.setpointValue} />
              </div>
            </Tile>
            <Tile>
              <span className="text-label font-semibold text-text-muted">
                Mode &amp; vitesse · 24 h
              </span>
              <TimelineCard entry={entry} />
            </Tile>
          </div>
        </div>
      )}
    </div>
  );
}

/** 24 h ambient-temperature chart with the current setpoint as a reference line. */
function TempHistory({
  entry,
  setpoint,
}: {
  entry: EntityEntry;
  setpoint: number | null;
}) {
  const id = (entry.ambientEntityId ?? entry.entityId) as EntityName;
  const { entityHistory } = useHistory(id, { hoursToShow: SPARKLINE_HOURS });
  const series = entityHistory
    .map((h) => ({ t: (h.lc ?? h.lu) * 1000, value: Number(h.s) }))
    .filter((d) => Number.isFinite(d.value) && Number.isFinite(d.t));
  const referenceLines =
    setpoint != null
      ? [{ y: setpoint, color: "var(--color-accent-climate)" }]
      : undefined;

  return (
    <Suspense
      fallback={<span className="text-meta text-text-muted">Chargement…</span>}
    >
      <SensorHistoryChart
        series={series}
        color="var(--color-accent-climate)"
        ariaLabel="Historique — Température (24 h)"
        tickSuffix="°"
        unit="°C"
        decimals={1}
        tickStep={1}
        referenceLines={referenceLines}
      />
    </Suspense>
  );
}

/** The Mode/Vitesse 24 h bands, from the climate entity's OWN history — one call
 * carries the mode (state `s`) and the fan speed (attribute `a.fan_mode`).
 * `minimalResponse:false` keeps attributes on every row so the Vitesse band has
 * data (Onecta is polled → the history is coarse; the bands degrade gracefully). */
function TimelineCard({ entry }: { entry: EntityEntry }) {
  const id = entry.entityId as EntityName;
  const { entityHistory } = useHistory(id, {
    hoursToShow: SPARKLINE_HOURS,
    minimalResponse: false,
    significantChangesOnly: false,
  });
  const points = entityHistory
    .map((h) => {
      const a = h.a as { fan_mode?: string } | undefined;
      return { t: (h.lc ?? h.lu) * 1000, mode: h.s, fan: a?.fan_mode ?? null };
    })
    .filter((p) => Number.isFinite(p.t));
  const endMs = Date.now();
  const startMs = endMs - SPARKLINE_HOURS * 3600 * 1000;
  return <ClimateTimeline points={points} startMs={startMs} endMs={endMs} />;
}

/** A frosted tile container (no titled section chrome). */
function Tile({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col gap-2 overflow-hidden rounded-md border border-tile-border bg-tile-fill p-3 ${className}`}
    >
      {children}
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
