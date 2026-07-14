import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Home } from './Home'

describe('Home shell', () => {
  it('renders the zone sections in IA order (UX-DR11)', () => {
    render(<Home />)
    const zoneNames = ['scènes', 'ambiance', 'éclairage', 'volets', 'climatisation']
    const headings = screen
      .getAllByRole('heading')
      .map((h) => h.textContent?.trim().toLowerCase() ?? '')
      .filter((t) => zoneNames.includes(t))
    expect(headings).toEqual(zoneNames)
  })

  it('renders standalone without any HA provider (non-blocking shell, AD-6/NFR4)', () => {
    // Deliberately NO HakitProvider: the shell chrome must render on its own,
    // so a disconnected/unavailable HA can never blank the kiosk.
    render(<Home />)
    expect(screen.getByText(/désarm/i)).toBeInTheDocument() // alarm placeholder (text, not colour)
    expect(screen.getByText(/caméras/i)).toBeInTheDocument() // cameras entry
  })
})
