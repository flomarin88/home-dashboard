import { describe, it, expect } from 'vitest'
import {
  vacuumStatusLabel,
  parseBattery,
  batteryColorClass,
} from './vacuum-status'

describe('vacuumStatusLabel', () => {
  it('maps known states to French labels', () => {
    expect(vacuumStatusLabel('cleaning')).toBe('En ménage')
    expect(vacuumStatusLabel('docked')).toBe('En charge')
    expect(vacuumStatusLabel('returning')).toBe('Retour à la base')
    expect(vacuumStatusLabel('paused')).toBe('En pause')
    expect(vacuumStatusLabel('idle')).toBe('Arrêté')
    expect(vacuumStatusLabel('error')).toBe('Erreur')
  })

  it('falls through to the raw state for unknown values, — for null', () => {
    expect(vacuumStatusLabel('mopping')).toBe('mopping')
    expect(vacuumStatusLabel(null)).toBe('—')
  })
})

describe('parseBattery', () => {
  it('parses a numeric battery state', () => {
    expect(parseBattery('100')).toBe(100)
    expect(parseBattery('37')).toBe(37)
  })
  it('returns null for non-numeric / missing', () => {
    expect(parseBattery('docked')).toBeNull()
    expect(parseBattery(null)).toBeNull()
    expect(parseBattery(undefined)).toBeNull()
  })
})

describe('batteryColorClass', () => {
  it('greens high, ambers mid, reds low, mutes unknown', () => {
    expect(batteryColorClass(100)).toBe('text-security-ok')
    expect(batteryColorClass(50)).toBe('text-security-ok')
    expect(batteryColorClass(49)).toBe('text-accent-lights')
    expect(batteryColorClass(20)).toBe('text-accent-lights')
    expect(batteryColorClass(19)).toBe('text-security-alert')
    expect(batteryColorClass(null)).toBe('text-text-muted')
  })
})
