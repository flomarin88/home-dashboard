import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const state = vi.hoisted(() => ({
  connectionStatus: 'connected' as string,
  temp: '13.2' as string,
  humidity: '81' as string,
  battery: '75' as string,
  trend: 'down' as string,
  condition: 'sunny' as string,
}))

const DAILY = vi.hoisted(() => [
  { datetime: '2026-07-17T00:00:00Z', temperature: 24, templow: 14, condition: 'sunny' },
  { datetime: '2026-07-18T00:00:00Z', temperature: 22, templow: 13, condition: 'rainy' },
])
const HOURLY = vi.hoisted(() => [
  {
    datetime: '2026-07-17T10:00:00Z',
    temperature: 20,
    condition: 'cloudy',
    precipitation_probability: 30,
  },
  {
    datetime: '2026-07-17T11:00:00Z',
    temperature: 21,
    condition: 'rainy',
    precipitation_probability: 60,
  },
])

vi.mock('@hakit/core', () => ({
  useEntity: (id: string) => {
    const last_changed = '2026-07-16T14:00:00Z'
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
    if (id.includes('batterie'))
      return {
        state: state.battery,
        last_changed,
        attributes: { unit_of_measurement: '%' },
      }
    return null
  },
  useHistory: () => ({
    entityHistory: [
      { s: '12', lu: 1_752_000_000 },
      { s: '13', lu: 1_752_003_600 },
      { s: '13.2', lu: 1_752_007_200 },
    ],
    coordinates: [],
    timeline: [],
    loading: false,
  }),
  useWeather: (_id: string, opts: { type: string }) => ({
    forecast: {
      type: opts.type,
      forecast: opts.type === 'daily' ? DAILY : HOURLY,
    },
  }),
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: state.connectionStatus }),
}))

// Recharts is only needed for its declarative shell here — stub it so the chart
// mounts (with data) without pulling ResizeObserver/canvas into jsdom.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: unknown }) => children,
  LineChart: ({ children }: { children: unknown }) => children,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}))

import { WeatherDetailContent } from './WeatherDetail'
import { weatherConfig } from '../entities'

function renderPage(cfg = weatherConfig()) {
  return render(
    <MemoryRouter initialEntries={['/meteo']}>
      <Routes>
        <Route path="/meteo" element={<WeatherDetailContent cfg={cfg} />} />
        <Route path="/" element={<div>home-page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  state.connectionStatus = 'connected'
  state.temp = '13.2'
  state.humidity = '81'
  state.battery = '75'
  state.trend = 'down'
  state.condition = 'sunny'
})

describe('WeatherDetail (Story 6.2)', () => {
  it('renders Actuel (condition + temp/humidité/batterie/tendance) and the history chart', async () => {
    renderPage()
    expect(screen.getByText('Ensoleillé')).toBeInTheDocument()
    expect(screen.getByText(/13\.2\s*°C/)).toBeInTheDocument()
    expect(screen.getByText(/↓/)).toBeInTheDocument()
    expect(screen.getByText(/81\s*%/)).toBeInTheDocument() // humidity (icon + value)
    // Chart is lazy-loaded (Recharts on the route) — await its mount.
    expect(
      await screen.findByRole('img', { name: /Historique de la température/i }),
    ).toBeInTheDocument()
  })

  it('renders daily and hourly forecasts from the weather entity', () => {
    renderPage()
    expect(screen.getByText('Prévisions 7 jours')).toBeInTheDocument()
    expect(screen.getByText('Prévisions horaires')).toBeInTheDocument()
    // Daily high/low for the first day.
    expect(screen.getByText(/24°/)).toBeInTheDocument()
    expect(screen.getByText(/14°/)).toBeInTheDocument()
    // Hourly precipitation probability.
    expect(screen.getByText('30%')).toBeInTheDocument()
  })

  it('falls back to "à venir" seams when no weather entity is mapped', () => {
    renderPage({
      ...weatherConfig(),
      conditionEntityId: undefined,
      forecastEntityId: undefined,
    })
    expect(screen.getAllByText('À venir')).toHaveLength(2)
    expect(screen.queryByText('Ensoleillé')).toBeNull()
  })

  it('back link navigates home', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Accueil/i }))
    expect(screen.getByText('home-page')).toBeInTheDocument()
  })
})
