import { RoomSensorCard } from "../widgets/RoomSensorCard";
import { LightTile } from "../widgets/LightTile";
import { VacuumTile } from "../widgets/VacuumTile";
import { listRooms, lights, vacuum } from "../entities";
import { isConfigured } from "../hakit";

/**
 * Home — the composed landscape kiosk tiles (Story 1.3, UX-DR11 / AD-10).
 *
 * Content only: the ground + top bar are owned by `KioskShell` (App.tsx). Tiles
 * only — no titled section chrome — in IA order: Ambiance · Éclairage (Volets /
 * Climatisation to come) · Aspirateur. Fits the 1024×768 kiosk with no scroll
 * (memory: target-device-and-layout). HA widgets render only under the provider;
 * unconfigured, the shell still shows (AD-6/NFR4).
 */
export function Home() {
  if (!isConfigured) {
    return (
      <p className="text-meta text-text-muted">Home Assistant non configuré.</p>
    );
  }

  const vacuumEntry = vacuum();
  return (
    <div className="flex flex-col gap-grid-gap">
      {/* Ambiance — 4 room sensor tiles */}
      <div className="grid grid-cols-2 gap-tile-gap md:grid-cols-4">
        {listRooms().map((r) => (
          <RoomSensorCard key={r.id} room={r.id} />
        ))}
      </div>

      {/* Éclairage · Volets · Climatisation — tiles in their columns (volets/clim
          to come; empty columns hold Éclairage's position) */}
      <div className="grid gap-grid-gap md:grid-cols-3">
        <div className="grid grid-cols-2 gap-tile-gap">
          {lights().map((entry) => (
            <LightTile key={entry.entityId} entry={entry} />
          ))}
        </div>
        <div />
        <div />
      </div>

      {/* Aspirateur */}
      {vacuumEntry ? (
        <div className="grid grid-cols-2 gap-tile-gap md:grid-cols-4">
          <VacuumTile entry={vacuumEntry} />
        </div>
      ) : null}
    </div>
  );
}
