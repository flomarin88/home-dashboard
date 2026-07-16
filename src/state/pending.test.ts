import { describe, it, expect, beforeEach } from 'vitest'
import { usePendingStore } from './pending'

const reset = () => usePendingStore.setState({ byId: {} })

describe('pending store (AD-11)', () => {
  beforeEach(reset)

  it('records an intent keyed by entity_id, bounded by an expiry', () => {
    usePendingStore.getState().setPending('light.salon', 'on', 5000, 1000)
    expect(usePendingStore.getState().byId['light.salon']).toEqual({
      target: 'on',
      sentAt: 1000,
      expiresAt: 6000,
    })
  })

  it('last-command-wins: a second intent overwrites the first (one in flight)', () => {
    const { setPending } = usePendingStore.getState()
    setPending('light.salon', 'on', 5000, 1000)
    setPending('light.salon', 'off', 5000, 2000)
    expect(usePendingStore.getState().byId['light.salon']).toEqual({
      target: 'off',
      sentAt: 2000,
      expiresAt: 7000,
    })
    expect(Object.keys(usePendingStore.getState().byId)).toHaveLength(1)
  })

  it('keeps one entry per entity — distinct entities coexist', () => {
    const { setPending } = usePendingStore.getState()
    setPending('light.salon', 'on', 5000, 1000)
    setPending('cover.chambre', 'open', 30000, 1000)
    expect(Object.keys(usePendingStore.getState().byId).sort()).toEqual([
      'cover.chambre',
      'light.salon',
    ])
  })

  it('clearPending resolves/drops the intent', () => {
    const { setPending, clearPending } = usePendingStore.getState()
    setPending('light.salon', 'on', 5000, 1000)
    clearPending('light.salon')
    expect(usePendingStore.getState().byId['light.salon']).toBeUndefined()
  })

  it('clearPending on an unknown entity is a no-op (stable reference)', () => {
    const before = usePendingStore.getState().byId
    usePendingStore.getState().clearPending('light.unknown')
    expect(usePendingStore.getState().byId).toBe(before)
  })

  it('an entry whose expiresAt is passed is expired (reader compares now)', () => {
    usePendingStore.getState().setPending('light.salon', 'on', 5000, 1000)
    const entry = usePendingStore.getState().byId['light.salon']
    expect(8000 > entry.expiresAt).toBe(true)
  })
})
