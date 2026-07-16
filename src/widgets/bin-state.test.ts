import { describe, it, expect } from 'vitest'
import { binView, haDateTime } from './bin-state'

describe('binView', () => {
  it('maps active windows', () => {
    expect(binView('jaune')).toEqual({ color: 'jaune', active: true, bin: 'jaune' })
    expect(binView('noire')).toEqual({ color: 'noire', active: true, bin: 'noire' })
  })
  it('maps oubli to red, not active, but keeps the bin', () => {
    expect(binView('oubli_jaune')).toEqual({ color: 'rouge', active: false, bin: 'jaune' })
    expect(binView('oubli_noire')).toEqual({ color: 'rouge', active: false, bin: 'noire' })
  })
  it('maps aucune / unknown / null to idle', () => {
    expect(binView('aucune')).toEqual({ color: 'idle', active: false, bin: null })
    expect(binView('unavailable')).toEqual({ color: 'idle', active: false, bin: null })
    expect(binView(null)).toEqual({ color: 'idle', active: false, bin: null })
  })
})

describe('haDateTime', () => {
  it('formats a Date as HA input_datetime (YYYY-MM-DD HH:mm:ss)', () => {
    expect(haDateTime(new Date(2026, 6, 16, 19, 5, 3))).toBe('2026-07-16 19:05:03')
  })
})
