# Story 2.3: Éclairage — allumer/éteindre (pièce + master)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Florian ou un enfant,
I want allumer/éteindre les lumières par pièce et par groupe,
so that je gère l'éclairage de la maison depuis la cuisine.

## Acceptance Criteria

_From `epics.md:253-265` (BDD verbatim):_

1. **Given** les lumières mappées **When** j'appuie sur une tuile pièce ou la tuile master « Toutes les lumières » **Then** la lumière (ou le groupe) bascule on/off, en **optimiste + convergence** (FR2, AD-5, UX-DR2/3).
2. **And** les tuiles des chambres enfants (Nathan, Gaspard) respectent la cible **≥ 56 px** (NFR2).
3. **And** l'action **master** déclenche le pattern **undo** (Story 2.2).

> ⚠️ **Réalité matérielle (2026-07-20)** : Florian ne dispose que d'**UNE** entité lumière réelle — `light.bureau_elgato` (« Lumière PC », pièce **Bureau**, RDC). Les chambres enfants (Nathan/Gaspard), le Salon, etc. **n'ont pas encore d'entité lumière**. Les AC 1–3 supposent plusieurs lumières + un master pertinent ; avec **une seule** lumière, une partie de 2.3 est **bloquée sur des entity_ids manquants** (voir _Open Questions_). Le périmètre **livrable maintenant** est cadré ci-dessous.

## Scope de cette story (adapté au réel)

**LIVRABLE MAINTENANT (débloqué) :**

- **A.** Remplacer le placeholder `light.salon` par la lumière **réelle** `light.bureau_elgato` dans le mapping (AD-7). Elle devient une **tuile `LightTile` réelle, tappable**, on/off optimiste + convergence — la vraie preuve end-to-end de l'infra 2.1 (jusqu'ici jamais exercée sur une vraie entité). Satisfait **AC1** pour la lumière disponible.
- **B.** Placer la tuile sur l'accueil : Bureau est **RDC** → tuile éclairage dans la **rangée RDC** de l'accueil (pair des cartes pièces / aspirateur). Doit tenir **sans scroll** (1024×768).

**BLOQUÉ (report jusqu'à obtention des entity_ids lumières manquants) :**

- **Master « Toutes les lumières »** (AC1 groupe, AC3 undo) : un master sur **une seule** lumière = UX factice. À construire quand **≥ 2** lumières existent. C'est aussi ce qui déclenche les 2 _deferred findings_ (voir Dev Notes).
- **Tuiles chambres enfants** (AC2, cible 56 px) : Nathan/Gaspard n'ont **pas** d'entité lumière → rien à câbler tant que les ids n'arrivent pas.

> Le dev DOIT trancher les _Open Questions_ (surtout Q1/Q2/Q3) avec Florian avant d'attaquer la partie master. La partie A/B est prête.

## Tasks / Subtasks

- [ ] **T1 — Mapping : lumière réelle Bureau** (AC: 1)
  - [ ] Dans `src/entities/mapping.ts`, remplacer l'entrée `LIGHTS` placeholder `light.salon` par `light.bureau_elgato` (retirer `placeholder: true`). `domain: "light"`, `service: "light.toggle"` (le champ mapping ; l'`apply` du modèle utilise `turn_on`/`turn_off`).
  - [ ] Décider le porteur du **label** « Bureau » (voir Q2). Recommandé : ajouter un champ optionnel `label?: string` à `EntityEntry` (Bureau n'est PAS une pièce-capteur Netatmo, donc `getRoom("bureau")` échouerait). Défaut si absent : `getRoom(entry.room).label`.
  - [ ] `assertNoPlaceholders` doit repasser vert (plus de placeholder).
  - [ ] Test mapping : `lights()` renvoie la lumière réelle ; pas de placeholder.
- [ ] **T2 — `LightTile` : découpler du référentiel pièce-capteur** (AC: 1, 2)
  - [ ] `LightTile` lit aujourd'hui `getRoom(entry.room)` (label + `kid`). Le rendre robuste à une lumière hors des 4 pièces canoniques : label depuis `entry.label ?? getRoom(entry.room).label` ; `kid` depuis `entry.kid ?? getRoom(entry.room).kid ?? false`. Ne pas casser le rendu existant.
  - [ ] Vérifier que `DeviceTile domain="lights"` garde l'accent ambre + états `default|on|stale` + variante `kid` (déjà ≥ 92 px kid ⇒ AC2 satisfait structurellement).
- [ ] **T3 — Accueil : placer la tuile éclairage Bureau (RDC)** (AC: 1)
  - [ ] Dans `src/pages/Home.tsx` (`HomeContent`), rendre la/les `LightTile` de `lights()` dans la **rangée RDC**, en pair des tuiles existantes. Ajuster la grille RDC (`grid-cols-2` → `grid-cols-3` si Salon + Aspirateur + Bureau) — **valider no-scroll sur device**.
  - [ ] (Rappel : la tuile `LightTile` placeholder avait été retirée de l'accueil lors du regroupement par étage ; elle revient ici en version réelle.)
- [ ] **T4 — Master « Toutes les lumières » + undo** — **BLOQUÉ** (AC: 1 groupe, 3)
  - [ ] Ne PAS implémenter tant que ≥ 2 lumières réelles n'existent pas (Q1/Q3). Quand débloqué : nouveau `MasterLightTile` (agrégat on/off, accent ambre, `%`/état à droite), commande **impérative** de groupe + **snapshot → `offerUndo`** (voir Dev Notes « groupe » et « deferred findings »).
- [ ] **T5 — Tests & validation**
  - [ ] Adapter/compléter `LightTile.test.tsx` (label depuis `entry.label`, kid, on/off optimiste, stale non-interactif, `failed` → « Échec »).
  - [ ] `Home.test.tsx` reste au fallback non-configuré ; ajouter au besoin un test de rendu de la tuile éclairage RDC (via un `HomeContent` monté sous provider mocké — cf. patrons RoomDetail/WeatherDetail).
  - [ ] `npm run typecheck` · `npm run lint` · `npx vitest run` verts ; pre-commit (prettier + oxlint) sur les fichiers touchés. **No-scroll** = check device (non automatisable).

## Dev Notes

### Le pattern de contrôle existe déjà — RÉUTILISER, ne pas réinventer

L'infra optimiste (Story 2.1) est **complète et shippée**. `light.bureau_elgato` est simplement le **premier vrai consommateur**.

- `src/state/control-model.ts` → **`lightModel`** existe et est **correct** : `domain:"light"`, `timeoutMs:5000`, `isConverged: state===target`, **pas** d'`isTransitional` (on/off instantané), `apply` = `entity.service.turnOn()/turnOff()` (jamais `toggle`, pour une convergence déterministe). **À réutiliser tel quel.**
- `src/hakit/useOptimisticControl.ts` → hook générique **par entité** : `{ displayState, isPending, isTransitional, isStale, failed, send }`. `send(target)` = retour optimiste < 200 ms puis convergence sur l'écho HA (AD-5/AD-11). Offline-gate (`send` no-op si `isStale`), nettoyage des timers au démontage, reset de `failed` à la convergence tardive.
- `src/widgets/LightTile.tsx` → **déjà construit** (Story 2.1, étendu 2.2) : compose `useOptimisticControl(id, lightModel)` + `DeviceTile domain="lights"`. Gère `stale` (non-interactif) et `failed` (« Échec », texte). **Seul changement requis** : le label/kid ne doivent plus dépendre d'une pièce-capteur (T2).
- `src/ui/DeviceTile.tsx` → base tile (Story 1.2), états `default|on|stale`, variante `kid` (plus grande, **≥ 92 px** ⇒ dépasse déjà le plancher 56 px de l'AC2), accent via `data-domain="lights"` (ambre `#ffb23e`). **NE PAS** ajouter d'utilitaires de couleur d'état (géré par le CSS `.device-tile[data-state]`). État porté par **texte + icône, pas la couleur seule** (UX-DR14).
- `src/entities/mapping.ts` → section `LIGHTS` + helper `lights()` (agrégation prête). Aujourd'hui **un placeholder** `light.salon`.

### La commande de GROUPE (pour le master, quand débloqué)

`useOptimisticControl` est **par entité** — on ne peut pas l'appeler dynamiquement pour N entités. Pour le master ET pour le restore d'undo (patron établi en 2.2/2.7) :

1. Lire l'état **confirmé** `entity.state` de chaque lumière **AVANT** l'action (snapshot).
2. Pour chaque entité, écrire l'intention dans le pending store impérativement : `usePendingStore.getState().setPending(id, target, lightModel.timeoutMs)`, puis émettre le service HA.
3. Service HA **impératif** en signature **with-target** : préférer `useHass().callService("light", "turn_on"|"turn_off", { target: { entity_id } })` avec un `entity_id` **string**. ⚠️ **Vérifier la signature exacte dans les types `@hakit/core` avant de coder** (ne pas deviner) — cf. `VacuumTile`/`ClimateTile` qui utilisent `useService(domain)` en `{ target, serviceData }`.

### Undo (master) — Story 2.2, premier vrai déclencheur

- `src/state/undo.ts` : **`offerUndo` est le point d'entrée unique**. `buildUndo(snapshots, reapply)` renvoie une **closure** ; `offer(label, undo, dwellMs=7000)` l'emballe. `reapply(entityId, priorState)` est fourni par 2.3. Best-effort par entité (`try/catch`).
- `src/ui/UndoToast.tsx` monté dans `KioskShell` **au-dessus** de la gate de connexion → la closure d'undo doit **résoudre entité/service au run-time** (`callService(..., { target: { entity_id } })` avec `entity_id` string) et **NE PAS** capturer un objet `useEntity(...)` vivant (sinon ref périmée après reconnexion/démontage). Le chemin `usePendingStore.getState()` (module scope) est déjà sûr.
- Snapshot = **client-side éphémère** (~7 s), ré-appliqué **via la couche pending**. **Aucun** `scene.create`, aucune entité scène HA (AD-1/AD-3/AD-4).

### Deux _deferred findings_ routés explicitement vers 2.3 (voir `deferred-work.md`)

Ils ne se matérialisent **qu'avec le master** (première situation « 2 widgets → 1 entité »). Donc **reportés avec le master** :

1. **Divergence de `failed` sur entité partagée** — tuile pièce + master pilotent le même `entity_id` ; chacun a son `useState(failed)`/timer, donc au timeout l'un affiche « Échec » et l'autre non. **Fix** = remonter le statut terminal dans le pending store partagé. À traiter **quand** le master est construit.
2. **Closure d'undo à refs périmées** — cf. ci-dessus (résoudre au run-time via `callService` + `entity_id` string).

### Previous-story (2.2) — learnings à porter

- IDs = compteur **monotone**, **jamais `Date.now()`** (revue 2.1). Timers propres, nettoyés au démontage/changement.
- Tests : temps déterministe (`vi.useFakeTimers()` / temps injecté), jamais `Date.now()` nu dans les assertions.
- `LightTile` consomme déjà `failed` → « Échec » (texte, pas couleur), reste pressable (retente + clear `failed`). Le finding 2.1 « LightTile ignore failed » est **résolu**.
- Le **device-proof** end-to-end « Tout éteindre → toast → Annuler » de 2.2 se prouve quand 2.3 câble le master (donc reporté avec lui).

### Project Structure Notes

- Fichiers **UPDATE** : `src/entities/mapping.ts` (LIGHTS réel), `src/widgets/LightTile.tsx` (label/kid découplés), `src/pages/Home.tsx` (rendu tuile RDC), tests associés. **NEW** (bloqué) : `MasterLightTile` + son test.
- **Divergence UX à noter** : `DESIGN.md`/`EXPERIENCE.md` décrivent une **section « Éclairage »** (Master + lumières par pièce) dans un accueil à sections (Ambiance/Éclairage/Volets/Climatisation). L'accueil **réel** a été refondu cette semaine en **regroupement par étage** (RDC/1er étage), sans sections nommées par domaine. 2.3 s'aligne sur l'accueil réel (tuile éclairage dans la rangée RDC), pas sur la maquette d'origine. `AD-7` : pièces canoniques = salon/chambre_parents/nathan/gaspard ; **Bureau n'en fait pas partie**.
- **AD-11** (couche pending unique par entité, last-command-wins) est **la** contrainte du master : il doit être un **owner optimiste propre** coexistant avec la tuile pièce sans course. `AD-2` : tout passe par `@hakit` (pas de REST/WS ad-hoc). `AD-6` : lumière stale ⇒ tuile non-interactive.

### References

- [Source: epics.md#Story 2.3 (lignes 253-265) — user story + AC BDD, FR2/AD-5/UX-DR2·3/NFR2/Story 2.2]
- [Source: ARCHITECTURE-SPINE.md#AD-5 (optimiste + réconciliation) · #AD-11 (pending unique par entité, ex. « Tout éteindre » vs Salon) · #AD-2 (@hakit only) · #AD-3 (source réactive, pas de cache) · #AD-4 (zéro logique auto) · #AD-6 (obsolescence par entité) · #AD-7 (mapping, pièces canoniques) · #AD-10 (accueil composé)]
- [Source: ux-designs/…/DESIGN.md — accent `accent-lights:#ffb23e` (ambre) ; device-tile (default/on-glow/stale/kid) ; master-tile ; no-scroll (l.200) · EXPERIENCE.md — Master + lumières par pièce, owner pending propre, kids opèrent leur lumière]
- [Source: 2-1…md — infra optimiste (useOptimisticControl, control-model, pending) ; LightTile vertical slice] · [2-2…md — offerUndo/buildUndo, snapshot éphémère, deferred findings] · [2-6…md / 2-7…md — service impératif with-target]
- [Source: src/state/control-model.ts#lightModel · src/widgets/LightTile.tsx · src/ui/DeviceTile.tsx · src/state/undo.ts · src/ui/UndoToast.tsx · src/entities/mapping.ts#LIGHTS]

## Décisions (2026-07-20, Florian)

- **Q1 — Master : REPORTÉ.** Avec une seule lumière, on ne construit **pas** le master « Toutes les lumières », ni l'undo, ni les lumières chambres-enfants dans 2.3. → **T4 hors périmètre**, à reprendre dans une **story de suivi** quand ≥ 2 entités lumières existent (les 2 _deferred findings_ #1/#2 et le device-proof undo de 2.2 partent avec).
- **Q2 — Label propre.** La lumière porte son **`label`** dans le mapping (champ optionnel `label?: string` sur `EntityEntry`) ; on **n'ajoute pas** « bureau » comme `RoomId`. `LightTile` lit `entry.label ?? getRoom(entry.room).label` (et `entry.kid ?? getRoom(entry.room).kid ?? false`).
- **Q3 — Aucune autre lumière** pour l'instant. AC2 (chambres enfants) et le master restent bloqués sur des `entity_id` à venir (action item sprint « rassembler les entity_ids Epic 2 »).
- **Q4 — RDC à 3 tuiles.** Accueil RDC → **`grid-cols-3`** : [Salon] [Aspirateur] [Bureau]. No-scroll à valider device.

**➜ Périmètre 2.3 final = A + B uniquement** (lumière Bureau réelle : mapping + `LightTile` découplé + tuile RDC + tests). Master/undo/chambres = story de suivi.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
