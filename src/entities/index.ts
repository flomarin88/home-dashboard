/**
 * `src/entities/` — the single source of truth mapping HA `entity_id`s to rooms
 * and widgets (AD-7). Import entities from here; never hardcode an `entity_id`
 * anywhere else. This is static config (which entity), NOT entity state — live
 * state is read via `@hakit` hooks in widgets (AD-3).
 */
export * from "./rooms";
export * from "./mapping";
