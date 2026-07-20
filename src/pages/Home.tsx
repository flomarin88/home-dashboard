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
 * then its room cards (`roomsOnFloor`) — the tappable atom that opens the room
 * detail. Devices sit under their floor: Climatisation heads the étage, the
 * Aspirateur closes the RDC (kept as a tile so `/aspirateur` stays reachable).
 * The placeholder Salon light is not shown yet — it returns later as a status
 * glyph inside the Salon card (backfill).
 *
 * Reverses the earlier "tiles only — no titled section chrome" decision
 * (UX-DR11 / AD-10) on purpose — see TD-8. Targets the 1024×768 kiosk with no
 * scroll (memory: target-device-and-layout); the still-full Climatisation card
 * is the tight spot until it is reduced to a compact temperature tile with its
 * own detail page (Intent B). HA widgets render only under the provider;
 * unconfigured, the shell still shows (AD-6/NFR4).
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

          {floor === "etage1" && climateEntry ? (
            <ClimateTile entry={climateEntry} />
          ) : null}

          <div className="grid grid-cols-3 gap-tile-gap">
            {roomsOnFloor(floor).map((r) => (
              <RoomSensorCard key={r.id} room={r.id} />
            ))}
          </div>

          {floor === "rdc" && vacuumEntry ? (
            <VacuumTile entry={vacuumEntry} />
          ) : null}
        </section>
      ))}
    </div>
  );
}
