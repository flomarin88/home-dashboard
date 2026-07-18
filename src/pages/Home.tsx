import { RoomSensorCard } from "../widgets/RoomSensorCard";
import { LightTile } from "../widgets/LightTile";
import { VacuumTile } from "../widgets/VacuumTile";
import { ClimateTile } from "../widgets/ClimateTile";
import { listRooms, lights, vacuum, climate } from "../entities";
import { isConfigured } from "../hakit";

/**
 * Home — the composed landscape kiosk tiles (Story 1.3, UX-DR11 / AD-10).
 *
 * Content only: the ground + top bar are owned by `KioskShell` (App.tsx). Tiles
 * only — no titled section chrome — in IA order: Ambiance, then a two-column
 * lower band: left = Éclairage + Aspirateur (Volets to come); right = the wide
 * Climatisation card (UX redesign gives it ~55% so the setpoint, icon'd modes
 * and segmented Vitesse/Oscillation breathe). Fits the 1024×768 kiosk with no
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
      {/* Ambiance — 4 room sensor tiles */}
      <div className="grid grid-cols-2 gap-tile-gap md:grid-cols-4">
        {listRooms().map((r) => (
          <RoomSensorCard key={r.id} room={r.id} />
        ))}
      </div>

      {/* Lower band: left column (éclairage + aspirateur) | wide climate card */}
      <div className="grid gap-grid-gap md:grid-cols-[1fr_1.3fr]">
        <div className="flex flex-col gap-grid-gap">
          <div className="grid grid-cols-2 gap-tile-gap">
            {lights().map((entry) => (
              <LightTile key={entry.entityId} entry={entry} />
            ))}
          </div>
          {vacuumEntry ? <VacuumTile entry={vacuumEntry} /> : null}
        </div>
        {climateEntry ? <ClimateTile entry={climateEntry} /> : <div />}
      </div>
    </div>
  );
}
