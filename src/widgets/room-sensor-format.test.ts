import { describe, it, expect } from 'vitest'
import { formatSensorValue } from './room-sensor-format'

describe('formatSensorValue', () => {
  it('rounds to the requested decimals', () => {
    expect(formatSensorValue('21.53', 1)).toBe('21.5')
    expect(formatSensorValue('21', 1)).toBe('21.0')
    expect(formatSensorValue('620', 0)).toBe('620')
    expect(formatSensorValue('47.6', 0)).toBe('48')
  })

  it('returns the em-dash placeholder for missing / non-numeric state', () => {
    for (const bad of ['unavailable', 'unknown', '', undefined, null, 'abc']) {
      expect(formatSensorValue(bad, 1)).toBe('—')
    }
  })
})
