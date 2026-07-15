---
baseline_commit: c9ed4e4804eb6e1ca009f1819e6aa3b7c71b8559
---

# Story 1.5: Ambiance — capteurs Netatmo (4 pièces)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Florian,
I want voir la **température, le CO₂ et l'humidité** de mes 4 pièces sur l'écran d'accueil, en direct,
so that je connais l'ambiance de la maison d'un coup d'œil — c'est la première story où de **vraies données HA** s'affichent sur le dashboard.

## Acceptance Criteria

1. **4 cartes capteurs (FR1 / UX-DR4).** La zone **Ambiance** de l'accueil affiche 4 cartes (Salon, Chambre Parents, Nathan, Gaspard). Chaque carte : **température = valeur de coup d'œil (grande, `numeric-lg`, tabular-nums)** ; **CO₂ + humidité en secondaire** (`meta`). Les entités viennent de **`roomSensors(roomId)`** (mapping 1.4) + **`useEntity`** — **aucun `entity_id` en dur** (AD-7).
2. **Live, sans cache (AD-3).** Quand HA pousse un changement d'état, la carte se rafraîchit via l'abonnement `@hakit` (pas de cache persistant qui recopie l'état). Une entité `unavailable`/`unknown`/absente **ne casse pas** la carte (afficher `—` ; l'indicateur d'obsolescence complet — pill « Hors ligne » + horodatage — est **Story 1.6**, pas ici).
3. **Route Détail de pièce posée (AD-10).** Taper une carte **navigue** vers `/room/:roomId` (page **stub** ; la page complète = Epic 5). Introduit le **routing** dans l'app.
4. **Non-bloquant + gates.** Le chrome du shell reste visible pendant `connecting`/`disconnected` (AD-6/NFR4 — jamais de blanc/login). `build` + `typecheck` + `lint` + `test` **verts**. **Preuve live (Florian)** : les 4 pièces affichent les vraies valeurs et se rafraîchissent.

## Tasks / Subtasks

- [x] **Task 1 — `RoomSensorCard` + formatage** (AC: 1, 2) — **TDD**
  - [x] `src/widgets/RoomSensorCard.tsx` : prop `room`. Lit les 3 capteurs via `roomSensors(room)` → `useEntity(id as EntityName, { returnNullIfNotFound: true })`. Label + température grande (`numeric-lg`, tabular-nums, unité depuis `attributes.unit_of_measurement`) + CO₂/humidité en `meta`. `<button>` tappable.
  - [x] Formatage pur `src/widgets/room-sensor-format.ts` (`formatSensorValue(state, decimals)` → `—` si absent/non-numérique) — **TDD** (2 tests). Test composant (mock `@hakit` + `MemoryRouter`) : rendu valeurs + navigation (2 tests).
  - [x] Réutilise tokens ; nouveau composant (pas `DeviceTile`). Cible tap large (tuile `min-h-tile-h`).
- [x] **Task 2 — Câbler les 4 cartes dans la zone Ambiance** (AC: 1)
  - [x] `Home.tsx` : zone Ambiance = `listRooms().map(<RoomSensorCard room=… />)` **gardée sur `isConfigured`** (sinon « HA non configuré » — évite un `useEntity` hors provider). Autres zones = placeholders.
- [x] **Task 3 — Routing + route détail stub** (AC: 3) — dépendance **approuvée** (Florian)
  - [x] `react-router-dom@7.18.1` installé (0 vuln). `App.tsx` : `<BrowserRouter>` → (`isConfigured` ? `HakitProvider loading={<Home/>}` : —) → `<Routes>` (`/`→Home, `/room/:roomId`→`RoomDetail` stub).
  - [x] `RoomSensorCard` : tap → `navigate('/room/' + room)`. `RoomDetail` lit `useParams` → label pièce + « à venir (Epic 5) ».
- [x] **Task 4 — Live + dégradation minimale** (AC: 2, 4)
  - [x] Live via abonnement `@hakit` (AD-3, pas de cache). Entité absente/`unavailable` → `—` (`returnNullIfNotFound` + `formatSensorValue`), sans crash. Pill obsolescence = 1.6.
  - [x] Chrome non-bloquant préservé (`loading={<Home/>}` ; cartes `—` tant que non ready). Remount shell (1.3 #2) toujours différé.
- [x] **Task 5 — Validation** (AC: 4)
  - [x] `build` + `typecheck` + `lint` (oxlint src) + `test` (21) **verts** ; 0 `entity_id` en dur hors `src/entities/`. Fix infra test : `@hakit/core` inliné dans vitest (import CJS `lodash`) + `VITE_HA_URL=''` en env test (déterminisme).
  - [ ] **⏳ Preuve device (Florian, review)** : les 4 pièces affichent les vraies temp/CO₂/humidité, se rafraîchissent au changement HA ; taper une carte ouvre le stub. Non observable côté agent (nécessite HA + appareil).

## Dev Notes

**Portée stricte.** Cette story livre **les 4 cartes capteurs live dans la zone Ambiance + le routing + une route détail stub**. **Hors scope** (ne pas construire) :
- **Page Détail de pièce complète** (appareils + historique capteurs) → **Epic 5** (ici : stub `/room/:roomId`).
- **Indicateur d'obsolescence complet** (pill « Hors ligne » + horodatage + détection par entité) → **Story 1.6**. Ici : juste `—` si `unavailable`, sans crash.
- **Autres zones** (Éclairage/Volets/Climatisation/Scènes) → leurs epics ; restent des placeholders.
- **Route Caméras** → Epic 4.
- **Résolution du remount shell** (1.3 #2) → différé.

**Continuité (Stories 1.1–1.4, done).**
- **Mapping 1.4 (done)** : `roomSensors(room)` renvoie les 3 capteurs (temp/co2/humidity) avec les **vrais entity_id Netatmo** déjà câblés. **Ne jamais coder un `entity_id` en dur** ici — tout vient de `src/entities/`. `entityId` est typé `string` → **caster en `EntityName`** au bord `useEntity`.
- **`@hakit` `useEntity(id, { returnNullIfNotFound: true })`** : renvoie l'entité live (`.state`, `.attributes.unit_of_measurement`) ou `null` si absente — la carte gère `null`/`unavailable` → `—`. L'abonnement rafraîchit tout seul (AD-3, pas de cache).
- **Provider** : les cartes DOIVENT être **sous `HakitProvider`** (contexte HA). App 1.3 : `if(!isConfigured) <Home/> ; else <HakitProvider loading={<Home/>}><Home/></HakitProvider>`. Le fallback `loading` **partage le contexte** du provider (HassConnect monte le provider autour de `loading` ET `children`) → `useEntity` dans le shell en cours de connexion renvoie `null` (→ `—`), sans crash. Ajouter le `BrowserRouter` **au-dessus** de `HakitProvider`.
- **Tokens/composants 1.2** : `SectionCard`, `numeric-lg`/`meta`/`tabular-nums`. Attention **cascade Tailwind v4** (leçon 1.2) : styling d'état via CSS unlayered si besoin, vérifier le CSS émis.
- **Tests** : baseline vitest (1.3). Pour tester un composant qui appelle `useEntity`, **mocker `@hakit/core`** (`vi.mock`) OU tester le **formatage pur** extrait (préféré, sans mock). Le live WS lui-même = preuve device, non unit-testé.
- **Gate** : `build` + `typecheck` + `oxlint src` + `test`. Build prod token-less (garde AD-8). `verbatimModuleSyntax`/`noUnusedLocals`.

**Netatmo — valeurs.** État capteur = la valeur (string numérique) ; `attributes.unit_of_measurement` = `°C` / `ppm` / `%`. Température : afficher arrondi 1 décimale + °C, grande. CO₂ : entier + ppm. Humidité : entier + %. `tabular-nums` sur les 3.

**Routing (react-router-dom v7.x — compat React 19 vérifiée).**
- Structure : `<BrowserRouter><HakitProvider loading={<Home/>}><Routes><Route path="/" element={<Home/>}/><Route path="/room/:roomId" element={<RoomDetail/>}/></Routes></HakitProvider></BrowserRouter>`. (La branche `!isConfigured` peut rendre `<BrowserRouter>` + routes sans provider.)
- `RoomSensorCard` utilise `useNavigate()` ; tap → `navigate('/room/' + room)`. `RoomDetail` lit `useParams()` → `roomId`, affiche `getRoom(roomId).label` + « Détail à venir (Epic 5) ».
- PWA (1.3) : `navigateFallback: '/index.html'` sert déjà le shell sur `/room/:id` (deep-link offline OK).

### Project Structure Notes

- `RoomSensorCard` → `src/widgets/` (spine : widgets par feature ; retirer `.gitkeep`). Pages → `src/pages/` (`RoomDetail.tsx` stub). Formatage pur → `src/widgets/` ou `src/ui/` (module testable).
- Fichiers NEW : `src/widgets/RoomSensorCard.tsx`, `src/widgets/room-sensor-format.ts` (+ test), `src/pages/RoomDetail.tsx`. UPDATE : `src/App.tsx` (router), `src/pages/Home.tsx` (zone Ambiance peuplée), `package.json` (react-router-dom). DELETE : `src/widgets/.gitkeep`.
- **Aucun `entity_id` en dur** — tout via `src/entities/`.

### References

- [Source: epics.md#Story 1.5 (FR1, UX-DR4) · Story 1.6 (obsolescence, séparée)]
- [Source: EXPERIENCE.md#Component Patterns (Room sensor card : tap = open room detail, never blank) · Information Architecture (température = glance value ; CO₂/humidité secondaires ; history en Room detail)]
- [Source: DESIGN.md#room-sensor-card (numeric-lg temp, meta CO₂/humidité) · Typography (tabular-nums)]
- [Source: ARCHITECTURE-SPINE.md#AD-3 (source réactive unique, pas de cache) · AD-7 (mapping, pas d'entity_id en dur) · AD-10 (routes pages profondes) · AD-6/NFR4 (jamais blanc — pill complète = 1.6)]
- [Source: Story 1-4 (done) — `roomSensors`/`sensor`, vrais entity_id Netatmo câblés, `EntityEntry`]
- [Source: Stories 1-1..1-3 (done) — `HakitProvider`/`useEntity`, `SectionCard`/tokens, shell non-bloquant, baseline vitest, garde AD-8, PWA navigateFallback]
- [Web/registry: `react-router-dom@7.18.1` (peer react ≥18) ; `@hakit/core` `useEntity`]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Liza Pairing mode, Autonomous).

### Debug Log References

- **`@hakit/core` + vitest** : `@hakit/core` fait `import { clamp } from 'lodash'` (CJS named import) → `Home.test` (qui importe la vraie lib via `RoomSensorCard`) plantait (`Named export 'clamp' not found`). Fix : `test.server.deps.inline: ['@hakit/core','@hakit/components']` (vitest transforme la lib). `RoomSensorCard.test` ne voit pas ça car il **mocke** `@hakit`.
- **Déterminisme test** : `.env.local` (URL+token de Florian) est chargé par vitest → `isConfigured` deviendrait vrai et `Home` rendrait les cartes (crash useEntity/router). Fix : `test.env: { VITE_HA_URL:'' }` → `isConfigured=false` en test, `Home` rend le placeholder.
- **Crash hors provider** : `Home` importe `RoomSensorCard` (→ `useEntity`). Rendu **gardé sur `isConfigured`** : sans provider (non configuré) → placeholder, pas de `useEntity`. Import de la lib OK (pas d'appel de hook).

### Completion Notes List

- **AC1–AC4 satisfaits (automatisable).** 4 `RoomSensorCard` live dans la zone Ambiance (température = coup d'œil, CO₂/humidité secondaires) via `roomSensors` (0 entity_id en dur) + `useEntity` (AD-3) ; routing `react-router-dom` + route `/room/:roomId` stub ; tap → navigate. Build/typecheck/lint/test (21) verts.
- **TDD** : `formatSensorValue` (pur, 2 tests) + `RoomSensorCard` (mock @hakit + MemoryRouter : rendu + navigation, 2 tests).
- **Dégradation minimale** : `unavailable`/absent → `—`. La **pill obsolescence complète (horodatage, détection socket/entité) = Story 1.6**.
- **`RoomDetail` = stub** (label + « à venir ») — page complète = Epic 5. Autres zones = placeholders.
- **Preuve device (Florian)** = étape review : vraies valeurs affichées + rafraîchies + tap→stub.
- Nouvelle dép : `react-router-dom@7.18.1` (approuvée). Findings 1.3 différés (#2 remount) toujours ouverts.

### File List

**Créés :**
- `src/widgets/RoomSensorCard.tsx`, `src/widgets/RoomSensorCard.test.tsx`
- `src/widgets/room-sensor-format.ts`, `src/widgets/room-sensor-format.test.ts`
- `src/pages/RoomDetail.tsx`
- **(v0.2)** `src/config.ts` (seuil global) ; `src/widgets/sparkline-scale.ts` (+ test) ; `src/widgets/Sparkline.tsx` (+ test)

**Modifiés :**
- `src/App.tsx` (BrowserRouter + Routes + RoomDetail ; branche `isConfigured`)
- `src/pages/Home.tsx` (zone Ambiance = 4 cartes gardées sur `isConfigured`)
- `vitest.config.ts` (`server.deps.inline` @hakit ; `env` VITE_HA_URL vide)
- `package.json` / `package-lock.json` (react-router-dom)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-5 → review)

**Supprimés :**
- `src/widgets/.gitkeep`

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-15 | 1.0 | **Accepté par Florian → Status: done.** Parties automatisables vérifiées (27 tests, typecheck/lint/build, 0 entity_id en dur, 0 token). **Preuve live device (valeurs + sparkline sur vraies données)** reste à confirmer par Florian une fois connecté au HA (actuellement absent du réseau local) — non observée à ce stade. |
| 2026-07-15 | 0.2 | **Ajout demandé par Florian** : mini-courbe de température (sparkline SVG maison, 24 h via `useHistory`) sur chaque tuile Ambiance + ligne pointillée à un **seuil global configurable** (`TEMPERATURE_THRESHOLD_C = 26` dans `src/config.ts`). **Override assumé** de la décision UX « historique → Détail de pièce » (densité accueil) — choix owner. TDD (`computeSparkline` + composant `Sparkline`), 27 tests. Nécessite HA (visible une fois connecté). Build/typecheck/lint verts. |
| 2026-07-15 | 0.1 | Zone Ambiance live : 4 `RoomSensorCard` (temp coup d'œil + CO₂/humidité) via `roomSensors` + `useEntity` (AD-3, 0 entity_id en dur) ; routing `react-router-dom` + route détail stub `/room/:roomId` + tap navigate. **TDD** (formatSensorValue + composant), 21 tests verts. Build/typecheck/lint verts, aucun token. Preuve device en attente (review). → review. |
