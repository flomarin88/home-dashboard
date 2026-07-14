import { HakitProvider, isConfigured } from './hakit'
import { Home } from './pages/Home'

/**
 * App root (Story 1.3). The kiosk shell must ALWAYS render — never a login
 * screen, never blank, even when HA is unconfigured, connecting, or down
 * (AD-6 / NFR4):
 *
 *  - Not configured (no HA URL) → render the shell directly, no HassConnect
 *    (HassConnect would otherwise show its "provide hassUrl" error).
 *  - Configured → mount the connection seam, but pass the shell as the
 *    `loading` fallback so it stays visible while connecting/reconnecting.
 *    Data-bound widgets (later stories) live inside the zones and handle their
 *    own per-entity stale state.
 */
function App() {
  if (!isConfigured) {
    return <Home />
  }
  return (
    <HakitProvider loading={<Home />}>
      <Home />
    </HakitProvider>
  )
}

export default App
