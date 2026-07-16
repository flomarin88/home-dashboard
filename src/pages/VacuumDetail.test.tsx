import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vacuum, vacuumDetail } from '../entities'
import { usePendingStore } from '../state/pending'
import { VacuumDetailContent } from './VacuumDetail'

const hass = vi.hoisted(() => ({
  vacuumState: 'docked' as string,
  connectionStatus: 'connected' as string,
  stop: vi.fn(),
  returnToBase: vi.fn(),
  press: vi.fn(),
}))

vi.mock('@hakit/core', () => ({
  useEntity: (id: string) => {
    if (id.includes('map'))
      return { attributes: { entity_picture: '/api/image_proxy/map?token=REDACTED' } }
    if (id.includes('batterie')) return { state: '100', attributes: {} }
    if (id.includes('en_charge')) return { state: 'on', attributes: {} }
    if (id.includes('capteurs')) return { state: '-216049', attributes: {} } // overdue
    if (id.includes('temps_restant')) return { state: '665461', attributes: {} } // ~8 j
    if (id.includes('erreur')) return { state: 'None', attributes: {} }
    if (id.startsWith('binary_sensor')) return { state: 'off', attributes: {} }
    if (id.includes('surface'))
      return { state: '0.0', attributes: { unit_of_measurement: 'm²' } }
    if (id.includes('piece')) return { state: 'Salon', attributes: {} }
    if (id.includes('duree')) return { state: '3', attributes: { unit_of_measurement: 's' } }
    return {
      state: hass.vacuumState,
      attributes: {},
      service: { stop: hass.stop, returnToBase: hass.returnToBase },
    }
  },
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: hass.connectionStatus }),
  useService: () => ({ press: hass.press }),
}))

const entry = () => vacuum()!
const detail = () => vacuumDetail()!

const renderPage = () =>
  render(
    <MemoryRouter>
      <VacuumDetailContent entry={entry()} detail={detail()} />
    </MemoryRouter>,
  )

describe('VacuumDetail (Story 5.3)', () => {
  beforeEach(() => {
    usePendingStore.setState({ byId: {} })
    hass.vacuumState = 'docked'
    hass.connectionStatus = 'connected'
    hass.press.mockClear()
  })

  it('renders the curated content as tiles (no section headings)', () => {
    renderPage()
    // Programs + controls + a self-labelled sensor row are present…
    expect(screen.getByRole('button', { name: 'Quotidien' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /arrêter/i })).toBeInTheDocument()
    expect(screen.getByText('Filtre')).toBeInTheDocument()
    // …and there are no titled sections anymore.
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('renders the map from the live entity_picture', () => {
    renderPage()
    const img = screen.getByRole('img', { name: /carte/i })
    expect(img.getAttribute('src')).toContain('/api/image_proxy/map')
  })

  it('launches a program via its button and shows optimistic "En ménage"', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Quotidien' }))
    expect(hass.press).toHaveBeenCalledWith({
      target: 'button.salon_roborock_s8_quotidien',
    })
    expect(screen.getByText(/en ménage/i)).toBeInTheDocument()
  })

  it('shows "À remplacer" for an overdue consumable and days for a healthy one', () => {
    renderPage()
    expect(screen.getByText('À remplacer')).toBeInTheDocument() // capteurs (negative)
    expect(screen.getAllByText('8 j').length).toBeGreaterThan(0) // filtre/brosses (~8j)
  })

  it('formats a binary alert as Oui/Non', () => {
    renderPage()
    // Pénurie d'eau = binary_sensor off → "Non"
    const rows = screen.getAllByText('Non')
    expect(rows.length).toBeGreaterThan(0)
  })

  it('has a back link to the home', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /accueil/i })).toBeInTheDocument()
  })
})
