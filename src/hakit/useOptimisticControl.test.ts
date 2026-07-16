import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { EntityName } from '@hakit/core'
import { usePendingStore } from '../state/pending'
import { lightModel } from '../state/control-model'
import type { ControlModel } from '../state/control-model'
import { useOptimisticControl } from './useOptimisticControl'

// Mutable HA mock (vi.hoisted so the mock factory can read it).
const hass = vi.hoisted(() => ({
  state: 'off' as string,
  connectionStatus: 'connected' as string,
  turnOn: vi.fn(),
  turnOff: vi.fn(),
}))

vi.mock('@hakit/core', () => ({
  useEntity: () => ({
    state: hass.state,
    service: { turnOn: hass.turnOn, turnOff: hass.turnOff },
  }),
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: hass.connectionStatus }),
}))

const ID = 'light.salon' as EntityName

describe('useOptimisticControl (AD-5 / AD-11)', () => {
  beforeEach(() => {
    usePendingStore.setState({ byId: {} })
    hass.state = 'off'
    hass.connectionStatus = 'connected'
    hass.turnOn.mockClear()
    hass.turnOff.mockClear()
  })

  it('applies the optimistic target immediately and calls the HA service (<200ms, no await)', () => {
    const { result } = renderHook(() => useOptimisticControl(ID, lightModel))
    expect(result.current.displayState).toBe('off')

    act(() => result.current.send('on'))

    expect(result.current.isPending).toBe(true)
    expect(result.current.displayState).toBe('on') // optimistic, before HA echo
    expect(hass.turnOn).toHaveBeenCalledOnce()
  })

  it('converges: resolves the intent when HA echoes the target', () => {
    const { result, rerender } = renderHook(() =>
      useOptimisticControl(ID, lightModel),
    )
    act(() => result.current.send('on'))
    expect(result.current.isPending).toBe(true)

    act(() => {
      hass.state = 'on'
      rerender()
    })

    expect(result.current.isPending).toBe(false)
    expect(result.current.displayState).toBe('on')
    expect(result.current.failed).toBe(false)
  })

  it('times out: no convergence by the deadline → failed + revert to confirmed', () => {
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() => useOptimisticControl(ID, lightModel))
      act(() => result.current.send('on'))
      expect(result.current.displayState).toBe('on')

      act(() => {
        vi.advanceTimersByTime(lightModel.timeoutMs + 10)
      })

      expect(result.current.isPending).toBe(false)
      expect(result.current.failed).toBe(true)
      expect(result.current.displayState).toBe('off') // reverted to confirmed
    } finally {
      vi.useRealTimers()
    }
  })

  it('retires a stale "failed" once the entity later reaches the target (no converged-but-failed)', () => {
    vi.useFakeTimers()
    try {
      const { result, rerender } = renderHook(() =>
        useOptimisticControl(ID, lightModel),
      )
      act(() => result.current.send('on'))
      act(() => {
        vi.advanceTimersByTime(lightModel.timeoutMs + 10) // times out
      })
      expect(result.current.failed).toBe(true)

      // HA finally reports the light DID turn on (late echo / another actor).
      act(() => {
        hass.state = 'on'
        rerender()
      })

      expect(result.current.failed).toBe(false) // no lit-tile-labelled-Échec
      expect(result.current.displayState).toBe('on')
    } finally {
      vi.useRealTimers()
    }
  })

  it('rapid opposing sends settle to the last target with no stuck intent', () => {
    // confirmed state is 'off'. send('on') → pending 'on'; the follow-up
    // send('off') already matches confirmed → converges at once. Each send still
    // issues its HA service (AD-4); nothing is left stuck pending.
    const { result } = renderHook(() => useOptimisticControl(ID, lightModel))
    act(() => {
      result.current.send('on')
      result.current.send('off')
    })
    expect(result.current.displayState).toBe('off')
    expect(result.current.isPending).toBe(false)
    expect(Object.keys(usePendingStore.getState().byId)).toHaveLength(0)
    expect(hass.turnOn).toHaveBeenCalledOnce()
    expect(hass.turnOff).toHaveBeenCalledOnce()
  })

  it('offline precedence (AD-6): send is a no-op on a stale entity', () => {
    hass.connectionStatus = 'disconnected'
    const { result } = renderHook(() => useOptimisticControl(ID, lightModel))
    expect(result.current.isStale).toBe(true)

    act(() => result.current.send('on'))

    expect(hass.turnOn).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(false)
    expect(Object.keys(usePendingStore.getState().byId)).toHaveLength(0)
  })

  it('drops its own in-flight intent on unmount (no orphan in the store)', () => {
    const { result, unmount } = renderHook(() =>
      useOptimisticControl(ID, lightModel),
    )
    act(() => result.current.send('on'))
    expect(usePendingStore.getState().byId[ID]).toBeDefined()

    unmount()

    expect(usePendingStore.getState().byId[ID]).toBeUndefined()
  })

  it('AD-5: a legitimately transitional state at the deadline is NOT a failure', () => {
    // A cover-like model with a transitional state. The device is stuck
    // "opening" past the timeout — that is in-progress, not a failure.
    const coverModel: ControlModel<'cover', 'open' | 'closed'> = {
      domain: 'cover',
      timeoutMs: 1000,
      isConverged: (t, s) => s === t,
      isTransitional: (s) => s === 'opening' || s === 'closing',
      apply: () => {},
    }
    const COVER = 'cover.chambre' as EntityName
    hass.state = 'opening'
    vi.useFakeTimers()
    try {
      const { result } = renderHook(() =>
        useOptimisticControl(COVER, coverModel),
      )
      act(() => result.current.send('open'))
      expect(result.current.isPending).toBe(true)
      expect(result.current.isTransitional).toBe(true)
      // display shows the real transitional state, not the target (AD-5)
      expect(result.current.displayState).toBe('opening')

      act(() => {
        vi.advanceTimersByTime(coverModel.timeoutMs + 10)
      })

      // still opening → still in flight, NOT failed
      expect(result.current.failed).toBe(false)
      expect(result.current.isPending).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
