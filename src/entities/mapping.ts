import type { RoomId } from './rooms'

/**
 * The entity mapping — the single integration contract (AD-7). Each entry ties
 * one HA `entity_id` to a room + domain + service. `service` is null for
 * read-only entities (sensors). Feature stories (lights, shutters, climate, …)
 * append their controllable entities to ENTITIES here — this file stays the
 * only place `entity_id`s live.
 *
 * This is static config, not entity state (AD-3): it says WHICH entity; widgets
 * read the live state via `@hakit` hooks. Consumers cast `entityId` to
 * `@hakit`'s `EntityName` at the `useEntity` boundary.
 */
export type Measure = 'temperature' | 'co2' | 'humidity'

export type EntityDomain =
  | 'sensor'
  | 'light'
  | 'cover'
  | 'climate'
  | 'vacuum'
  | 'alarm_control_panel'

export interface EntityEntry {
  /** Real HA entity_id — the integration contract. */
  readonly entityId: string
  readonly room: RoomId
  readonly domain: EntityDomain
  /** HA service for control (e.g. 'light.toggle'); null for read-only. */
  readonly service: string | null
  /** Set for sensor entities. */
  readonly measure?: Measure
  /** True while `entityId` is a placeholder awaiting Florian's real HA id. */
  readonly placeholder?: boolean
  /** Vacuum-only: battery is a SEPARATE sensor entity (HA removed `battery_level`
   *  from vacuum entities), read for display. */
  readonly batteryEntityId?: string
  /** Vacuum-only: "Lancer" runs a routine via a `button` entity (e.g. the
   *  "Quotidien" program), not `vacuum.start`. */
  readonly startButtonEntityId?: string
}

/** Well-formed HA entity_id: `<domain>.<object_id>`. */
const ENTITY_ID_RE = /^[a-z_]+\.[a-z0-9_]+$/

/**
 * Netatmo sensors — 4 rooms × { temperature, CO₂, humidity } (Story 1.5).
 * Real HA entity_ids (Florian's HA, 2026-07-14).
 *
 * NOTE: the Salon uses the main Netatmo indoor station (`sensor.interieur_*`) —
 * the only module not room-named (confirmed in the Salon by Florian). The other
 * rooms use their named thermometer modules (`interieur_thermometre_<room>_*`).
 * CO₂ = `dioxyde_de_carbone`, humidity = `humidite`.
 */
const SENSORS: readonly EntityEntry[] = [
  // Salon — main indoor station
  { entityId: 'sensor.interieur_temperature', room: 'salon', domain: 'sensor', service: null, measure: 'temperature' },
  { entityId: 'sensor.interieur_dioxyde_de_carbone', room: 'salon', domain: 'sensor', service: null, measure: 'co2' },
  { entityId: 'sensor.interieur_humidite', room: 'salon', domain: 'sensor', service: null, measure: 'humidity' },
  // Chambre Parents
  { entityId: 'sensor.interieur_thermometre_parents_temperature', room: 'chambre_parents', domain: 'sensor', service: null, measure: 'temperature' },
  { entityId: 'sensor.interieur_thermometre_parents_dioxyde_de_carbone', room: 'chambre_parents', domain: 'sensor', service: null, measure: 'co2' },
  { entityId: 'sensor.interieur_thermometre_parents_humidite', room: 'chambre_parents', domain: 'sensor', service: null, measure: 'humidity' },
  // Nathan
  { entityId: 'sensor.interieur_thermometre_nathan_temperature', room: 'nathan', domain: 'sensor', service: null, measure: 'temperature' },
  { entityId: 'sensor.interieur_thermometre_nathan_dioxyde_de_carbone', room: 'nathan', domain: 'sensor', service: null, measure: 'co2' },
  { entityId: 'sensor.interieur_thermometre_nathan_humidite', room: 'nathan', domain: 'sensor', service: null, measure: 'humidity' },
  // Gaspard
  { entityId: 'sensor.interieur_thermometre_gaspard_temperature', room: 'gaspard', domain: 'sensor', service: null, measure: 'temperature' },
  { entityId: 'sensor.interieur_thermometre_gaspard_dioxyde_de_carbone', room: 'gaspard', domain: 'sensor', service: null, measure: 'co2' },
  { entityId: 'sensor.interieur_thermometre_gaspard_humidite', room: 'gaspard', domain: 'sensor', service: null, measure: 'humidity' },
]

/**
 * Lights (FR2) — Story 2.1 wires the first tile (vertical slice); Story 2.3
 * fills the rest (per-room + master). Control entities declare their HA
 * `service`. PLACEHOLDER entity_id until Florian provides the real HA light id
 * (assertNoPlaceholders flags it until then, on purpose).
 */
const LIGHTS: readonly EntityEntry[] = [
  { entityId: 'light.salon', room: 'salon', domain: 'light', service: 'light.toggle', placeholder: true },
]

/**
 * Vacuum (FR10) — Roborock, Story 2.7. REAL entity_id (Florian's HA, 2026-07-16).
 * A single device with no canonical room; `room: 'salon'` is a required-field
 * default, not meaningful here.
 */
const VACUUM: readonly EntityEntry[] = [
  {
    entityId: 'vacuum.roborock_s8',
    room: 'salon',
    domain: 'vacuum',
    service: 'vacuum.start',
    // Battery moved to its own sensor in modern HA; "Lancer" runs the "Quotidien"
    // routine via a button entity. (Confirm both ids against HA if the tile shows
    // "—" / no-op — one-line fix here.)
    batteryEntityId: 'sensor.roborock_s8_batterie',
    startButtonEntityId: 'button.salon_roborock_s8_quotidien',
  },
]

/** All mapped entities. Feature stories append their entities here (AD-7). */
export const ENTITIES: readonly EntityEntry[] = [...SENSORS, ...LIGHTS, ...VACUUM]

/** The Netatmo measures for a room (temperature, CO₂, humidity). */
export function roomSensors(room: RoomId): EntityEntry[] {
  return ENTITIES.filter((e) => e.room === room && e.domain === 'sensor')
}

/** All mapped lights (FR2). Feature stories append to LIGHTS above (AD-7). */
export function lights(): EntityEntry[] {
  return ENTITIES.filter((e) => e.domain === 'light')
}

/** The mapped vacuum entity (FR10), or undefined if none. */
export function vacuum(): EntityEntry | undefined {
  return ENTITIES.find((e) => e.domain === 'vacuum')
}

/** The single sensor entity for a (room, measure), or undefined if unmapped. */
export function sensor(
  room: RoomId,
  measure: Measure,
): EntityEntry | undefined {
  return ENTITIES.find(
    (e) => e.room === room && e.domain === 'sensor' && e.measure === measure,
  )
}

/**
 * Canonical mapping invariant (AD-7): one entity per real concept.
 *  - every `entity_id` appears at most once (one entity = one entry);
 *  - each sensor (room, measure) is mapped at most once.
 * Control domains may legitimately have several entities per room, so only the
 * entity_id-uniqueness rule constrains them. Throws on the first violation.
 */
export function assertCanonicalMapping(
  entries: readonly EntityEntry[] = ENTITIES,
): void {
  const seenIds = new Set<string>()
  const seenSensorConcepts = new Set<string>()
  for (const e of entries) {
    // Well-formedness: a malformed entity_id (typo, missing dot) otherwise
    // ships silently and only surfaces as an `unavailable` widget later.
    if (!ENTITY_ID_RE.test(e.entityId)) {
      throw new Error(
        `Malformed entity_id "${e.entityId}" — expected "<domain>.<object_id>"`,
      )
    }
    if (seenIds.has(e.entityId)) {
      throw new Error(
        `Non-canonical mapping: entity_id "${e.entityId}" is mapped more than once`,
      )
    }
    seenIds.add(e.entityId)

    if (e.domain === 'sensor' && e.measure) {
      const concept = `${e.room}/${e.measure}`
      if (seenSensorConcepts.has(concept)) {
        throw new Error(
          `Non-canonical mapping: sensor concept "${concept}" is mapped more than once`,
        )
      }
      seenSensorConcepts.add(concept)
    }
  }
}

/**
 * Guard for shipping real data (not part of the always-green gate, since
 * placeholders are legitimately present until 1.5). Throws if any entry still
 * carries a placeholder entity_id — call it before Story 1.5's live-proof so
 * "placeholders still present" is a loud failure, not a runtime `unavailable`.
 */
export function assertNoPlaceholders(
  entries: readonly EntityEntry[] = ENTITIES,
): void {
  const remaining = entries.filter((e) => e.placeholder)
  if (remaining.length > 0) {
    throw new Error(
      `${remaining.length} placeholder entity_id(s) not yet replaced with real HA ids: ` +
        remaining.map((e) => e.entityId).join(', '),
    )
  }
}

// Self-enforce the canonical invariant live in dev (not just under `npm test`),
// so a bad edit surfaces immediately. Stripped from production builds.
if (import.meta.env.DEV) {
  assertCanonicalMapping()
}
