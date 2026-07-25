import type { ReactNode } from "react";
import { useEntity } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import { RoomSensorCard } from "../widgets/RoomSensorCard";
import { VacuumTile } from "../widgets/VacuumTile";
import { ClimateTile } from "../widgets/ClimateTile";
import { LightTile } from "../widgets/LightTile";
import { CoursesTile } from "../widgets/CoursesTile";
import { parseTemp } from "../widgets/climate-status";
import {
  FLOOR_ORDER,
  FLOOR_LABEL,
  roomsOnFloor,
  getRoom,
  lights,
  vacuum,
  climate,
} from "../entities";
import { isConfigured } from "../hakit";
import { CommitTag } from "../ui/CommitTag";
import { TEMPERATURE_THRESHOLD_C } from "../config";
import { GRID_COLS } from "./home-grid";

/**
 * Home — the composed landscape kiosk tiles, grouped by floor (moule
 * "pièce d'abord, étage en en-tête léger").
 *
 * Content only: the ground + top bar are owned by `KioskShell` (App.tsx). Each
 * floor (`FLOOR_ORDER`, top → bottom = étage then RDC) gets a discreet heading,
 * then a single grid of its tiles on ONE row: the étage is [Climatisation,
 * Parents, Gaspard, Nathan], the RDC is [Salon, Aspirateur, Courses, Bureau].
 * Room cards are the tappable atom → room detail; the compact ClimateTile, the
 * VacuumTile and the LightTile sit as peers of the room cards (the vacuum is
 * kept on the home so `/aspirateur` stays reachable). The room sparklines carry a
 * red dashed reference line: the A/C setpoint for the étage rooms, a static 26 °C
 * for the RDC (Salon, which has no A/C).
 *
 * Reverses the earlier "tiles only — no titled section chrome" decision
 * (UX-DR11 / AD-10) on purpose — see TD-8. Fits the 1024×768 kiosk with no
 * scroll (memory: target-device-and-layout). HA widgets render only under the
 * provider; unconfigured, the shell still shows (AD-6/NFR4).
 */
export function Home() {
  // CommitTag is a fixed, non-interactive build stamp — rendered in both states
  // so the deployed version is always glanceable on the home page.
  return (
    <>
      {isConfigured ? <HomeContent /> : <UnconfiguredFallback />}
      <CommitTag />
    </>
  );
}

/**
 * Shown when HA is unconfigured. NutriClaude is an isolated seam (AD-12): the
 * Courses tile has no HA dependency, so it stays visible even when HA is
 * unconfigured — otherwise its "degraded, never blank" contract (AC2/AC7) would
 * be unobservable whenever HA is down.
 */
function UnconfiguredFallback() {
  return (
    <div className="flex flex-col gap-grid-gap">
      <p className="text-meta text-text-muted">Home Assistant non configuré.</p>
      <div className="grid grid-cols-3 gap-tile-gap">
        <CoursesTile />
      </div>
    </div>
  );
}

/** Rendered only when configured (under the HA provider), so it may use hooks. */
function HomeContent() {
  const vacuumEntry = vacuum();
  const climateEntry = climate();
  const lightEntries = lights();
  // The upstairs A/C setpoint — the étage rooms' reference line (the RDC uses a
  // static 26 °C instead, below).
  const climateEntity = useEntity(
    (climateEntry?.entityId ?? "unknown") as EntityName,
    { returnNullIfNotFound: true },
  );
  const setpoint = parseTemp(
    (climateEntity?.attributes as { temperature?: number | string } | undefined)
      ?.temperature,
  );

  return (
    <div className="flex flex-col gap-grid-gap">
      {FLOOR_ORDER.map((floor) => {
        // The floor's tiles, assembled as a LIST first: the grid then derives its
        // column count from it (GRID_COLS), so a tile can never be added without
        // the row widening to hold it. Device tiles are peers of the room cards.
        const tiles: ReactNode[] = [];

        if (floor === "etage1" && climateEntry) {
          tiles.push(<ClimateTile key="climate" entry={climateEntry} />);
        }

        for (const r of roomsOnFloor(floor)) {
          tiles.push(
            <RoomSensorCard
              key={r.id}
              room={r.id}
              refTemp={floor === "etage1" ? setpoint : TEMPERATURE_THRESHOLD_C}
            />,
          );
        }

        if (floor === "rdc" && vacuumEntry) {
          tiles.push(<VacuumTile key="vacuum" entry={vacuumEntry} />);
        }

        // Courses (v2) — coordination tile, grouped with the Ambiance room cards
        // (UX-DR19). NutriClaude is an isolated seam (AD-12); the tile only
        // shares the layout, not HA state.
        if (floor === "rdc") {
          tiles.push(<CoursesTile key="courses" />);
        }

        for (const l of lightEntries) {
          if (getRoom(l.room).floor === floor) {
            tiles.push(<LightTile key={l.entityId} entry={l} />);
          }
        }

        return (
          <section key={floor} className="flex flex-col gap-tile-gap">
            <h2 className="text-caption font-semibold uppercase tracking-wide text-text-muted">
              {FLOOR_LABEL[floor]}
            </h2>

            <div
              className={`grid gap-tile-gap ${GRID_COLS[tiles.length] ?? "grid-cols-6"}`}
            >
              {tiles}
            </div>
          </section>
        );
      })}
    </div>
  );
}
