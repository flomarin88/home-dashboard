---
baseline_commit: 93b1876ec109cd81f60bdc85af0fd6e1ab0af52c
---

# Story 1.4: Mapping entity_id centralisé

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a développeur du Home Dashboard,
I want une **source unique** qui mappe les `entity_id` Home Assistant aux pièces et widgets (avec domaine + service),
so that aucun composant ne code d'`entity_id` en dur, un concept réel = une entité canonique, et les features suivantes (capteurs, lumières, volets…) branchent leurs entités au même endroit.

## Acceptance Criteria

1. **Pièces canoniques (AD-7).** Une **source unique** déclare les 4 pièces avec leur `id` canonique (`salon`, `chambre_parents`, `nathan`, `gaspard`), un **label FR** (« Salon », « Chambre Parents », « Nathan », « Gaspard ») et un flag **`kid`** (`true` pour `nathan`/`gaspard`, feed du variant kid — cibles 56 px). Aucun autre fichier ne redéfinit la liste des pièces.
2. **Mapping entity_id = contrat unique (AD-7).** Dans `src/entities/` **uniquement**, une source déclare pour chaque entité : `entity_id` ↔ **pièce** + **widget/feature** + **domaine** + **service** (le `service` est `null` pour les entités read-only comme les capteurs). Les `entity_id` sont **le contrat d'intégration** — référencés à ce seul endroit.
3. **Capteurs Netatmo peuplés (pour 1.5).** Les 4 pièces × { **température**, **CO₂**, **humidité** } = **12 entrées capteurs** (`domain: 'sensor'`, `service: null`), avec les **vrais `entity_id` du HA de Florian** (voir Dev Notes → « Obtenir les entity_id »). Accesseur typé, ex. `roomSensors(roomId)` → les mesures de la pièce.
4. **Invariant canonique (AD-7).** **Une entité par concept réel** : un couple (pièce, mesure) est mappé à **un seul** `entity_id` ; pas deux entrées contradictoires pour le même concept. Vérifié par un **contrôle** (test unitaire et/ou garde d'exécution en dev).
5. **Zéro `entity_id` en dur ailleurs + gates.** Aucun `entity_id` HA codé en dur dans `src/` hors `src/entities/`. `npm run build` + `typecheck` + `lint` (oxlint src) + `test` **verts**.

## Tasks / Subtasks

- [x] **Task 1 — Pièces canoniques** (AC: 1) — **TDD**
  - [x] `src/entities/rooms.ts` : `RoomId`, `Room { id, label, kid }`, `ROOMS` (nathan/gaspard `kid: true`), `getRoom`/`listRooms`. Tests : ordre des 4 pièces + flags kid.
- [x] **Task 2 — Shape du mapping (entity_id + domaine + service)** (AC: 2)
  - [x] `src/entities/mapping.ts` : `EntityEntry { entityId, room, domain, service, measure? }`, `EntityDomain` (sensor/light/cover/climate/vacuum/alarm_control_panel), `service: null` pour read-only. `ENTITIES` = source unique extensible (features y ajouteront leurs entités).
  - [x] `entityId: string` (config statique découplée de `@hakit` ; les consommateurs castent en `EntityName` au bord `useEntity`). Pas d'état d'entité (AD-3).
- [x] **Task 3 — Peupler les capteurs Netatmo + accesseur** (AC: 3) — ⚠️ **placeholders**
  - [x] 12 entrées capteurs explicites (4 pièces × temp/CO₂/humidité, `domain: 'sensor'`, `service: null`). **`entity_id` = PLACEHOLDERS marqués `TODO`** (`sensor.<room>_<measure>`) — à remplacer par les vrais ids de Florian avant la preuve live de 1.5.
  - [x] Accesseurs `roomSensors(room)` + `sensor(room, measure)`. Tests : 3 mesures/pièce, 12 au total, résolution (pièce, mesure).
- [x] **Task 4 — Invariant canonique + tests** (AC: 4, 5) — **TDD**
  - [x] `assertCanonicalMapping()` : `entity_id` unique partout ; (pièce, mesure) unique pour les capteurs (les domaines de contrôle peuvent avoir plusieurs entités/pièce → seule l'unicité d'`entity_id` les contraint). Tests : mapping réel accepté ; doublon (pièce,mesure) et `entity_id` dupliqué rejetés.
- [x] **Task 5 — No-hardcode + validation** (AC: 5)
  - [x] `rg` : aucun `entity_id` HA hors `src/entities/` (0 hit). `.gitkeep` retiré.
  - [x] `build` + `typecheck` + `lint` (oxlint src) + `test` (12/12) **verts**.

## Dev Notes

**Portée stricte.** Cette story livre **la source unique de mapping** : pièces canoniques + shape entity_id↔pièce/widget/domaine/service + **capteurs Netatmo peuplés** + invariant + accesseurs + tests. **Hors scope** (ne pas construire) :
- **UI / cartes capteurs** → Story 1.5 (consomme ce mapping + `useEntity` + `SectionCard`/tokens).
- **Données live / `useEntity`** → widgets des stories features ; ici **config statique** seulement (AD-3 : pas d'état d'entité stocké).
- **Entités contrôlables** (lumières, volets, clim, aspirateur, alarme) → **ajoutées à ce même fichier** par leurs stories (Epics 2–4). Ne pas les peupler maintenant (pas les entity_id, pas de sur-construction).
- **Obsolescence** → Story 1.6.

**Continuité (Stories 1.1–1.3, done).**
- Dossier `src/entities/` : placeholder du seed créé en 1.1 (`.gitkeep`) — **c'est ici** que vit le mapping (spine : `entities/` = mapping AD-7). Retirer le `.gitkeep` une fois peuplé.
- Baseline de tests **en place** (`vitest` + Testing Library, ajoutés en 1.3) : `npm test`. Le mapping est de la **logique pure** → bon ROI pour des tests d'accesseurs/invariant (recommandé). `tsconfig.app.json` **exclut** `*.test.ts` du build ; `oxlint src` lint aussi les tests.
- Conventions TS : `verbatimModuleSyntax` (`import type` pour les types), `noUnusedLocals`. Gate = build + typecheck + oxlint src + test.
- **AD-3** rappel : ce mapping ne stocke **pas** d'état d'entité (pas de cache) — il déclare *quelle* entité ; les widgets liront l'état live via `useEntity`/`useHass` (dans le provider). Séparation nette « quelle entité » (ici) vs « son état » (widgets).
- `@hakit` : `EntityName` est exporté (`${domain}.${string} | 'unknown'`) ; `useEntity(entityId)` attend ce type. Le mapping peut typer `entityId: EntityName` (cast si besoin) pour que les conscommateurs 1.5 passent directement au hook sans cast.

**Obtenir les `entity_id` réels (Netatmo).** Le mapping est **du contenu authored**, mais les valeurs sont les entités du HA de **Florian** :
- Les découvrir dans HA : **Outils de développement → États**, filtrer par `sensor.` (intégration Netatmo) — noter les `entity_id` de température/CO₂/humidité des 4 pièces. (Le nommage dépend de l'intégration, ex. `sensor.salon_temperature`, `sensor.salon_co2`, `sensor.salon_humidity` — **à confirmer**, ne pas deviner.)
- **Dépendance dev** : si les `entity_id` réels ne sont pas fournis au moment du dev, poser des placeholders **`TODO`** typés et documentés ; ils devront être remplacés par les vrais **avant la preuve live de 1.5** (sinon les cartes afficheront `unavailable`). Cette story peut être structurellement « done » avec placeholders marqués, mais le flag doit être explicite.

**Une entité canonique par concept (AD-7).** Ex. « alarme armée » = **une** entité (pas deux). Pour les capteurs : chaque (pièce, mesure) = exactement une entrée. L'invariant (Task 4) empêche qu'un même concept soit mappé à deux `entity_id` divergents (source de bugs d'affichage contradictoire).

### Project Structure Notes

- Tout sous `src/entities/` : `rooms.ts` (pièces), `mapping.ts` (entités + domaine/service), `index.ts` (barrel + accesseurs + invariant), `mapping.test.ts` (tests logique). Retirer `src/entities/.gitkeep`.
- Fichiers NEW : `src/entities/rooms.ts`, `src/entities/mapping.ts`, `src/entities/index.ts`, `src/entities/mapping.test.ts`. DELETE : `src/entities/.gitkeep`.
- Les consommateurs (1.5+) importeront **depuis `src/entities/`** — jamais d'`entity_id` littéral ailleurs.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4 (AC AD-7) · Story 1.5 (capteurs = 1er consommateur)]
- [Source: ARCHITECTURE-SPINE.md#AD-7 (mapping entity_id source unique, domaine+service, une entité canonique par concept) · AD-3 (pas de cache d'état) · Structural Seed (`src/entities/`) · Consistency Conventions (pièces canoniques `salon`/`chambre_parents`/`nathan`/`gaspard`)]
- [Source: EXPERIENCE.md#Information Architecture (4 pièces, rooms canoniques) · Accessibility Floor (kid rooms nathan/gaspard)]
- [Source: DESIGN.md#room-sensor-card (température = valeur de coup d'œil ; CO₂/humidité secondaires) — consommé en 1.5]
- [Source: Stories 1-1..1-3 (done) — seam `src/hakit/`, `@hakit` `EntityName`/`useEntity`, baseline vitest, gate oxlint src]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Liza Pairing mode, Autonomous).

### Debug Log References

- **TDD** (baseline vitest de 1.3) : 3 cycles red→green — rooms, accesseurs capteurs, invariant canonique. 12 tests verts.
- `entityId` typé `string` (et non `@hakit` `EntityName`) : découple le contrat de mapping de la lib de connexion et évite toute friction de types sur les littéraux ; 1.5 castera au bord `useEntity`.
- Invariant : l'unicité `(pièce, mesure)` ne s'applique qu'aux capteurs ; les domaines de contrôle (plusieurs lumières/pièce) ne sont contraints que par l'unicité d'`entity_id` — forward-safe.

### Completion Notes List

- **AC1–AC5 satisfaits et vérifiés** (build/typecheck/lint/test verts ; 0 `entity_id` en dur hors `src/entities/`).
- **⚠️ PLACEHOLDERS `entity_id`** : les 12 capteurs utilisent `sensor.<room>_<measure>` (marqués `TODO` dans `mapping.ts`). **À remplacer par les vrais ids du HA de Florian** (Outils de dev → États, filtre `sensor.`) **avant la preuve live de 1.5** — sinon les cartes 1.5 afficheront `unavailable`. La structure/logique est complète et testée ; seules les valeurs de données restent à confirmer.
- **Source unique extensible** : `ENTITIES` ne contient que les capteurs ; lumières/volets/clim/aspirateur/alarme seront **ajoutés ici** par leurs stories (AD-7 préservé).
- **Invariant** vérifié par test (le mapping réel passe ; doublons rejetés) — tient lieu de garde (AC4 « test unitaire »).
- Baseline de tests portée à **12** (rooms + accesseurs + invariant).

### File List

**Créés :**
- `src/entities/rooms.ts`
- `src/entities/mapping.ts`
- `src/entities/index.ts`
- `src/entities/mapping.test.ts`

**Supprimés :**
- `src/entities/.gitkeep` (dossier peuplé)

**Modifiés :**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-4 → review)

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-14 | 0.2 | Code-review (high) — corrections #1–#4 (durcissement du validateur). **#1** : `assertCanonicalMapping` vérifie la **forme** `<domain>.<object_id>` (un `entity_id` mal formé échoue le gate au lieu de finir en `unavailable`). **#2** : appel `if (import.meta.env.DEV) assertCanonicalMapping()` au module-load → auto-enforcé en dev, plus seulement au test. **#3** : flag `placeholder: true` sur les 12 capteurs + `assertNoPlaceholders()` (à appeler avant la preuve live de 1.5 — « placeholders restants » = échec bruyant). **#4** : test renforcé — **chaque** pièce a ses 3 mesures (plus seulement Salon). #5 (throw `getRoom` injoignable) : skip. 16 tests verts. |
| 2026-07-14 | 0.1 | Mapping `entity_id` centralisé (AD-7) : pièces canoniques + `EntityEntry` (entity_id↔pièce/domaine/service) + 12 capteurs Netatmo (**placeholders TODO**) + accesseurs `roomSensors`/`sensor` + invariant canonique. **TDD**, 12 tests verts. Build/typecheck/lint verts, 0 entity_id en dur ailleurs. → review. |
