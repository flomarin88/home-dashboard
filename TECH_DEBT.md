# Tech Debt

Deliberate deferrals, each with **what · why deferred · payback trigger** (per the
Core contract). Deliberate debt is fine; undocumented debt is just bugs.

Opened from the Epic 1 retrospective (`_bmad-output/implementation-artifacts/epic-1-retro-2026-07-15.md`).

---

## TD-1 — Shell remounts on HA (re)connect · ✅ PAID (Story 2.1)

_Source: Story 1.3 code-review finding #2. Resolved: Story 2.1 (2026-07-15)._

- **What:** `App` passed `<Home/>` as both `HassConnect`'s `loading` fallback **and**
  its children. On connect (and every reconnect) HassConnect swaps loading→children,
  so `Home` unmounted and a fresh `Home` mounted — the `Clock` interval restarted and any
  component state was lost.
- **Fix (Story 2.1):** introduced `KioskShell` (App.tsx) — the ground + `TopBar` (which
  runs the Clock) now live **above** the connection gate; `HakitProvider` wraps only the
  data zones, with a `ConnectingZones` skeleton fallback. A (re)connect now remounts only
  the data zones (they degrade via `useEntityValue`), never the shell or Clock. `TopBar`
  extracted to `src/ui/TopBar.tsx`; `Home`/`RoomDetail` became content-only (shell owns the
  ground). Note: because the pending layer (AD-11) is a module-level Zustand store, in-flight
  optimistic state already survived a remount — so this fix is about chrome/Clock stability
  and structural correctness, not saving pending state.
- **Follow-up (minor):** `TopBar` is now persistent across routes (also shows on the
  `RoomDetail` stub). Fine for the kiosk; revisit when Epic 5 designs RoomDetail.

## TD-2 — Test files are not type-checked · severity: low

_Source: Story 1.3 code-review finding #5._

- **What:** `tsconfig.app.json` excludes `*.test.*` from `tsc -b`, and Vitest transpiles
  via esbuild without type-checking — so a type error in a test (wrong prop, renamed
  export, bad import) is caught by nothing until it blows up at runtime.
- **Why deferred:** tooling nicety; low risk; keeps the build/typecheck fast and clean.
- **Payback trigger:** when a test type-error slips through, or when test complexity grows.
  Options: `vitest --typecheck`, or a test-scoped tsconfig added to the build graph.

## TD-3 — Foundation unverified on real HA · severity: medium (verification, not code)

_Source: Epic 1 retrospective._

- **What:** Epic 1 stories were accepted with **live/device proof pending** (owner away
  from the LAN). The dashboard has not been run end-to-end against real Home Assistant
  this cycle — the offline/loading behaviour, live sensors, and PWA kiosk are all
  machine-verified but not eyeballed on real data.
- **Why deferred:** HA is LAN-only and the owner was off-network.
- **Payback trigger:** once Tailscale + the deploy secrets are set — run the E2E proof
  (all four rooms live + refresh, offline degradation, warm PWA start, tap→room stub).

## TD-4 — Top-bar HA widgets are hand-placed `fixed` siblings · ✅ PAID (Story 6.4)

_Source: Story 6.2 (2026-07-16). Recurring since 6.1. **Paid 2026-07-17 (Story 6.4):**
extracted `src/ui/TopBarSlots.tsx` — a `fixed` flex region mounted under the provider
that flows its HA children (`TopBarWeather`, `BinTile`, and the turtle in 6.3) instead of
per-tile coordinates; a conditional tile that renders `null` now leaves no gap. Final
on-device offsets validated in 6.4's device-proof (Florian)._

- **What:** HA-backed top-bar elements (`BinTile` 6.1, `TopBarWeather` 6.2) can't live in
  `TopBar` (it's above the connection gate, TD-1), so each is a `fixed`-positioned sibling
  mounted under the provider in `KioskShell`, with hand-tuned coordinates to avoid overlap
  (weather left `left-44`, bins centered). This is now the **3rd** top-bar element and the
  placement is coordinate-fragile — a 4th will make collisions likely, and the offsets are
  guesses until validated on the real iPad.
- **Why deferred:** two/three elements are manageable; a real composition layer is scope
  the current stories don't need.
- **Payback trigger:** a 4th HA top-bar element, or an observed overlap on-device. Then
  extract a `TopBarSlots` layout (a `fixed` fl/grid region under the provider that lays
  out its HA children) so elements flow instead of being individually positioned.

## TD-5 — Half-open WebSocket freezes data silently (no auto-refresh) · severity: HIGH · diagnosed, fix pending

_Source: bug report 2026-07-18 ("dashboard not refreshing, last temp data 30 min late").
Root-caused this session; fix proposed & approved-pending._

- **Symptom (observed on the iPad kiosk):** the dashboard stops refreshing — a temperature
  value was ~30 min stale. **No** stale/offline pill was shown (data looked normal), the
  panel did **not** recover on its own (a manual reload fixed it), and it is **recurring**.
- **Root cause:** all live data flows through the single `@hakit` `HassConnect` WebSocket
  (AD-2); there is **no polling**. `home-assistant-js-websocket` drives reconnect **only**
  from the socket `close`/`error` event (`socket.js:100-101` → `connection.js:66
_handleClose` → `reconnect`); it has **no periodic heartbeat** (`ping()` exists at
  `connection.js:239` but is never called on an interval). `connected` is just
  `socket.readyState == OPEN` (`connection.js:143`). On iOS the OS silently tears down the
  socket's TCP connection (screen dim / power mgmt / network handoff) **without firing
  `close`** → the socket sits half-open: `readyState` stays OPEN → `connectionStatus` stays
  `"connected"` → `isStale()` (`src/hakit/stale.ts`) returns false → no reconnect, no pill,
  frozen data until a fresh socket is opened by reload.
- **Why the three observations confirm it:** no pill rules out @hakit's clean suspend (that
  sets status `"suspended"` → pill; see `handleSuspendResume.js`, `hiddenDelayMs` 5 min);
  reload-fixes-it proves the server had newer data (client socket was dead, not the sensor);
  recurring matches a systematic connection failure. The freeze happens while the page is
  still **visible** (no `visibilitychange` fired), which is why neither the suspend path nor
  a resume-triggered reload would catch it.
- **Proposed fix (approved-pending):** add the missing socket-liveness heartbeat.
  New `useConnectionWatchdog()` hook in `src/hakit/`, mounted once (render-null component)
  **inside** `HakitProvider` (needs `useHass`). It reads `connection` from
  `useHass((s) => s.connection)` — the public store exposes `connection: Connection | null`
  (in `DATA_KEYS`). While `document.visibilityState === "visible"` (stand down when hidden so
  it never fights @hakit's own suspend/resume), every ~30 s race `connection.ping()` against
  a 5 s timeout (a hung ping = dead socket → the timeout is the detector); on timeout call
  `connection.reconnect(true)` (force-close + reopen; the library auto-resubscribes). Also
  ping immediately on `visibilitychange`→visible / `pageshow`. During the forced reconnect
  the library emits disconnect→ready, so tiles show the stale pill briefly then refresh —
  honest, not silent.
  - **Test:** `useConnectionWatchdog.test.ts` (fake timers + mock `connection`): healthy
    ping → no reconnect; hung ping → `reconnect(true)` after timeout; hidden → stands down;
    resume → immediate probe.
  - **Doc:** add a liveness/heartbeat note to `docs/home-assistant.md` under AD-6.
  - **Rejected alternatives:** age-based staleness in `stale.ts` (only makes it _visible_,
    doesn't restore auto-refresh, false-positives on legitimately-stable sensors);
    `location.reload()` on resume (doesn't fire — the freeze happens while visible).
- **Why deferred:** owner switched context; logged for pickup.
- **Payback trigger:** next work session — implement the watchdog, then validate on the
  real iPad through a screen-off/idle cycle (temps advance without a reload). Related to
  TD-3 (needs on-device proof).

## TD-6 — Climate attribute optimism is a component-local overlay, not the shared pending layer · severity: low

_Source: Story 2.6 (deliberate design decision — see story Dev Notes)._

- **What:** `ClimateTile` drives the numeric setpoint + fan + swing through a component-local
  `useOptimisticAttr` overlay, NOT the shared per-`entity_id` pending layer (AD-11) used by
  lights/vacuum/climate-mode. This is deliberate: AD-11's single slot per `entity_id` is
  already taken by the hvac_mode intent, and a climate entity has several independently-set
  facets. A single tile owns the entity, so there's no cross-widget race (the harm AD-11
  prevents) — the local overlay is sound here.
- **Why deferred:** unifying attribute optimism into a per-`(entity_id, facet)` pending layer
  would change an AD-11 invariant and touch the 2.1 infra shared by lights/vacuum — out of
  scope for a single feature story, and unnecessary while only one widget owns the entity.
- **Payback trigger:** a **second** widget needs to drive the same climate entity's attributes
  (e.g. a future "Détail climatisation" page controlling the setpoint alongside the home tile),
  OR a second attribute-driven device appears. Then promote the overlay to a shared
  per-`(entity_id, facet)` pending layer so the two owners reconcile instead of racing.

## TD-7 — Climate card redesign not visually verified on 1024×768 · ✅ VERIFIED (2026-07-18, iPad)

_Source: Climate card UX redesign (2026-07-18, branch `feat/climate-card-redesign`).
Resolved: eyeballed on the wall iPad against live HA — the lower band fits with no scroll._

- **What:** the redesigned `ClimateTile` is taller than the previous version (header +
  central setpoint + 5 icon'd mode chips + two full-width segmented rows for Vitesse/
  Oscillation), and `Home` now packs it beside a left column (éclairage + aspirateur) in a
  `md:grid-cols-[1fr_1.3fr]` band. All behaviour is machine-verified (191 tests, typecheck,
  lint), but the **no-scroll invariant at 1024×768** (memory: target-device-and-layout) has
  NOT been eyeballed on a real render — jsdom has no layout, and HA data is LAN-only from the
  build machine.
- **Why deferred:** owner chose to commit as-is and verify on the wall iPad later, rather
  than block on a partial (skeleton-only) local screenshot.
- **Payback trigger:** next time the dashboard runs against live HA on the iPad — confirm the
  lower band fits with no scroll. If it overflows, reduce row heights (mode chips `min-h-[56px]`,
  segments `min-h-[48px]`) or the inter-row `gap-3` on the climate card before anything else.

## TD-8 — Home regrouped by floor: section chrome reversed + no-scroll at risk until climate is compacted · severity: medium (temporary)

_Source: U1 rework (2026-07-20) — floor pills replaced by a floor-grouped home
("pièce d'abord, étage en en-tête léger"). Intent A of a two-part change._

- **What:** `Home` now renders two discreet floor headings ("1er étage", "RDC")
  with room cards grouped under each (`roomsOnFloor`), replacing the per-tile
  `FloorPill` (deleted). This **reverses the "tiles only — no titled section
  chrome" decision (UX-DR11 / AD-10)**, on purpose. The Climatisation card is
  still the **full control surface** (setpoint + 5 mode chips + Vitesse +
  Oscillation) placed at the top of the étage, so the **no-scroll invariant at
  1024×768** (memory: target-device-and-layout) is at risk until it is reduced.
- **Why deferred:** owner chose to lay the reversible structural "mould" first
  (Intent A), then compact `ClimateTile` to temperature-only with a dedicated
  `/climatisation` detail page (Intent B, per the provided mock) — which is what
  frees the vertical room.
- **Payback trigger:** Intent B (compact `ClimateTile` + `/climatisation` detail
  page). On landing it, re-confirm no-scroll on the wall iPad. If A ships before
  B, eyeball the iPad first; if it overflows, reduce the climate card rows (as
  TD-7) or drop it below the room row. Also open then: the RDC row shows a lone
  Salon card at 1/3 width (`grid-cols-3`) — revisit the grid when lights/glyphs
  backfill.
