import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HakitProvider, isConfigured } from './hakit'
import { TopBar } from './ui/TopBar'
import { UndoToast } from './ui/UndoToast'
import { SectionCard } from './ui/SectionCard'
import { Skeleton } from './ui/Skeleton'
import { Home } from './pages/Home'
import { RoomDetail } from './pages/RoomDetail'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<RoomDetail />} />
    </Routes>
  )
}

/**
 * Shown by `HakitProvider` while HA is connecting (data zones only). It mirrors
 * the home layout with skeletons so connecting→connected has no layout jump, and
 * — being outside the provider — uses no HA hooks. Never blank (NFR4/AD-6).
 */
function ConnectingZones() {
  return (
    <div className="flex flex-col gap-grid-gap">
      <SectionCard title="Scènes" />
      <SectionCard title="Ambiance">
        <div className="grid grid-cols-2 gap-tile-gap md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-tile-h w-full rounded-md" />
          ))}
        </div>
      </SectionCard>
      <div className="grid gap-grid-gap md:grid-cols-3">
        <SectionCard title="Éclairage" />
        <SectionCard title="Volets" />
        <SectionCard title="Climatisation" />
      </div>
    </div>
  )
}

/**
 * KioskShell — the persistent kiosk chrome. The ground + `TopBar` (which runs
 * the Clock interval) live ABOVE the HA connection gate; only the data zones
 * (`children`) sit inside `HakitProvider`.
 *
 * Why (TD-1 fix): `HassConnect` renders its `loading` fallback until
 * authenticated and swaps back to it on every disconnect, remounting its
 * children — which used to reset the Clock and any component state. Keeping the
 * chrome outside the gate means a (re)connect only remounts the data zones (they
 * already degrade gracefully via `useEntityValue`), never the shell or Clock.
 *
 * Not configured (no HA URL) → render the zones with NO provider (Home gates its
 * HA widgets off internally); the shell still shows, never blank (AD-6/NFR4).
 */
function KioskShell() {
  return (
    <main className="bg-ground flex min-h-svh w-full flex-col gap-grid-gap p-6 text-text">
      <TopBar />
      {isConfigured ? (
        <HakitProvider loading={<ConnectingZones />}>
          <AppRoutes />
        </HakitProvider>
      ) : (
        <AppRoutes />
      )}

      {/* Undo safety-net toast (NFR6) — chrome, above the connection gate so it
          persists across (re)connect; the undo closure (built under the provider)
          is what reaches HA. */}
      <UndoToast />
    </main>
  )
}

// Serve-path aware: matches Vite's base so routes work under a subpath deploy
// (e.g. /local/home-dashboard/) as well as at root.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

function App() {
  return (
    <BrowserRouter basename={basename}>
      <KioskShell />
    </BrowserRouter>
  )
}

export default App
