---
baseline_commit: 3b5e0022a45ed1c3debca6bba833241becaea09c
---

# Story 2.1: Infra de contrôle (optimiste + convergence)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a développeur du Home Dashboard,
I want une **couche de pilotage optimiste par entité** (pending → appel service HA → convergence vers la cible) fournie comme **mécanisme réutilisable**, plus **une première tuile lumière** qui la démontre de bout en bout,
so that chaque widget de contrôle d'Epic 2 (lumières, volets, clim, aspirateur, armer) réagit **< 200 ms**, converge de façon cohérente, et n'a **aucune** logique optimiste dupliquée à réinventer.

## Contexte & valeur

Story fondatrice d'Epic 2 : elle pose la **forme** que toutes les tuiles de pilotage (2.3–2.7, et l'armement 4.1, et les scènes 3.1) vont réutiliser. Elle est le pendant « écriture » de ce que `useEntityValue` (Story 1.6) est à la « lecture ». Se tromper ici se propage à tout l'epic — d'où le vertical slice (une vraie lumière câblée) pour prouver l'abstraction avant de la répliquer.

**Trois décisions produit prises avec Florian (2026-07-15), à respecter :**
1. **Store pending = Zustand** (`zustand@5.0.14`, déjà présent dans l'arbre via la sous-dépendance de `@hakit` — le **promouvoir en dépendance directe** de `package.json`). Store **hors de l'arbre React** → l'intention en vol survit à un remontage.
2. **Portée = mécanisme + un vertical slice** : livrer le store + le hook + le modèle par domaine **et** câbler **une** tuile lumière réelle (via un `entity_id` **placeholder**, car les `entity_id` de contrôle réels ne sont pas encore fournis — action item Florian ouverte). Preuve device différée (comme 1.6).
3. **Corriger TD-1 (remontage du shell) dans cette story**, en prérequis, **avant** la première tuile de contrôle.

## Acceptance Criteria

1. **Couche pending unique par `entity_id` (AD-11) + retour visuel < 200 ms (NFR1, AD-5).**
   **Given** une action de pilotage sur une entité
   **When** l'utilisateur appuie
   **Then** l'intention entre dans **une seule couche pending, clé = `entity_id`, last-command-wins, bornée/expirante** (un 2ᵉ appui écrase le 1ᵉ ; une seule intention en vol par entité) **et** l'UI applique **immédiatement** (< 200 ms, sans attendre l'écho HA) l'état optimiste cible.
   **And** la couche pending **ne stocke que l'intention en attente** — ce n'est **pas** un cache d'état confirmé (carve-out explicite d'AD-3 par AD-11).

2. **Convergence vers la cible + états transitionnels + échec = timeout (AD-5) ; services HA uniquement (AD-4).**
   **Given** une intention en vol et l'écho d'état HA qui arrive
   **When** l'état de l'entité change
   **Then** si l'état **atteint la cible** → l'intention pending est **résolue** (effacée) et l'UI affiche l'état confirmé ; si l'état est **transitionnel** (modèle par domaine : volet `opening`/`closing`, clim `target ≠ current`) → l'intention est **maintenue** (ce **n'est pas** un échec) ; si le **timeout par domaine** est dépassé **sans** convergence → intention effacée, **retour à l'état confirmé** + **signalement** (drapeau `failed` exposé au widget).
   **And** l'exécution n'appelle **que** des services HA (`entity.service.turnOn()` / `turnOff()` / …) — **aucune** logique d'automatisation (si/alors, horaire) côté client (AD-4).

3. **Vertical slice — une tuile lumière réelle câblée de bout en bout (FR2, UX-DR2).**
   **Given** une entité `light` mappée (placeholder tant que Florian n'a pas fourni l'`entity_id` réel) et le mécanisme ci-dessus
   **When** j'appuie sur la tuile
   **Then** la tuile (`DeviceTile` de 1.2, accent `lights` ambre) bascule **on/off en optimiste** (état `on` : tint + glow, texte « Allumé »/« Éteint ») **puis converge** sur l'écho HA, via `useEntityValue` (1.6) pour l'obsolescence + le nouveau hook pour l'optimiste.
   **And** entité obsolète (`unavailable`/socket perdu) → tuile **non interactive** + pattern « Hors ligne » (1.6) : on ne pilote pas une entité qu'on ne voit pas.

4. **Prérequis TD-1 — le shell survit à la (re)connexion HA (AD-6, NFR4).**
   **Given** l'app connectée à HA qui perd puis retrouve la connexion (ou se connecte au démarrage)
   **When** `HassConnect` bascule loading ↔ children
   **Then** la **chrome du shell** (barre, `Clock`, titres de zones, layout) **ne se remonte pas** : l'intervalle du `Clock` **ne redémarre pas**, aucun flash ; seules les **zones de données** (Ambiance + tuiles de contrôle) gèrent l'état « connexion en cours » individuellement.
   **And** non-configuré (pas d'URL HA) → le shell s'affiche quand même (aucune tentative HA), **jamais de blanc** (comportement 1.5 préservé).

5. **Mécanisme réutilisable + gates verts.**
   **Given** le store + le hook + le modèle par domaine
   **When** je termine
   **Then** ils forment le **mécanisme unique** d'optimisme d'Epic 2 (les tuiles 2.3–2.7 s'y branchent en fournissant un `ControlModel` — **zéro logique optimiste dupliquée**), et `build` + `typecheck` + `lint` (`oxlint src`) + `test` sont **verts** ; **0 `entity_id` en dur** hors `src/entities/` ; **0 token** dans `dist/`.

## Tasks / Subtasks

- [x] **Task 1 — Promouvoir Zustand en dépendance directe** (AC: 1)
  - [x] `package.json` → `dependencies` : ajouter `"zustand": "^5.0.14"` (déjà résolu dans l'arbre ; le déclarer explicitement — ne pas dépendre d'un hoisting transitoire de `@hakit`). Ne PAS toucher aux autres deps. `npm install` pour figer le lockfile.

- [x] **Task 2 — Store pending par `entity_id`** (AC: 1) — **TDD (store pur)**
  - [x] `src/state/pending.ts` : store Zustand `{ byId: Record<string, PendingEntry> }`.
    - `PendingEntry<T> = { target: T; sentAt: number; expiresAt: number }` (`target` = état cible générique, spécialisé par domaine).
    - `setPending(entityId, target, timeoutMs)` : **last-command-wins** (écrase l'entrée existante ; `sentAt = Date.now()`, `expiresAt = sentAt + timeoutMs`).
    - `clearPending(entityId)`.
    - `getPending(entityId)` / sélecteur pour lecture ; **bornée** : une entrée dont `Date.now() > expiresAt` est considérée expirée (le hook Task 4 la traite comme timeout).
  - [x] **Le store vit au niveau module (hors React)** — il survit par construction à tout remontage (renforce Task 5 en défense en profondeur). **Il ne recopie jamais l'état confirmé HA** (AD-3/AD-11).
  - [x] Tests (Vitest, pas de DOM) : set → présent ; 2ᵉ set même id → écrase (last-command-wins) ; clear → absent ; expiration (injecter le temps ou comparer `expiresAt`). **Ne pas** utiliser `Date.now()` non contrôlé dans les assertions — passer un temps explicite ou `vi.useFakeTimers()`.

- [x] **Task 3 — Modèle par domaine (`ControlModel`) + modèle lumière** (AC: 2, 3) — **TDD**
  - [x] `src/state/control-model.ts` :
    ```ts
    export interface ControlModel<T> {
      domain: EntityDomain
      /** État confirmé HA == cible atteinte ? */
      isConverged(target: T, state: string): boolean
      /** État transitionnel légitime (en cours), PAS un échec. */
      isTransitional?(state: string): boolean
      /** Applique l'intention via des services HA uniquement (AD-4). */
      apply(entity: HassEntityWithService<any>, target: T): void
      /** Timeout par domaine avant de déclarer l'échec. */
      timeoutMs: number
    }
    ```
  - [x] `lightModel: ControlModel<'on' | 'off'>` : `isConverged(t, s) => s === t` ; **pas** de transitionnel ; `apply(e, t) => t === 'on' ? e.service.turnOn() : e.service.turnOff()` (**turn_on/turn_off**, pas `toggle` — convergence déterministe vers une cible) ; `timeoutMs ≈ 5000`.
  - [x] Tests : `isConverged` on/off ; `apply` appelle le bon service (mock `entity.service`).
  - [x] **Note pour 2.5/2.6** (documenter, ne pas construire) : le modèle volet fournira `isTransitional(s) => s==='opening'||s==='closing'` + `timeoutMs` plus long ; le modèle clim comparera mode + consigne. Le hook (Task 4) doit être **agnostique au domaine** pour qu'ils s'y branchent sans le modifier.

- [x] **Task 4 — Hook optimiste `useOptimisticControl`** (AC: 1, 2) — **TDD (renderHook)**
  - [x] `src/hakit/useOptimisticControl.ts` (dans le seam `hakit/` : lit `@hakit` + appelle des services HA — AD-2).
    - Signature : `useOptimisticControl<T>(entityId: EntityName, model: ControlModel<T>): { displayTarget: T | null; isPending: boolean; failed: boolean; send(target: T): void }`.
    - `send(target)` : `setPending(entityId, target, model.timeoutMs)` **puis** `model.apply(entity, target)`. Le retour visuel optimiste vient du fait que `displayTarget` reflète le pending **immédiatement** (< 200 ms, aucun await de l'écho HA).
    - **Convergence** (effet sur le changement d'état de l'entité) : s'il y a un pending → `isConverged` ? oui = `clearPending` ; sinon `isTransitional?` = maintenir ; sinon rien (attendre encore).
    - **Timeout** : poser un `setTimeout(expiresAt - now)` ; à échéance sans convergence → `clearPending` + `failed = true` (transitoire) → l'UI revient à l'état confirmé. Nettoyer le timer au unmount / nouveau `send`.
    - **Précédence obsolescence** : le hook lit aussi l'obsolescence (via `useEntityValue` ou `isStale`) ; **hors ligne ⇒ pas de pending pertinent** — la tuile est non interactive (AC3). Ne pas afficher un optimiste sur une entité qu'on ne peut pas commander.
  - [x] Tests (mock `@hakit` façon `RoomSensorCard.test.tsx` : `vi.hoisted` + `vi.mock('@hakit/core')` avec état mutable) : `send('on')` → `isPending` + `displayTarget==='on'` immédiat ; écho entité → `'on'` → pending résolu ; timeout (fake timers) sans écho → `failed` + retour confirmé ; last-command-wins (send off puis on rapide → seul 'on' en vol).

- [x] **Task 5 — Prérequis TD-1 : shell hors du gate de connexion** (AC: 4)
  - [x] Refactor `src/App.tsx` : **la chrome ne doit plus être l'enfant que `HassConnect` échange** avec son `loading`. `HassConnect` **rend `loading` tant que non authentifié/connexion**, et `children` **seulement une fois authentifié** (vérifié dans les types `@hakit`) → à chaque (re)connexion il **remonte** l'arbre enfant. Aujourd'hui `loading={<Home/>}` **et** children `→ <Home/>` : deux `Home` distincts → remontage (Clock reset, TD-1).
  - [x] **Cible** : lever la chrome non-HA (barre, `Clock`, cadres de zones, layout) **au-dessus** du gate ; n'envelopper dans `HassConnect` que les **zones dépendantes de HA** (Ambiance + tuiles de contrôle), qui gèrent « connexion en cours » via un fallback local (ex. skeletons). Préserver : non-configuré → shell rendu sans `HassConnect` (comportement actuel) ; `RoomDetail` (route) a aussi besoin de HA.
  - [x] **Vérification observable** : au (re)connect, l'intervalle du `Clock` **ne redémarre pas** et aucun composant chrome ne se remonte. (Le store pending étant hors React survit déjà à un remontage — donc TD-1 concerne désormais la **stabilité chrome/Clock** et la **correction structurelle**, non plus la perte du pending.)
  - [x] Mettre à jour `TECH_DEBT.md` : marquer **TD-1 résolu** (déplacer en « payée » ou barrer, avec le commit).
  - [x] Ne pas régresser : `Home` reste de la chrome pure sans HA ; l'`isConfigured`-gating de l'Ambiance (1.5) est préservé.

- [x] **Task 6 — Vertical slice : tuile lumière + mapping** (AC: 3) — **TDD (composant)**
  - [x] `src/entities/mapping.ts` : ajouter une section `LIGHTS` (comme `SENSORS`) avec **une** entrée placeholder : `{ entityId: 'light.salon', room: 'salon', domain: 'light', service: 'light.toggle', placeholder: true }`. L'ajouter à `ENTITIES`. (`assertCanonicalMapping` passe : `light.salon` bien formé + unique ; `assertNoPlaceholders` la signalera, ce qui est voulu jusqu'à la preuve live.)
  - [x] `src/widgets/LightTile.tsx` : lit l'entité lumière ; compose `useEntityValue` (obsolescence 1.6) + `useOptimisticControl(id, lightModel)` ; rend `DeviceTile` (`domain='lights'`, `state='on'|'default'|'stale'`, `value` = « Allumé »/« Éteint », `onPress = () => send(currentOn ? 'off' : 'on')`). Obsolète → `state='stale'` + non interactif (pas de `onPress`).
  - [x] Câbler **une** `LightTile` dans la zone **Éclairage** de `Home` (aujourd'hui `<SectionCard title="Éclairage" />` vide). **Overlap assumé avec 2.3** (qui étendra : plusieurs pièces + tuile master + undo) — le **noter dans la story 2.3** au moment de la créer.
  - [x] Test composant (mock `@hakit`) : rendu off → tap → optimiste « Allumé » (state `on`) ; écho `'on'` → confirmé ; mock déconnecté → tuile `stale`, non cliquable.

- [x] **Task 7 — Validation (gates)** (AC: 5)
  - [x] `npm run build` + `npm run typecheck` + `npm run lint` + `npm run test` **verts**. Pré-commit sur les fichiers touchés.
  - [x] Vérifier **0 `entity_id` en dur** hors `src/entities/` (`rg` de `light\.` / `sensor\.` dans `src/` hors `entities/`), **0 token** dans `dist/` (grep du bundle, cf. garde AD-8).
  - [ ] **⏳ Preuve device (Florian, review)** — non observable côté agent : avec l'`entity_id` lumière réel, appui → allumage < 200 ms puis convergence ; couper HA en plein appui → timeout → retour à l'état confirmé + signalement ; entité `unavailable` → tuile non interactive « Hors ligne » ; (re)connexion → pas de flash du shell, `Clock` continu.

### Review Findings (code-review 2026-07-15)

_Adversarial review (Blind Hunter · Edge Case Hunter · Acceptance Auditor), 3 fresh-context layers. Severities re-assigned at triage. No High-severity / no shipping-blocker for the light slice; the Med items are latent gaps in the reusable mechanism that bite the next transitional/non-string domain (2.5/2.6)._

**Patch (fixed in this review pass — 2026-07-16):**
- [x] [Review][Patch] Timeout ignores `isTransitional` + no convergence re-check → false-`failed` on legitimately transitional states (AD-5) — timeout now re-checks live state: converged ⇒ resolve, transitional ⇒ stay in flight, else fail [src/hakit/useOptimisticControl.ts]
- [x] [Review][Patch] `displayState` blind `as string` cast breaks the domain-agnostic contract — constrained `T extends string` on `ControlModel` + hook; the state token is always a string [src/state/control-model.ts, src/hakit/useOptimisticControl.ts]
- [x] [Review][Patch] Hook didn't enforce offline precedence — folded `isStale` (shared pure helper) into the hook; `send` is a no-op when stale; `isStale` exposed; `LightTile` now reads it from the hook [src/hakit/useOptimisticControl.ts, src/widgets/LightTile.tsx]
- [x] [Review][Patch] Orphaned pending entry on unmount → hook now clears its own in-flight intent on unmount (tracked via `ownSentAt` ref) [src/hakit/useOptimisticControl.ts]
- [x] [Review][Patch] Completion-note "0 entity_id en dur" overstated — scoped to non-test code [doc]

_+3 tests (offline-gated send, transitional-safe timeout, unmount cleanup) → 57 green; typecheck/lint/build (token-free) green._

**Defer (to a later story — real but not this story's scope):**
- [x] [Review][Defer] LightTile ignores `failed` (silent snap-back, no failure cue) — deferred to **Story 2.2** (owns undo/toast/failure UX) [src/widgets/LightTile.tsx:25]
- [x] [Review][Defer] Per-hook `failed` divergence on a shared entity (needs status in the store) — deferred to **Story 2.3** (first shared-entity widget: master tile) [src/hakit/useOptimisticControl.ts]
- [x] [Review][Defer] `ConnectingZones` shows Home skeleton on `/room` during initial connect — deferred to **Epic 5** (RoomDetail build) [src/App.tsx]

**Dismissed:** `sentAt` ms-collision (not reachable — effect cleanup clears the stale timer first) · AC4 "titres de zones" literal remount (user-facing intent met: Clock stable, `ConnectingZones` mirrors layout so no flash — acknowledged in Dev Notes).

## Dev Notes

**Portée stricte.** Cette story livre : (a) le **store pending** (AD-11), (b) le **hook optimiste + modèle par domaine** (AD-5), (c) **une** tuile lumière de démonstration (vertical slice), (d) le **fix TD-1** (prérequis). **Hors scope — NE PAS construire :**
- **Undo / toast** (« Annuler » 6-8 s) → **Story 2.2**. AC5 d'Epic pour le master light y renvoie ; ici, aucun undo.
- **Tuile master** (« Toutes les lumières »), intensité/couleur, volets, clim, aspirateur, armement → leurs stories (2.3–2.7, 4.1). Ils **réutiliseront** `useOptimisticControl` + un `ControlModel`. Ici : **un seul** slice on/off.
- **Cache persistant** d'état → interdit (AD-3). La couche pending n'est **pas** un cache (elle ne garde que l'intention en vol, expirante).
- **Bannière connexion globale** → AD-6 est **par entité** (déjà couvert par 1.6).

**Décisions d'archi verrouillées (ADs qui gouvernent 2.1).**
- **AD-11** — couche pending **unique, clé `entity_id`, last-command-wins, bornée/expirante**, **distincte** d'un cache confirmé. Empêche deux widgets (« Tout éteindre » vs tuile Salon) de piloter `light.salon` avec des overlays concurrents : une seule intention en vol par entité.
- **AD-5** — appui = **retour visuel immédiat < 200 ms** via le pending, **puis convergence** vers la cible sur écho HA. **États transitionnels ≠ échecs** (modèle par domaine + timeout). Échec = **timeout sans convergence** → retour à l'état confirmé + signalement.
- **AD-4** — **zéro** logique d'automatisation client : uniquement des appels de services HA.
- **AD-3** — l'état **confirmé** vient **seulement** de l'abonnement `@hakit` ; le pending est le carve-out autorisé (intentions), pas une copie d'état.
- **AD-2** — accès HA **exclusivement** via `@hakit` ; le hook vit dans `src/hakit/`.
- **AD-6/NFR4** (via TD-1) — le shell ne blanchit jamais et ne se remonte pas sur (re)connexion.

**API `@hakit` (vérifiée dans les types `@hakit/core` 6.0.2, 2026-07-15) — ne pas deviner :**
- `useEntity(id, { returnNullIfNotFound: true })` renvoie `HassEntityWithService<domain>` : `.state`, `.attributes`, `.last_changed`, **et `.service`** = les services du domaine **déjà ciblés sur cette entité** (variante « no-target »). Ex. lumière : `entity.service.turnOn()`, `entity.service.turnOff()`, `entity.service.toggle()`. Avec `serviceData` : `entity.service.turnOn({ serviceData: { brightness_pct: 50 } })` (utile en 2.4, pas ici).
- Alternative : `useService('light')` renvoie les services **avec** `target` requis, et `useHass().callService(...)` existe. **Préférer `entity.service.*`** (ciblage implicite, typé) pour une tuile mono-entité.
- `useHass((s) => s.connectionStatus)` → `'pending'|'disconnected'|'pending-suspension'|'suspended'|'connected'` (type non exporté — mirroir local si besoin, cf. 1.6). `HassConnect` : `loading` rendu **tant que non authentifié/connexion**, `children` **une fois authentifié** — d'où le remontage TD-1.

**Réutiliser l'existant — NE PAS réinventer :**
- **`useEntityValue` (1.6, `src/hakit/`)** : obsolescence par entité + dernière valeur + `since`. La tuile de contrôle le compose pour l'état `stale`. Ne **pas** re-détecter l'obsolescence.
- **`isStale` / `formatSince` (1.6, `src/hakit/stale.ts`)**.
- **`DeviceTile` (1.2, `src/ui/`)** : états `default`/`on` (tint+glow)/`stale`, accent par `data-domain` (`lights` = ambre), cibles ≥74px (≥92px kid), état porté par **texte+icône** (NFR2/UX-DR14). La `LightTile` **l'habille**, elle ne recrée pas la tuile. `OfflinePill` déjà intégré au `stale`.
- **`ENTITIES` / `mapping.ts` (1.4, AD-7)** : **seul** endroit où vivent les `entity_id`. La lumière s'ajoute **là** (section `LIGHTS`), avec `domain` + `service`. `EntityDomain` inclut déjà `'light'`.
- **`ROOMS` / `RoomId` (`rooms.ts`)** : `salon` existe.

**Store — pourquoi Zustand hors React.** Le store au niveau module survit à un remontage React **par construction** : même si TD-1 régressait, l'intention en vol ne serait pas perdue. C'est une défense en profondeur — le fix TD-1 reste requis pour la stabilité de la chrome/`Clock` et la propreté structurelle, **pas** pour sauver le pending. (Honnête : avec Zustand, TD-1 n'est plus *critique* pour l'état optimiste, mais reste dû — action item rétro + payback trigger TD-1.)

**Tests (baseline Vitest, cf. 1.5/1.6) :**
- Store pur + modèle : tests unitaires sans DOM. **Temps déterministe** : `vi.useFakeTimers()` ou temps injecté — **ne pas** appeler `Date.now()` non maîtrisé dans les assertions.
- Hook + composant : mock `@hakit/core` via `vi.hoisted(() => ({...}))` + `vi.mock('@hakit/core', () => ({ useEntity, useHass, useHistory }))` avec **état mutable** (patron exact dans `src/widgets/RoomSensorCard.test.tsx`). `@hakit/*` est **inliné** dans `vitest.config.ts` (`server.deps.inline`) — leçon 1.5 (import CJS lodash). `VITE_HA_URL=''` en env test.
- `renderHook` (`@testing-library/react`) pour `useOptimisticControl`.
- **Remontage TD-1** : difficile à tester en unit avec `HassConnect` mocké ; se contenter d'un test « shell rendu sans config » + la **preuve device** (review). Ne pas sur-ingénierer un test fragile.
- Gate : `verbatimModuleSyntax` + `noUnusedLocals` actifs → imports `type` explicites. **Rappel TD-2** : les `*.test.*` ne sont **pas** typecontrôlés par `tsc -b` (transpilés esbuild) — une erreur de type dans un test ne casse que le run ; garder les tests simples.

### Project Structure Notes

- **NEW** : `src/state/pending.ts` (+ `.test.ts`), `src/state/control-model.ts` (+ `.test.ts`) — le dossier `src/state/` (aujourd'hui `.gitkeep`) est **précisément** prévu pour la couche pending (AD-11) dans le Structural Seed de l'archi. `src/hakit/useOptimisticControl.ts` (+ `.test.ts`) — dans le seam HA (lit `@hakit` + services). `src/widgets/LightTile.tsx` (+ `.test.tsx`).
- **UPDATE** : `src/App.tsx` (fix TD-1), `src/pages/Home.tsx` (une `LightTile` dans Éclairage), `src/entities/mapping.ts` (section `LIGHTS`, 1 placeholder), `package.json` + lockfile (zustand direct), `TECH_DEBT.md` (TD-1 payée), `_bmad-output/implementation-artifacts/sprint-status.yaml` (2-1 → in-progress puis review).
- **Placement (Structural Seed AD) :** `state/` = pending ; `hakit/` = accès HA + hooks dérivés ; `widgets/` = widgets par feature ; `ui/` = primitives. Respecter la direction de dépendance : Widgets → hakit / entities / pending ; jamais l'inverse.
- **Conventions style** : Tailwind/TailAdmin primaire ; ne pas mélanger avec l'Emotion interne de `@hakit/components` (Consistency Conventions). Pas de nom de classe Tailwind construit dynamiquement (leçon cascade 1.2 : accents via `data-domain`).

### Décisions ouvertes / dépendances (non bloquantes pour l'automatisable)

- **`entity_id` lumière réel manquant** (action item Florian, rétro Epic 1) → **placeholder `light.salon`** en attendant ; le mécanisme + les tests passent sans device. Remplacer + preuve live à la review.
- **Overlap 2.3** : la `LightTile` + son entrée Éclairage seront **étendues** par 2.3 (multi-pièces, master, undo). À signaler dans la story 2.3.
- **Review multi-modèle** (action item Florian) : cette story est un bon candidat pour la review indépendante (logique de contrôle = cœur d'Epic 2).

### References

- [Source: epics.md#Story 2.1 (AD-11 pending, AD-5 optimiste+convergence, NFR1 <200ms, AD-4 services HA only)]
- [Source: ARCHITECTURE-SPINE.md#AD-11 (couche pending unique par entity_id, last-command-wins, bornée, distincte d'un cache) · #AD-5 (optimiste + réconciliation, transitionnel ≠ échec, timeout par domaine) · #AD-3 (autorité d'état, carve-out pending) · #AD-4 (zéro automatisation client) · #AD-2 (accès HA via @hakit) · #Structural Seed (state/ = pending)]
- [Source: EXPERIENCE.md#Interaction Patterns & States (In-flight <200ms tint/glow ; Transitional shutter/climate = légitime ; Failure = timeout→revert+signal) · Device tile / Master tile (propriétaire optimiste propre dans la couche pending)]
- [Source: DESIGN.md#device-tile (état on = accent+glow ; accent lights=ambre) · a11y floor (≥48/56px, texte+icône)]
- [Source: Story 1.6 (done — `useEntityValue`, `isStale`, `OfflinePill` : à composer pour l'obsolescence) · Story 1.4 (done — `mapping.ts`/`ENTITIES` AD-7, ajouter la lumière ici) · Story 1.2 (done — `DeviceTile` états + accents) · Story 1.3 (done — shell ; source de TD-1)]
- [Source: TECH_DEBT.md#TD-1 (shell remounts on reconnect ; payback = Story 2.1, avant la 1ʳᵉ tuile) · #TD-2 (tests non typécheckés)]
- [Source: @hakit/core 6.0.2 types — `useEntity().service.turnOn/turnOff/toggle`, `useService`, `useHass(connectionStatus)`, `HassConnect{loading,children}` (vérifiés 2026-07-15)]
- [Source: sprint-status.yaml action_items (entity_ids de contrôle à fournir ; fix 1.3 #2 avant widgets 2.x ; review multi-modèle Epic 2)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Liza Pairing mode, Autonomous — Amelia dev-story).

### Debug Log References

- **Cast `entity as unknown as HassEntityWithService<D>`** dans `useOptimisticControl` : `useEntity(EntityName)` renvoie l'union large de tous les domaines ; le modèle est mono-domaine `D`. `tsc` refuse le cast direct (unions non chevauchantes) → widen via `unknown`. Cast unique, localisé, justifié par le mapping (AD-7 garantit domaine(entité)==domaine(modèle)).
- **`HassProvider` (render-prop `(ready)=>ReactNode`) n'est PAS exporté publiquement** — seul `HassConnect` l'est, qui échange `loading`↔`children` (remontage à chaque (dé)connexion). D'où le fix TD-1 **structurel** : chrome au-dessus du gate (pas de dépendance aux internes `@hakit`).
- **`HassConnect` peut envelopper ses enfants dans une `div`** (`wrapperProps`) → chaque page possède désormais sa propre mise en page (`<div flex flex-col gap>`), donc le layout est identique que le provider enveloppe ou non (configuré/non-configuré).
- **Test hook « last-command-wins »** : envoyer une cible déjà égale à l'état confirmé (`off` quand `off`) **converge immédiatement** (comportement correct : le widget n'envoie jamais l'état courant). Test réécrit pour asserter ce comportement réel ; le last-command-wins pur est couvert au niveau store (`pending.test.ts`).
- **Build local bloqué par la garde AD-8** (`.env.local` a `VITE_HA_TOKEN`) — c'est la garde qui fonctionne. Build vérifié **sans token** (chemin CI/prod) : `dist/` propre, 0 token.

### Completion Notes List

- **AC1–AC5 satisfaits (automatisable).** Couche pending Zustand par `entity_id` (last-command-wins, bornée, hors React) ; hook `useOptimisticControl` (optimiste <200ms → convergence → timeout+revert+`failed`) agnostique au domaine via `ControlModel` ; `lightModel` (turn_on/turn_off) ; `LightTile` câblée dans Éclairage (le hook porte l'obsolescence + l'optimiste) ; fix TD-1 (chrome hors du gate). **57 tests verts** (post-review), typecheck/lint/build (sans token) verts, **0 `entity_id` en dur dans le code non-test hors `entities/`** (les tests utilisent légitimement des ids littéraux), 0 token dans `dist/`.
- **Décision d'API (Post-Hoc) :** le hook expose `{ displayState, isPending, isTransitional, failed, send }` (spec respectée). `apply` reste dans le modèle (spec) ; `PendingEntry.target` est stocké en `unknown` au niveau store (spécialisé par domaine côté hook) plutôt que générique `<T>` — un store unique héberge tous les domaines.
- **Scope TD-1 — fichiers au-delà de la liste initiale :** le fix a nécessité d'extraire `TopBar` (`src/ui/TopBar.tsx`, NEW) et de rendre **`Home` ET `RoomDetail` « contenu seul »** (les deux rendaient leur propre `<main class="bg-ground">`) — `RoomDetail.tsx` n'était pas dans la liste UPDATE initiale mais devait l'être. Conséquence assumée : **`TopBar` est désormais persistante sur toutes les routes** (y compris le stub `RoomDetail`) — OK pour un kiosque, à revisiter en Epic 5.
- **Zustand direct** promu (`^5.0.14`) ; le store module-level rend le pending **remount-safe par construction** (défense en profondeur vis-à-vis de TD-1).
- **Preuve device (Florian) = review** : avec l'`entity_id` lumière réel — appui <200ms + convergence, timeout→revert, offline→non interactif, (re)connexion sans flash du `Clock`. Non observable côté agent (nécessite HA + appareil). Placeholder `light.salon` à remplacer.

### File List

**Créés :**
- `src/state/pending.ts`, `src/state/pending.test.ts`
- `src/state/control-model.ts`, `src/state/control-model.test.ts`
- `src/hakit/useOptimisticControl.ts`, `src/hakit/useOptimisticControl.test.ts`
- `src/widgets/LightTile.tsx`, `src/widgets/LightTile.test.tsx`
- `src/ui/TopBar.tsx`, `src/ui/TopBar.test.tsx`
- `src/App.test.tsx`

**Modifiés :**
- `src/App.tsx` (KioskShell : chrome hors du gate + `ConnectingZones` fallback — fix TD-1)
- `src/pages/Home.tsx` (contenu seul, sans TopBar ; `LightTile` dans Éclairage)
- `src/pages/RoomDetail.tsx` (contenu seul, sans `<main>`/ground — conséquence TD-1)
- `src/entities/mapping.ts` (section `LIGHTS` + `lights()` ; 1 placeholder `light.salon`)
- `src/entities/mapping.test.ts` (test placeholder mis à jour + test `lights()`)
- `package.json` + `package-lock.json` (zustand en dépendance directe)
- `TECH_DEBT.md` (TD-1 → payée)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (2-1 → in-progress → review)

**Post-review (2026-07-16) :**
- `src/hakit/useOptimisticControl.ts` (timeout transitional-safe + convergence re-check ; offline-gating `send` ; `isStale` exposé ; nettoyage pending au unmount)
- `src/state/control-model.ts` (`T extends string`)
- `src/widgets/LightTile.tsx` (obsolescence via le hook, `useEntityValue` retiré)
- `src/hakit/useOptimisticControl.test.ts` (+3 tests : offline, transitionnel, unmount)
- `_bmad-output/implementation-artifacts/deferred-work.md` (NEW — 3 findings différés)

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-16 | 1.0 | **Accepté par Florian → Status: done.** Code-review (3 couches adversariales, contexte frais) traitée : 5 patches appliqués sur le mécanisme réutilisable (timeout transitional-safe + re-check convergence ; `T extends string` ; offline-gating dans le hook ; nettoyage pending au unmount ; wording doc), 3 findings différés (2.2/2.3/Epic 5), 2 rejetés. 57 tests verts, typecheck/lint/build (sans token) verts, 0 token. **Restent en suivi (comme 1.6) :** preuve device sur vrai HA (remplacer le placeholder `light.salon`) + review indépendante multi-modèle (action item Florian). |
| 2026-07-15 | 0.1 | Infra de contrôle optimiste (AD-5/AD-11) : store pending Zustand par `entity_id` (last-command-wins, bornée, hors React) ; `ControlModel` + `lightModel` ; hook `useOptimisticControl` (optimiste <200ms → convergence → timeout/revert/`failed`) ; vertical slice `LightTile` (compose `useEntityValue` + le hook) câblée dans Éclairage (placeholder `light.salon`). Fix **TD-1** : `KioskShell` place la chrome/`Clock` au-dessus du gate de connexion, `HakitProvider` n'enveloppe que les zones de données (+ `ConnectingZones`). 54 tests verts, typecheck/lint/build (sans token) verts, 0 token dans `dist/`. Preuve device en attente (review). → review. |
