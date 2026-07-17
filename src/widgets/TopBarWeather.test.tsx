import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// Mutable mock state (vi.hoisted so the hoisted vi.mock factory can read it).
const state = vi.hoisted(() => ({
  connectionStatus: 'connected' as string,
  temp: '12.34' as string,
  humidity: '78' as string,
  trend: 'up' as string,
  condition: 'sunny' as string,
}))

vi.mock('@hakit/core', () => ({
  useEntity: (id: string) => {
    const last_changed = '2026-07-16T14:00:00Z'
    // Order matters: `temperature_trend` also contains "temperature".
    if (id.includes('weather'))
      return { state: state.condition, last_changed, attributes: {} }
    if (id.includes('temperature_trend'))
      return { state: state.trend, last_changed, attributes: {} }
    if (id.includes('temperature'))
      return {
        state: state.temp,
        last_changed,
        attributes: { unit_of_measurement: '°C' },
      }
    if (id.includes('humidite'))
      return {
        state: state.humidity,
        last_changed,
        attributes: { unit_of_measurement: '%' },
      }
    return null
  },
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: state.connectionStatus }),
}))

import { TopBarWeather } from './TopBarWeather'

function renderWidget() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<TopBarWeather />} />
        <Route path="/meteo" element={<div>meteo-page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  state.connectionStatus = 'connected'
  state.temp = '12.34'
  state.humidity = '78'
  state.trend = 'up'
  state.condition = 'sunny'
})

describe('TopBarWeather (Story 6.2)', () => {
  it('shows temperature (glance), rising trend arrow and humidity when live', () => {
    renderWidget()
    expect(screen.getByText(/12\.3\s*°C/)).toBeInTheDocument()
    expect(screen.getByText(/↑/)).toBeInTheDocument()
    expect(screen.getByText(/78\s*%/)).toBeInTheDocument()
    // Accessible summary carries the condition + values + direction.
    expect(
      screen.getByRole('button', {
        name: /Météo extérieure Ensoleillé.*humidité.*en hausse/i,
      }),
    ).toBeInTheDocument()
  })

  it('navigates to /meteo on tap', () => {
    renderWidget()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('meteo-page')).toBeInTheDocument()
  })

  it('offline → dimmed but keeps the last-known value (never blank, AD-6)', () => {
    state.connectionStatus = 'disconnected'
    renderWidget()
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('opacity-60')
    expect(screen.getByText(/12\.3\s*°C/)).toBeInTheDocument()
  })
})
