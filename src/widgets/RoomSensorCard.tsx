import { useNavigate } from "react-router-dom";
import { useHistory } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import type { RoomId, Measure } from "../entities";
import { roomSensors, getRoom, roomBattery } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { formatSensorValue, co2ColorClass } from "./room-sensor-format";
import { DropletIcon, Co2Icon, NoiseIcon, RoomIcon } from "./WeatherIcon";
import TileTempChart from "./TileTempChart";
import { OfflinePill } from "../ui/OfflinePill";
import { BatteryPill } from "../ui/BatteryPill";
import { TileHeader } from "../ui/TileHeader";
import { Skeleton } from "../ui/Skeleton";
import { SPARKLINE_HOURS } from "../config";

/**
 * Room sensor card (Story 1.5, UX-DR4) — one room's Netatmo ambience.
 * Temperature is the glance value (large, tabular-nums); CO₂ + humidity are
 * secondary. Entity ids come from the central mapping (roomSensors — AD-7,
 * never hardcoded); live state is read via `useEntityValue` (AD-3/AD-6).
 *
 * Obsolescence (Story 1.6): when the temperature entity goes offline (socket
 * lost or entity unavailable), the card keeps the last-known value + a
 * "Hors ligne" pill + timestamp, with a dashed stale border — never blank.
 * Tap opens the room detail route. `refTemp` (the upstairs A/C setpoint, passed
 * by Home for the étage rooms) draws a red dashed reference line on the sparkline.
 */
export function RoomSensorCard({
  room,
  refTemp,
}: {
  room: RoomId;
  refTemp?: number | null;
}) {
  const navigate = useNavigate();
  const sensors = roomSensors(room);
  const idFor = (m: Measure): EntityName =>
    (sensors.find((s) => s.measure === m)?.entityId ?? "unknown") as EntityName;

  // Called unconditionally, stable order (ids are static config).
  const temperature = useEntityValue(idFor("temperature"));
  const co2 = useEntityValue(idFor("co2"));
  const humidity = useEntityValue(idFor("humidity"));
  const noise = useEntityValue(idFor("noise"));
  // Only the Salon has a sonomètre; other rooms omit the dB reading.
  const hasNoise = sensors.some((s) => s.measure === "noise");

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
      <TileHeader
        icon={<RoomIcon kind={getRoom(room).kind} size={18} />}
        title={getRoom(room).label}
        right={<BatteryPill entityId={roomBattery(room)} />}
      />

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
            {hasNoise ? (
              <span className="inline-flex items-center gap-1">
                <NoiseIcon size={12} />
                {formatSensorValue(noise.value, 0)} {noise.unit ?? "dB"}
              </span>
            ) : null}
          </span>
        )}
      </div>

      {/* Grows to fill the rest of the card — the room cards stretch to the
          row height (set by the taller Climatisation / Aspirateur tiles). */}
      <div className="mt-1 min-h-[2rem] flex-1">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : offline ? (
          <div className="flex h-full items-center">
            <OfflinePill since={temperature.since} />
          </div>
        ) : (
          <TileTempChart values={tempSeries} refTemp={refTemp} />
        )}
      </div>
    </button>
  );
}
