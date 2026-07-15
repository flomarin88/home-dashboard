import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useParams } from 'react-router-dom'

// Mock the live HA hooks with fixed states keyed by the sensor id.
vi.mock('@hakit/core', () => ({
  useEntity: (id: string) => {
    if (id.includes('temperature'))
      return { state: '21.53', attributes: { unit_of_measurement: '°C' } }
    if (id.includes('carbone'))
      return { state: '620', attributes: { unit_of_measurement: 'ppm' } }
    if (id.includes('humidite'))
      return { state: '48', attributes: { unit_of_measurement: '%' } }
    return null
  },
  useHistory: () => ({
    entityHistory: [{ s: '20' }, { s: '22' }, { s: '21.5' }],
    coordinates: [],
    timeline: [],
    loading: false,
  }),
}))

import { RoomSensorCard } from './RoomSensorCard'

function Detail() {
  const { roomId } = useParams()
  return <div>detail:{roomId}</div>
}

function renderCard() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<RoomSensorCard room="salon" />} />
        <Route path="/room/:roomId" element={<Detail />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('RoomSensorCard', () => {
  it('shows the room label, temperature (glance) and CO₂ / humidity', () => {
    renderCard()
    expect(screen.getByText('Salon')).toBeInTheDocument()
    expect(screen.getByText(/21\.5\s*°C/)).toBeInTheDocument()
    expect(screen.getByText(/620 ppm/)).toBeInTheDocument()
    expect(screen.getByText(/48 %/)).toBeInTheDocument()
  })

  it('navigates to the room detail route on tap', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('detail:salon')).toBeInTheDocument()
  })
})
