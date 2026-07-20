import { RoomSensorCard } from "../widgets/RoomSensorCard";
import { VacuumTile } from "../widgets/VacuumTile";
import { ClimateTile } from "../widgets/ClimateTile";
import {
  FLOOR_ORDER,
  FLOOR_LABEL,
  roomsOnFloor,
  vacuum,
  climate,
} from "../entities";
import { isConfigured } from "../hakit";

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
 * kept on the home so `/aspirateur` stays reachable). The placeholder Salon
 * light is not shown yet — it returns later as a status glyph inside the Salon
 * card (backfill).
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

  const vacuumEntry = vacuum();
  const climateEntry = climate();
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
              <RoomSensorCard key={r.id} room={r.id} />
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
