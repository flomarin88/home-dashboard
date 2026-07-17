import { useNavigate } from 'react-router-dom'
import type { EntityName } from '@hakit/core'
import { weatherConfig } from '../entities'
import { useEntityValue } from '../hakit/useEntityValue'
import { formatSensorValue } from './room-sensor-format'
import { trendArrow, trendColorClass, conditionLabel } from './weather-format'
import { WeatherIcon, DropletIcon } from './WeatherIcon'

/**
 * TopBarWeather (Story 6.2) — a compact outdoor-weather glance in the top bar:
 * condition icon + temperature + (coloured) trend arrow + humidity, tappable →
 * `/meteo`. The outdoor module's battery is maintenance detail, kept off this
 * glance and shown on `/meteo` instead (Florian, 2026-07-17).
 *
 * Reflects the Netatmo outdoor sensors + the HA `weather.*` condition
 * (AD-1/AD-2/AD-3). It needs HA, so — like BinTile — it's mounted UNDER the
 * provider and `fixed`-positioned, aligned with the TopBar button row (the
 * TopBar/Clock stay above the connection gate, TD-1; a real composition layer is
 * TD-4). Obsolescence: muted + last-known value (AD-6).
 */
export function TopBarWeather() {
  const cfg = weatherConfig()
  const navigate = useNavigate()
  const temp = useEntityValue(cfg.tempEntityId as EntityName)
  const humidity = useEntityValue(cfg.humidityEntityId as EntityName)
  const trend = useEntityValue(cfg.trendEntityId as EntityName)
  // Condition entity (weather.*). Fall back to the temp entity so the hook stays
  // unconditional and no entity_id literal leaks in (its numeric state maps to
  // the 'thermo' default) when no weather integration is mapped.
  const condition = useEntityValue(
    (cfg.conditionEntityId ?? cfg.tempEntityId) as EntityName,
  )

  const arrow = trendArrow(trend.value)

  const tempLabel = `${formatSensorValue(temp.value, 1)} ${temp.unit ?? '°C'}`
  const humLabel = `${formatSensorValue(humidity.value, 0)} %`
  const trendWord = TREND_WORD[trend.value ?? ''] ?? ''
  const condLabel = cfg.conditionEntityId ? conditionLabel(condition.value) : ''

  return (
    <button
      type="button"
      onClick={() => navigate('/meteo')}
      aria-label={`Météo extérieure${condLabel && condLabel !== '—' ? ` ${condLabel}` : ''} ${tempLabel}, humidité ${humLabel}${
        trendWord ? `, ${trendWord}` : ''
      } — ouvrir le détail`}
      className={`fixed left-44 top-6 z-40 inline-flex min-h-[48px] items-center gap-2 rounded-lg border border-card-border bg-card-fill px-4 backdrop-blur-glass ${
        temp.isStale ? 'opacity-60' : ''
      }`}
    >
      <WeatherIcon
        condition={cfg.conditionEntityId ? condition.value : null}
        size={20}
      />
      <span className="inline-flex items-baseline gap-1 text-label font-semibold tabular-nums text-text">
        {tempLabel}
        {arrow ? <span className={trendColorClass(trend.value)}>{arrow}</span> : null}
      </span>
      <span className="inline-flex items-center gap-1 text-meta tabular-nums text-text-muted">
        <DropletIcon />
        {humLabel}
      </span>
    </button>
  )
}

/** Netatmo trend state → French phrase for the accessible label. */
const TREND_WORD: Record<string, string> = {
  up: 'en hausse',
  down: 'en baisse',
  stable: 'stable',
}
