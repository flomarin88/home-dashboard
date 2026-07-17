import { useNavigate } from "react-router-dom";
import { useHistory } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import type { RoomId, Measure } from "../entities";
import { roomSensors, getRoom } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { formatSensorValue, co2ColorClass } from "./room-sensor-format";
import { DropletIcon, Co2Icon } from "./WeatherIcon";
import { Sparkline } from "./Sparkline";
import { OfflinePill } from "../ui/OfflinePill";
import { FloorPill } from "../ui/FloorPill";
import { Skeleton } from "../ui/Skeleton";
import { TEMPERATURE_THRESHOLD_C, SPARKLINE_HOURS } from "../config";

/**
 * Room sensor card (Story 1.5, UX-DR4) — one room's Netatmo ambience.
 * Temperature is the glance value (large, tabular-nums); CO₂ + humidity are
 * secondary. Entity ids come from the central mapping (roomSensors — AD-7,
 * never hardcoded); live state is read via `useEntityValue` (AD-3/AD-6).
 *
 * Obsolescence (Story 1.6): when the temperature entity goes offline (socket
 * lost or entity unavailable), the card keeps the last-known value + a
 * "Hors ligne" pill + timestamp, with a dashed stale border — never blank.
 * Tap opens the room detail route.
 */
export function RoomSensorCard({ room }: { room: RoomId }) {
  const navigate = useNavigate();
  const sensors = roomSensors(room);
  const idFor = (m: Measure): EntityName =>
    (sensors.find((s) => s.measure === m)?.entityId ?? "unknown") as EntityName;

  // Called unconditionally, stable order (ids are static config).
  const temperature = useEntityValue(idFor("temperature"));
  const co2 = useEntityValue(idFor("co2"));
  const humidity = useEntityValue(idFor("humidity"));

  // 24h temperature history for the sparkline (compressed HA shape { s: state }).
  const { entityHistory } = useHistory(idFor("temperature"), {
    hoursToShow: SPARKLINE_HOURS,
  });
  const tempSeries = entityHistory
    .map((h) => Number(h.s))
    .filter((n) => Number.isFinite(n));

  // Three states, keyed off the primary sensor (temperature):
  //  loading = waiting for first data (skeleton) · offline = last value + pill
  //  (stale but known) · live = values + sparkline.
  const loading = temperature.loading;
  // Offline if ANY of the room's sensors is stale (not just temperature), so a
  // single failing measure still surfaces the offline cue (AD-6, per entity).
  const offline =
    !loading && (temperature.isStale || co2.isStale || humidity.isStale);

  return (
    <button
      type="button"
      onClick={() => navigate(`/room/${room}`)}
      className={[
        "flex cursor-pointer flex-col gap-1 rounded-md border bg-tile-fill px-4 py-3 text-left",
        // one border-color + one text-color per state — never stack conflicting
        // utilities (Story 1.2 cascade lesson). Only the offline state is dashed.
        offline
          ? "border-dashed border-stale text-stale-text"
          : "border-tile-border text-text",
      ].join(" ")}
    >
      {/* Fixed row heights so loading/offline/live occupy the SAME footprint —
          no tile-height jump when data arrives (CLS). */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-label font-semibold">{getRoom(room).label}</span>
        <FloorPill floor={getRoom(room).floor} />
      </div>

      <div className="flex h-8 items-center">
        {loading ? (
          <Skeleton className="h-6 w-24" />
        ) : (
          <span className="text-numeric-lg font-semibold tabular-nums">
            {formatSensorValue(temperature.value, 1)} {temperature.unit ?? "°C"}
          </span>
        )}
      </div>

      <div className="flex h-4 items-center">
        {loading ? (
          <Skeleton className="h-3 w-28" />
        ) : (
          <span className="flex w-full min-w-0 items-center gap-2 text-meta tabular-nums text-text-muted">
            {/* CO₂: leaf icon + value, air-quality colour only when live — a
                stale value stays muted (colour would mislead). */}
            <span
              className={`inline-flex items-center gap-1 ${
                offline ? "" : co2ColorClass(co2.value)
              }`}
            >
              <Co2Icon size={12} />
              {formatSensorValue(co2.value, 0)} ppm
            </span>
            <span className="inline-flex items-center gap-1">
              <DropletIcon size={12} />
              {formatSensorValue(humidity.value, 0)} %
            </span>
          </span>
        )}
      </div>

      <div className="mt-1 flex h-8 items-center">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : offline ? (
          <OfflinePill since={temperature.since} />
        ) : (
          <Sparkline values={tempSeries} threshold={TEMPERATURE_THRESHOLD_C} />
        )}
      </div>
    </button>
  );
}
