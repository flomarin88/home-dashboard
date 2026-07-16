import { describe, it, expect, vi } from 'vitest'
import type { HassEntityWithService } from '@hakit/core'
import { lightModel, vacuumModel } from './control-model'

describe('lightModel (AD-5 / AD-4)', () => {
  it('converges when confirmed state equals the target', () => {
    expect(lightModel.isConverged('on', 'on')).toBe(true)
    expect(lightModel.isConverged('on', 'off')).toBe(false)
    expect(lightModel.isConverged('off', 'off')).toBe(true)
  })

  it('has no transitional state (on/off is instantaneous)', () => {
    expect(lightModel.isTransitional).toBeUndefined()
  })

  it('apply issues turn_on / turn_off via HA services only (AD-4)', () => {
    const turnOn = vi.fn()
    const turnOff = vi.fn()
    const entity = {
      service: { turnOn, turnOff },
    } as unknown as HassEntityWithService<'light'>

    lightModel.apply(entity, 'on')
    expect(turnOn).toHaveBeenCalledOnce()
    expect(turnOff).not.toHaveBeenCalled()

    lightModel.apply(entity, 'off')
    expect(turnOff).toHaveBeenCalledOnce()
  })
})

describe('vacuumModel (AD-5 / AD-4)', () => {
  it('converges on state equality', () => {
    expect(vacuumModel.isConverged('cleaning', 'cleaning')).toBe(true)
    expect(vacuumModel.isConverged('docked', 'returning')).toBe(false)
    expect(vacuumModel.isConverged('idle', 'idle')).toBe(true)
  })

  it('treats "returning" as transitional (the dock trip is not a failure)', () => {
    expect(vacuumModel.isTransitional?.('returning')).toBe(true)
    expect(vacuumModel.isTransitional?.('cleaning')).toBe(false)
    expect(vacuumModel.isTransitional?.('docked')).toBe(false)
  })

  it('maps the vacuum-native targets to their HA services; start is external (AD-4)', () => {
    const start = vi.fn()
    const stop = vi.fn()
    const returnToBase = vi.fn()
    const entity = {
      service: { start, stop, returnToBase },
    } as unknown as HassEntityWithService<'vacuum'>

    vacuumModel.apply(entity, 'docked')
    expect(returnToBase).toHaveBeenCalledOnce()

    vacuumModel.apply(entity, 'idle')
    expect(stop).toHaveBeenCalledOnce()

    // 'cleaning' is a no-op here — the widget presses the "Quotidien" button.
    vacuumModel.apply(entity, 'cleaning')
    expect(start).not.toHaveBeenCalled()
  })
})
