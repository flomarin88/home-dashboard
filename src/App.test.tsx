import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'

describe('App / KioskShell (TD-1: chrome above the connection gate)', () => {
  it('renders the persistent chrome and the zones together (unconfigured, no provider)', () => {
    render(<App />)
    // Chrome (TopBar) lives above the provider → always present.
    expect(screen.getByText(/désarmé/i)).toBeInTheDocument()
    // Zones (Home) render within the same shell.
    const headings = screen
      .getAllByRole('heading')
      .map((h) => h.textContent?.trim().toLowerCase() ?? '')
    expect(headings).toContain('scènes')
  })
})
