import { HakitProvider } from './hakit'
import { ConnectionCheck } from './ConnectionCheck'

/**
 * App root. Everything renders inside the single HA connection seam
 * (HakitProvider, AD-2). Story 1.1 renders only the throwaway connection
 * control view; the real kiosk shell and pages arrive in later stories.
 */
function App() {
  return (
    <HakitProvider>
      <ConnectionCheck />
    </HakitProvider>
  )
}

export default App
