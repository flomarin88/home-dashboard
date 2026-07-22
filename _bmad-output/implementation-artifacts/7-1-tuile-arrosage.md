---
baseline_commit: 50454ffe778522f082b2258be8e6c287815e6537
---

# Story 7.1: Tuile Arrosage (barre supérieure)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- dev-story 2026-07-22: app-side implémenté & gates verts (266 tests). Reste Task 0 HA + device-proof (Florian) avant done. -->

## Story

As a Florian,
I want une **tuile plante** dans la **barre supérieure** qui se remplit quand l'arrosage du jour est fait (vide → plein, 1 tap) et se réarme chaque nuit,
so that je vois d'un coup d'œil si j'ai arrosé et je le valide d'un doigt en passant, **sans y penser** — avec **remise à zéro automatique chaque nuit**.

## Contexte & valeur

**Epic 7 (v2)** — re-validation du pattern **« rituel partagé » côté HA** (AD-15). L'Arrosage est le **clone le plus simple du moule Tortues** (Story 6.3) avec `maximum: 1` : un seul geste par jour, remplissage binaire vide→plein. Pur **HA-natif, reflect-only** : **HA détient l'état** (arrosé aujourd'hui ou non) **ET l'échéancier** (reset minuit) — AD-1/AD-4 (*toute logique horaire vit dans HA*). L'app **reflète** un compteur HA et l'**incrémente via un service** au tap ; **aucune persistance ni reset côté app** (AD-1/AD-3, FR-8).

**Différence clé avec 6.3 :** `maximum: 1` (pas 2) → **pas de niveau « moitié »**, la tuile est **soit vide (à arroser) soit pleine (fait)**. Et **TD-4 est déjà soldé** : `TopBarSlots` (Story 6.4) existe et flowe déjà météo/tortue/poubelle — la tuile plante y est simplement **ajoutée comme 4ᵉ enfant**, aucun refactor préalable (≠ la dépendance TD-4 qui bloquait 6.3).

## Contrat d'interface HA ↔ app (à respecter des deux côtés)

**`counter.plantes_arrosees`** (helper HA **`counter`** — Task 0 : `minimum: 0`, `maximum: 1`, `step: 1`, `initial: 0`) — `state` ∈ `"0"` | `"1"` (+ `unavailable`/`unknown` → obsolescence AD-6). L'app le **reflète** (AD-1/AD-3) et **n'écrit jamais l'état directement**. Contrat **déjà documenté** : `docs/home-assistant.md` § « Arrosage — plantes 1×/jour (Story 7.1) ».

| state | tuile (`src/widgets/` — clone `TurtleTile`, `maximum: 1`) |
| --- | --- |
| `"0"` | fond **vide** (à arroser) ; tap → `counter.increment` |
| `"1"` | fond **plein**, **désactivée** (arrosé, jusqu'au reset minuit) |
| `unavailable`/`unknown`/socket perdue | **obsolescence** (atténuée, non interactive — AD-6) |

- **Arrosage** → l'app appelle **`counter.increment`** (service HA, AD-4) ciblant `counter.plantes_arrosees` ; HA incrémente et **échoit** le nouvel état. À `maximum` (1), `counter.increment` est un **no-op** (HA clampe) → garde-fou même si le `disabled` app échouait.
- **Reset minuit** → **automation HA** (déclencheur `time` `00:00:00` → action `counter.reset` sur `counter.plantes_arrosees`). **PAS côté app** (AD-4).
- **Pas de `input_datetime`/timestamp** (comme 6.3) → **aucun souci de fuseau** (la leçon 6.1 D1 « écrire un epoch, pas une heure locale » ne s'applique pas). L'**état = le compteur**.

## Acceptance Criteria

1. **Tuile pilotée par le compteur (AD-1/AD-3/AD-6).**
   **Given** `counter.plantes_arrosees` mappé dans `src/entities/`
   **When** l'accueil s'affiche
   **Then** une **tuile plante** dans la **barre supérieure** (`TopBarSlots`, aux côtés de météo/tortue/poubelle, **visible en permanence**) montre un **fond qui se remplit de bas en haut** selon `state` : `0`→**vide**, `1`→**plein**. Lu **uniquement** via `@hakit` (AD-2), **pas de cache** (AD-3).
   **And** `unavailable`/perte socket → **obsolescence** (AD-6, atténuée, **jamais de blanc**).

2. **Arrosage = `counter.increment`, désactivé à plein (AD-4).**
   **Given** `state` = `0` et entité **non obsolète**
   **When** j'appuie sur la tuile (cible **≥56px** — geste enfant, NFR2)
   **Then** l'app appelle **`counter.increment`** (**service HA uniquement** — AD-4) sur `counter.plantes_arrosees` ; l'état affiché **reflète HA** (`0`→`1`) en **reflect-only** (écho HA < 1 s, **pas d'optimiste local**).
   **And** à `state` = `1` → **geste désactivé** (`disabled`, la tuile reste visible « pleine ») ; **hors ligne/obsolète** → **non interactive**.

3. **Réutilisation + a11y + kiosque + gates.**
   **Given** la tuile + le mapping
   **When** je termine
   **Then** l'obsolescence réutilise `useEntityValue`/`isStale` ; **le niveau de remplissage (vide/plein) porte le sens sans couleur seule** (UX-DR14/UX-DR22) + `aria-label` explicite (« Arrosage : à faire / fait ») ; **pas de texte de statut visible** ; la tuile respecte le **kiosque 1024×768 sans scroll** et **ne collisionne pas** avec les tuiles top-bar existantes (voir Dev Notes — 4ᵉ tuile, marge fragile) ; tous les `entity_id` dans `src/entities/` (AD-7) ; `build`+`typecheck`+`lint`+`test` **verts** ; **0 token** dans `dist/`.

## Tasks / Subtasks

- [ ] **Task 0 — ⚠️ PRÉREQUIS HA (Florian, hors app) : compteur + automation reset**
  - [ ] **Créer** le helper `counter.plantes_arrosees` (Paramètres → Appareils et services → Helpers → **Compteur** : minimum **0**, maximum **1**, pas **1**, valeur initiale **0**).
  - [ ] **Créer** une automation « Reset arrosage minuit » : déclencheur **`time` = `00:00:00`** → action **`counter.reset`** sur `counter.plantes_arrosees`.
  - [ ] Confirmer l'**`entity_id` réel** — `counter.plantes_arrosees` (device-proof → le slug doit correspondre au mapping ; sinon mettre à jour `src/entities/mapping.ts`).
  - [ ] _(Doc déjà écrite : `docs/home-assistant.md` § « Arrosage — plantes 1×/jour » couvre le setup pas-à-pas + le contrat d'interface.)_

- [x] **Task 1 — Mapping arrosage** (AC: 1, 2, 3)
  - [x] `src/entities/mapping.ts` : config **`PLANTS`** (AD-7) `{ counterEntityId: 'counter.plantes_arrosees' }` + accesseur **`plantsConfig()`**. Suivre **exactement** le moule de `TURTLES`/`turtlesConfig()` (interface `PlantsConfig` avec le même JSDoc « min 0, max 1 »). — `mapping.test.ts` n'assère pas cette forme (comme pour `TURTLES`) → pas de MAJ.

- [x] **Task 2 — Interprétation d'état (pur)** (AC: 1, 2) — **TDD**
  - [x] `src/widgets/plant-state.ts` : **`plantView(state): { count: 0 | 1; fill: 'empty' | 'full'; done: boolean }`**. _Déviation assumée vs le brouillon `{ watered, ... }` : renvoyer `{ count, fill, done }` **calque exactement `turtleView`** (cohérence famille) ; `done` encode déjà « arrosé » pour l'aria/disabled — pas de booléen redondant._
    - Parser `state` en entier, **clamp `0..1`** ; `0`→`fill:'empty'`, `1`→`fill:'full'` ; `done = count >= 1`.
    - `unavailable`/`unknown`/`null`/non-numérique → `count 0` par défaut (obsolescence gérée côté tuile via `isStale`). **Aucune logique horaire ici** (AD-4) — pur mapping.
  - [x] Tests : chaque `state` (`"0"`/`"1"`/`null`/`undefined`/`"unavailable"`/`"unknown"`/`""`/`"2"`/`"-1"`) → vue attendue (clamp vérifié).

- [x] **Task 3 — Tuile `PlantTile`** (AC: 1, 2, 3) — **TDD (composant)**
  - [x] `src/widgets/PlantTile.tsx` : lit `counter.plantes_arrosees` via **`useEntityValue`** (obsolescence) ; `plantView(value)` → **grosse icône plante** par-dessus un **fond de tuile qui se remplit de bas en haut** selon `fill` (`empty` 0 % / `full` 100 %). **Cloné de `TurtleTile.tsx`** : même structure (bouton `relative … overflow-hidden`, `min-h-[56px]`, `rounded-lg`, `backdrop-blur-glass`, `border-card-border`, `bg-card-fill`), même calque de fond `absolute inset-x-0 bottom-0 … bg-security-ok/25 transition-[height]`, icône `relative` au-dessus. **Pas de texte de statut** — `aria-label` = « Arrosage : à faire » / « Arrosage : fait ».
    - [x] Si `!done && !isStale` : **bouton ≥56px** → au tap, **`useService('counter').increment({ target: counterEntityId })`** (service HA, AD-4).
    - [x] Si `done` (count 1) : **`disabled`**, reste visible « pleine ».
    - [x] Si `isStale` : non interactive, atténuée (`opacity-60`, obsolescence AD-6) — **jamais cachée** (≠ poubelle).
  - [x] **HA = source unique — PAS d'optimiste local.** La tuile **reflète** le compteur, le tap **appelle le service**, HA **échoit** l'état. Aucun `useState`/`justDone` optimiste introduit.
  - [x] **Garde in-flight (write-debounce)** : `useRef(pending)` repris de `TurtleTile`, libéré à l'écho HA (`useEffect` sur `value`).
  - [x] **Undo 5 s** : `offerUndo('Plantes arrosées', () => decrement, 5000)` — **gardé** (parité 6.3, coût nul). Reverse `counter.decrement` (planché à 0 par le `minimum` HA).
  - [x] **Échecs de service** (leçon 6.1 D2) : `.catch((err) => console.warn(...))` sur increment ET decrement ; garde `pending` libérée en cas d'échec.
  - [x] **Signature `counter.increment`/`decrement`** (`@hakit/core`) — typecheck OK, **sans `serviceData`**, juste `{ target }`.
  - [x] Test (mock `@hakit`, calqué sur `TurtleTile.test.tsx`) : `"0"` → vide (`h-0`) + tap → `counter.increment` sur `counter.plantes_arrosees` ; `"1"` → **plein (`h-full`) + `disabled` + aucun appel** ; double-tap rapide → **1 seul** increment ; tap → undo 5 s → `counter.decrement` ; déconnecté → `opacity-60` + `disabled` + aucun appel. **(8 tests verts : 3 `plant-state` + 5 `PlantTile`.)**

- [x] **Task 4 — Insérer la tuile dans `TopBarSlots`** (AC: 1, 3)
  - [x] `src/App.tsx` : `<PlantTile/>` inséré comme **4ᵉ enfant** de `<TopBarSlots>`, ordre `TopBarWeather` → `TurtleTile` → `PlantTile` → `BinTile`. **Visible en permanence**. Pas de nouveau `fixed` (TD-4 soldé — la couche existe).
  - [ ] **⚠️ 4ᵉ tuile permanente = risque collision top-bar** (dette connue, `deferred-work.md`) — **à vérifier au device-proof (Florian)** : rangée horloge → météo/tortue/plante/poubelle → contrôles **ne se chevauche pas** et **ne scrolle pas** à 1024×768. _(Non vérifiable côté agent — reporté au device-proof.)_

- [ ] **Task 5 — Validation (gates)** (AC: 3)
  - [x] `build` (sans token, garde AD-8) + `typecheck` + `lint` (oxlint) + `test` **verts** (266 tests, +8) ; 0 `entity_id` en dur hors `entities/` (le literal n'apparaît que dans les assertions de test + JSDoc, comme `TurtleTile`) ; **0 token dans `dist/`** (build sans `.env.local` → 0 `VITE_`/JWT ; les hits `llat` = « insta**llat**ion » dans les chunks de locale `@hakit`) ; Prettier OK.
  - [ ] **⏳ Preuve device (Florian)** — tuile plante visible, tap → remplissage + increment HA, `disabled` à plein, reset minuit OK, **pas de collision/scroll** à 1024×768.

### Review Findings (code review 2026-07-22)

_Revue multi-agent (Blind Hunter + Edge Case Hunter + Acceptance Auditor), Opus. Acceptance Auditor : 0 violation d'AC. Aucun bug High/Med. 1 patch, 4 différés (pré-existants/famille), 2 rejetés (bruit)._

- [x] [Review][Patch] Branche `.catch` de libération de la garde `pending` (increment échoué → retry possible) non testée — ✅ test ajouté 2026-07-22 (`increment` rejette → 2ᵉ tap ré-écrit) [src/widgets/PlantTile.test.tsx]
- [x] [Review][Fixed] Undo inter-tuiles écrasé — ✅ **corrigé 2026-07-22** (choix Florian) : store undo passé de slot unique → **file** ; `UndoToast` rend une pile, chaque undo avec son propre dwell. `offerUndo` inchangé (3 callers intacts). +4 tests (store file + toast empilé). [src/state/undo.ts · src/ui/UndoToast.tsx] — _refactor infra partagée, commit séparé de la feature 7.1 (Rule 6)_
- [x] [Review][Fixed] Toast undo offert même si l'`increment` échoue (offre fantôme) — ✅ **corrigé 2026-07-22** : `offerUndo` déplacé dans le `.then()` de l'appel service (Turtle + Plant + Bin), offert seulement au succès. Tests des 3 tuiles passés en async. [src/widgets/{TurtleTile,PlantTile,BinTile}.tsx]
- [x] [Review][Fixed] Les ids `counter.*`/`input_datetime.*` (plante/tortue/poubelle) hors validation canonique — ✅ **corrigé 2026-07-22** : `assertWellFormedAuxIds()` passe les ids auxiliaires au `ENTITY_ID_RE`, appelée dans le bloc DEV existant + tests. [src/entities/mapping.ts]
- [x] [Review][Defer] Garde in-flight potentiellement bloquée si HA n'écho jamais (D2) — **maintenu différé** (choix Florian, ROI marginal : proba très faible, fix = timer de sécurité géré). [src/widgets/{TurtleTile,PlantTile}.tsx]

_Rejetés (bruit) : (1) `view.count` non consommé par la tuile binaire — API publique testée, parité `turtleView` intentionnelle (le Blind Hunter lui-même : « not a defect ») ; (2) `""`/`" "` non traités comme stale — sorties correctes (garbage→« à faire »), commentaire partagé verbatim avec `turtle-state.ts`._

## Dev Notes

**Portée stricte.** Tuile plante **pilotée par un compteur HA** + increment au tap. **Hors scope — NE PAS construire :**
- **Le reset minuit / tout échéancier côté client** → **interdit (AD-4)** ; vit dans l'**automation HA** (Task 0). L'app **reflète** le compteur, ne le remet jamais à zéro.
- **Persistance/compte côté app** → interdit (AD-1/AD-3). Le « arrosé aujourd'hui ? » = **l'état du `counter` HA**. Ne pas stocker localement, ne pas recompter.
- **Texte de statut sur la tuile** → non (cohérent 6.1/6.3 : icône seule) ; l'`aria-label` couvre l'a11y.
- **Accent couleur dédié** → **non** (UX-DR18/UX-DR22 : l'Arrosage **n'a pas d'accent**, son état est porté par le **niveau de remplissage**, teinte `bg-security-ok/25` comme la tortue).

**Réutilisation maximale — cloner, ne pas réinventer.** 7.1 est le **jumeau `maximum:1`** de 6.3. Le dev doit **copier `TurtleTile.tsx` → `PlantTile.tsx`** et **`turtle-state.ts` → `plant-state.ts`**, puis simplifier (retirer le palier `half`). Modèles vivants à lire **avant** d'écrire :
- `src/widgets/TurtleTile.tsx` — structure bouton + calque de fond + garde in-flight + undo + `.catch`.
- `src/widgets/turtle-state.ts` — helper pur, parse+clamp.
- `src/widgets/TurtleTile.test.tsx` / `turtle-state.test.ts` — moule de tests (mock `@hakit`, `useUndoStore`).
- `src/widgets/BinTile.tsx` — **même look « done »** que la tortue depuis 2026-07-22 (fond vert plein, pas de coche) : le repère « fait » est déjà unifié dans la famille.

**Icône plante.** Fournir un composant SVG local `PlantIcon` (comme `TurtleIcon`/`PoubelleIcon` : `24×24` viewBox, `stroke="currentColor"`, `strokeWidth="2"`, `className="relative text-text"`). **Pas** de dépendance d'icônes externe (build order stdlib/codebase d'abord). Un pot + tige/feuilles suffit ; lisible par-dessus le fond rempli.

**A11y (UX-DR14/UX-DR22) — état jamais par la couleur seule.** Le **niveau de remplissage** (vide/plein) est le repère non-coloré intrinsèque. `aria-label` explicite selon `done`. Ne pas réintroduire de texte de statut visible.

**Obsolescence (AD-6).** `isStale` → `opacity-60` + `disabled`, **jamais caché** (comme la tortue, ≠ poubelle). Dette connue (`deferred-work.md`) : « fait » (plein+disabled) et « hors-ligne » (plein/dernier état+disabled) se ressemblent — marginal sur kiosque mono-utilisateur ; l'`aria-label` distingue « fait ». Ne pas sur-investir ici.

**Garde-fou increment.** `counter` `maximum: 1` côté HA → un `increment` à 1 est un **no-op** (clamp HA). Garder malgré tout le `disabled` app (UX + évite un appel réseau inutile). Défense en profondeur.

**Collision top-bar (dette active).** Voir Task 4 : la tuile plante est la **4ᵉ** tuile permanente. Aucune barrière code contre le chevauchement — device-proof obligatoire à 1024×768. Ne pas « résoudre » la dette ici (hors scope, Rule 6) ; juste **ne pas la déclencher** et signaler si le device-proof la révèle.

### Project Structure Notes

- **NEW** : `src/widgets/PlantTile.tsx` (+ `.test.tsx`) ; `src/widgets/plant-state.ts` (+ `.test.ts`).
- **UPDATE** : `src/entities/mapping.ts` (+ `.test.ts` si la forme est assertée) (`PlantsConfig` + `PLANTS` + `plantsConfig()`) ; `src/App.tsx` (monter `<PlantTile/>` dans `TopBarSlots`) ; `_bmad-output/implementation-artifacts/sprint-status.yaml` (7-1 → in-progress → review).
- **PAS de UPDATE `docs/home-assistant.md`** : la section « Arrosage » **existe déjà** (contrat + Task 0 documentés). Ne pas la dupliquer.
- **Direction de dépendance** : `widgets/PlantTile` → `hakit`/`entities`/`state`. Tuile sous provider (`TopBarSlots` est déjà sous `HakitProvider`).
- **Style** : Tailwind ; icône/cible ≥56px ; remplissage vide→plein + `aria-label` ; kiosque sans scroll. Prettier (défauts) + pre-commit Husky (le commit déclenche le gate complet : lint-staged → typecheck → test).

### Décisions tranchées

- **`maximum: 1`** (1 arrosage/jour) — décision produit Epic 7 ; remplissage **binaire** vide→plein (pas de « moitié »).
- **Remplissage = fond de tuile** (montée verticale de bas en haut), pas l'icône. Icône plante lisible par-dessus (repère non-coloré, UX-DR14/UX-DR22).
- **À 1/1 = reste visible** : tuile **pleine + `disabled`** jusqu'au reset minuit (confirmation « fait »), ne se cache pas.
- **Placement** : 4ᵉ enfant de `TopBarSlots` (TD-4 déjà soldé) — pas de nouveau `fixed`.
- **Pas d'accent couleur** (UX-DR18/UX-DR22).

### Décisions ouvertes / dépendances

- **Task 0 bloquant** : `counter.plantes_arrosees` + automation reset minuit (Florian, HA). L'app ne peut pas être éprouvée sans (mais est **codable/testable** avec le mock `@hakit`).
- **`counter` vs `input_boolean`** : **`counter`** retenu (homogène avec Tortues, `maximum` intégré → clamp, `counter.reset` simple). Si Florian préfère `input_boolean.plantes_arrosees`, adapter le contrat (`plant-state.ts` parse `"on"`/`"off"` au lieu de `"1"`/`"0"`) et le mapping — voir la note « Alternative » dans `docs/home-assistant.md`.
- **Undo au tap** : à confirmer (par défaut gardé, parité 6.3, coût nul).
- **Ordre des tuiles** dans `TopBarSlots` : à trancher au device-proof.

### References

- [Source: epics.md#Epic 7 (Arrosage des plantes) · #Story 7.1 (tuile plante, `maximum: 1`, reflect-only, moule Tortues)]
- [Source: 6-3-nourrir-les-tortues.md — **moule direct** : `TurtleTile`/`turtle-state` + tests, HA source unique / pas d'optimiste, garde in-flight, `useService('counter').increment` sans `serviceData`, `.catch` (D2), obsolescence AD-6 ; leçon fuseau D1 **non applicable**]
- [Source: docs/home-assistant.md#Arrosage — plantes 1×/jour (Story 7.1) — **contrat d'interface + Task 0 déjà écrits** : `counter.plantes_arrosees` min 0/max 1, automation reset minuit, table d'état]
- [Source: src/widgets/TurtleTile.tsx · turtle-state.ts · BinTile.tsx (look « done » unifié 2026-07-22) · TurtleTile.test.tsx — fichiers à cloner]
- [Source: src/ui/TopBarSlots.tsx (Story 6.4, TD-4 soldé) · src/App.tsx (mount) · src/hakit/useEntityValue.ts (obsolescence) · src/state/undo.ts (`offerUndo`)]
- [Source: ARCHITECTURE-SPINE.md#AD-1/AD-3 (HA source de vérité, app sans persistance) · #AD-4 (reset/échéancier dans HA) · #AD-6 (obsolescence) · #AD-7 (mapping `entities/`) · #AD-2 (accès `@hakit`) · #AD-15 (rituel partagé) · #AD-8 (build sans secret)]
- [Source: UX-DELTA-V2.md#UX-DR22 (Tuile Arrosage, clone TurtleTile `maximum:1`) · #UX-DR14 (état jamais par couleur seule) · #UX-DR18 (Arrosage sans accent)]
- [Source: deferred-work.md — durcissement collision top-bar (4ᵉ tuile) · distinction « fait » vs hors-ligne]
- [Source: memory `target-device-and-layout` (1024×768 sans scroll) · @hakit/core 6.0.2 (`counter.increment`/`counter.decrement`/`useEntity`)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Liza Pairing, Autonomous — bmad dev-story).

### Debug Log References

- **Clone direct de 6.3.** `plant-state.ts` = `turtle-state.ts` avec clamp `0..1` (pas de palier `half`) ; `PlantTile.tsx` = `TurtleTile.tsx` avec `FILL_HEIGHT = { empty: "h-0", full: "h-full" }` et l'`aria-label` « Arrosage : à faire / fait ». Garde in-flight, undo 5 s (decrement), `.catch` conservés à l'identique.
- **`counter.increment`/`decrement`** : `useService("counter")` typecheck OK contre `@hakit/core` (signature confirmée en 6.3, **sans `serviceData`**). `.catch(console.warn)` sur les deux appels (leçon 6.1 D2). Pas d'optimiste local (HA source unique).
- **Remplissage** : calque `absolute inset-x-0 bottom-0` `h-0`/`h-full`, teinte `bg-security-ok/25`, `overflow-hidden` sur la tuile, icône plante `relative` au-dessus. Le **niveau** est le repère non-coloré (UX-DR14/UX-DR22).
- **Icône plante** : `PlantIcon` SVG local (pot + tige feuillue), même gabarit que `TurtleIcon`/`PoubelleIcon` (24×24, `stroke=currentColor`, `strokeWidth=2`). Aucune dépendance d'icônes externe.
- **Déviation d'interface assumée** : `plantView` renvoie `{ count, fill, done }` (calque `turtleView`) et non le `{ watered, ... }` du brouillon de story — `done` couvre déjà aria+disabled, pas de booléen redondant. Story mise à jour en conséquence.
- **Build/AD-8** : build vérifié **sans `.env.local`** (mis de côté puis restauré) → OK, PWA générée, **0 `VITE_`/JWT dans `dist/`**. Les hits `grep llat` = « installation » dans les JSON de locale `@hakit` (faux positifs, chunks préexistants).
- **Obsolescence** : `isStale` → `opacity-60` + `disabled`, **jamais caché** (AD-6, ≠ poubelle).

### Completion Notes List

- **AC1–AC3 satisfaits (côté app).** `plantsConfig` (AD-7) ; `plantView` (pur, clamp 0..1) ; `PlantTile` (fond qui se remplit vide/plein, tap→`counter.increment`, `disabled` à 1/1, obsolescence atténuée) inséré comme **4ᵉ enfant** de `TopBarSlots`. HA source unique, pas d'optimiste.
- **Gates** : typecheck + oxlint + **266 tests** verts (+8 : `plant-state` 3, `PlantTile` 5) ; build sans token OK ; Prettier OK ; 0 régression.
- **PAS de MAJ `docs/home-assistant.md`** : la section « Arrosage » y était déjà écrite (contrat + Task 0). Pas de duplication.
- **Reste (non-agent, Florian)** : **Task 0** = créer `counter.plantes_arrosees` (0→1) + l'automation `counter.reset` minuit dans HA (guide : `docs/home-assistant.md` § Arrosage) ; **preuve device** = valider remplissage/tap/reset **et l'absence de collision/scroll top-bar** (4ᵉ tuile) sur l'iPad 1024×768.

### File List

**Créés :**
- `src/widgets/plant-state.ts`, `src/widgets/plant-state.test.ts`
- `src/widgets/PlantTile.tsx`, `src/widgets/PlantTile.test.tsx`

**Modifiés :**
- `src/entities/mapping.ts` (`PlantsConfig` + `PLANTS` + `plantsConfig()`)
- `src/App.tsx` (`<PlantTile/>` 3ᵉ position dans `TopBarSlots`, après `TurtleTile`)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (7-1 → in-progress → review)

**Modifiés — suite de revue (patch + fix D1) :**
- `src/widgets/PlantTile.test.tsx` (test de la branche `.catch` : increment échoué → retry)
- `src/state/undo.ts` (fix D1 : slot unique → file d'undos) + `src/state/undo.test.ts`
- `src/ui/UndoToast.tsx` (fix D1 : pile de toasts, `UndoToastItem` auto-timé) + `src/ui/UndoToast.test.tsx`
- `src/widgets/TurtleTile.test.tsx`, `src/widgets/BinTile.test.tsx` (adaptation `current` → `queue`)

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-22 | 0.3 | **Revue de code (dev-story → code-review, Opus multi-agent).** Blind + Edge + Acceptance : 0 violation d'AC, aucun bug High/Med. 1 patch appliqué (test de la branche `.catch` guard-release). 4 différés (pré-existants/famille) consignés dans `deferred-work.md` ; **D1 corrigé sur demande de Florian** : store undo slot unique → file, `UndoToast` empilé (`offerUndo` inchangé, 3 callers intacts). 2 rejets (bruit). +4 tests (patch 1 + D1 3) → **270 verts**, tsc/oxlint/Prettier verts, 0 régression. Statut maintenu `review` (reste Task 0 HA + device-proof, Florian). |
| 2026-07-22 | 0.2 | **Implémentée (dev-story).** `plantsConfig` + `plantView` (pur, clamp 0..1) + `PlantTile` (fond de tuile qui se remplit vide/plein, tap → `counter.increment`, `disabled` à 1/1, undo 5 s, garde in-flight, obsolescence AD-6) inséré dans `TopBarSlots` (4ᵉ tuile). Clone `maximum:1` du moule Tortues — HA source unique, pas d'optimiste. `plantView` renvoie `{ count, fill, done }` (calque `turtleView`, pas le `watered` du brouillon). +8 tests (266 verts, 43 fichiers), tsc/oxlint/build-sans-token/Prettier verts, 0 régression. Reste : Task 0 HA + preuve device (Florian). → review. |
| 2026-07-22 | 0.1 | Story 7.1 créée (create-story, Ultimate context engine) — **tuile plante** dans `TopBarSlots`, **compteur HA `counter.plantes_arrosees`** (`maximum: 1`), **`counter.increment`** au tap, **remplissage binaire** vide→plein, **`disabled` à plein**, **reset minuit côté HA** (automation). **Clone `maximum:1` du moule Tortues (6.3)** : HA source unique, pas d'optimiste, garde in-flight, obsolescence AD-6. Simplifications vs 6.3 : pas de palier « moitié », **TD-4 déjà soldé** (ajout d'enfant, pas de refactor), **doc HA déjà écrite**. Risque : **4ᵉ tuile top-bar** (dette collision `deferred-work.md`) → device-proof à 1024×768. Task 0 (counter + automation) + preuve device = Florian. → ready-for-dev. |
