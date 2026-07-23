import type { RoomId } from "./rooms";

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
export type Measure = "temperature" | "co2" | "humidity" | "noise";

export type EntityDomain =
  "sensor" | "light" | "cover" | "climate" | "vacuum" | "alarm_control_panel";

export interface EntityEntry {
  /** Real HA entity_id — the integration contract. */
  readonly entityId: string;
  readonly room: RoomId;
  readonly domain: EntityDomain;
  /** HA service for control (e.g. 'light.toggle'); null for read-only. */
  readonly service: string | null;
  /** Display label override for a device NOT tied to a canonical sensor room
   *  (e.g. a light in the Bureau); falls back to `getRoom(room).label`. */
  readonly label?: string;
  /** Set for sensor entities. */
  readonly measure?: Measure;
  /** True while `entityId` is a placeholder awaiting Florian's real HA id. */
  readonly placeholder?: boolean;
  /** Vacuum-only: battery is a SEPARATE sensor entity (HA removed `battery_level`
   *  from vacuum entities), read for display. */
  readonly batteryEntityId?: string;
  /** Vacuum-only: "Lancer" runs a routine via a `button` entity (e.g. the
   *  "Quotidien" program), not `vacuum.start`. */
  readonly startButtonEntityId?: string;
  /** Climate-only: ambient temperature can live on a SEPARATE sensor when the
   *  cloud integration leaves `current_temperature` null (like vacuum battery),
   *  read for display as a fallback. */
  readonly ambientEntityId?: string;
}

/** Well-formed HA entity_id: `<domain>.<object_id>`. */
const ENTITY_ID_RE = /^[a-z_]+\.[a-z0-9_]+$/;

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
  {
    entityId: "sensor.interieur_temperature",
    room: "salon",
    domain: "sensor",
    service: null,
    measure: "temperature",
  },
  {
    entityId: "sensor.interieur_dioxyde_de_carbone",
    room: "salon",
    domain: "sensor",
    service: null,
    measure: "co2",
  },
  {
    entityId: "sensor.interieur_humidite",
    room: "salon",
    domain: "sensor",
    service: null,
    measure: "humidity",
  },
  {
    entityId: "sensor.interieur_noise",
    room: "salon",
    domain: "sensor",
    service: null,
    measure: "noise",
  },
  // Chambre Parents
  {
    entityId: "sensor.interieur_thermometre_parents_temperature",
    room: "chambre_parents",
    domain: "sensor",
    service: null,
    measure: "temperature",
  },
  {
    entityId: "sensor.interieur_thermometre_parents_dioxyde_de_carbone",
    room: "chambre_parents",
    domain: "sensor",
    service: null,
    measure: "co2",
  },
  {
    entityId: "sensor.interieur_thermometre_parents_humidite",
    room: "chambre_parents",
    domain: "sensor",
    service: null,
    measure: "humidity",
  },
  // Nathan
  {
    entityId: "sensor.interieur_thermometre_nathan_temperature",
    room: "nathan",
    domain: "sensor",
    service: null,
    measure: "temperature",
  },
  {
    entityId: "sensor.interieur_thermometre_nathan_dioxyde_de_carbone",
    room: "nathan",
    domain: "sensor",
    service: null,
    measure: "co2",
  },
  {
    entityId: "sensor.interieur_thermometre_nathan_humidite",
    room: "nathan",
    domain: "sensor",
    service: null,
    measure: "humidity",
  },
  // Gaspard
  {
    entityId: "sensor.interieur_thermometre_gaspard_temperature",
    room: "gaspard",
    domain: "sensor",
    service: null,
    measure: "temperature",
  },
  {
    entityId: "sensor.interieur_thermometre_gaspard_dioxyde_de_carbone",
    room: "gaspard",
    domain: "sensor",
    service: null,
    measure: "co2",
  },
  {
    entityId: "sensor.interieur_thermometre_gaspard_humidite",
    room: "gaspard",
    domain: "sensor",
    service: null,
    measure: "humidity",
  },
];

/**
 * Lights (FR2) — Story 2.1 wires the first tile (vertical slice); Story 2.3
 * fills the rest (per-room + master). Control entities declare their HA
 * `service`. REAL entity_id (Florian's HA, 2026-07-20): the office PC light
 * (Elgato Key Light). No canonical sensor room — `room: 'salon'` is a
 * required-field default whose RDC floor is correct for placement; `label:
 * 'Bureau'` drives the tile display (Story 2.3).
 */
const LIGHTS: readonly EntityEntry[] = [
  {
    entityId: "light.bureau_elgato",
    room: "salon",
    domain: "light",
    service: "light.toggle",
    label: "Bureau",
  },
];

/**
 * Vacuum (FR10) — Roborock, Story 2.7. REAL entity_id (Florian's HA, 2026-07-16).
 * A single device with no canonical room; `room: 'salon'` is a required-field
 * default, not meaningful here.
 */
const VACUUM: readonly EntityEntry[] = [
  {
    entityId: "vacuum.roborock_s8",
    room: "salon",
    domain: "vacuum",
    service: "vacuum.start",
    // Battery moved to its own sensor in modern HA; "Lancer" runs the "Quotidien"
    // routine via a button entity. (Confirm both ids against HA if the tile shows
    // "—" / no-op — one-line fix here.)
    batteryEntityId: "sensor.roborock_s8_batterie",
    startButtonEntityId: "button.salon_roborock_s8_quotidien",
  },
];

/**
 * Climate (FR6) — the upstairs A/C, Story 2.6. REAL entity_id (Florian's HA,
 * 2026-07-18): a Daikin Onecta unit. A single device covering the étage, no
 * canonical room; `room: 'chambre_parents'` (floor 1) is a required-field
 * default, not meaningful — the climate device is placed on the étage directly
 * by the home layout, not via this room field.
 *
 * Onecta is a rate-limited CLOUD integration (polled, not push): ambient temp is
 * exposed on a dedicated sensor, read as a fallback when the climate entity's
 * `current_temperature` attribute is null. `service` = the primary control.
 */
const CLIMATE: readonly EntityEntry[] = [
  {
    entityId: "climate.climatiseur_etage_room_temperature",
    room: "chambre_parents",
    domain: "climate",
    service: "climate.set_hvac_mode",
    ambientEntityId: "sensor.climatiseur_etage_climatecontrol_room_temperature",
  },
];

/** All mapped entities. Feature stories append their entities here (AD-7). */
export const ENTITIES: readonly EntityEntry[] = [
  ...SENSORS,
  ...LIGHTS,
  ...VACUUM,
  ...CLIMATE,
];

/** The Netatmo measures for a room (temperature, CO₂, humidity). */
export function roomSensors(room: RoomId): EntityEntry[] {
  return ENTITIES.filter((e) => e.room === room && e.domain === "sensor");
}

/**
 * Per-room battery sensor (REAL ids, Florian's HA 2026-07-20). Only the bedroom
 * Netatmo modules run on cells; the Salon is the main indoor station on mains
 * power → NO battery (omitted, its tile shows none). The paired OUTDOOR module's
 * battery (`sensor.interieur_exterieur_batterie`) belongs to the weather, not a
 * room — it lives on `/meteo` (WeatherConfig.batteryEntityId).
 */
const ROOM_BATTERY: Partial<Record<RoomId, string>> = {
  chambre_parents: "sensor.interieur_thermometre_parents_batterie",
  gaspard: "sensor.interieur_thermometre_gaspard_batterie",
  nathan: "sensor.interieur_thermometre_nathan_batterie",
};

/** The battery sensor entity_id for a room's module, or undefined (mains-powered). */
export function roomBattery(room: RoomId): string | undefined {
  return ROOM_BATTERY[room];
}

/** All mapped lights (FR2). Feature stories append to LIGHTS above (AD-7). */
export function lights(): EntityEntry[] {
  return ENTITIES.filter((e) => e.domain === "light");
}

/** The mapped vacuum entity (FR10), or undefined if none. */
export function vacuum(): EntityEntry | undefined {
  return ENTITIES.find((e) => e.domain === "vacuum");
}

/** The mapped climate entity (FR6, Story 2.6), or undefined if none. */
export function climate(): EntityEntry | undefined {
  return ENTITIES.find((e) => e.domain === "climate");
}

/** A labelled reference to a secondary HA entity used on the vacuum detail page. */
export interface LabelledEntity {
  readonly label: string;
  readonly entityId: string;
}

/**
 * Vacuum detail-page entities (Story 5.3) — the richer Roborock data kept OFF
 * the glanceable home tile. All ids live here (AD-7). The map is an HA `image`
 * entity: the page reads its `entity_picture` at RUNTIME (its token is never
 * stored — AD-8). Real ids from Florian's HA (2026-07-16).
 */
export interface VacuumDetail {
  /** HA `image` entity — its `entity_picture` (with a live token) is read at runtime. */
  readonly mapEntityId: string;
  /** binary_sensor: charging at the dock. */
  readonly chargingEntityId: string;
  /** Launchable routines (`button` entities). */
  readonly programs: readonly LabelledEntity[];
  /** In-progress cleaning fields. */
  readonly cleaning: readonly LabelledEntity[];
  /** Consumable time-left sensors (seconds; ≤0 → "à remplacer"). */
  readonly consumables: readonly LabelledEntity[];
  /** Alerts (error sensor + binary_sensors). */
  readonly alerts: readonly LabelledEntity[];
}

const VACUUM_DETAIL: VacuumDetail = {
  mapEntityId: "image.salon_roborock_s8_map_0",
  chargingEntityId: "binary_sensor.salon_roborock_s8_en_charge",
  programs: [
    { label: "Quotidien", entityId: "button.salon_roborock_s8_quotidien" },
    {
      label: "Après les repas",
      entityId: "button.salon_roborock_s8_apres_les_repas",
    },
  ],
  cleaning: [
    { label: "Surface", entityId: "sensor.roborock_s8_surface_de_nettoyage" },
    { label: "Durée", entityId: "sensor.roborock_s8_duree_de_nettoyage" },
    {
      label: "Pièce actuelle",
      entityId: "sensor.salon_roborock_s8_piece_actuelle",
    },
  ],
  consumables: [
    {
      label: "Brosse principale",
      entityId: "sensor.roborock_s8_temps_restant_brosse_principale",
    },
    {
      label: "Brosse latérale",
      entityId: "sensor.roborock_s8_temps_restant_brosse_laterale",
    },
    { label: "Filtre", entityId: "sensor.roborock_s8_temps_restant_filtre" },
    {
      label: "Capteurs",
      entityId: "sensor.roborock_s8_temps_restant_capteurs",
    },
  ],
  alerts: [
    { label: "Erreur", entityId: "sensor.roborock_s8_erreur_aspirateur" },
    {
      label: "Pénurie d'eau",
      entityId: "binary_sensor.roborock_s8_penurie_d_eau",
    },
    {
      label: "Réservoir d'eau",
      entityId: "binary_sensor.roborock_s8_reservoir_d_eau_fixe",
    },
    {
      label: "Serpillière",
      entityId: "binary_sensor.roborock_s8_serpilliere_fixee",
    },
  ],
};

/** The vacuum detail-page entity references (Story 5.3), or undefined if no vacuum. */
export function vacuumDetail(): VacuumDetail | undefined {
  return vacuum() ? VACUUM_DETAIL : undefined;
}

/**
 * Bins (Story 6.1) — the app REFLECTS a HA template sensor (schedule + oubli
 * logic live in HA, AD-4) and WRITES a timestamp to a per-bin `input_datetime`
 * on "sortie" (its HA history is the log). Contract: see docs/home-assistant.md.
 */
export interface BinsConfig {
  /**
   * HA template sensor. state ∈ aucune | {c}_a_sortir | {c}_sortie | {c}_oubli |
   * {c}_oubli_ack, with c ∈ {jaune, noire}. Contract: docs/home-assistant.md.
   */
  readonly stateEntityId: string;
  /** input_datetime written (`set_datetime`) when a bin is marked out. */
  readonly sortie: { readonly jaune: string; readonly noire: string };
  /** input_datetime written when an *oubli* is acknowledged (dismissed, no sortie). */
  readonly ack: { readonly jaune: string; readonly noire: string };
}

const BINS: BinsConfig = {
  stateEntityId: "sensor.poubelle_a_sortir",
  sortie: {
    jaune: "input_datetime.poubelle_jaune_sortie",
    noire: "input_datetime.poubelle_noire_sortie",
  },
  ack: {
    jaune: "input_datetime.poubelle_jaune_oubli_ack",
    noire: "input_datetime.poubelle_noire_oubli_ack",
  },
};

/** The bins config (Story 6.1). */
export function binsConfig(): BinsConfig {
  return BINS;
}

/**
 * Turtles (Story 6.3) — a family-coordination ritual (Epic 6). The app REFLECTS a
 * HA `counter` (0..2 feedings today) and INCREMENTS it via a service on tap; the
 * daily midnight reset is an HA automation (AD-4). Contract: docs/home-assistant.md.
 */
export interface TurtlesConfig {
  /** HA `counter` helper (min 0, max 2). state ∈ "0" | "1" | "2". */
  readonly counterEntityId: string;
}

const TURTLES: TurtlesConfig = {
  counterEntityId: "counter.tortues_repas",
};

/** The turtles config (Story 6.3). */
export function turtlesConfig(): TurtlesConfig {
  return TURTLES;
}

/**
 * Plants (Story 7.1) — the `maximum: 1` twin of Turtles (Epic 7, "rituel partagé"
 * AD-15). The app REFLECTS a HA `counter` (0 = à arroser, 1 = arrosé today) and
 * INCREMENTS it via a service on tap; the daily midnight reset is an HA automation
 * (AD-4). Contract: docs/home-assistant.md § "Arrosage — plantes 1×/jour".
 */
export interface PlantsConfig {
  /** HA `counter` helper (min 0, max 1). state ∈ "0" | "1". */
  readonly counterEntityId: string;
}

const PLANTS: PlantsConfig = {
  counterEntityId: "counter.plantes_arrosees",
};

/** The plants config (Story 7.1). */
export function plantsConfig(): PlantsConfig {
  return PLANTS;
}

/**
 * Weather (Story 6.2) — outdoor Netatmo sensors (temp/humidity/battery/trend,
 * real ids) reflected via @hakit. Condition icon / 7-day forecast / rain-in-1h
 * come from a HA weather integration to be added (AD-1/AD-2 — no external API in
 * the client); their ids are optional seams, "à venir" until set.
 */
export interface WeatherConfig {
  readonly tempEntityId: string;
  readonly humidityEntityId: string;
  readonly batteryEntityId: string;
  readonly trendEntityId: string;
  /** `sensor.sun_next_rising` — next sunrise, ISO timestamp state. */
  readonly sunriseEntityId: string;
  /** `sensor.sun_next_setting` — next sunset, ISO timestamp state. */
  readonly sunsetEntityId: string;
  /** `weather.*` — drives the condition icon (state = condition). */
  readonly conditionEntityId?: string;
  /** `weather.*` — daily + hourly forecast (usually same entity as condition). */
  readonly forecastEntityId?: string;
}

const WEATHER: WeatherConfig = {
  tempEntityId: "sensor.interieur_exterieur_temperature",
  humidityEntityId: "sensor.interieur_exterieur_humidite",
  batteryEntityId: "sensor.interieur_exterieur_batterie",
  trendEntityId: "sensor.interieur_exterieur_temperature_trend",
  sunriseEntityId: "sensor.sun_next_rising",
  sunsetEntityId: "sensor.sun_next_setting",
  // HA weather integration (Task 0, provided by Florian 2026-07-17): condition +
  // daily/hourly forecast come from one `weather.*` entity.
  conditionEntityId: "weather.forecast_home",
  forecastEntityId: "weather.forecast_home",
};

/** The weather config (Story 6.2). */
export function weatherConfig(): WeatherConfig {
  return WEATHER;
}

/**
 * Electricity consumption (Story 9.1) — a daily-cumulative kWh sensor + a unit
 * price helper, reflected read-only (AD-16). Cost = kWh × price is a DISPLAY
 * derivation (never a stored state, AD-1). A single flat price for 9.1; Story
 * 9.2 splits it into HC/HP + adds the current-period sensor.
 * ⚠️ PLACEHOLDER ids until Task 0 (real Enedis / TotalÉnergies daily sensor +
 * `input_number` price helper) — confirm the real slugs at device-proof.
 */
export interface ElectricityConfig {
  /** `sensor.*` — daily cumulative consumption in kWh (utility_meter `cycle: daily`, reset midnight HA). */
  readonly dailyKwhEntityId: string;
  /** `input_number.*` — unit price €/kWh (flat; Story 9.2 splits into HC/HP). */
  readonly priceEntityId: string;
}

const ELECTRICITY: ElectricityConfig = {
  // ⚠️ Placeholders (Task 0) — the real ids depend on the provider integration.
  dailyKwhEntityId: "sensor.electricite_conso_jour",
  priceEntityId: "input_number.prix_kwh",
};

/** The electricity config (Story 9.1). */
export function electricityConfig(): ElectricityConfig {
  return ELECTRICITY;
}

/** The single sensor entity for a (room, measure), or undefined if unmapped. */
export function sensor(
  room: RoomId,
  measure: Measure,
): EntityEntry | undefined {
  return ENTITIES.find(
    (e) => e.room === room && e.domain === "sensor" && e.measure === measure,
  );
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
  const seenIds = new Set<string>();
  const seenSensorConcepts = new Set<string>();
  for (const e of entries) {
    // Well-formedness: a malformed entity_id (typo, missing dot) otherwise
    // ships silently and only surfaces as an `unavailable` widget later.
    if (!ENTITY_ID_RE.test(e.entityId)) {
      throw new Error(
        `Malformed entity_id "${e.entityId}" — expected "<domain>.<object_id>"`,
      );
    }
    if (seenIds.has(e.entityId)) {
      throw new Error(
        `Non-canonical mapping: entity_id "${e.entityId}" is mapped more than once`,
      );
    }
    seenIds.add(e.entityId);

    if (e.domain === "sensor" && e.measure) {
      const concept = `${e.room}/${e.measure}`;
      if (seenSensorConcepts.has(concept)) {
        throw new Error(
          `Non-canonical mapping: sensor concept "${concept}" is mapped more than once`,
        );
      }
      seenSensorConcepts.add(concept);
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
  const remaining = entries.filter((e) => e.placeholder);
  if (remaining.length > 0) {
    throw new Error(
      `${remaining.length} placeholder entity_id(s) not yet replaced with real HA ids: ` +
        remaining.map((e) => e.entityId).join(", "),
    );
  }
}

/**
 * Auxiliary HA ids that drive a widget but live OUTSIDE `ENTITIES` (the ritual
 * counters + the bin's `input_datetime` helpers). They otherwise escape
 * `assertCanonicalMapping`'s well-formedness check, so a typo would ship as a
 * silently `unavailable` tile instead of a loud dev-time throw. Format-only:
 * these are distinct HA helper domains (`counter`/`input_datetime`), not sensors,
 * so the (room, measure) canonical rule does not apply — only `ENTITY_ID_RE`.
 */
const AUX_ENTITY_IDS: readonly string[] = [
  TURTLES.counterEntityId,
  PLANTS.counterEntityId,
  BINS.stateEntityId,
  BINS.sortie.jaune,
  BINS.sortie.noire,
  BINS.ack.jaune,
  BINS.ack.noire,
  ELECTRICITY.dailyKwhEntityId,
  ELECTRICITY.priceEntityId,
];

export function assertWellFormedAuxIds(
  ids: readonly string[] = AUX_ENTITY_IDS,
): void {
  for (const id of ids) {
    if (!ENTITY_ID_RE.test(id)) {
      throw new Error(
        `Malformed auxiliary entity_id "${id}" — expected "<domain>.<object_id>"`,
      );
    }
  }
}

// Self-enforce the canonical invariant live in dev (not just under `npm test`),
// so a bad edit surfaces immediately. Stripped from production builds.
if (import.meta.env.DEV) {
  assertCanonicalMapping();
  assertWellFormedAuxIds();
}
