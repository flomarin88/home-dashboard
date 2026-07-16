import type { AllDomains, HassEntityWithService } from '@hakit/core'

/**
 * A per-domain control model (AD-5). It carries the domain-specific knowledge
 * the generic optimistic hook (`useOptimisticControl`) needs, so the hook stays
 * agnostic and every Epic 2 domain (lights, shutters, climate, vacuum, alarm)
 * plugs in by supplying one of these — no duplicated optimistic logic.
 *
 *  - `isConverged`  : confirmed HA state == the intended target?
 *  - `isTransitional`: a legitimate in-progress state (e.g. cover opening) that
 *                      is NOT a failure and must keep the intent alive (AD-5).
 *  - `apply`        : issue the intent via HA services ONLY (AD-4).
 *  - `timeoutMs`    : how long to wait for convergence before declaring failure.
 *
 * `T extends string`: the optimistic target is a HA **state token** (always a
 * string — `on`/`off`, `open`/`closed`, `heat`/`cool`/`off`, …), so it composes
 * with the confirmed `entity.state` without lying about its type. Numeric
 * attributes (brightness, setpoint, position) are a separate concern, not this
 * hook's `displayState`.
 */
export interface ControlModel<D extends AllDomains, T extends string> {
  readonly domain: D
  isConverged(target: T, state: string): boolean
  isTransitional?(state: string): boolean
  apply(entity: HassEntityWithService<D>, target: T): void
  readonly timeoutMs: number
}

export type LightTarget = 'on' | 'off'

/**
 * Lights (FR2): on/off is instantaneous — no transitional state. Convergence is
 * plain state equality; `apply` uses `turn_on`/`turn_off` (not `toggle`) so the
 * command is deterministic toward the intended target.
 */
export const lightModel: ControlModel<'light', LightTarget> = {
  domain: 'light',
  timeoutMs: 5000,
  isConverged: (target, state) => state === target,
  apply: (entity, target) =>
    target === 'on' ? entity.service.turnOn() : entity.service.turnOff(),
}
