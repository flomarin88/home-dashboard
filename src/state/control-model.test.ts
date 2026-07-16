import { describe, it, expect, vi } from 'vitest'
import type { HassEntityWithService } from '@hakit/core'
import { lightModel } from './control-model'

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
