---
baseline_commit: 7cd7d69e920fc786a1dbfaaeff19ae73cfc84589
---

# Story 6.1: Sortie des poubelles (jaune / noire)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Florian,
I want une **tuile poubelle** (grosse icône, jaune/noire selon le jour, rouge si oubli) que je peux marquer « sortie » pendant le créneau,
so that on n'oublie jamais de sortir la bonne poubelle (jaune = tri · noire = ordures), et qu'on garde l'historique.

## Contexte & valeur

**Net-new / correct-course (2026-07-16)** — amorce de la **couche coordination familiale** (spine Deferred v2), tirée en avant **en respectant l'archi** : **HA détient l'échéancier ET l'état** (AD-1/AD-4 : *toute logique horaire vit dans HA*), l'app **reflète** un capteur + **écrit un timestamp** via service HA. L'app n'a **aucune persistance propre** (AD-1/AD-3) → l'« fait/pas fait » et l'**historique** vivent dans HA.

**Décisions produit (Florian, 2026-07-16) :**
1. **Une tuile**, pas un indicateur barre supérieure (→ dans l'arbre `@hakit`, plus de contrainte TD-1).
2. **Grosse icône poubelle, sans texte**, **colorée** : **jaune** / **noire** selon le créneau, **rouge** si oubli.
3. **Active seulement pendant le créneau** ; **si sortie → bouton désactivé** ; **si oubli → rouge**.
4. **Schéma horaire dans HA** (choix « pure ») : **capteur template** calcule l'état ; l'app le reflète.
5. **Logger date+heure** de la sortie → **HA** (`input_datetime` + historique HA = journal récupérable).

**Créneaux (dans le template HA, PAS dans l'app) :** Jaune = **mardi 18h → mercredi 7h** · Noire = **jeudi 18h → vendredi 7h**.

## Contrat d'interface HA ↔ app (à respecter des deux côtés)

**`sensor.poubelle_a_sortir`** (capteur template HA — Task 0) — `state` ∈ :
- `jaune` — poubelle **jaune** à sortir **maintenant** (créneau actif, pas encore sortie)
- `noire` — poubelle **noire** à sortir maintenant
- `oubli_jaune` — jaune **non sortie**, créneau passé → **rouge**
- `oubli_noire` — noire non sortie, créneau passé → **rouge**
- `aucune` — rien à sortir (repos)
- `unavailable`/`unknown` → obsolescence (AD-6)

**`input_datetime.poubelle_jaune_sortie`** / **`…_noire_sortie`** (HA helpers — Task 0) : l'app y **écrit `now`** au tap « Sortie » ; le template HA les lit pour décider `jaune`→`aucune` (fait) et l'oubli ; leur **historique HA = le journal**.

> _Aide template HA (indicatif, côté Florian) :_ `jaune` si `now` ∈ [mardi 18h, mercredi 7h] et `input_datetime.poubelle_jaune_sortie` **hors** de ce créneau ; `aucune` si déjà dans le créneau ; `oubli_jaune` si `now` > mercredi 7h et pas sortie et avant le prochain créneau. Idem noire (jeudi/vendredi).

## Acceptance Criteria

1. **Tuile pilotée par le capteur (AD-1/AD-3/AD-6).**
   **Given** `sensor.poubelle_a_sortir` mappé
   **When** l'accueil s'affiche
   **Then** une **tuile** montre une **grosse icône poubelle** (sans texte de statut) **colorée** selon `state` : `jaune`→**jaune**, `noire`→**noire**, `oubli_jaune`/`oubli_noire`→**rouge**, `aucune`→**neutre/atténué**. Lu **uniquement** via `@hakit` (AD-2), pas de cache (AD-3).
   **And** `unavailable`/perte socket → **obsolescence** (AD-6, icône atténuée + « Hors ligne », jamais de blanc).

2. **« Sortie » = écrire le timestamp HA, seulement quand actif (AD-4).**
   **Given** un créneau **actif** (`state` = `jaune` ou `noire`)
   **When** j'appuie sur la tuile (cible ≥56px — geste enfant, NFR2)
   **Then** l'app **écrit `now`** dans l'`input_datetime` correspondant (`input_datetime.set_datetime`, **service HA uniquement** — AD-4) ; **retour optimiste immédiat < 200 ms** (l'action se marque « faite »), réconcilié quand le capteur repasse à `aucune` (AD-5).
   **And** **hors créneau actif** (`aucune`/oubli) → **pas d'action d'écriture** de sortie sur simple affichage ; **une fois sortie, le geste est désactivé** (le capteur n'est plus `jaune`/`noire`). _(Sortie tardive en état `oubli` : autorisée — voir Dev Notes.)_

3. **Réutilisation + kiosque + gates.**
   **Given** la tuile + le mapping
   **When** je termine
   **Then** l'obsolescence réutilise `useEntityValue`/`isStale` ; **couleur jamais seule** — l'icône poubelle + un repère non-coloré (forme/pastille d'état) portent le sens (UX-DR14) ; la tuile respecte le **kiosque 1024×768 sans scroll** ; tous les `entity_id` dans `src/entities/` (AD-7) ; `build`+`typecheck`+`lint`+`test` **verts** ; **0 token** dans `dist/`.

## Tasks / Subtasks

- [ ] **Task 0 — ⚠️ PRÉREQUIS HA (Florian, hors app) : capteur + helpers**
  - [ ] **Créer** `sensor.poubelle_a_sortir` (**template**) respectant le **Contrat d'interface** ci-dessus (états `jaune`/`noire`/`oubli_jaune`/`oubli_noire`/`aucune`), avec les créneaux mardi/jeudi.
  - [ ] **Créer** `input_datetime.poubelle_jaune_sortie` et `input_datetime.poubelle_noire_sortie` (Helpers → Date/heure).
  - [ ] Confirmer les **`entity_id` réels** (les slugs peuvent différer — leçon 2.7). Le dev **ne devine pas** ; il mappe les ids fournis.

- [ ] **Task 1 — Mapping poubelles** (AC: 1, 2, 3)
  - [ ] `src/entities/mapping.ts` : config `BINS` (AD-7) : `stateEntityId: 'sensor.poubelle_a_sortir'` + map `sortie` par couleur `{ jaune: 'input_datetime.poubelle_jaune_sortie', noire: 'input_datetime.…_noire_sortie' }`. Accesseur `binsConfig()`.

- [ ] **Task 2 — Interprétation d'état (pur)** (AC: 1, 2) — **TDD**
  - [ ] `src/widgets/bin-state.ts` : `binView(state): { color: 'jaune'|'noire'|'rouge'|'idle'; active: boolean; bin: 'jaune'|'noire'|null }`.
    - `jaune`→{jaune, active:true, bin:jaune} ; `noire`→{noire, active:true, bin:noire} ; `oubli_jaune`→{rouge, active:false, bin:jaune} ; `oubli_noire`→{rouge, active:false, bin:noire} ; `aucune`/inconnu→{idle, active:false, bin:null}.
  - [ ] **Aucune logique horaire ici** (AD-4) — pur mapping d'un état HA. Tests : chaque état → vue attendue.

- [ ] **Task 3 — Tuile `BinTile`** (AC: 1, 2, 3) — **TDD (composant)**
  - [ ] `src/widgets/BinTile.tsx` : lit `sensor.poubelle_a_sortir` via `useEntityValue` (obsolescence) ; `binView(value)` → **grosse icône poubelle** remplie de la couleur (jaune/noire/rouge) ou atténuée (idle) ; **repère d'état non-coloré** (ex. petite pastille/point ou variation de forme) pour l'a11y (UX-DR14). **Pas de texte de statut** (décision Florian) — un `aria-label` décrit l'état (lecteur d'écran).
    - Si `active` : la tuile est un **bouton ≥56px** → au tap, `useService('input_datetime').set_datetime({ target: sortieId, serviceData: { datetime: <ISO now> } })` (service HA, AD-4) + **optimiste** (marque « fait » localement jusqu'à ce que le capteur quitte `jaune`/`noire`).
    - Si **oubli** (rouge) : tuile **rouge**, tap **autorisé** (sortie tardive → écrit aussi le timestamp) — ou purement indicatif selon préférence ; par défaut : tap autorisé.
    - Si `idle`/obsolète : non interactive.
  - [ ] `set_datetime` : `datetime` au format HA (`'YYYY-MM-DD HH:mm:ss'`) — **vérifier la signature exacte** dans les types `@hakit/core` (comme `callService`/vacuum). `now` injectable pour tests.
  - [ ] Test (mock `@hakit`) : `jaune` → icône jaune + tuile-bouton ; tap → `set_datetime` appelé sur l'`input_datetime` jaune (optimiste « fait ») ; `oubli_noire` → rouge ; `aucune` → atténué non interactif ; déconnecté → obsolescence.

- [ ] **Task 4 — Placer la tuile sur l'accueil** (AC: 1, 3)
  - [ ] `src/pages/Home.tsx` : ajouter la tuile Poubelles (gérée `isConfigured`, sous provider). Placement compact dans la grille (kiosque sans scroll — mémoire `target-device-and-layout`). Ne pas régresser le layout.

- [ ] **Task 5 — Validation (gates)** (AC: 3)
  - [ ] `build` (sans token) + `typecheck` + `lint` + `test` **verts** ; 0 `entity_id` en dur hors `entities/` (code non-test) ; 0 token dans `dist/`.
  - [ ] **⏳ Preuve device (Florian, review)** : mardi soir → tuile jaune + tap « Sortie » → `input_datetime` écrit (visible dans HA) + tuile repasse `aucune` ; jeudi soir → noire ; oubli → rouge ; historique consultable dans HA (historique de l'`input_datetime`). Pas de scroll.

## Dev Notes

**Portée stricte.** Tuile poubelle **pilotée par un capteur HA** + écriture du timestamp de sortie. **Hors scope — NE PAS construire :**
- **Le schéma horaire / le calcul actif-oubli côté client** → **interdit (AD-4)** ; vit dans le **template HA** (Task 0). L'app **reflète** `sensor.poubelle_a_sortir` + **mappe** l'état → vue (pur, pas d'horaire).
- **Persistance/journal côté app** → interdit (AD-1/AD-3). Le journal = **historique HA** de l'`input_datetime`. Ne pas stocker localement.
- **Réinitialisation du cycle** (retour à `aucune` après collecte, oubli, prochain créneau) → **template/automation HA**, pas l'app.
- **Autres rituels (tortues, To-do)** → v2, pas ici.
- **Texte de statut sur la tuile** → non (décision Florian : icône seule) ; l'`aria-label` couvre l'a11y lecteur d'écran.

**A11y (UX-DR14) — nuance couleur.** Florian veut « sans texte, grosse icône colorée ». La couleur jaune/noire = **l'identité réelle** des bacs (naturelle), le rouge = alerte. Pour ne pas porter le sens **par la couleur seule** : ajouter un **repère non-coloré** (ex. un petit point/anneau d'état, ou l'icône « ! » sur oubli) + `aria-label` explicite (« Poubelle jaune à sortir » / « Oubli poubelle noire »). Le porter au dev sans réintroduire de texte de statut visible.

**Continuité (Stories done, commit `7cd7d69`).**
- **`useEntityValue`/`isStale`/`OfflinePill` (1.6)** : obsolescence du capteur.
- **`useService`/`callService` (vu en 2.7 pour `button.press`)** : ici `input_datetime.set_datetime` — **même pattern impératif** ; vérifier la signature/format `datetime` dans les types `@hakit/core` au dev.
- **`useOptimisticControl`/pending (2.1)** : la « sortie » n'est **pas** un on/off simple (c'est écrire un datetime) → un **optimiste léger** (drapeau local « fait » jusqu'à ce que le capteur quitte l'état actif) suffit ; réutiliser le store pending seulement si pertinent. Ne pas sur-ingénierer.
- **Mapping (`entities/`, AD-7)** ; **`Home` sous provider** ; **kiosque 1024×768 sans scroll** (mémoire).
- **Helper pur + test** (`vacuum-status`/`consumableLabel`) : `bin-state.ts` suit le moule. **`now` injecté** dans les tests (leçon).

**@hakit :** `input_datetime.set_datetime` (domaine `input_datetime`) — service impératif via `useService('input_datetime')` ou l'entité. Format `datetime` HA = `'YYYY-MM-DD HH:mm:ss'`. Accès HA via `@hakit` seulement (AD-2).

### Project Structure Notes

- **NEW** : `src/widgets/BinTile.tsx` (+ `.test.tsx`) ; `src/widgets/bin-state.ts` (+ `.test.ts`).
- **UPDATE** : `src/entities/mapping.ts` (+ `.test.ts`) (`BINS` + `binsConfig()`) ; `src/pages/Home.tsx` (tuile) ; `_bmad-output/implementation-artifacts/sprint-status.yaml` (6-1 → in-progress → review). _(Éventuel token couleur jaune/noire dans `index.css` si besoin — rouge = `security-alert` existant.)_
- **Direction de dépendance** : `widgets/BinTile` → `hakit`/`entities`. Tuile sous provider.
- **Style** : Tailwind ; icône ≥56px (geste enfant) ; couleur + repère non-coloré ; kiosque sans scroll.

### Décisions ouvertes / dépendances

- **Task 0 bloquant** : le **capteur template** + les 2 `input_datetime` (Florian, côté HA). L'app ne peut pas être éprouvée sans.
- **Format `set_datetime`** : signature exacte à vérifier au dev.
- **Tap en état `oubli`** : autorisé (sortie tardive) par défaut — confirmer au besoin.
- **Couleurs tokens** : jaune/noire à ajouter en tokens neutres si nécessaire (pas des accents domotiques) ; rouge = `security-alert`.

### References

- [Source: epics.md#Epic 6 / Story 6.1 (correct-course 2026-07-16)]
- [Source: ARCHITECTURE-SPINE.md#AD-4 (**toute logique horaire vit dans HA** — le schéma poubelles = template HA) · #AD-1/AD-3 (HA source de vérité, app sans persistance) · #AD-6 (obsolescence) · #AD-7 (mapping) · #AD-2 (accès @hakit) · #Deferred (coordination v2 = primitives HA)]
- [Source: EXPERIENCE.md#Enfants & sécurité (« poubelles sorties » = coordination v2 ; cibles enfant) · UX-DR14 (état jamais par la couleur seule)]
- [Source: Story 2.7 (done, `7cd7d69` — pattern service impératif `useService(...).press`, patron helper pur + tests, mapping structuré) · Story 1.6 (obsolescence) · memory: target-device-and-layout (1024×768 sans scroll)]
- [Source: @hakit/core 6.0.2 — `input_datetime.set_datetime`, `useEntity` (à vérifier au dev)]

## Dev Agent Record

### Agent Model Used

_(à remplir par le dev)_

### Debug Log References

### Completion Notes List

### File List
