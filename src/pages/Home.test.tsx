import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Home } from './Home'

describe('Home zones', () => {
  it('renders the zone sections in IA order (UX-DR11)', () => {
    render(<Home />)
    const zoneNames = ['scènes', 'ambiance', 'éclairage', 'volets', 'climatisation']
    const headings = screen
      .getAllByRole('heading')
      .map((h) => h.textContent?.trim().toLowerCase() ?? '')
      .filter((t) => zoneNames.includes(t))
    expect(headings).toEqual(zoneNames)
  })

  it('renders standalone without any HA provider (non-blocking, AD-6/NFR4)', () => {
    // Unconfigured in the test env → HA zones show their fallback instead of
    // calling @hakit, so the zones can render with no provider and never blank.
    render(<Home />)
    expect(screen.getByText(/non configuré/i)).toBeInTheDocument()
  })
})
