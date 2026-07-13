---
name: 'Adversarial Review — Home Dashboard v1 Architecture Spine'
type: review-adversarial
target: '../ARCHITECTURE-SPINE.md'
reviewer: adversary
created: '2026-07-12'
method: 'Construct two units one level down that each obey EVERY AD yet build incompatibly. Each such pair = a hole to close.'
---

# Adversarial Review — Architecture Spine (Home Dashboard v1)

## Method

For each candidate hole I name two concrete widgets/features that are each **fully AD-1..AD-10 compliant**
(HA sole truth, @hakit only, single reactive source, no client automation, optimistic+reconcile, degrade on
disconnect, single mapping, single token, static same-origin, composed home + deep routes) — yet, built
independently to the letter of the spine, they produce **incompatible or contradictory behavior**. Each pair
is a gap the spine does not currently arbitrate. Scope kept to v1 (Netatmo + lights/shutters/AC/Arlo), hobby
kiosk — no enterprise theater.

---

## VERDICT

The spine is coherent as a **read model** (HA truth → push → render). Its **write/optimistic model (AD-5)**
and its **staleness model (AD-6)** are underspecified and leak: they are written per-widget and per-"WebSocket
loss", but real entities are shared across widgets, mutate transitionally, and go stale while the socket is
healthy. Five concrete two-widget pairs build incompatibly while each honors every AD. All five close with one
new AD (AD-11, optimistic ownership) plus tightening of AD-5, AD-6, AD-7.

---

## Finding 1 — [HIGH] Optimistic state is per-widget, not per-entity: two widgets driving one entity race

**Pair:** Home-screen master toggle **"Tout éteindre / Tout allumer"** (FR9 accueil composé, "contrôles
primaires") vs per-room **`LightWidget` Salon** (FR2/FR3). Both legitimately drive `light.salon`.

**Both obey every AD:** each accesses HA via @hakit (AD-2), consumes state via the single subscription (AD-3),
calls `light.turn_on/off` services (AD-4), and applies immediate visual feedback then reconciles on echo (AD-5).

**Incompatibility:** AD-5 says "un appui applique un retour visuel immédiat… puis réconcilie sur l'écho".
It binds "chaque widget de contrôle" — i.e. the optimistic overlay is scoped to the *widget that was pressed*.
Nothing says the pending/predicted value lives **per entity_id**. So:
- User taps master **OFF** (master overlay: all off, reconcile timer A) then immediately taps `LightWidget`
  Salon **ON** (widget overlay: salon on, reconcile timer B). Two divergent local overlays and two independent
  reconcile timers now exist for **one** entity. When the two HA echoes arrive (order not guaranteed), each
  widget reconciles against its own overlay — the two controls can settle showing opposite states for the same
  bulb, and "retour à l'état confirmé + signalement" fires on whichever lost the race even though the user's
  last intent succeeded.
- AD-3 ("aucun store parallèle qui duplique l'état d'entité") governs the *read* path but is silent on the
  optimistic *write* overlay, so it does not arbitrate this.

Same shape also bites **scene-driven mutation**: FR5 `SceneButton "Cinéma"` closes shutters + dims lights.
The SceneButton shows its own optimistic "done" (AD-5), but the `LightWidget`/`ShutterWidget` whose entities
the scene mutated received no local press, so they have **no optimistic owner** and simply lag until echo —
glanceable state is internally inconsistent (scene says done, room widgets say old) with no AD covering it.

**Fix — new AD-11 (Optimistic ownership):** pending/predicted state is keyed **per `entity_id` in one shared
reconciliation store**, single-writer-per-entity, last-command-wins with a command id; all widgets (and scene
buttons) subscribe to that store rather than holding private overlays. An entity mutated by a scene inherits a
pending marker so every widget bound to it reflects "in flight" consistently.

---

## Finding 2 — [HIGH] AD-5's binary optimistic-then-reconcile is incompatible with transitional-state domains

**Pair:** `LightWidget` (FR2, `light.*` — effectively binary on/off) vs `ShutterWidget` (FR4, `cover.*`).
Climate is a third victim (FR6, `climate.*`).

**Both obey every AD** including AD-5 as written.

**Incompatibility:** AD-5 models a control as "tap → immediate target state → reconcile when HA echoes that
state; else revert". That fits a light (`on`→`on`). It does **not** fit a cover: `cover.*` reports
`opening`/`closing` for 15–25 s and a `current_position` 0–100 before settling on `open`/`closed`. Applied to
the letter, `ShutterWidget` shows "Fermé" instantly; the first echoes are `closing` (≠ commanded `closed`);
a reconcile rule that treats "echo ≠ optimistic within timeout ⇒ revert + signal" (AD-5's failure clause)
will **flip the widget back to open mid-travel and raise a false failure**, then flip again when it finally
closes — flicker + spurious error. Climate has the same defect: commanded `target_temperature` never equals
the slowly-drifting `current_temperature`, so a naive reconcile permanently reads as "not yet confirmed /
failed". Two teams implementing AD-5 literally for a light vs a cover produce genuinely different and
mutually inconsistent reconcile machines, and the cover one is wrong.

**Fix — tighten AD-5:** define reconcile as "state is **converging toward** the commanded target; documented
transitional states (`opening`/`closing`, `current`≠`target`) are *expected*, not failure". Specify the
optimistic model **per domain**: binary (lights/switch), positional/setpoint (covers/climate — track
commanded target vs live position, no revert while transitioning), and a per-domain confirm-vs-timeout policy
(covers/climate need multi-second windows; lights sub-second). Failure = terminal wrong state or explicit
service error, not a transitional read.

---

## Finding 3 — [MED] AD-6 conflates staleness with WebSocket loss; entities go stale while the socket is healthy

**Pair:** Netatmo `CapteurWidget` (FR1, cloud-backed sensors) vs `LightWidget` (FR2, local). Both obey AD-6.

**Incompatibility:** AD-6 defines the degraded case as "à la perte WebSocket/HA, rendre la dernière valeur
connue + indicateur d'obsolescence". It keys staleness on **WS/HA loss**. But the WebSocket to HA can be
perfectly healthy while an entity is stale or dead for orthogonal reasons:
- Netatmo cloud poll fails / rate-limits → `sensor.salon_temperature` becomes `unavailable` (or keeps an old
  value with an old `last_updated`) while the HA socket stays up. AD-6 is silent ⇒ `CapteurWidget` shows a
  fresh-looking last value with **no staleness badge**, contradicting AD-6's own intent.
- `unavailable`/`unknown` entity states are not covered at all. `CapteurWidget` might grey the tile;
  `LightWidget` might render an `unavailable` bulb as "off" and (per AD-5) let the user tap it, firing a
  service call at a dead device. Both are AD-6-compliant (socket is up) yet behave incompatibly, and one is
  misleading.

**Fix — extend AD-6:** staleness is **per entity**, from `state ∈ {unavailable, unknown}` OR
`now − last_updated > threshold`, **independent of WS status**. Cloud sources (Netatmo/Arlo) inherit the same
per-entity rule (not only "si le net tombe"). Define one canonical staleness/`unavailable` rendering
(disabled control + badge) that every widget reuses.

---

## Finding 4 — [MED] AD-7 fixes `entity_id` as the contract but not the domain/concept, so two features model one real-world thing as different entities

**Pair:** Home-screen **Arm/Disarm** widget (FR7) vs **Camera page** security controls (FR8, Arlo).

**Both obey AD-7:** each references its `entity_id` through the single mapping config; neither hardcodes ids
elsewhere. AD-7 declares "les `entity_id` sont le contrat".

**Incompatibility:** AD-7 constrains *where* ids are referenced, not *which* id/domain represents a given
real-world concept. "Security armed" has several plausible HA shapes: `alarm_control_panel.maison`
(states `armed_away`/`disarmed`, service `alarm_arm_away`) vs an Arlo-integration `switch.arlo_armed` vs a
`binary_sensor`. The FR7 widget can bind `alarm_control_panel.maison` and the FR8 camera page can bind
`switch.arlo_armed` — **both mapping-compliant, both "single source"** in their own entry — yet the app now
has two contradictory truths and two controls for one concept. Arming from the camera page won't reflect in
the home widget, and vice versa.

**Fix — tighten AD-7:** mapping entries declare **domain + capability/service contract**, and each
real-world concept (security-armed, a room's "main light") maps to **one canonical entity**; the config layer
flags when two widgets bind the same concept to different ids. Keeps entity_id as contract *and* makes the
concept the unit of uniqueness.

---

## Finding 5 — [MED] AD-3 (no parallel store) vs AD-5 (optimistic overlay) is unresolved; two widgets implement optimism incompatibly and both claim compliance

**Pair:** `ClimWidget` (FR6) implemented with a local `useState` predicted setpoint vs `LightWidget` (FR2)
implemented as "style the pressed control only, never store a predicted value, re-read from @hakit".

**Incompatibility:** AD-3 forbids "aucun store parallèle qui duplique/caches l'état d'entité HA". AD-5 requires
an immediate predicted value before HA echoes — which **is** a short-lived local copy of anticipated entity
state. The spine never reconciles the two, so a strict reading of AD-3 makes the `useState`-overlay widget a
violation while the "style-only" widget is compliant — yet the style-only approach can't actually show a
predicted *value* (new temperature, new shutter position), only a pressed style, so it under-delivers AD-5 for
non-binary domains. Two reasonable implementations diverge and each can cite the spine.

**Fix — carve-out (fold into AD-11 or AD-3):** explicitly permit an **optimistic pending-command layer** that
is short-lived, per-entity, discarded on echo/timeout, and architecturally distinct from a *persistent entity
cache* (which remains forbidden by AD-3). Naming the two layers separately removes the contradiction.

---

## Summary of proposed spine changes

| Hole | AD action |
| --- | --- |
| F1 Per-widget optimism races on shared entity; scene-mutated entities have no optimistic owner | **New AD-11** — optimistic pending state keyed per entity_id, single shared reconciliation store, last-command-wins |
| F2 Binary reconcile breaks covers/climate (transitional states → false revert) | **Tighten AD-5** — converge-toward-target semantics; per-domain optimistic model + timeout policy |
| F3 Staleness ≠ WS loss; cloud/`unavailable` stale while socket healthy | **Extend AD-6** — per-entity `unavailable/unknown`/last-updated staleness, socket-independent, one canonical rendering |
| F4 One concept → two entities/domains across features | **Tighten AD-7** — mapping declares domain + service contract; one canonical entity per real-world concept |
| F5 AD-3 vs AD-5 contradiction on the optimistic overlay | **Carve-out in AD-3/AD-11** — permit bounded per-entity pending layer, distinct from forbidden persistent cache |

Non-holes worth noting (kept out of findings, proportionate): AD-1/AD-2/AD-8/AD-9/AD-10 are tight and do not
admit incompatible pairs at v1 scope — the whole write-path risk concentrates in AD-5/AD-6.
