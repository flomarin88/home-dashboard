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
- **Progress (Intent B1, 2026-07-20):** `ClimateTile` reduced to a
  temperature-only compact tile; the full controls (mode / speed / oscillation /
  power) + a 24 h temperature history chart moved to the new `/climatisation`
  detail page, over a shared `useClimate` hook. The étage section is now short,
  so the home no-scroll pressure is largely relieved. **Still to confirm on the
  wall iPad:** no-scroll on BOTH the home and the new detail page. **Remaining:**
  B2 = the Mode/Vitesse 24 h timeline on the detail page — feasibility confirmed
  (`entityHistory[].a.fan_mode` with `minimalResponse:false`); residual real-HA
  density risk only (Onecta is a polled cloud entity).
- **Progress (Intent C, 2026-07-20):** the home is now one row per floor — étage
  = [Clim, Parents, Gaspard, Nathan] (4 col), RDC = [Salon, Aspirateur] (2 col).
  The lone-Salon-at-1/3 concern above is resolved. New device-check item: the
  compact ClimateTile at 1/4 width (its −/+ stepper) — confirm it reads well.
- **Progress (Intent B2, 2026-07-20):** the Mode/Vitesse 24 h timeline shipped on
  the detail page (`ClimateTimeline`, from `useHistory(climateId,
{minimalResponse:false})`). The detail's right column is now two stacked tiles
  (Température chart + timeline) — add to the device check: no-scroll on the
  detail page. The Vitesse band's real density depends on how often HA recorded
  `fan_mode` changes on the polled Onecta entity — it degrades to fewer segments,
  never blank.
- **Progress (2026-07-25):** the no-scroll risk tracked here **did** materialise —
  the RDC row declared `grid-cols-3` while carrying 4 tiles (the `LightTile` from
  `lights()` was never counted in "RDC = [Salon, Aspirateur]"), wrapping onto a
  2nd row and clipping the bottom card on the iPad. Fixed by deriving the column
  count from the tile list (`GRID_COLS`, `Home.tsx`); the RDC row is now
  [Salon, Aspirateur, Courses, Bureau] on one row. Measured 748/748 with ~180px
  of slack. The residual, unguarded part is TD-9.

## TD-9 — L'invariant de hauteur du kiosque n'est gardé par aucun test · severity: medium

_Source: bug « carte du bas rognée » (2026-07-25), trouvé sur l'iPad, diagnostiqué
en reproduisant `main` contraint à 1024×748 dans Chrome._

- **What:** rien ne vérifie automatiquement que la home tient dans les 748px du
  viewport PWA de l'iPad. La dérivation des colonnes (`GRID_COLS`, `Home.tsx`)
  rend impossible le désaccord colonnes/tuiles qui a causé CE bug, mais une tuile
  plus haute, une police plus grande ou une 5ᵉ tuile déborderaient toujours sans
  qu'aucun test ne bronche. jsdom ne fait pas de layout : seul un navigateur réel
  peut mesurer.
- **Why deferred:** demanderait un harnais de test navigateur (Playwright ou
  vitest browser mode) — hors périmètre d'un fix de bug d'une ligne.
- **Payback trigger:** au 3ᵉ bug de débordement du kiosque, ou à l'arrivée d'un
  harnais navigateur pour une autre raison. En attendant, le garde-fou est
  manuel : mesurer `stage.scrollHeight` vs `clientHeight` avec `main` contraint à
  1024×748 dans Chrome avant toute modification de la grille de la home.
- **Note d'instrument:** le DIAG embarqué (`0c75dfa`) rapportait `ovf 0` sur
  l'iPad là où Chrome mesurait 56px de dépassement. WebKit n'a pas remonté le
  débordement des descendants dans le `scrollHeight` d'un `flex-col` +
  `overflow:hidden`. **Ne pas refaire confiance à cette mesure sur ce moteur.**

## TD-10 — Avis react-router non corrigeable par bump · severity: low (non exploitable ici)

_Source: `npm audit` du 2026-07-26 (GHSA-qwww-vcr4-c8h2), pendant la montée des
dépendances._

- **What:** `react-router` 7.12.0 – 8.2.0 est marqué high — « RSC Mode CSRF
  Bypass Allows Action Execution Before 400 Response ». `react-router-dom@^7.18.1`
  en dépend, donc **2 lignes rouges permanentes** dans `npm audit`.
- **Why deferred:** **non exploitable dans cette app.** L'avis porte sur le mode
  RSC ; le dashboard est un SPA statique servi par HA en `HashRouter`, sans rendu
  serveur, sans action ni loader serveur, sans RSC. Et il n'existe pas de
  correctif sous forme de bump : `react-router-dom` s'arrête à 7.18.1, la v8
  (corrigée en 8.3.0) ayant consolidé l'API dans `react-router` — passer au
  correctif est une **migration**, donc un intent distinct (Rule 2, Atomic
  Intent). Le « correctif » que propose `npm audit fix --force` est un
  **downgrade** en 7.11.0, soit 7 mineures de régression pour un avis hors sujet.
- **Payback trigger:** publication d'un `react-router-dom` corrigé ; OU migration
  vers `react-router` v8 entreprise pour une autre raison ; OU — et là ça devient
  **bloquant, pas différable** — introduction d'un rendu serveur, d'actions
  serveur ou du mode RSC dans l'app.

## TD-11 — Chaîne build-time de vite-plugin-pwa sans correctif amont · severity: low (build-time)

_Source: `npm audit` du 2026-07-26 — 8 des 10 vulnérabilités high restantes._

- **What:** `vite-plugin-pwa@1.3.0` → `workbox-build@7.4.1` → `@trickfilm400/rollup-plugin-off-main-thread`,
  `ejs` → `jake` → `filelist`, `minimatch`, `brace-expansion`. Toutes high.
- **Why deferred:** **aucun correctif amont n'existe** — `1.3.0` EST la dernière
  publiée, et npm ne sait proposer qu'un downgrade en `1.2.0`. Forcer par
  `overrides` injecterait des majors (`ejs` 3→6, `filelist` 1→2, `jake` 10→12)
  dans le générateur du service worker. Le mode de défaillance n'est pas « le
  build casse » (visible) mais « le SW est généré, subtilement faux » — or le SW
  porte le shell hors-ligne du kiosque (AD-6/AD-9, « never blank »). Échanger une
  exposition build-time contre un risque de corruption silencieuse du runtime de
  l'appareil est le mauvais côté du marché. **Exposition réelle : build-time
  uniquement** — `workbox-build` s'exécute pendant `vite build`, rien de cette
  chaîne n'atteint l'iPad.
- **Payback trigger:** publication d'un `vite-plugin-pwa` / `workbox-build`
  corrigé (à re-tester à chaque `npm audit`) ; OU si le build cesse d'être
  exécuté sur une machine de confiance (CI partagée, entrées non maîtrisées) —
  l'exposition build-time cesse alors d'être théorique.
- **Si on veut quand même tenter les `overrides`:** l'instrument honnête est de
  rebuild et **differ le `dist/sw.js` généré** contre la version connue bonne.
  Identique = innocuité prouvée, pas supposée.
- **Réglé au passage (2026-07-26):** `fast-uri` (même chaîne, via `ajv`) corrigé
  par `npm audit fix` non forcé — 11 → 10 vulnérabilités.
