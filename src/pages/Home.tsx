import { SectionCard } from '../ui/SectionCard'
import { Clock } from '../ui/Clock'
import { RoomSensorCard } from '../widgets/RoomSensorCard'
import { listRooms } from '../entities'
import { isConfigured } from '../hakit'

/**
 * Home — the composed landscape kiosk shell (Story 1.3, UX-DR11 / AD-10).
 *
 * A single non-scrolling screen on the Glass Gradient ground: a top bar
 * (clock · alarm · Cameras entry) then the zones in IA order — Scènes
 * (prominent) · Ambiance · Éclairage · Volets · Climatisation. Ambiance is
 * live (Story 1.5); the other zones stay empty titled cards until their
 * feature stories fill them.
 *
 * This is pure, provider-independent chrome: it renders with no HA connection,
 * so a disconnected/unavailable HA can never blank the kiosk (AD-6 / NFR4).
 * Alarm + Cameras are inert placeholders here (features: Epic 4).
 */
export function Home() {
  return (
    <main className="bg-ground flex min-h-svh w-full flex-col gap-grid-gap p-6 text-text">
      <TopBar />

      {/* Scènes — hero prominence (spine wins over the mock's bottom placement) */}
      <SectionCard title="Scènes" />

      {/* Ambiance — 4 room sensor cards (live). The cards use useEntity, so they
          only render when HA is configured (i.e. under HakitProvider); otherwise
          the shell still shows, never blank (AD-6/NFR4). */}
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
        <SectionCard title="Éclairage" />
        <SectionCard title="Volets" />
        <SectionCard title="Climatisation" />
      </div>
    </main>
  )
}

function TopBar() {
  return (
    <header className="flex items-center justify-between gap-4">
      <Clock />
      <div className="flex items-center gap-3">
        {/* Alarm placeholder — state carried by TEXT + ICON, not colour (UX-DR14) */}
        <button
          type="button"
          disabled
          aria-label="Alarme — bientôt disponible"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-card-border bg-card-fill px-4 text-label font-semibold text-text opacity-60"
        >
          <LockOpenIcon />
          <span>Désarmé</span>
        </button>
        {/* Cameras entry — inert until the Cameras page (Story 4.2) */}
        <button
          type="button"
          disabled
          aria-label="Caméras — bientôt disponible"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-card-border bg-card-fill px-4 text-label font-semibold text-text opacity-60"
        >
          <span>Caméras</span>
          <ChevronRightIcon />
        </button>
      </div>
    </header>
  )
}

function LockOpenIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}
