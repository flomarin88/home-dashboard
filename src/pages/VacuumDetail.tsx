import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEntity, useService } from '@hakit/core'
import type { EntityName } from '@hakit/core'
import { isConfigured } from '../hakit'
import { vacuum, vacuumDetail } from '../entities'
import type { EntityEntry, VacuumDetail as VacuumDetailConfig } from '../entities'
import { useOptimisticControl } from '../hakit/useOptimisticControl'
import { vacuumModel } from '../state/control-model'
import {
  vacuumStatusLabel,
  parseBattery,
  batteryColorClass,
  consumableLabel,
} from '../widgets/vacuum-status'

/**
 * VacuumDetail — deep page for the Roborock (Story 5.3, AD-10). The rich data
 * kept off the glanceable home tile (Story 2.7): map, launchable programs,
 * consumables, cleaning state, alerts, plus the base controls (reusing the 2.7
 * control stack unchanged). Content-only — the ground + top bar are owned by
 * `KioskShell` (TD-1). Opened by tapping the home Aspirateur tile.
 *
 * Layout: a landscape 3-column grid of frosted tiles (no titled sections) that
 * fits the 1024×768 kiosk viewport with NO scroll (memory: target-device-and-layout).
 */
export function VacuumDetail() {
  const entry = vacuum()
  const detail = vacuumDetail()
  if (!isConfigured || !entry || !detail) {
    return (
      <div className="flex h-full flex-col gap-2">
        <BackLink />
        <p className="text-meta text-text-muted">Aspirateur non configuré.</p>
      </div>
    )
  }
  return <VacuumDetailContent entry={entry} detail={detail} />
}

export function VacuumDetailContent({
  entry,
  detail,
}: {
  entry: EntityEntry
  detail: VacuumDetailConfig
}) {
  const id = entry.entityId as EntityName
  const { displayState, send, isStale } = useOptimisticControl(id, vacuumModel)
  const buttonSvc = useService('button')

  const battery = parseBattery(
    useEntity((entry.batteryEntityId ?? entry.entityId) as EntityName, {
      returnNullIfNotFound: true,
    })?.state,
  )
  const mapEntity = useEntity(detail.mapEntityId as EntityName, {
    returnNullIfNotFound: true,
  })
  // entity_picture carries a live HA token — read at runtime, never stored (AD-8).
  const mapUrl = (mapEntity?.attributes as { entity_picture?: string } | undefined)
    ?.entity_picture
  const charging = useEntity(detail.chargingEntityId as EntityName, {
    returnNullIfNotFound: true,
  })?.state

  const launch = (buttonEntityId: string) => {
    buttonSvc.press({ target: buttonEntityId })
    send('cleaning') // optimistic feedback on the vacuum
  }

  const cleaning = displayState === 'cleaning'
  const docked = displayState === 'docked'
  const actionClass =
    'inline-flex min-h-[48px] items-center justify-center rounded-sm border border-tile-border bg-tile-fill px-4 text-label font-semibold text-text disabled:opacity-50'

  return (
    <div className="flex h-full flex-col gap-grid-gap overflow-hidden">
      <BackLink />

      <div className="grid min-h-0 flex-1 grid-cols-3 gap-grid-gap">
        {/* Left 2/3 — map */}
        <Tile className="col-span-2 min-h-0 items-center justify-center">
          {mapUrl ? (
            <img
              src={mapUrl}
              alt="Carte de l'aspirateur"
              className="h-full w-full rounded object-contain"
            />
          ) : (
            <p className="text-meta text-text-muted">Carte indisponible</p>
          )}
        </Tile>

        {/* Right 1/3 — actions + details */}
        <div className="flex min-h-0 flex-col gap-grid-gap overflow-hidden">
          <Tile>
            <div className="flex flex-wrap gap-tile-gap">
              {detail.programs.map((p) => (
                <button
                  key={p.entityId}
                  type="button"
                  disabled={isStale}
                  onClick={() => launch(p.entityId)}
                  className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-sm border border-accent-vacuum/50 bg-accent-vacuum/15 px-4 text-label font-semibold text-text disabled:opacity-50"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Tile>

          <Tile>
            <span className="text-meta text-text">
              {vacuumStatusLabel(displayState)}
              {' · '}
              <span className={`tabular-nums ${batteryColorClass(battery)}`}>
                {battery ?? '—'} %
              </span>
              {charging === 'on' ? ' · En charge' : ''}
            </span>
            <div className="flex gap-tile-gap">
              <button
                type="button"
                disabled={isStale || !cleaning}
                onClick={() => send('idle')}
                className={`flex-1 ${actionClass}`}
              >
                Arrêter
              </button>
              <button
                type="button"
                disabled={isStale || docked}
                onClick={() => send('docked')}
                className={`flex-1 ${actionClass}`}
              >
                Retour base
              </button>
            </div>
          </Tile>

          {/* details — nettoyage / consommables / alertes (self-labelled rows) */}
          <Tile>
            {detail.cleaning.map((f) => (
              <Field key={f.entityId} label={f.label} entityId={f.entityId} />
            ))}
          </Tile>
          <Tile>
            {detail.consumables.map((c) => (
              <Field
                key={c.entityId}
                label={c.label}
                entityId={c.entityId}
                format={consumableLabel}
              />
            ))}
          </Tile>
          <Tile>
            {detail.alerts.map((a) => (
              <Field
                key={a.entityId}
                label={a.label}
                entityId={a.entityId}
                format={
                  a.entityId.startsWith('binary_sensor') ? formatBinary : formatError
                }
              />
            ))}
          </Tile>
        </div>
      </div>
    </div>
  )
}

/** A frosted tile container (no titled section chrome). */
function Tile({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`flex flex-col gap-2 overflow-hidden rounded-md border border-tile-border bg-tile-fill p-3 ${className}`}
    >
      {children}
    </div>
  )
}

/** One label → live value row; unavailable/unknown → "—" (never blank, AD-6). */
function Field({
  label,
  entityId,
  format,
}: {
  label: string
  entityId: string
  format?: (state: string) => string
}) {
  const entity = useEntity(entityId as EntityName, { returnNullIfNotFound: true })
  const raw = entity?.state
  const stale = raw == null || raw === 'unavailable' || raw === 'unknown'
  const unit = entity?.attributes?.unit_of_measurement
  const value = stale
    ? '—'
    : format
      ? format(raw)
      : unit
        ? `${raw} ${unit}`
        : raw

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-meta text-text-muted">{label}</span>
      <span className="text-meta tabular-nums text-text">{value}</span>
    </div>
  )
}

function formatBinary(state: string): string {
  return state === 'on' ? 'Oui' : state === 'off' ? 'Non' : state
}

function formatError(state: string): string {
  const s = state.toLowerCase()
  return s === 'none' || s === '' ? 'Aucune' : state
}

function BackLink() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate('/')}
      className="inline-flex min-h-[44px] w-fit items-center gap-1 text-label font-semibold text-text-muted"
    >
      ‹ Accueil
    </button>
  )
}
