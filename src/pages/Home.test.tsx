import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Home } from './Home'

describe('Home', () => {
  it('renders standalone without a provider (unconfigured → not blank, AD-6/NFR4)', () => {
    // No HakitProvider: unconfigured in the test env, so Home shows its fallback
    // instead of calling @hakit — the shell can never blank.
    render(<Home />)
    expect(screen.getByText(/non configuré/i)).toBeInTheDocument()
  })
})
