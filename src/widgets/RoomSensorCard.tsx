import { useNavigate } from 'react-router-dom'
import { useHistory } from '@hakit/core'
import type { EntityName } from '@hakit/core'
import type { RoomId, Measure } from '../entities'
import { roomSensors, getRoom } from '../entities'
import { useEntityValue } from '../hakit/useEntityValue'
import { formatSensorValue } from './room-sensor-format'
import { Sparkline } from './Sparkline'
import { OfflinePill } from '../ui/OfflinePill'
import { TEMPERATURE_THRESHOLD_C, SPARKLINE_HOURS } from '../config'

/**
 * Room sensor card (Story 1.5, UX-DR4) — one room's Netatmo ambience.
 * Temperature is the glance value (large, tabular-nums); CO₂ + humidity are
 * secondary. Entity ids come from the central mapping (roomSensors — AD-7,
 * never hardcoded); live state is read via `useEntityValue` (AD-3/AD-6).
 *
 * Obsolescence (Story 1.6): when the temperature entity goes offline (socket
 * lost or entity unavailable), the card keeps the last-known value + a
 * "Hors ligne" pill + timestamp, with a dashed stale border — never blank.
 * Tap opens the room detail route.
 */
export function RoomSensorCard({ room }: { room: RoomId }) {
  const navigate = useNavigate()
  const sensors = roomSensors(room)
  const idFor = (m: Measure): EntityName =>
    (sensors.find((s) => s.measure === m)?.entityId ?? 'unknown') as EntityName

  // Called unconditionally, stable order (ids are static config).
  const temperature = useEntityValue(idFor('temperature'))
  const co2 = useEntityValue(idFor('co2'))
  const humidity = useEntityValue(idFor('humidity'))

  // 24h temperature history for the sparkline (compressed HA shape { s: state }).
  const { entityHistory } = useHistory(idFor('temperature'), {
    hoursToShow: SPARKLINE_HOURS,
  })
  const tempSeries = entityHistory
    .map((h) => Number(h.s))
    .filter((n) => Number.isFinite(n))

  // The card reads stale from its primary sensor (temperature).
  const stale = temperature.isStale

  return (
    <button
      type="button"
      onClick={() => navigate(`/room/${room}`)}
      className={[
        'flex min-h-tile-h cursor-pointer flex-col justify-between gap-1 rounded-md border bg-tile-fill px-4 py-3 text-left',
        // one border-color + one text-color per state — never stack conflicting
        // utilities (Story 1.2 cascade lesson).
        stale
          ? 'border-dashed border-stale text-stale-text'
          : 'border-tile-border text-text',
      ].join(' ')}
    >
      <span className="text-label font-semibold">{getRoom(room).label}</span>
      <span className="text-numeric-lg font-semibold tabular-nums">
        {formatSensorValue(temperature.value, 1)} {temperature.unit ?? '°C'}
      </span>
      <span className="text-meta tabular-nums text-text-muted">
        CO₂ {formatSensorValue(co2.value, 0)} ppm ·{' '}
        {formatSensorValue(humidity.value, 0)} %
      </span>
      {stale ? (
        <OfflinePill since={temperature.since} />
      ) : (
        <Sparkline values={tempSeries} threshold={TEMPERATURE_THRESHOLD_C} />
      )}
    </button>
  )
}
