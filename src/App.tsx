import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HakitProvider, isConfigured } from './hakit'
import { Home } from './pages/Home'
import { RoomDetail } from './pages/RoomDetail'

/**
 * App root (Story 1.5). Routing (AD-10): Home + a room-detail stub. The kiosk
 * shell must always render — never a login screen or blank (AD-6 / NFR4):
 *
 *  - Not configured (no HA URL) → render the routes with NO HassConnect (the
 *    provider would show its "provide hassUrl" error). The Ambiance cards, which
 *    need HA, are gated off in Home when unconfigured.
 *  - Configured → mount the connection seam with the shell as the `loading`
 *    fallback so it stays visible while connecting; the sensor widgets inside
 *    read live state and degrade to "—" until ready.
 */
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/room/:roomId" element={<RoomDetail />} />
    </Routes>
  )
}

// Serve-path aware: matches Vite's base so routes work under a subpath deploy
// (e.g. /local/home-dashboard/) as well as at root.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

function App() {
  return (
    <BrowserRouter basename={basename}>
      {isConfigured ? (
        <HakitProvider loading={<Home />}>
          <AppRoutes />
        </HakitProvider>
      ) : (
        <AppRoutes />
      )}
    </BrowserRouter>
  )
}

export default App
