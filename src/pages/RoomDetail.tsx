import { lazy, Suspense } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useHistory } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import { isConfigured } from "../hakit";
import { ROOMS, sensor } from "../entities";
import type { Room, RoomId, Measure } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import {
  formatSensorValue,
  co2ColorClass,
  co2Color,
} from "../widgets/room-sensor-format";
import {
  SPARKLINE_HOURS,
  TEMP_REFERENCE_LINES,
  CO2_REFERENCE_LINES,
} from "../config";

// Shared lazy chunk with /meteo — Recharts stays off the home warm-start bundle.
const SensorHistoryChart = lazy(() => import("../widgets/SensorHistoryChart"));

/** Per-measure display config for the history tiles (colour/unit/axis). */
interface MeasureConfig {
  readonly title: string;
  readonly color: string;
  readonly unit: string;
  readonly tickSuffix: string;
  readonly decimals: number;
  /** Force whole-step Y ticks (temperature only — degree by degree). */
  readonly tickStep?: number;
  /** Horizontal reference lines (temperature: 26° red / 20° blue; CO₂: 1000/2000). */
  readonly referenceLines?: readonly { y: number; color: string }[];
  /** Colour the current numeric value by threshold (e.g. CO₂ air quality). */
  readonly valueColorClass?: (state: string | null) => string;
  /**
   * Colour the history LINE by the current value's threshold band (CO₂ only), so
   * the curve matches the current value (green/orange/red). Omit → fixed `color`.
   */
  readonly lineColor?: (state: string | null) => string;
}

const MEASURE_CONFIG: Record<Measure, MeasureConfig> = {
  temperature: {
    title: "Température",
    color: "var(--color-accent-climate)",
    unit: "°C",
    tickSuffix: "°",
    decimals: 1,
    tickStep: 1,
    referenceLines: TEMP_REFERENCE_LINES,
  },
  co2: {
    title: "CO₂",
    color: "var(--color-accent-lights)",
    unit: "ppm",
    tickSuffix: "",
    decimals: 0,
    referenceLines: CO2_REFERENCE_LINES,
    valueColorClass: co2ColorClass,
    lineColor: co2Color,
  },
  humidity: {
    title: "Humidité",
    color: "var(--color-accent-shutters)",
    unit: "%",
    tickSuffix: "%",
    decimals: 0,
  },
  noise: {
    title: "Bruit",
    color: "var(--color-accent-vacuum)",
    unit: "dB",
    tickSuffix: "",
    decimals: 0,
  },
};

// Display order; only measures actually mapped for the room are rendered (so the
// Salon shows its sonomètre while the others show 3).
const MEASURE_ORDER: Measure[] = ["temperature", "co2", "humidity", "noise"];

/**
 * Room detail (Story 6.2 extension → Epic 5.2): the room's Netatmo sensors as
 * interactive 24 h history charts, reusing the Recharts `SensorHistoryChart`
 * (Florian, 2026-07-17). Content-only — ground + top bar are owned by
 * `KioskShell` (TD-1). Landscape 2×2 grid, no scroll (memory:
 * target-device-and-layout). Reached by tapping a room sensor card.
 */
export function RoomDetail() {
  const { roomId } = useParams();
  const room = ROOMS.find((r) => r.id === (roomId as RoomId));
  if (!isConfigured || !room) {
    return (
      <div className="flex h-full flex-col gap-2">
        <BackLink />
        <p className="text-meta text-text-muted">
          {room ? "Home Assistant non configuré." : "Pièce inconnue."}
        </p>
      </div>
    );
  }
  return <RoomDetailContent room={room} />;
}

export function RoomDetailContent({ room }: { room: Room }) {
  const measures = MEASURE_ORDER.filter((m) => sensor(room.id, m));

  return (
    <div className="flex h-full flex-col gap-grid-gap overflow-hidden">
      <div className="flex items-center gap-3">
        <BackLink />
        <h1 className="text-title font-bold">{room.label}</h1>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-grid-gap">
        {measures.map((m) => (
          <MeasureTile key={m} room={room.id} measure={m} />
        ))}
      </div>
    </div>
  );
}

function MeasureTile({ room, measure }: { room: RoomId; measure: Measure }) {
  const cfg = MEASURE_CONFIG[measure];
  const entry = sensor(room, measure);
  // Tiles are only rendered for mapped measures, so `entry` is present; the
  // non-entity 'unknown' sentinel (matches RoomSensorCard) keeps entity_ids in
  // entities/ only (AD-7) if a measure is ever unmapped.
  const id = (entry?.entityId ?? "unknown") as EntityName;
  const current = useEntityValue(id);
  const { entityHistory } = useHistory(id, { hoursToShow: SPARKLINE_HOURS });
  const series = entityHistory
    .map((h) => ({ t: (h.lc ?? h.lu) * 1000, value: Number(h.s) }))
    .filter((d) => Number.isFinite(d.value) && Number.isFinite(d.t));

  // CO₂ line colour follows the current value's band (green/orange/red), grey
  // when stale — mirrors the value colour. Other measures keep their fixed colour.
  const lineColor = cfg.lineColor
    ? current.isStale
      ? "var(--color-stale-text)"
      : cfg.lineColor(current.value)
    : cfg.color;

  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-md border border-tile-border bg-tile-fill p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-label font-semibold text-text-muted">
          {cfg.title}
        </span>
        <span
          className={`text-label font-semibold tabular-nums ${
            current.isStale
              ? "text-stale-text"
              : (cfg.valueColorClass?.(current.value) ?? "text-text")
          }`}
        >
          {formatSensorValue(current.value, cfg.decimals)} {cfg.unit}
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <span className="text-meta text-text-muted">Chargement…</span>
          }
        >
          <SensorHistoryChart
            series={series}
            color={lineColor}
            ariaLabel={`Historique — ${cfg.title} (24 h)`}
            tickSuffix={cfg.tickSuffix}
            unit={cfg.unit}
            decimals={cfg.decimals}
            tickStep={cfg.tickStep}
            referenceLines={cfg.referenceLines}
          />
        </Suspense>
      </div>
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
