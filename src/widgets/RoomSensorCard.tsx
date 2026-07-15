import { useNavigate } from 'react-router-dom'
import { useEntity, useHistory } from '@hakit/core'
import type { EntityName } from '@hakit/core'
import type { RoomId, Measure } from '../entities'
import { roomSensors, getRoom } from '../entities'
import { formatSensorValue } from './room-sensor-format'
import { Sparkline } from './Sparkline'
import { TEMPERATURE_THRESHOLD_C, SPARKLINE_HOURS } from '../config'

/**
 * Room sensor card (Story 1.5, UX-DR4) — one room's Netatmo ambience.
 * Temperature is the glance value (large, tabular-nums); CO₂ + humidity are
 * secondary. Entity ids come from the central mapping (roomSensors — AD-7,
 * never hardcoded); live state is read via `useEntity` (AD-3, no cache). A
 * missing/unavailable sensor reads as "—" (the full offline pill is Story 1.6).
 * Tap opens the room detail route.
 */
export function RoomSensorCard({ room }: { room: RoomId }) {
  const navigate = useNavigate()
  const sensors = roomSensors(room)
  const idFor = (m: Measure): EntityName =>
    (sensors.find((s) => s.measure === m)?.entityId ?? 'unknown') as EntityName

  // useEntity hooks are called unconditionally, in stable order (ids are static
  // config). returnNullIfNotFound keeps a missing entity from throwing.
  const temperature = useEntity(idFor('temperature'), {
    returnNullIfNotFound: true,
  })
  const co2 = useEntity(idFor('co2'), { returnNullIfNotFound: true })
  const humidity = useEntity(idFor('humidity'), { returnNullIfNotFound: true })

  // 24h temperature history for the sparkline. entityHistory uses the compressed
  // HA shape ({ s: state }); keep only finite numeric points.
  const { entityHistory } = useHistory(idFor('temperature'), {
    hoursToShow: SPARKLINE_HOURS,
  })
  const tempSeries = entityHistory
    .map((h) => Number(h.s))
    .filter((n) => Number.isFinite(n))

  const tempUnit = temperature?.attributes?.unit_of_measurement ?? '°C'

  return (
    <button
      type="button"
      onClick={() => navigate(`/room/${room}`)}
      className="flex min-h-tile-h cursor-pointer flex-col justify-between gap-1 rounded-md border border-tile-border bg-tile-fill px-4 py-3 text-left"
    >
      <span className="text-label font-semibold text-text">
        {getRoom(room).label}
      </span>
      <span className="text-numeric-lg font-semibold tabular-nums text-text">
        {formatSensorValue(temperature?.state, 1)} {tempUnit}
      </span>
      <span className="text-meta tabular-nums text-text-muted">
        CO₂ {formatSensorValue(co2?.state, 0)} ppm ·{' '}
        {formatSensorValue(humidity?.state, 0)} %
      </span>
      <Sparkline values={tempSeries} threshold={TEMPERATURE_THRESHOLD_C} />
    </button>
  )
}
