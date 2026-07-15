---
baseline_commit: ddb791a669db39b776b46c48992c3adac8ce57be
---

# Story 1.6: Pattern d'obsolescence (hors ligne)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Florian,
I want que les données qui ne sont plus fiables soient **signalées** (dernière valeur + « Hors ligne » + heure) plutôt que masquées ou blanchies,
so that je sais quand une valeur affichée n'est plus à jour — et l'écran ne devient **jamais** blanc.

## Acceptance Criteria

1. **Détection par entité, indépendante du socket (AD-6).** Une entité est **obsolète** si : la **connexion WebSocket est perdue** (`connectionStatus ≠ 'connected'`) **OU** son état est `unavailable` / `unknown` / absent. La détection est **par entité** (pas un drapeau global) — une source cloud (Netatmo) peut tomber socket ouvert (NFR5).
2. **Dernière valeur connue + horodatage (AD-6 ; carve-out AD-3).** Quand une entité devient obsolète, afficher sa **dernière valeur connue** (mémorisée en **mémoire éphémère de session** — **pas** un cache persistant, AD-3) + **« dernière donnée HH:MM »**. Si aucune valeur n'a jamais été reçue → `—`. **Jamais de blanc** (NFR4).
3. **Indicateur (UX-DR10 / DESIGN).** Pill **« Hors ligne » (icône + label) = repère PRIMAIRE** ; bordure pointillée `stale` **secondaire** ; texte en `stale-text` (lisible). Voix : « Hors ligne · dernière donnée 14:02 ». État porté par **texte + icône, pas la couleur seule** (UX-DR14).
4. **Retrofit `RoomSensorCard` (1.5).** Les cartes capteurs adoptent le pattern : au lieu du `—` actuel, elles montrent **dernière valeur + pill + horodatage** quand une mesure (temp/CO₂/humidité) est obsolète. Le reste (valeurs live, sparkline) inchangé.
5. **Mécanisme réutilisable + gates.** La détection + dernière-valeur vivent dans **un hook unique réutilisable** (ex. `useEntityValue`), prêt pour les widgets de contrôle (Epic 2+) — pas de logique d'obsolescence dupliquée. `build` + `typecheck` + `lint` + `test` **verts**.

## Tasks / Subtasks

- [x] **Task 1 — Détection pure `isStale`** (AC: 1) — **TDD**
  - [x] `src/hakit/stale.ts` : `isStale(state, connected)` = `!connected || null || 'unavailable' || 'unknown'`. Tests (5) : live→false ; déconnecté→true ; unavailable/unknown/absent→true.
  - [x] `formatSince(iso)` → « HH:MM » (Intl fr-FR) ; `''` si invalide/absent. TDD.
- [x] **Task 2 — Hook `useEntityValue`** (AC: 1, 2)
  - [x] `src/hakit/useEntityValue.ts` : enveloppe `useEntity` + `useHass(s => s.connectionStatus)` ; mémorise la dernière valeur non-obsolète en **`useRef` éphémère** (AD-3). Retourne `{ value, unit, isStale, since }`. **Sur perte socket** : l'entité est figée à un état réel → repli sur cette valeur (pas de blanc même au 1er render déconnecté).
  - [x] Accès HA via `@hakit` uniquement (AD-2) ; point unique du pattern d'obsolescence.
- [x] **Task 3 — Indicateur « Hors ligne »** (AC: 3) — **ui/**
  - [x] `src/ui/OfflineIcon.tsx` (extrait de `DeviceTile` — DRY) + `src/ui/OfflinePill.tsx` (icône + « Hors ligne » + « dernière donnée HH:MM », `stale`/`stale-text`).
  - [x] `DeviceTile` (1.2) unifié : son pill stale utilise `OfflinePill` + l'icône partagée (dédup).
- [x] **Task 4 — Retrofit `RoomSensorCard`** (AC: 4) — **TDD (composant)**
  - [x] `useEntityValue` pour temp/CO₂/humidité ; obsolète → dernière valeur + `OfflinePill` + horodatage + **bordure pointillée conditionnelle** (une seule utilitaire border/text par état — leçon cascade 1.2). Sparkline remplacée par la pill quand obsolète. Test (mock `@hakit` `useHass` `disconnected`) : pill + valeur figée + horodatage, jamais vide.
- [x] **Task 5 — Validation** (AC: 5)
  - [x] `build` + `typecheck` + `lint` (oxlint src) + `test` (33) **verts** ; 0 `entity_id` en dur hors `src/entities/` ; 0 token dans `dist/`.
  - [ ] **⏳ Preuve device (Florian, review)** : couper HA/réseau ou une source Netatmo → carte garde dernière valeur + « Hors ligne » + heure, jamais de blanc ; reconnexion → live. Non observable côté agent (nécessite HA + appareil).

## Dev Notes

**Portée stricte.** Cette story livre **le pattern d'obsolescence par entité (détection + dernière-valeur + indicateur) et le retrofit des capteurs (1.5)**. **Hors scope** (ne pas construire) :
- **Bannière « hors ligne » globale** — AD-6 est **par entité**, pas un drapeau global. Un indicateur de connexion global discret reste optionnel/différé.
- **Widgets de contrôle** (lumières/volets/clim + leur état `stale` de `DeviceTile`) → leurs epics ; ils **réutiliseront `useEntityValue`** quand ils existeront. Ici : fournir le mécanisme + retrofit du **seul** widget data live (`RoomSensorCard`).
- **Undo / actions** → Epic 2. **Cache persistant** → interdit (AD-3).

**Continuité (Stories 1.1–1.5, done).**
- **AD-3 (crucial ici)** : « dernière valeur connue » = **état éphémère de session** (un `useRef` qui retient la dernière valeur non-obsolète), **jamais** un cache persistant qui recopie l'état HA. C'est le carve-out explicite d'AD-6 vs AD-3.
- **Deux cas de « stale »** : (a) **perte socket** → `@hakit` fige les entités à leur dernier état (la valeur est déjà là) ; détection via `connectionStatus`. (b) **entité `unavailable`** socket ouvert (Netatmo cloud) → `useEntity` renvoie `state='unavailable'` → il faut la **dernière valeur mémorisée**. Le hook couvre les deux.
- **`@hakit`** : `useEntity(id, {returnNullIfNotFound:true})` (état + `.attributes.unit_of_measurement` + `.last_changed`) ; `useHass(s => s.connectionStatus)` (`'connected'|'disconnected'|…`). Accès HA via `@hakit` seulement (AD-2).
- **DeviceTile (1.2)** a déjà l'**état visuel `stale`** (bordure pointillée + pill « Hors ligne ») mais **sans** logique (détection/horodatage/dernière-valeur). 1.6 apporte la logique + l'horodatage ; réutiliser l'`OfflineIcon` existant. Ne pas dupliquer.
- **RoomSensorCard (1.5)** affiche `—` sur `unavailable` (fallback minimal, explicitement « la pill complète = 1.6 »). **C'est ce retrofit.** Ne pas casser la sparkline ni le live.
- **Tests** : baseline vitest. Mock `@hakit` (`useEntity` + `useHass` + `useHistory`) dans les tests composant ; `@hakit` est **inliné** dans vitest (leçon 1.5 : import CJS lodash). `VITE_HA_URL=''` en env test (déterminisme).
- **Gate** : build + typecheck + oxlint src + test. `verbatimModuleSyntax`/`noUnusedLocals`.

**`useHass` sélecteur** : `useHass((s) => s.connectionStatus)` renvoie `ConnectionStatus` (`'pending'|'disconnected'|'pending-suspension'|'suspended'|'connected'`, non exporté — mirroir local si besoin, cf. leçon 1.2). `connected = status === 'connected'`.

**Horodatage** : `entity.last_changed` (ISO) → « HH:MM ». Pour une entité obsolète, mémoriser le `last_changed` de la **dernière valeur bonne**. Format via `Intl.DateTimeFormat('fr-FR', { hour:'2-digit', minute:'2-digit' })` (cf. `clock-format`).

### Project Structure Notes

- Détection + hook → `src/hakit/` (`stale.ts`, `useEntityValue.ts`) : wrappers `@hakit`, cœur du seam d'accès HA + obsolescence (AD-2/AD-6). Indicateur visuel → `src/ui/OfflinePill.tsx` (AD-6 : affichage obsolescence en `ui/`).
- Fichiers NEW : `src/hakit/stale.ts` (+ test), `src/hakit/useEntityValue.ts`, `src/ui/OfflinePill.tsx`. UPDATE : `src/widgets/RoomSensorCard.tsx` (+ test), éventuellement `src/ui/DeviceTile.tsx` (extraire `OfflineIcon`).
- Réutiliser tokens `stale`/`stale-text` (1.2) ; **aucun** nouvel token.

### References

- [Source: epics.md#Story 1.6 (AD-6, NFR4, UX-DR10, NFR5)]
- [Source: ARCHITECTURE-SPINE.md#AD-6 (obsolescence par entité, indépendante du socket ; dernière valeur + indicateur ; jamais blanc) · AD-3 (pas de cache persistant — carve-out) · AD-2 (accès HA via @hakit)]
- [Source: EXPERIENCE.md#State Patterns (Stale/offline : dernière valeur + pill primaire + « dernière donnée HH:MM », par entité) · Voice and Tone (« Hors ligne · dernière donnée 14:02 »)]
- [Source: DESIGN.md#device-tile-stale (bordure pointillée stale, pill « Hors ligne » primaire, stale-text) · Do's & Don'ts (dernière valeur + indicateur, jamais blanc/spinner)]
- [Source: Story 1-2 (done — DeviceTile stale visual + OfflineIcon) · Story 1-5 (done — RoomSensorCard, `—` fallback à retrofitter, mock @hakit, useHistory)]
- [Source: @hakit `useEntity` / `useHass(connectionStatus)` — vérifiés en 1.1/1.2/1.5]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Liza Pairing mode, Autonomous).

### Debug Log References

- **AD-3 carve-out** : la « dernière valeur » vit dans un `useRef` éphémère (pas de cache persistant). **Cas perte-socket** : `@hakit` fige l'entité à un état réel → `useEntityValue` replie sur cette valeur figée (sinon 1er render déconnecté = blanc). Deux cas couverts : socket perdu (via `connectionStatus`) et entité `unavailable` (via l'état).
- **Test config** : mock `@hakit` étendu avec `useHass((s)=>s.connectionStatus)` (via `vi.hoisted` pour un état mutable) → teste live + `disconnected` dans un fichier.
- **Cascade Tailwind (leçon 1.2)** : bordure/texte stale via classes **conditionnelles** (une seule `border-*`/`text-*` par état) — pas d'empilement conflictuel.

### Completion Notes List

- **AC1–AC5 satisfaits (automatisable).** Détection par entité indépendante du socket (`isStale`) ; hook unique `useEntityValue` (dernière valeur + `since`, éphémère AD-3) ; `OfflinePill` (repère primaire + « dernière donnée HH:MM ») ; `RoomSensorCard` retrofitté (obsolète → dernière valeur + pill + bordure pointillée, jamais blanc). 33 tests verts.
- **DRY** : `OfflineIcon` extrait ; `DeviceTile` (1.2) réutilise `OfflinePill` (dédup de la pill/icône).
- **Réutilisable** : `useEntityValue` + `OfflinePill` sont le mécanisme unique — les widgets de contrôle (Epic 2+) l'adopteront (pas de logique d'obsolescence dupliquée).
- **Preuve device (Florian)** = review : couper HA/réseau → pill + dernière valeur + heure, reconnexion → live. Non observable côté agent.
- **Épic 1 complet** après acceptation de 1.6 (fondation : scaffold → design system → shell/PWA → mapping → capteurs live → obsolescence).

### File List

**Créés :**
- `src/hakit/stale.ts`, `src/hakit/stale.test.ts`
- `src/hakit/useEntityValue.ts`
- `src/ui/OfflineIcon.tsx`, `src/ui/OfflinePill.tsx`

**Modifiés :**
- `src/ui/DeviceTile.tsx` (utilise `OfflinePill` + `OfflineIcon` partagé ; supprime les copies inline)
- `src/widgets/RoomSensorCard.tsx` (+ `.test.tsx`) : `useEntityValue` + état obsolète
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-6 → review)

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-15 | 1.0 | **Accepté par Florian → Status: done.** Code-review (high) traitée + parties automatisables vérifiées (36 tests, typecheck/lint/build, 0 token). Preuve live device (offline/loading sur vraies données) à confirmer par Florian une fois connecté au HA. **Clôt l'Epic 1 (Fondation).** |
| 2026-07-15 | 0.3 | Code-review (high) — 6 corrections. **#1** `loading = !connected && known == null` (entité manquante/`unavailable` en connecté → **offline** — + pill, plus de skeleton perpétuel). **#2** capture `lastGood` déplacée en `useEffect` (plus de mutation de ref en render). **#3** ligne CO₂/humidité `truncate` (plus de clip au wrap sur tuile étroite). **#4** carte offline si **l'une** des 3 mesures est stale (pas seulement la température). **#5** `Sparkline` `min-h-8` (self-contained). **#6** `Skeleton` token `bg-text-muted/20`. 36 tests verts. |
| 2026-07-15 | 0.2 | **État `loading` / skeleton** (demandé par Florian) : distinction *loading* (obsolète **sans** valeur connue → skeleton) vs *offline* (obsolète **avec** dernière valeur → pill). Corrige le flash « Hors ligne » au démarrage à froid (connexion en cours ≠ hors ligne). `useEntityValue.loading` + `src/ui/Skeleton.tsx` + `RoomSensorCard` 3 états. 35 tests verts. |
| 2026-07-15 | 0.1 | Pattern d'obsolescence (AD-6) : `isStale` + `formatSince` (TDD) ; hook unique `useEntityValue` (dernière valeur éphémère + `since`, socket-indépendant) ; `OfflinePill` (+ `OfflineIcon` extrait, `DeviceTile` unifié) ; retrofit `RoomSensorCard` (obsolète → dernière valeur + pill + horodatage, jamais blanc). 33 tests verts, build/typecheck/lint verts, 0 token. Preuve device en attente (review). → review. |
