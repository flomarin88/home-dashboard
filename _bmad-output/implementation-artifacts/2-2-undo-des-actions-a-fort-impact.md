---
baseline_commit: 1843a86dbb86bf47897f68604222c57f6d7486c4
---

# Story 2.2: Undo des actions à fort impact

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Florian,
I want annuler une action à fort impact pendant quelques secondes (« Tout éteindre », « Tout fermer », « Désarmer », application de scène),
so that une fausse manip — y compris un appui d'enfant (Nathan 5, Gaspard 3, **aucun child-lock en v1**) — ne coûte rien : l'état revient à ce qu'il était.

## Contexte & valeur

Story infra d'Epic 2 : le **filet de sécurité réversible**. `useOptimisticControl` (2.1) rend chaque commande instantanée ; 2.2 ajoute le **mécanisme d'undo réutilisable** (toast « Annuler » + snapshot/restauration) que les **déclencheurs à fort impact** appelleront : tuile master « Toutes les lumières »/« Tout éteindre » (**2.3**), « Tous les volets »/« Tout fermer » (**2.5**), « Désarmer » (**4.1**), application de scène (**3.1**). C'est le pendant « sécurité » de ce que 2.1 est à la « réactivité ».

**Trois décisions produit prises avec Florian (2026-07-16), à respecter :**
1. **Portée = mécanisme + tests seulement.** Livrer le store undo + le composant `UndoToast` + l'utilitaire snapshot/restauration, prouvés par tests. **Aucun déclencheur réel** ici — le 1ᵉ « Tout éteindre » réel est la tuile master de **2.3**. (Contrairement à 2.1, pas de vertical slice naturel : l'undo ne s'applique qu'aux actions **de groupe/master**, qui sont 2.3+.)
2. **Snapshot = client-side éphémère.** Avant l'action, capturer l'**état confirmé** de chaque entité affectée dans l'enregistrement undo (état UI éphémère, vit seulement pendant la fenêtre 6-8 s) ; sur « Annuler », **ré-appliquer via services HA à travers la couche pending (2.1)**. **Pas** de `scene.create` HA (pas d'entités scène transitoires). Respecte AD-1 (UI éphémère OK), AD-4 (services HA only), AD-11 (passe par le pending).
3. **Replier le finding différé de 2.1** : `LightTile` ignore `useOptimisticControl.failed` (échec de timeout silencieux). 2.2 = « feedback d'action transitoire » : ajouter un **indice minimal « Échec »** consommé par `LightTile`. Clôt la dette différée de la review 2.1.

## Acceptance Criteria

1. **Store undo unique + toast « Annuler » 6-8 s (NFR6, UX-DR9).**
   **Given** une action à fort impact déclenchée qui enregistre un undo (`offerUndo`)
   **When** elle s'exécute
   **Then** un **toast unique** apparaît avec le label de l'action, un bouton **« Annuler » ≥52px, contraste élevé** (état porté par **texte + icône**, pas la couleur seule — UX-DR14), et un **compte à rebours visible** (anneau ou barre) sur une **durée 6-8 s** ; le toast **s'auto-efface** à l'expiration.
   **And** le store est **unique et borné** (une seule action annulable active, **last-wins** : une nouvelle action à fort impact remplace le toast), au niveau module (cohérent avec le pending 2.1), **sans HA** (le toast se rend hors du gate de connexion).

2. **« Annuler » restaure l'état confirmé précédent (NFR6).**
   **Given** le toast affiché
   **When** j'appuie sur « Annuler » (avant expiration)
   **Then** la **closure d'undo enregistrée s'exécute** (ré-applique le snapshot des états confirmés précédents **via services HA à travers la couche pending** — optimiste + convergence, AD-4/AD-11) **et** le toast se ferme.
   **And** l'utilitaire snapshot/restauration est **réutilisable et testé** : capturer `[{entityId, priorState}]` + construire l'undo qui ré-applique chaque entité. **Aucune entité scène HA créée** (client-side éphémère).

3. **Indice d'échec minimal (replie le finding différé de 2.1).**
   **Given** une commande optimiste qui **timeout sans converger** (`useOptimisticControl.failed`)
   **When** l'échec est signalé
   **Then** `LightTile` **surface un indice « Échec »** (texte, pas la couleur seule) au lieu de revenir silencieusement à l'état confirmé — l'échec n'est plus muet.
   **And** le finding « LightTile ignore `failed` » de `deferred-work.md` est **marqué résolu**.

4. **Mécanisme réutilisable + gates verts.**
   **Given** le store + le toast + l'utilitaire
   **When** je termine
   **Then** `offerUndo` est le **point d'entrée unique** de l'undo pour tous les déclencheurs Epic 2+ (2.3 master, 2.5 « Tout fermer », 4.1 « Désarmer », 3.1 scènes) — **zéro logique d'undo dupliquée** — et `build` + `typecheck` + `lint` (`oxlint src`) + `test` sont **verts** ; **0 token** dans `dist/`.

## Tasks / Subtasks

- [x] **Task 1 — Store undo par action unique** (AC: 1) — **TDD (store pur)**
  - [x] `src/state/undo.ts` : store Zustand `{ current: UndoableAction | null }` (cohérent avec `pending.ts` de 2.1).
    - `UndoableAction = { id: string; label: string; undo: () => void; offeredAt: number; expiresAt: number }`.
    - `offerUndo(label, undo, dwellMs = 7000, now?)` : crée l'action (id = compteur monotone, **pas** `Date.now()` seul — cf. leçon review 2.1), **last-wins** (remplace `current`), bornée (`expiresAt = now + dwellMs`). Retourne l'id.
    - `dismiss(id?)` : efface `current` (si `id` fourni, seulement s'il correspond — évite d'effacer une action plus récente).
    - `runUndo()` : appelle `current.undo()` **puis** `dismiss`.
  - [x] Store au niveau module, **sans HA** (le toast se monte hors du gate).
  - [x] Tests (Vitest, pas de DOM) : offer → present ; 2ᵉ offer → remplace (last-wins, un seul actif) ; `runUndo` appelle la closure + efface ; `dismiss(id)` n'efface pas une action plus récente ; **temps déterministe** (`vi.useFakeTimers()` / temps injecté).

- [x] **Task 2 — Utilitaire snapshot → undo** (AC: 2) — **TDD (pur)**
  - [x] `src/state/undo.ts` (ou `undo-snapshot.ts`) : `interface EntitySnapshot { entityId: string; priorState: string }`.
    - `buildUndo(label, snapshots, reapply): UndoableAction` où `reapply: (entityId: string, priorState: string) => void` est fourni par l'appelant (qui détient le moyen de commander — voir Dev Notes). `undo()` itère les snapshots et appelle `reapply` pour chacun.
  - [x] Tests : `buildUndo` → `undo()` appelle `reapply(id, priorState)` pour chaque snapshot, dans l'ordre ; label/id conservés.
  - [x] **NE PAS** construire ici la capture live (lecture des états confirmés) ni le re-`send` groupé imperatif : ça appartient aux tuiles master (2.3/2.5) qui ont les entités. **Documenter le pattern** (Dev Notes) : snapshot = `entity.state` confirmé avant l'action ; `reapply` = `usePendingStore.getState().setPending(id, priorState, timeout)` + appel service HA (`useHass().callService` / `useService(domain)`) — impératif, hors hook, pour une action de groupe.

- [x] **Task 3 — Composant `UndoToast`** (AC: 1, 2) — **TDD (composant)** — **ui/**
  - [x] `src/ui/UndoToast.tsx` : s'abonne au store undo ; ne rend rien si `current == null`.
    - Rendu : label + bouton **« Annuler » ≥52px** (`min-h-[52px]`, contraste élevé, **texte + icône** — pas couleur seule) → `runUndo()` ; **compte à rebours visible** (anneau SVG ou barre) piloté par `expiresAt` (le composant possède l'`interval` de tick + le `setTimeout` d'auto-`dismiss` ; nettoyer au unmount — leçon timers 2.1).
    - Positionnement **fixe** (bas/centre), overlay global. Fond givré (tokens `card-fill`/`card-border`, cf. design system 1.2). **Pas** de nouveau token sauf nécessité.
  - [x] Voix FR : « Annuler » (UX-DR15). A11y : bouton ≥52px, rôle bouton, label lisible.
  - [x] Tests (mock du store undo, ou offer réel + fake timers) : offer → toast + label + bouton « Annuler » présents ; clic « Annuler » → `runUndo` (closure appelée) + toast disparaît ; laisser expirer (fake timers, dwell+ε) → auto-dismiss, toast disparaît, closure **non** appelée.

- [x] **Task 4 — Monter `UndoToast` dans le shell** (AC: 1)
  - [x] `src/App.tsx` : monter **une** `<UndoToast/>` dans `KioskShell`, **hors du gate de connexion** (comme `TopBar` — le toast n'a pas besoin de HA ; sa closure `undo`, elle, est créée par l'appelant sous le provider et capture le moyen de commander). Overlay fixe au-dessus des zones.
  - [x] Ne pas régresser TD-1 : la chrome (dont le toast) reste hors du remontage.

- [x] **Task 5 — Replier l'indice « Échec » (finding 2.1)** (AC: 3) — **TDD (composant)**
  - [x] `src/widgets/LightTile.tsx` : consommer `failed` de `useOptimisticControl` ; quand `failed` (et non `stale`), afficher un **indice « Échec »** (texte, ex. `value="Échec"` ou petit état) au lieu du retour silencieux à l'état confirmé. Minimal (l'affordance de retry riche est future).
  - [x] `src/widgets/LightTile.test.tsx` : ajouter un cas — timeout sans écho (fake timers) → tuile montre « Échec ».
  - [x] `deferred-work.md` : marquer le finding « LightTile ignores `failed` » **résolu (Story 2.2)**.

- [x] **Task 6 — Validation (gates)** (AC: 4)
  - [x] `npm run build` (sans token) + `npm run typecheck` + `npm run lint` + `npm run test` **verts**. Pré-commit sur les fichiers touchés.
  - [x] **0 token** dans `dist/` (garde AD-8). Pas d'`entity_id` en dur hors `entities/` (le mécanisme undo est agnostique aux entités).
  - [ ] **⏳ Preuve device (Florian, review)** — non observable côté agent, **différée jusqu'à un déclencheur réel (2.3)** : « Tout éteindre » → toast 6-8 s + compte à rebours → « Annuler » avant expiration → les lumières reviennent à leur état précédent ; laisser expirer → l'action reste. (2.2 seul n'a pas de déclencheur réel à éprouver sur device.)

### Review Findings (code-review 2026-07-16)

_3 couches adversariales (Blind Hunter · Edge Case Hunter · Acceptance Auditor), contexte frais. Sévérités ré-assignées au triage. Aucun High. Les 4 patchs cœur corrigent un vrai bug visible sur kiosque (F2), une contradiction UI (F1), la robustesse de l'undo (F3), et le contraste spec (F4)._

**Patch (fixed in this review pass — 2026-07-16) :**
- [x] [Review][Patch] `failed` collant après convergence tardive → tuile allumée étiquetée « Échec ». Corrigé dans le hook : effet qui réinitialise `failed` quand l'état confirmé atteint la dernière cible sans pending (`lastTarget` ref). **Clôt aussi le résidu sticky-`failed` de la review 2.1** [src/hakit/useOptimisticControl.ts]
- [x] [Review][Patch] Compte à rebours aberrant à la 1ʳᵉ frame — extrait dans `undoCountdown(offeredAt, expiresAt, now)` bornant `remaining` à `[0, total]` (fraction ≤ 1, secondes ≤ dwell) [src/state/undo.ts, src/ui/UndoToast.tsx]
- [x] [Review][Patch] `runUndo` : `try/finally` (efface le toast même si `undo()` throw, l'erreur remonte tout de même — Rule 14) ; `buildUndo` : `try/catch` par entité (best-effort, `console.warn`) → une entité qui échoue ne bloque pas les autres [src/state/undo.ts]
- [x] [Review][Patch] Bouton « Annuler » + barre montés en **contraste élevé** (`bg-text` fond clair / texte `ground-indigo` sombre ; barre `bg-text`) [src/ui/UndoToast.tsx]
- [x] [Review][Patch] Secondes du compte à rebours passées en `aria-hidden` (le `aria-label` statique couvre l'annonce ; plus de spam lecteur d'écran) [src/ui/UndoToast.tsx]

_+6 tests (retire-stale-failed, undoCountdown clamp ×3, runUndo-throws, buildUndo-best-effort) → 75 verts ; typecheck/lint/build (sans token) verts._

**Defer :**
- [x] [Review][Defer] La closure `undo` (montée hors du gate) peut capturer des refs HA périmées si l'appelant se démonte — deferred to **Story 2.3** : résoudre l'entité/service au run-time via `callService(entity_id)`, ne pas capturer un objet entité live [src/App.tsx / guidance 2.3]

**Dismissed :** seam `offer(now)` test-only (`offerUndo` public ne l'expose pas) · snapshots dupliqués/vides (contrat appelant : un snapshot par entité, capturé par itération) · « 0 token dans dist » (déjà vérifié : build sans token, grep propre).

## Dev Notes

**Portée stricte.** 2.2 livre : (a) le **store undo** (action unique, borné, last-wins), (b) le composant **`UndoToast`** (compte à rebours + « Annuler » ≥52px), (c) l'**utilitaire `buildUndo`** (snapshot → closure), (d) l'**indice « Échec »** minimal dans `LightTile` (replie la dette 2.1). **Hors scope — NE PAS construire :**
- **Tuiles master / actions de groupe réelles** (« Toutes les lumières », « Tout éteindre », « Tous les volets », « Tout fermer ») → **2.3 / 2.5**. Elles **appelleront `offerUndo`** + fourniront le snapshot + `reapply`. Ici : le mécanisme + `buildUndo`, **pas** la capture live ni le re-`send` groupé impératif.
- **« Désarmer » undo** → **4.1** ; **undo de scène** → **3.1**. Mêmes points d'entrée.
- **Undo persistant / multi-niveaux / re-do** → hors v1 (un seul niveau, éphémère, fenêtre 6-8 s).
- **Cache d'état** → interdit (AD-3). Le snapshot est **UI éphémère** (vit dans l'action undo courante), pas un cache.

**Décisions produit (verrouillées, cf. Contexte).** Mécanisme-seul (proof différée à 2.3) ; snapshot **client-side éphémère** ré-appliqué **via la couche pending** (pas de `scene.create`) ; indice « Échec » replié.

**Continuité (Story 2.1, done — commit `1843a86`).**
- **`useOptimisticControl` (`src/hakit/`)** : `{ displayState, isPending, isTransitional, isStale, failed, send }`. `failed` = timeout sans convergence (revient à l'état confirmé). **AC3 le consomme** dans `LightTile`.
- **Couche pending (`src/state/pending.ts`, Zustand, AD-11)** : `usePendingStore` — `setPending(id, target, timeoutMs, now?)`, `clearPending(id)`. **La restauration undo passe par là** (impératif : `usePendingStore.getState().setPending(...)` + appel service) pour rester cohérente avec l'optimisme 2.1.
- **`ControlModel` / `lightModel` (`src/state/control-model.ts`)** : `apply(entity, target)` = services HA. Pour la restauration groupée, l'appelant (2.3) commande chaque entité vers son `priorState`.
- **Pattern Zustand + composant** établi en 2.1 (store module pur + widget abonné) — **le réutiliser** pour le store undo + `UndoToast`. Ne pas réinventer.
- **`KioskShell` (`src/App.tsx`, TD-1)** : la chrome vit **hors du gate**. `UndoToast` s'y monte (comme `TopBar`). Le toast n'a pas besoin de HA ; la closure `undo` (créée par l'appelant sous le provider) capture le moyen de commander.
- **`DeviceTile` (`src/ui/`)** : états `default`/`on`/`stale`. Pour « Échec », rester minimal (texte via `value`) — **ne pas** ajouter un nouvel état visuel lourd (le traitement d'échec riche = futur).

**Commander un groupe hors hook (guidance pour la restauration + pour 2.3).** `useOptimisticControl` est un hook **par entité** — on ne peut pas l'appeler dynamiquement pour N entités. Pour une action de groupe (et la restauration undo) : lire l'état confirmé (snapshot) **avant** l'action, puis, à la restauration, pour chaque entité : `usePendingStore.getState().setPending(id, priorState, timeoutMs)` + appel service HA impératif (`useHass().callService(domain, service, { target: { entity_id } })` ou `useService(domain)`). Accès HA **via `@hakit` uniquement** (AD-2). Vérifier la signature exacte de `callService` dans les types `@hakit/core` avant usage (ne pas deviner).

**API `@hakit` (rappel, vérifié 2.1) :** `useEntity(id).state`/`.service.*` ; `useHass((s)=>s.connectionStatus)` ; `useHass().callService(...)` (impératif — **vérifier la signature** côté types). `HassConnect` gate les enfants sur l'auth → toast **hors** du gate.

**Tests (baseline Vitest, cf. 2.1) :**
- Store + utilitaire : unitaires sans DOM ; **temps déterministe** (`vi.useFakeTimers()`), **pas** de `Date.now()` non maîtrisé dans les assertions ; **id via compteur monotone** (leçon review 2.1 : ne pas utiliser `Date.now()` comme identifiant unique).
- `UndoToast` : composant + fake timers (compte à rebours + auto-dismiss). Nettoyer les timers au unmount (leçon 2.1).
- `LightTile` : cas « Échec » via timeout (fake timers) — étend le test existant.
- Gate : `verbatimModuleSyntax` + `noUnusedLocals`/`noUnusedParameters` actifs → imports `type` explicites. **TD-2** : les `*.test.*` ne sont pas typecheckés par `tsc -b`.

### Project Structure Notes

- **NEW** : `src/state/undo.ts` (+ `.test.ts`) — le store + `buildUndo` (dossier `state/` = état UI transverse borné, comme `pending`/`control-model` de 2.1). `src/ui/UndoToast.tsx` (+ `.test.tsx`) — overlay UI (primitive, `ui/`).
- **UPDATE** : `src/App.tsx` (monter `UndoToast` dans `KioskShell`, hors gate), `src/widgets/LightTile.tsx` (+ `.test.tsx`) (indice « Échec »), `deferred-work.md` (finding 2.1 résolu), `_bmad-output/implementation-artifacts/sprint-status.yaml` (2-2 → in-progress → review).
- **Placement/direction de dépendance** : `ui/UndoToast` → `state/undo` (abonnement) ; les appelants (widgets/tuiles master, 2.3+) → `state/undo` (`offerUndo`) + `state/pending` (restauration). Toast **sans** dépendance HA.
- **Style** : Tailwind/TailAdmin primaire ; fond givré via tokens existants (`card-fill`/`card-border`, radius `lg`) ; **pas** de classe Tailwind construite dynamiquement (leçon cascade 1.2) ; cible ≥52px (`min-h-[52px]`) ; texte+icône (UX-DR14).

### Décisions ouvertes / dépendances

- **Preuve device différée à 2.3** : 2.2 n'a pas de déclencheur réel ; le flux end-to-end (Tout éteindre → toast → Annuler → retour état) s'éprouve quand 2.3 câble la tuile master. Le noter dans 2.3.
- **`callService` impératif** : signature exacte à vérifier dans `@hakit/core` (types) au moment du dev — ne pas deviner ; c'est le seul point « nouveau » d'API HA vs 2.1.
- **Durée dwell** : 7000 ms par défaut (milieu de 6-8 s), paramétrable par `offerUndo`.

### References

- [Source: epics.md#Story 2.2 (toast « Annuler » 6-8 s, ≥52px, compte à rebours ; retour à l'état confirmé) · #Story 2.3/2.5/4.1/3.1 (déclencheurs : master lights, Tout fermer, Désarmer, scènes)]
- [Source: ARCHITECTURE-SPINE.md#AD-11 (couche pending — la restauration y passe) · #AD-5 (optimiste+convergence) · #AD-4 (services HA only, zéro automatisation client) · #AD-1/AD-3 (état UI éphémère OK, pas de cache) · #AD-2 (accès HA via @hakit)]
- [Source: EXPERIENCE.md#Enfants & sécurité (undo = filet universel, retour à l'état confirmé précédent, pas de child-lock v1) · #Micro-copy/Voice (« Annuler ») · undo-toast 6-8 s + compte à rebours + ≥52px]
- [Source: DESIGN.md#undo-toast (dwell 6-8 s, annulerButton min 52px contraste élevé, countdown visible ring/bar) · #a11y (état par texte+icône, pas couleur seule)]
- [Source: Story 2.1 (done, commit `1843a86` — `useOptimisticControl.failed`, `usePendingStore`, `ControlModel`, `KioskShell`, pattern Zustand+composant ; leçons review : id monotone pas `Date.now()`, nettoyage timers) · deferred-work.md (finding « LightTile ignores failed » routé ici)]
- [Source: @hakit/core 6.0.2 types — `useHass().callService`, `useService`, `useEntity().service.*` (signature `callService` à vérifier au dev)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Liza Pairing mode, Autonomous — Amelia dev-story).

### Debug Log References

- **`buildUndo` renvoie une closure `() => void`, pas un `UndoableAction`** (raffinement vs le texte de la story) : un `UndoableAction` complet a besoin de l'`id`/timing que seul le store possède. Le store `offer(label, undo, dwellMs?)` enveloppe la closure. Signature aussi simplifiée : `buildUndo(snapshots, reapply)` (pas de `label` — il vit sur `offer`). Design plus propre et honnête.
- **Aucun appel `callService` dans 2.2** : la restauration réelle (impérative, groupée) est fournie par l'appelant (`reapply`), donc 2.2 reste HA-agnostique et testable pur. La vérif de signature `callService` est reportée à 2.3 (documentée en Dev Notes).
- **Timers** : `UndoToast` possède `setInterval` (tick 100 ms du compte à rebours) + `setTimeout` (auto-dismiss à `expiresAt`), nettoyés au changement/unmount (leçon 2.1). Id `dismiss(id)` garde-fou contre l'effacement d'un offer plus récent.
- **Build local bloqué par la garde AD-8** (token `.env.local`) — attendu ; build vérifié **sans token**, `dist/` propre.

### Completion Notes List

- **AC1–AC4 satisfaits (automatisable).** Store undo Zustand (action unique, last-wins, borné, id monotone, hors React/HA) ; `buildUndo` (snapshot → closure de restauration, `reapply` fourni par l'appelant) ; `offerUndo` = point d'entrée unique ; `UndoToast` (label + barre de compte à rebours + « Annuler » ≥52px texte+icône + auto-dismiss) monté dans `KioskShell` hors du gate ; indice « Échec » replié dans `LightTile` (consomme `useOptimisticControl.failed`). **69 tests verts** (+12), typecheck/lint/build (sans token) verts, 0 token dans `dist/`.
- **Finding 2.1 clos** : `deferred-work.md` — « LightTile ignores `failed` » marqué **résolu (2.2)**.
- **Raffinement d'API** (Post-Hoc, cf. Debug Log) : `buildUndo` → closure ; store `offer` enveloppe. Intention de la story préservée (mécanisme réutilisable + `offerUndo` unique).
- **Preuve device (Florian) = review, différée à 2.3** : 2.2 n'a pas de déclencheur réel ; le flux « Tout éteindre → toast → Annuler → retour état » s'éprouve quand 2.3 câble la tuile master. Non observable côté agent.

### File List

**Créés :**
- `src/state/undo.ts`, `src/state/undo.test.ts`
- `src/ui/UndoToast.tsx`, `src/ui/UndoToast.test.tsx`

**Modifiés :**
- `src/App.tsx` (monte `<UndoToast/>` dans `KioskShell`, hors du gate)
- `src/widgets/LightTile.tsx` (+ `.test.tsx`) : indice « Échec » via `useOptimisticControl.failed`
- `_bmad-output/implementation-artifacts/deferred-work.md` (finding 2.1 « LightTile ignores failed » → résolu)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (2-2 → in-progress → review)

**Post-review (2026-07-16) :**
- `src/hakit/useOptimisticControl.ts` (+ `.test.ts`) — F1 : effet de retrait du `failed` périmé (`lastTarget` ref)
- `src/state/undo.ts` (+ `.test.ts`) — F2 `undoCountdown` borné ; F3 `runUndo` try/finally + `buildUndo` best-effort
- `src/ui/UndoToast.tsx` — F2 (helper borné), F4/F5 (contraste), F7 (aria-hidden secondes)
- `_bmad-output/implementation-artifacts/deferred-work.md` (+ finding différé 2.2 → 2.3 : refs HA périmées dans la closure undo)

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-16 | 1.0 | **Accepté par Florian → Status: done.** Code-review (3 couches adversariales) traitée : 5 patches (retrait `failed` périmé — clôt aussi le résidu 2.1 ; `undoCountdown` borné ; `runUndo` try/finally + `buildUndo` best-effort ; contraste « Annuler » ; `aria-hidden` secondes), 1 différé (refs HA périmées → 2.3), 4 rejetés. 75 tests verts, typecheck/lint/build (sans token) verts, 0 token. **Restent en suivi :** preuve device (via 2.3, 1ᵉ déclencheur réel) + review indépendante multi-modèle. |
| 2026-07-16 | 0.1 | Mécanisme d'undo (NFR6/UX-DR9) : store Zustand `useUndoStore` (action unique, last-wins, borné, id monotone) + `buildUndo` (snapshot→restauration) + `offerUndo` (entrée unique) ; `UndoToast` (compte à rebours + « Annuler » ≥52px, auto-dismiss) monté hors du gate dans `KioskShell` ; indice « Échec » replié dans `LightTile` (clôt le finding différé de la review 2.1). Portée = mécanisme + tests (déclencheurs réels = 2.3/2.5/4.1/3.1) ; snapshot client-side éphémère ré-appliqué via la couche pending. 69 tests verts, typecheck/lint/build (sans token) verts, 0 token. Preuve device différée à 2.3 (pas de déclencheur réel ici). → review. |
