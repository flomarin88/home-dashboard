import { SectionCard } from '../ui/SectionCard'
import { RoomSensorCard } from '../widgets/RoomSensorCard'
import { LightTile } from '../widgets/LightTile'
import { VacuumTile } from '../widgets/VacuumTile'
import { listRooms, lights, vacuum } from '../entities'
import { isConfigured } from '../hakit'

/**
 * Home — the composed landscape kiosk zones (Story 1.3, UX-DR11 / AD-10).
 *
 * Content only: the ground + top bar are owned by `KioskShell` (App.tsx), which
 * mounts this ABOVE-provider chrome so a (re)connect never remounts the shell
 * (TD-1). The zones follow IA order — Scènes (prominent) · Ambiance · Éclairage
 * · Volets · Climatisation — empty titled cards until each feature lands.
 *
 * HA widgets (Ambiance sensors, Éclairage tiles) are rendered only when HA is
 * configured, i.e. under the provider; unconfigured, the zones still show,
 * never blank (AD-6/NFR4).
 */
export function Home() {
  const vacuumEntry = vacuum()
  return (
    <div className="flex flex-col gap-grid-gap">
      {/* Scènes — hero prominence (spine wins over the mock's bottom placement) */}
      <SectionCard title="Scènes" />

      <SectionCard title="Ambiance">
        {isConfigured ? (
          <div className="grid grid-cols-2 gap-tile-gap md:grid-cols-4">
            {listRooms().map((r) => (
              <RoomSensorCard key={r.id} room={r.id} />
            ))}
          </div>
        ) : (
          <p className="text-meta text-text-muted">Home Assistant non configuré.</p>
        )}
      </SectionCard>

      <div className="grid gap-grid-gap md:grid-cols-3">
        <SectionCard title="Éclairage">
          {isConfigured ? (
            <div className="grid grid-cols-2 gap-tile-gap">
              {lights().map((entry) => (
                <LightTile key={entry.entityId} entry={entry} />
              ))}
            </div>
          ) : null}
        </SectionCard>
        <SectionCard title="Volets" />
        <SectionCard title="Climatisation" />
      </div>

      {/* Aspirateur — the IA has no dedicated vacuum zone; a small section after
          the control row is the default placement (Story 2.7). */}
      {isConfigured && vacuumEntry ? (
        <SectionCard title="Aspirateur">
          <div className="grid grid-cols-2 gap-tile-gap md:grid-cols-4">
            <VacuumTile entry={vacuumEntry} />
          </div>
        </SectionCard>
      ) : null}
    </div>
  )
}
