---
baseline_commit: ad21f35e8d3f55b416bddff589acca077ed2a042
---

# Story 2.7: Robot aspirateur (Roborock)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Florian,
I want lancer / arrêter le ménage, renvoyer l'aspirateur à sa base, et voir son état (batterie, en charge / en ménage) depuis l'accueil,
so that je pilote le Roborock sans ouvrir son app.

## Contexte & valeur

Première tuile de pilotage **d'un vrai appareil connecté** (`vacuum.roborock_s8` — id réel fourni par Florian, **pas** un placeholder) → **première preuve device** du socle 2.1 (optimiste + convergence) sur un domaine à **états transitionnels réels** (`returning`). Domaine propre, simple, qui **réutilise l'infra existante sans la modifier** : l'aspirateur est un domaine à **état-chaîne** (`cleaning`/`docked`/`returning`/`idle`), donc `useOptimisticControl` (2.1, `T extends string`) s'applique tel quel — **aucune généralisation de hook** (contrairement à 2.5 volets / 2.6 clim qui sont numériques), **aucun undo** (appareil unique, pas d'action de groupe), **aucun nouveau token** (accent violet `--color-accent-vacuum` déjà posé en 1.2).

**Décision produit (Florian, 2026-07-16) :** `entity_id` réel `vacuum.roborock_s8` mappé directement.

## Acceptance Criteria

1. **Tuile aspirateur — état + accent violet (FR10, UX-DR17).**
   **Given** l'entité `vacuum.roborock_s8` mappée
   **When** j'ouvre l'accueil
   **Then** une tuile affiche l'**état lisible** (batterie %, et le statut : « En ménage » / « En charge » / « Retour à la base » / « En pause »/« Arrêté ») avec l'**accent violet** (`data-domain="vacuum"`), état porté par **texte (+ icône)**, pas la couleur seule (UX-DR14).
   **And** entité obsolète (`unavailable`/socket perdu) → tuile **non interactive** + « Hors ligne » (pattern 1.6, via `useOptimisticControl.isStale`), **jamais de blanc**.

2. **Commandes optimistes + convergence (AD-5).**
   **Given** la tuile aspirateur
   **When** j'appuie sur **Lancer** / **Arrêter** (le ménage) ou **Retour base**
   **Then** le service HA correspondant s'exécute (`vacuum.start` / `vacuum.stop` / `vacuum.return_to_base` via `@hakit`), avec **retour visuel optimiste < 200 ms** (NFR1) puis **convergence** vers l'état cible ; l'état **transitionnel `returning`** (trajet vers la base) est affiché comme **légitime, pas un échec** (AD-5) ; l'échec = timeout sans convergence → retour à l'état confirmé + indice « Échec ».
   **And** aucune logique d'automatisation côté client — seuls des services HA sont appelés (AD-4) ; l'intention passe par la **couche pending unique** (AD-11).

3. **Réutilisation + gates verts.**
   **Given** le modèle vacuum + la tuile
   **When** je termine
   **Then** le domaine se branche sur `useOptimisticControl` **sans le modifier** (un `ControlModel` de plus — zéro logique optimiste dupliquée), et `build` + `typecheck` + `lint` + `test` sont **verts** ; l'`entity_id` vit **uniquement** dans `src/entities/` (AD-7) ; **0 token** dans `dist/`.

## Tasks / Subtasks

- [x] **Task 1 — Mapper l'entité vacuum** (AC: 1, 3)
  - [x] `src/entities/mapping.ts` : ajouter une section `VACUUM` (comme `SENSORS`/`LIGHTS`) avec l'entrée **réelle** `{ entityId: 'vacuum.roborock_s8', room: 'salon', domain: 'vacuum', service: 'vacuum.start' }` (pas de `placeholder`). L'ajouter à `ENTITIES`. (`room` : l'aspirateur n'a pas de pièce canonique ; utiliser `salon` par défaut — le mapping exige un `room`. Noter que `room` n'est pas signifiant ici.)
  - [x] Accesseur `vacuum(): EntityEntry | undefined` (ou `vacuums()`), cohérent avec `lights()`/`roomSensors()`. `assertCanonicalMapping` passe (`vacuum.roborock_s8` bien formé + unique). `EntityDomain` inclut déjà `'vacuum'`.

- [x] **Task 2 — Modèle de contrôle vacuum** (AC: 2) — **TDD**
  - [x] `src/state/control-model.ts` : `export type VacuumTarget = 'cleaning' | 'idle' | 'docked'` + `vacuumModel: ControlModel<'vacuum', VacuumTarget>` :
    - `isConverged(target, state) => state === target`
    - `isTransitional(state) => state === 'returning'` (trajet vers la base — pas un échec, AD-5)
    - `apply(entity, target)` : `cleaning → entity.service.start()` ; `docked → entity.service.returnToBase()` ; `idle → entity.service.stop()`
    - `timeoutMs ≈ 10000` (la commande doit prendre effet en ~10 s ; le long trajet `returning` est transitionnel, donc pas de timeout-échec pendant le retour).
  - [x] Tests : `isConverged` ; `isTransitional('returning')===true`, `('cleaning')===false` ; `apply` appelle le bon service par cible (mock `entity.service`).
  - [ ] **⚠️ Point à vérifier au device-proof :** confirmer que `vacuum.stop` mène l'S8 à l'état **`idle`** (et non `paused`). Si l'intégration renvoie `paused` sur stop, ajuster la cible « Arrêter » (`idle` → `paused`) — noté en Dev Notes. Ne pas deviner : vérifier sur l'appareil.

- [x] **Task 3 — Widget `VacuumTile`** (AC: 1, 2) — **TDD (composant)**
  - [x] `src/widgets/VacuumTile.tsx` : compose `useOptimisticControl(id, vacuumModel)` (état optimiste + `isStale` + `failed` + `send`) **et** un `useEntity(id)` direct pour l'attribut **`battery_level`** (le hook de contrôle n'expose pas les attributs ; 2 abonnements même id, dédupliqués par `@hakit`).
    - **Rendu** : conteneur tuile givré (tokens `tile-fill`/`tile-border`), `data-domain="vacuum"` (accent violet), **statut** (label FR mappé depuis `displayState` — voir Dev Notes) + **batterie** (`Batterie {battery_level} %`, `tabular-nums` ; `—` si absent), et **contrôles ≥48px** : toggle **Lancer/Arrêter** (`cleaning`→"Arrêter"/`send('idle')` ; sinon "Lancer"/`send('cleaning')`) + bouton **Retour base** (`send('docked')`, masqué/désactivé si déjà `docked`).
    - `failed` (timeout) → indice « Échec » (texte, pas couleur seule — pattern `LightTile` 2.2). `isStale` → tuile non interactive + « Hors ligne » (pattern 1.6).
  - [x] A11y (NFR2/UX-DR14) : boutons ≥48px, rôle bouton, état par texte+icône. Voix FR : « Lancer », « Arrêter », « Retour base » (UX-DR15).
  - [x] Test composant (mock `@hakit` `useEntity`/`useHass`, patron `RoomSensorCard.test`) : `docked` + batterie → statut « En charge » + « Batterie X % » ; tap « Lancer » → optimiste `cleaning` (« En ménage ») + `vacuum.start` appelé ; `returning` → statut « Retour à la base », transitionnel (pas d'échec) ; déconnecté → non interactif « Hors ligne ».

- [x] **Task 4 — Placer la tuile sur l'accueil** (AC: 1)
  - [x] `src/pages/Home.tsx` : ajouter une section **« Aspirateur »** (l'IA — EXPERIENCE.md — ne prévoit pas de zone aspirateur ; une `SectionCard title="Aspirateur"` dédiée après la rangée Éclairage/Volets/Climatisation est le choix par défaut, **facilement déplaçable**). Gater par `isConfigured` (comme Ambiance/Éclairage) : la tuile lit HA via `@hakit`, donc rendue sous le provider seulement.
  - [x] Ne pas régresser le shell (TD-1) ni les zones existantes.

- [x] **Task 5 — Validation (gates)** (AC: 3)
  - [x] `npm run build` (sans token) + `npm run typecheck` + `npm run lint` + `npm run test` **verts**. Pré-commit sur les fichiers touchés.
  - [x] **0 `entity_id` en dur** dans le code non-test hors `src/entities/` ; **0 token** dans `dist/`.
  - [ ] **⏳ Preuve device (Florian, review) — ENFIN RÉELLE :** l'S8 étant connecté, éprouver de bout en bout : accueil → tuile montre batterie + statut réel ; **Lancer** → l'aspi démarre, statut « En ménage » < 200 ms puis converge ; **Retour base** → statut « Retour à la base » (transitionnel) puis « En charge » sans timeout-échec ; **Arrêter** → statut confirmé (vérifier `idle` vs `paused`) ; couper HA en pleine commande → timeout → « Échec » + retour à l'état confirmé ; entité obsolète → « Hors ligne ». **C'est la 1ʳᵉ validation device du socle 2.1 sur un vrai appareil.**

## Dev Notes

**Portée stricte.** 2.7 livre : (a) le **mapping** de l'entité vacuum réelle, (b) le **`vacuumModel`**, (c) la **tuile `VacuumTile`** (état + batterie + 3 actions), (d) sa **place sur l'accueil**. **Hors scope — NE PAS construire :**
- **Vitesse d'aspiration (`fan_speed`), nettoyage de zone (`clean_spot`), `locate`, `send_command`** → hors ACs (FR10 = lancer/arrêter/retour base + état). Ne pas les ajouter.
- **Undo / toast** → l'aspirateur est un **appareil unique** sans action de groupe à fort impact ; **pas de `offerUndo`** ici (undo = 2.2, déclenché par les master/scènes).
- **Généralisation numérique du hook** → **pas** nécessaire (vacuum = état-chaîne). C'est 2.5 (volets, position) / 2.6 (clim, consigne) qui l'exigeront.
- **Nouveau token / nouvel état visuel `DeviceTile`** → l'accent violet existe déjà (1.2). La tuile réutilise les tokens de tuile ; pas de nouveau token.
- **Room detail** → Epic 5.

**Continuité (Stories 2.1 + 2.2, done — commit `ad21f35`).**
- **`useOptimisticControl` (`src/hakit/useOptimisticControl.ts`)** — `useOptimisticControl<D extends AllDomains, T extends string>(entityId, model)` → `{ displayState, isPending, isTransitional, isStale, failed, send }`. **Se branche tel quel** (vacuum = `T = VacuumTarget extends string`). `send(target)` = optimiste (<200 ms) + `model.apply` (services HA) + convergence ; `isTransitional` déjà géré (revue 2.2 : le timeout ne fait plus échouer un état transitionnel — **2.7 en est la 1ʳᵉ preuve avec un vrai `returning`**) ; `isStale` (offline) rend `send` no-op ; `failed` (timeout) exposé.
- **`ControlModel<D, T extends string>` + `lightModel` (`src/state/control-model.ts`)** — ajouter `vacuumModel` à côté ; même forme (`isConverged`/`isTransitional?`/`apply`/`timeoutMs`).
- **Couche pending (`src/state/pending.ts`, AD-11)** — utilisée par le hook ; rien à faire directement.
- **`LightTile` (`src/widgets/LightTile.tsx`)** — **patron de référence** pour `VacuumTile` : compose le hook, gère `isStale`/`failed`/`displayState`, dresse une tuile. La différence : la tuile aspirateur est un **cluster de contrôle** (statut + batterie + plusieurs boutons), pas une tuile binaire → widget custom (comme le sera `shutter-control`), pas `DeviceTile`. Réutiliser les **tokens** (`tile-fill`/`tile-border`, `data-domain`) et le pattern accent CSS.
- **`mapping.ts` / `ENTITIES` (AD-7)** — seul endroit des `entity_id`. Ajouter la section `VACUUM`. `EntityDomain` inclut déjà `'vacuum'`.
- **`isConfigured` / gating** (`Home`) — la tuile lit HA ⇒ rendue sous le provider seulement (comme Ambiance/Éclairage).

**API `@hakit` vacuum (vérifiée dans les types `@hakit/core` 6.0.2, 2026-07-16) — ne pas deviner :**
- `useEntity('vacuum.roborock_s8')` → `state` (`'cleaning'|'docked'|'idle'|'paused'|'returning'|'error'|…`) + `attributes.battery_level` (number) + `attributes.status`/`fan_speed`.
- `entity.service` : `start()`, `stop()`, `pause()`, `returnToBase()`, `cleanSpot()`, `locate()`, `setFanSpeed({ serviceData: { fan_speed } })` (variante ciblée sur l'entité). **N'utiliser que** `start` / `stop` / `returnToBase`.
- Accès HA **via `@hakit` uniquement** (AD-2).

**Mapping statut FR (depuis `displayState`) :** `cleaning` → « En ménage » ; `docked` → « En charge » (à la base) ; `returning` → « Retour à la base » ; `paused` → « En pause » ; `idle` → « Arrêté » ; `error` → « Erreur » ; défaut → l'état brut. (Fonction pure testable, ex. `vacuumStatusLabel(state)` dans `widgets/` — cf. `room-sensor-format`.)

**Tests (baseline Vitest, cf. 2.1/2.2) :**
- `vacuumModel` : unitaires purs (isConverged / isTransitional / apply avec `entity.service` mocké — `as unknown as HassEntityWithService<'vacuum'>`).
- `vacuumStatusLabel` : pur (chaque état → label).
- `VacuumTile` : mock `@hakit` (`useEntity` renvoyant state + `attributes.battery_level` ; `useHass(connectionStatus)`) via `vi.hoisted` + `vi.mock('@hakit/core')` (patron `RoomSensorCard.test`/`LightTile.test`) ; état mutable. Reset `usePendingStore` entre tests. Fake timers pour le cas « Échec » (timeout) si testé.
- Gate : `verbatimModuleSyntax` + `noUnusedLocals/Parameters` → imports `type` explicites. **TD-2** : les tests ne sont pas typecheckés par `tsc -b`.

### Project Structure Notes

- **NEW** : `src/state/control-model.ts` (UPDATE en fait — ajout `vacuumModel`) ; `src/widgets/VacuumTile.tsx` (+ `.test.tsx`) ; éventuel `src/widgets/vacuum-status.ts` (+ test) pour `vacuumStatusLabel`.
- **UPDATE** : `src/state/control-model.ts` (+ `.test.ts`), `src/entities/mapping.ts` (+ `.test.ts`, section `VACUUM` + accesseur), `src/pages/Home.tsx` (+ `.test.tsx` si assertion de zone) (section Aspirateur), `_bmad-output/implementation-artifacts/sprint-status.yaml` (2-7 → in-progress → review).
- **Placement / direction de dépendance** : `widgets/VacuumTile` → `hakit/useOptimisticControl` + `state/control-model` + `entities`. Jamais l'inverse.
- **Style** : Tailwind/TailAdmin primaire ; accent via `data-domain="vacuum"` (pas de classe Tailwind construite dynamiquement — leçon cascade 1.2) ; cibles ≥48px ; texte+icône.

### Décisions ouvertes / dépendances

- **`vacuum.stop` → `idle` vs `paused`** : à confirmer sur l'S8 au device-proof ; ajuster la cible « Arrêter » si besoin (Task 2).
- **Placement accueil** : section « Aspirateur » dédiée par défaut (l'IA ne la prévoit pas) ; déplaçable selon le rendu réel.
- **`battery_level` absent** : géré (`—`) ; l'S8 le rapporte normalement.
- **Preuve device réelle** : 1ʳᵉ opportunité de valider le socle 2.1 sur un vrai appareil (Roborock connecté). Clôt en partie l'action item rétro « Gather Epic-2 control entity_ids » (au moins pour le vacuum).

### References

- [Source: epics.md#Story 2.7 (FR10 lancer/arrêter/retour base + état batterie ; accent violet ; optimiste+convergence) · #UX-DR17 (Tuile aspirateur)]
- [Source: ARCHITECTURE-SPINE.md#AD-5 (optimiste + convergence, transitionnel ≠ échec) · #AD-11 (couche pending) · #AD-4 (services HA only) · #AD-7 (mapping entity_id) · #AD-2 (accès via @hakit) · #AD-6 (obsolescence)]
- [Source: DESIGN.md#accent-vacuum (violet #a06bff, déjà token) · a11y (texte+icône, ≥48px)]
- [Source: EXPERIENCE.md#Information Architecture (zones accueil — pas de zone aspirateur : décision de placement) · Voice (labels d'action FR)]
- [Source: Story 2.1 (done, `ad21f35` — `useOptimisticControl`, `ControlModel`, pending) · Story 2.2 (done — `failed`→« Échec » dans `LightTile`, patron à réutiliser) · Story 1.6 (`isStale`/offline) · Story 1.2 (`DeviceTile`, accent violet, tokens)]
- [Source: @hakit/core 6.0.2 types — `vacuum` services (`start`/`stop`/`returnToBase`/…), `VacuumEntity` (`state`, `attributes.battery_level`) (vérifiés 2026-07-16)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Liza Pairing mode, Autonomous — Amelia dev-story).

### Debug Log References

- **`useOptimisticControl` réutilisé tel quel** — vacuum = domaine état-chaîne, `VacuumTarget extends string`. Aucune modification du hook (contrairement à ce qu'exigeront 2.5/2.6, numériques). 1ʳᵉ usage d'un vrai `isTransitional` (`returning`).
- **`VacuumTile` = 2 abonnements même id** : `useOptimisticControl(id)` (état/contrôle) + `useEntity(id)` (attribut `battery_level`). Dédupliqués par le store `@hakit`. Le hook de contrôle n'expose pas les attributs — d'où le read direct.
- **Non-null assertion évitée** dans `Home` : `const vacuumEntry = vacuum()` en tête, puis `{isConfigured && vacuumEntry ? … : null}` (oxlint `no-non-null-assertion`).
- **`vacuum.stop` → `idle` vs `paused`** : la cible « Arrêter » vise `idle` ; à confirmer sur l'S8 au device-proof (Task 2). Non vérifiable côté agent.
- **Build local bloqué par la garde AD-8** (token) — attendu ; build vérifié **sans token**, `dist/` propre, 0 token.

### Completion Notes List

- **AC1–AC3 satisfaits (automatisable).** `vacuum.roborock_s8` mappé (réel, pas placeholder) ; `vacuumModel` (start/stop/returnToBase → cibles cleaning/idle/docked, `returning` transitionnel) branché sur `useOptimisticControl` **sans le modifier** ; `VacuumTile` (statut FR + batterie + Lancer/Arrêter + Retour base, accent violet, `isStale`→« Hors ligne », `failed`→« Échec ») ; section « Aspirateur » sur l'accueil. **85 tests verts** (+10), typecheck/lint/build (sans token) verts, 0 `entity_id` en dur hors `entities/` (code non-test), 0 token.
- **Réutilisation prouvée** : un `ControlModel` de plus, zéro logique optimiste dupliquée. Le domaine transitionnel (`returning`) exerce pour de vrai le chemin `isTransitional` (posé en 2.1, durci en revue 2.2).
- **Preuve device (Florian) = review — 1ʳᵉ RÉELLE** (S8 connecté) : Lancer→En ménage, Retour base→Retour à la base (transitionnel)→En charge sans faux « Échec », Arrêter (vérifier idle/paused), offline→Hors ligne. Non observable côté agent.

### File List

**Créés :**
- `src/widgets/VacuumTile.tsx`, `src/widgets/VacuumTile.test.tsx`
- `src/widgets/vacuum-status.ts`, `src/widgets/vacuum-status.test.ts`

**Modifiés :**
- `src/entities/mapping.ts` (+ `.test.ts`) : section `VACUUM` (`vacuum.roborock_s8`, réel) + accesseur `vacuum()`
- `src/state/control-model.ts` (+ `.test.ts`) : `VacuumTarget` + `vacuumModel`
- `src/pages/Home.tsx` : section « Aspirateur » (gated `isConfigured`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (2-7 → in-progress → review)

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-16 | 1.0 | **Accepté par Florian → Status: done.** Tuile aspirateur validée sur l'S8 réel (batterie `sensor.roborock_s8_batterie`, « Lancer » = programme « Quotidien » via bouton, icônes + batterie colorée). 89 tests verts, typecheck/lint/build (sans token) verts, 0 token. Domaine branché sur `useOptimisticControl` **sans modification** (1ʳᵉ preuve device réelle du socle 2.1 + 1ᵉ vrai état transitionnel `returning`). **Suivi :** confirmer le bouton `button.salon_roborock_s8_quotidien` ; review indépendante multi-modèle (action item Florian). |
| 2026-07-16 | 0.2 | **Retours device Florian (S8 réel) :** (1) batterie vide → HA a sorti `battery_level` de l'entité vacuum ; lue depuis un **capteur séparé** `sensor.roborock_s8_battery` (`batteryEntityId` dans le mapping). (2) **« Lancer » lance le programme « Quotidien »** via `button.salon_roborock_s8_quotidien` (`startButtonEntityId`) — `vacuumModel.apply('cleaning')` devient no-op ; `VacuumTile` presse le bouton via `useService('button')` + `send('cleaning')` (optimiste/convergence conservés). (3) **Icônes + couleurs** : icône de statut par état + batterie **colorée par niveau** (vert ≥50 / ambre ≥20 / rouge <20, éclair si en charge). Helpers purs `parseBattery`/`batteryColorClass`. 89 tests verts, gates verts. Batterie confirmée par Florian = `sensor.roborock_s8_batterie` (orthographe FR). Bouton `button.salon_roborock_s8_quotidien` encore à confirmer. |
| 2026-07-16 | 0.1 | Robot aspirateur Roborock (FR10) : `vacuum.roborock_s8` mappé (réel) ; `vacuumModel` (start/stop/returnToBase, `returning` transitionnel) sur `useOptimisticControl` **réutilisé sans modification** ; `VacuumTile` (statut FR + batterie + 3 actions, accent violet, offline/échec) ; `vacuumStatusLabel` ; section « Aspirateur » accueil. 85 tests verts, typecheck/lint/build (sans token) verts, 0 token. 1ʳᵉ tuile d'un vrai appareil → preuve device réelle en attente (review). → review. |
