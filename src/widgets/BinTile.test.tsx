import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BinTile } from './BinTile'

const hass = vi.hoisted(() => ({
  state: 'jaune' as string,
  connectionStatus: 'connected' as string,
  setDatetime: vi.fn(),
}))

vi.mock('@hakit/core', () => ({
  useEntity: () => ({
    state: hass.state,
    last_changed: '2026-07-16T18:00:00Z',
    attributes: {},
  }),
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: hass.connectionStatus }),
  useService: () => ({ setDatetime: hass.setDatetime }),
}))

describe('BinTile (Story 6.1 — top-bar indicator)', () => {
  beforeEach(() => {
    hass.state = 'jaune'
    hass.connectionStatus = 'connected'
    hass.setDatetime.mockClear()
  })

  it('active window (jaune) → shown + marks sortie by writing the input_datetime, then hides', () => {
    render(<BinTile />)
    const btn = screen.getByRole('button', { name: /jaune.*sortie/i })

    fireEvent.click(btn)

    expect(hass.setDatetime).toHaveBeenCalledWith({
      target: 'input_datetime.poubelle_jaune_sortie',
      serviceData: { datetime: expect.any(String) },
    })
    // optimistic: once marked, the indicator disappears
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('oubli → still shown + tappable (late sortie) on the right bin', () => {
    hass.state = 'oubli_noire'
    render(<BinTile />)
    fireEvent.click(screen.getByRole('button', { name: /oubli/i }))
    expect(hass.setDatetime).toHaveBeenCalledWith({
      target: 'input_datetime.poubelle_noire_sortie',
      serviceData: { datetime: expect.any(String) },
    })
  })

  it('aucune → renders nothing (no top-bar clutter)', () => {
    hass.state = 'aucune'
    const { container } = render(<BinTile />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offline → renders nothing', () => {
    hass.connectionStatus = 'disconnected'
    const { container } = render(<BinTile />)
    expect(container).toBeEmptyDOMElement()
  })
})
