import { StyleGuide } from './ui/StyleGuide'

/**
 * App root. Story 1.2 renders the throwaway design-system styleguide — a pure
 * presentational surface, so it deliberately does NOT mount the HA connection
 * seam (HakitProvider would gate rendering behind HA auth). The real kiosk
 * shell reassembles the seam + pages in Story 1.3.
 *
 * The Story 1.1 connection view still lives in src/ConnectionCheck.tsx (proven,
 * throwaway) and is superseded here.
 */
function App() {
  return <StyleGuide />
}

export default App
