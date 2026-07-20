import { useEntity } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import { RoomSensorCard } from "../widgets/RoomSensorCard";
import { VacuumTile } from "../widgets/VacuumTile";
import { ClimateTile } from "../widgets/ClimateTile";
import { parseTemp } from "../widgets/climate-status";
import {
  FLOOR_ORDER,
  FLOOR_LABEL,
  roomsOnFloor,
  vacuum,
  climate,
} from "../entities";
import { isConfigured } from "../hakit";
import { TEMPERATURE_THRESHOLD_C } from "../config";

/**
 * Home — the composed landscape kiosk tiles, grouped by floor (moule
 * "pièce d'abord, étage en en-tête léger").
 *
 * Content only: the ground + top bar are owned by `KioskShell` (App.tsx). Each
 * floor (`FLOOR_ORDER`, top → bottom = étage then RDC) gets a discreet heading,
 * then a single grid of its tiles on one row: the étage is [Climatisation,
 * Parents, Gaspard, Nathan] (4 columns), the RDC is [Salon, Aspirateur] (2
 * columns). Room cards are the tappable atom → room detail; the compact
 * ClimateTile and the VacuumTile sit as peers of the room cards (the vacuum is
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
  if (!isConfigured) {
    return (
      <p className="text-meta text-text-muted">Home Assistant non configuré.</p>
    );
  }
  return <HomeContent />;
}

/** Rendered only when configured (under the HA provider), so it may use hooks. */
function HomeContent() {
  const vacuumEntry = vacuum();
  const climateEntry = climate();
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
      {FLOOR_ORDER.map((floor) => (
        <section key={floor} className="flex flex-col gap-tile-gap">
          <h2 className="text-caption font-semibold uppercase tracking-wide text-text-muted">
            {FLOOR_LABEL[floor]}
          </h2>

          {/* One row per floor: étage = clim + 3 chambres (4 col), RDC = salon
              + aspirateur (2 col). Device tiles are peers of the room cards. */}
          <div
            className={`grid gap-tile-gap ${
              floor === "etage1" ? "grid-cols-4" : "grid-cols-2"
            }`}
          >
            {floor === "etage1" && climateEntry ? (
              <ClimateTile entry={climateEntry} />
            ) : null}

            {roomsOnFloor(floor).map((r) => (
              <RoomSensorCard
                key={r.id}
                room={r.id}
                refTemp={
                  floor === "etage1" ? setpoint : TEMPERATURE_THRESHOLD_C
                }
              />
            ))}

            {floor === "rdc" && vacuumEntry ? (
              <VacuumTile entry={vacuumEntry} />
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
