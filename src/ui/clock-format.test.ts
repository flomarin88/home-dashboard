import { describe, it, expect } from 'vitest'
import { formatClock } from './clock-format'

// Dates built from local components so both construction and Intl formatting
// use the same (local) timezone — deterministic regardless of the CI tz.
describe('formatClock', () => {
  it('formats the time as zero-padded 24h HH:MM', () => {
    expect(formatClock(new Date(2026, 6, 14, 9, 5)).time).toBe('09:05')
    expect(formatClock(new Date(2026, 0, 3, 7, 4)).time).toBe('07:04')
    expect(formatClock(new Date(2026, 6, 14, 23, 0)).time).toBe('23:00')
  })

  it('formats the date in French with weekday, day and month', () => {
    const { date } = formatClock(new Date(2026, 6, 14, 9, 5))
    expect(date).toMatch(/14 juillet/)
    // weekday present and lowercase (fr-FR long weekday)
    expect(date).toMatch(/^[a-zà-ÿ]+ 14 juillet/)
  })
})
