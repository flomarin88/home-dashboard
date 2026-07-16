import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { EntityEntry } from '../entities'
import { usePendingStore } from '../state/pending'
import { LightTile } from './LightTile'

const hass = vi.hoisted(() => ({
  state: 'off' as string,
  connectionStatus: 'connected' as string,
  turnOn: vi.fn(),
  turnOff: vi.fn(),
}))

vi.mock('@hakit/core', () => ({
  useEntity: () => ({
    state: hass.state,
    last_changed: '2026-07-15T14:00:00Z',
    attributes: {},
    service: { turnOn: hass.turnOn, turnOff: hass.turnOff },
  }),
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: hass.connectionStatus }),
}))

const ENTRY: EntityEntry = {
  entityId: 'light.salon',
  room: 'salon',
  domain: 'light',
  service: 'light.toggle',
}

describe('LightTile (Story 2.1 vertical slice)', () => {
  beforeEach(() => {
    usePendingStore.setState({ byId: {} })
    hass.state = 'off'
    hass.connectionStatus = 'connected'
    hass.turnOn.mockClear()
    hass.turnOff.mockClear()
  })

  it('shows off state, then flips optimistically to on and calls the HA service', () => {
    render(<LightTile entry={ENTRY} />)
    expect(screen.getByText('Éteint')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('Allumé')).toBeInTheDocument() // optimistic, pre-echo
    expect(hass.turnOn).toHaveBeenCalledOnce()
  })

  it('offline: renders a non-interactive "Hors ligne" tile (AD-6)', () => {
    hass.connectionStatus = 'disconnected'
    render(<LightTile entry={ENTRY} />)

    expect(screen.getByText(/hors ligne/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull() // cannot command an offline entity
    expect(hass.turnOn).not.toHaveBeenCalled()
  })
})
