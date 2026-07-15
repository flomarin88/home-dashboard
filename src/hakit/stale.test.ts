import { describe, it, expect } from 'vitest'
import { isStale, formatSince } from './stale'

describe('isStale', () => {
  it('is false only for a real value on a live connection', () => {
    expect(isStale('21.5', true)).toBe(false)
  })

  it('is true when the socket is lost, whatever the value', () => {
    expect(isStale('21.5', false)).toBe(true)
  })

  it('is true for unavailable / unknown / missing state', () => {
    expect(isStale('unavailable', true)).toBe(true)
    expect(isStale('unknown', true)).toBe(true)
    expect(isStale(null, true)).toBe(true)
    expect(isStale(undefined, true)).toBe(true)
  })
})

describe('formatSince', () => {
  it('formats a timestamp as HH:MM', () => {
    // built from local components → deterministic across timezones
    const iso = new Date(2026, 6, 15, 14, 2).toISOString()
    expect(formatSince(iso)).toBe('14:02')
  })

  it('returns empty string for missing / invalid input', () => {
    expect(formatSince(null)).toBe('')
    expect(formatSince(undefined)).toBe('')
    expect(formatSince('not-a-date')).toBe('')
  })
})
