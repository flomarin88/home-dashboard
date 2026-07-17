---
baseline_commit: d57fd519ff94ab81aaad815a442e21a98f94414a
---

# Story 6.3: Nourrir les tortues (2×/jour)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Florian,
I want une **tuile tortue** dans la **barre supérieure** qui se remplit à chaque repas (vide → moitié → pleine, 2 taps) et se désactive une fois les 2 repas donnés,
so that on n'oublie jamais de **nourrir les tortues 2×/jour**, avec **remise à zéro automatique chaque nuit**.

## Contexte & valeur

**Net-new / correct-course (2026-07-17)** — poursuite de la **couche coordination familiale** (Epic 6, spine Deferred v2). Les rituels « tortues / to-do » étaient explicitement renvoyés à v2 dans 6.1 ; tirés en avant ici, **en respectant l'archi** comme 6.1 : **HA détient l'état** (compteur de repas du jour) **ET l'échéancier** (reset minuit) — AD-1/AD-4 (*toute logique horaire vit dans HA*). L'app **reflète** un compteur HA et **incrémente via un service** ; **aucune persistance ni reset côté app** (AD-1/AD-3).

**Décisions produit (Florian, 2026-07-17) :**
1. **2 repas/jour** ; **icône tortue** dans la **barre supérieure** (comme la poubelle 6.1).
2. **Remplissage progressif** : vide (0) → **moitié** (1ᵉʳ tap) → **pleine** (2ᵉ tap).
3. À **2/2** : tuile **désactivée** (repas faits), **reste visible** jusqu'au reset.
4. **Reset automatique tous les jours à minuit** — **côté HA** (automation), jamais l'app.

## Contrat d'interface HA ↔ app (à respecter des deux côtés)

**`counter.tortues_repas`** (helper HA **`counter`** — Task 0 : `minimum: 0`, `maximum: 2`, `step: 1`, `initial: 0`) — `state` ∈ `"0"` | `"1"` | `"2"` (+ `unavailable`/`unknown` → obsolescence AD-6). L'app le **reflète** (AD-1/AD-3) et **n'écrit jamais l'état directement**.

- **Repas** → l'app appelle **`counter.increment`** (service HA, AD-4) ciblant `counter.tortues_repas` ; HA incrémente et **échoit** le nouvel état. À `maximum` (2), `counter.increment` est un **no-op** (HA clampe) → garde-fou même si le `disabled` app échouait.
- **Reset minuit** → **automation HA** (déclencheur `time` `00:00:00` → action `counter.reset` sur `counter.tortues_repas`). **PAS côté app** (AD-4).
- `unavailable`/perte socket → **obsolescence** (AD-6, atténué, jamais de blanc).

> _Différence clé avec 6.1 :_ pas de `input_datetime`/timestamp écrit ici → **aucun souci de fuseau** (la leçon 6.1 « écrire un epoch, pas une heure locale » ne s'applique pas). L'**état = le compteur** (pas des timestamps), et le reset est une **automation**, pas un calcul de fenêtre.

## Acceptance Criteria

1. **Tuile pilotée par le compteur (AD-1/AD-3/AD-6).**
   **Given** `counter.tortues_repas` mappé
   **When** l'accueil s'affiche
   **Then** une **tuile tortue** dans la **barre supérieure** montre un **niveau de remplissage** selon `state` : `0`→**vide**, `1`→**moitié**, `2`→**plein**. Lu **uniquement** via `@hakit` (AD-2), **pas de cache** (AD-3).
   **And** `unavailable`/perte socket → **obsolescence** (AD-6, atténuée).

2. **Repas = `counter.increment`, désactivé à 2 (AD-4).**
   **Given** `state` = `0` ou `1`
   **When** j'appuie sur la tuile (cible ≥56px — geste enfant, NFR2)
   **Then** l'app appelle **`counter.increment`** (**service HA uniquement** — AD-4) sur `counter.tortues_repas` ; l'état affiché **reflète HA** (`0`→`1`→`2`).
   **And** à `state` = `2` → **geste désactivé** (`disabled`, la tuile reste visible « pleine ») ; **hors ligne/obsolète** → **non interactive**.

3. **Réutilisation + kiosque + gates.**
   **Given** la tuile + le mapping
   **When** je termine
   **Then** l'obsolescence réutilise `useEntityValue`/`isStale` ; **le niveau de remplissage (0/moitié/plein) porte le sens sans couleur seule** (UX-DR14) + `aria-label` explicite ; **pas de texte de statut visible** ; la tuile respecte le **kiosque 1024×768 sans scroll** et **ne collisionne pas** avec les tuiles top-bar existantes (voir Dev Notes/TD-4) ; tous les `entity_id` dans `src/entities/` (AD-7) ; `build`+`typecheck`+`lint`+`test` **verts** ; **0 token** dans `dist/`.

## Tasks / Subtasks

- [ ] **Task 0 — ⚠️ PRÉREQUIS HA (Florian, hors app) : compteur + automation reset**
  - [ ] **Créer** le helper `counter.tortues_repas` (Paramètres → Appareils et services → Helpers → **Compteur** : minimum **0**, maximum **2**, pas **1**, valeur initiale **0**).
  - [ ] **Créer** une automation « Reset tortues minuit » : déclencheur **`time` = `00:00:00`** → action **`counter.reset`** sur `counter.tortues_repas`.
  - [ ] Confirmer l'**`entity_id` réel** (le slug peut différer — leçons 2.7/6.1 : le dev **ne devine pas**, il mappe l'id fourni).
  - [ ] Documenter le setup dans `docs/home-assistant.md` (nouvelle section « Tortues » — miroir de la section « Poubelles »).

- [ ] **Task 1 — Mapping tortues** (AC: 1, 2, 3)
  - [ ] `src/entities/mapping.ts` : config **`TURTLES`** (AD-7) `{ counterEntityId: 'counter.tortues_repas' }` + accesseur **`turtlesConfig()`**. Suivre exactement le moule de `BINS`/`binsConfig()`. Mettre à jour `mapping.test.ts` si la forme y est assertée.

- [ ] **Task 2 — Interprétation d'état (pur)** (AC: 1, 2) — **TDD**
  - [ ] `src/widgets/turtle-state.ts` : **`turtleView(state: string | null | undefined): { count: 0 | 1 | 2; fill: 'empty' | 'half' | 'full'; done: boolean }`**.
    - Parser `state` en entier, **clamp `0..2`** ; `count 0`→`fill:'empty'`, `1`→`'half'`, `2`→`'full'` ; `done = count >= 2`.
    - `unavailable`/`unknown`/`null`/non-numérique → traiter comme obsolescence côté tuile (via `isStale`) ; `turtleView` renvoie `count 0` par défaut. **Aucune logique horaire ici** (AD-4) — pur mapping.
  - [ ] Tests : chaque `state` (`"0"`/`"1"`/`"2"`/`null`/`"unavailable"`) → vue attendue.

- [ ] **Task 3 — Tuile `TurtleTile`** (AC: 1, 2, 3) — **TDD (composant)**
  - [ ] `src/widgets/TurtleTile.tsx` : lit `counter.tortues_repas` via **`useEntityValue`** (obsolescence) ; `turtleView(value)` → **grosse icône tortue** par-dessus un **fond de tuile qui se remplit de bas en haut** selon `fill` (`empty` 0 % / `half` 50 % / `full` 100 %). Implémentation suggérée : un calque de fond en `absolute` dont la hauteur (`h-0`/`h-1/2`/`h-full`) ou un `background`/`clip` traduit le niveau, l'icône restant lisible au-dessus. **Pas de texte de statut** — `aria-label` = « Tortues : N repas sur 2 » (+ « — nourrir » si tappable).
    - Si `!done && !isStale` : **bouton ≥56px** → au tap, **`useService('counter').increment({ target: counterEntityId })`** (service HA, AD-4).
    - Si `done` (count 2) : **`disabled`**, reste visible « pleine ».
    - Si `isStale` : non interactive, atténuée (obsolescence).
  - [ ] **⚠️ HA = source unique — PAS d'optimiste local.** Suivre le pattern **final** de 6.1 (v0.3, commit `9f14001`) : la tuile **reflète** le compteur, le tap **appelle le service**, HA **échoit** le nouvel état. **Ne PAS** réintroduire un `useState`/`justDone` optimiste (retiré exprès en 6.1). L'incrément se reflète en < 1 s.
  - [ ] **Vérifier la signature** de `counter.increment` dans les types `@hakit/core` (comme `set_datetime`/`button.press`) — `increment` **sans `serviceData`**, juste la cible. `now` injectable si besoin (pas nécessaire ici, pas de timestamp).
  - [ ] Test (mock `@hakit`) : `"0"` → tuile vide + tap → `counter.increment` appelé ; `"1"` → moitié + tap → increment ; `"2"` → **plein + `disabled` + aucun appel au clic** ; déconnecté → obsolescence non interactive.

- [ ] **Task 4 — Placer la tuile dans la couche de composition top-bar (TD-4)** (AC: 1, 3)
  - [ ] **PRÉREQUIS : le refactor TD-4** (couche de composition barre supérieure — voir story dédiée / Décisions ouvertes) doit être livré **avant**. La tortue n'est **PAS** un nouvel élément `fixed` empilé : elle est **un enfant de la couche de composition** (aux côtés de météo + poubelle), qui gère le placement/l'espacement et la contrainte gate (TD-1 : Clock/TopBar au-dessus du gate, tuiles HA en dessous).
  - [ ] Y insérer `<TurtleTile/>` (**visible en permanence**, ≠ poubelle conditionnelle). Ne pas régresser le layout kiosque (1024×768 sans scroll) ni le rendu de météo/poubelle. **Vérifier à 1024×768 (iPad).**

- [ ] **Task 5 — Validation (gates)** (AC: 3)
  - [ ] `build` (sans token) + `typecheck` + `lint` + `test` **verts** ; 0 `entity_id` en dur hors `entities/` (code non-test) ; 0 token dans `dist/`. Le **pre-commit** (Prettier + oxlint + typecheck + tests, ajouté ce sprint) doit passer.
  - [ ] **⏳ Preuve device (Florian, review)** : tuile tortue visible ; 1ᵉʳ tap → moitié + compteur HA à 1 ; 2ᵉ tap → pleine + `disabled` + compteur à 2 ; à minuit → l'automation remet à 0 → tuile vide le lendemain. Pas de scroll.

## Dev Notes

**Portée stricte.** Tuile tortue **pilotée par un compteur HA** + incrément au tap. **Hors scope — NE PAS construire :**
- **Le reset minuit / tout échéancier côté client** → **interdit (AD-4)** ; vit dans l'**automation HA** (Task 0). L'app **reflète** le compteur, elle ne le remet jamais à zéro.
- **Persistance/compte côté app** → interdit (AD-1/AD-3). Le « combien de repas aujourd'hui » = **l'état du `counter` HA**. Ne pas stocker localement, ne pas recompter.
- **Texte de statut sur la tuile** → non (cohérent 6.1 : icône seule) ; l'`aria-label` couvre l'a11y lecteur d'écran.

**Archi = reflet compteur + `counter.increment`.** Plus **simple** que 6.1 : pas de capteur template (l'app lit le `counter` directement), pas de `input_datetime`, **pas de timestamp** → la leçon fuseau de 6.1 (D1) **ne s'applique pas**.

**Continuité (6.1 final, commit `9f14001` ; réutiliser, ne pas réinventer) :**
- **Moule tuile top-bar `fixed` sous le provider** = `BinTile.tsx`. Réutiliser la structure (bouton `fixed … top-6`, `min-h-[48px]`, `rounded-lg`, `backdrop-blur-glass`, icône via composant SVG local). Aligner la **taille** sur les autres tuiles top-bar.
- **HA = source unique, PAS d'optimiste** (6.1 a **retiré** `justDone` en v0.3). Le tap appelle le service ; HA pilote l'affichage. Anti-pattern à éviter absolument : réintroduire un état local optimiste.
- **`useEntityValue`/`isStale`/obsolescence** (1.6) ; **helper pur + test** (`bin-state.ts`/`turtle-state.ts` — même moule, `now` injecté si besoin) ; **mapping `entities/` AD-7**.
- **`useService` impératif** : `set_datetime` (6.1) / `button.press` (2.7) → ici **`counter.increment`** (domaine `counter`, **sans `serviceData`**). Vérifier la signature exacte dans `@hakit/core` au dev.
- **Gérer les échecs de service** (leçon 6.1 D2) : envelopper l'appel `.catch((err) => console.warn(...))` comme `BinTile`/`undo.ts` — pas de fire-and-forget silencieux.

**A11y (UX-DR14) — état jamais par la couleur seule.** Ici le **niveau de remplissage** (vide/moitié/plein) est un **repère non-coloré** intrinsèque (quantité/position) — c'est plus fort que 6.1. Ajouter un `aria-label` explicite (« Tortues : 1 repas sur 2 »). Ne pas réintroduire de texte de statut visible.

**Composition barre supérieure (TD-4 — TRAITÉ AVANT 6.3, décision Florian 2026-07-17).** La tortue étant **visible en permanence** (≠ poubelle conditionnelle), on **ne pile pas** un 3ᵉ `fixed`. TD-4 est résolu par un **refactor dédié préalable** : une **couche de composition top-bar** qui héberge météo (`TopBarWeather`), poubelle (`BinTile`) et tortue, gère placement/espacement et la contrainte gate (TD-1 : `Clock`/`TopBar` **au-dessus** du gate de connexion, tuiles HA **en dessous** — actuellement la raison des `fixed` séparés). 6.3 **consomme** cette couche (Task 4), elle ne l'invente pas. ⚠️ Le refactor touche **du code livré** (6.1/6.2) → **story/commit séparé** (Rule 6 : refactor ≠ feature), livré et vérifié avant la tortue. **Vérifier le rendu à 1024×768 (iPad).**

**Garde-fou increment.** `counter` `maximum: 2` côté HA → un `increment` à 2 est un **no-op** (clamp HA). Garder malgré tout le `disabled` app (UX + évite un appel réseau inutile). Défense en profondeur, pas redondance inutile.

### Project Structure Notes

- **NEW** : `src/widgets/TurtleTile.tsx` (+ `.test.tsx`) ; `src/widgets/turtle-state.ts` (+ `.test.ts`).
- **UPDATE** : `src/entities/mapping.ts` (+ `.test.ts`) (`TurtlesConfig` + `TURTLES` + `turtlesConfig()`) ; `src/App.tsx` (monter `<TurtleTile/>` `fixed` sous le provider) ; `docs/home-assistant.md` (section « Tortues ») ; `_bmad-output/implementation-artifacts/sprint-status.yaml` (6-3 → in-progress → review).
- **Direction de dépendance** : `widgets/TurtleTile` → `hakit`/`entities`. Tuile sous provider.
- **Style** : Tailwind ; icône/cible ≥56px (geste enfant) ; remplissage progressif + `aria-label` ; kiosque sans scroll. Repo formaté **Prettier** (défauts) + **pre-commit Husky** (ajoutés ce sprint) — le commit déclenche le gate complet.

### Décisions tranchées (Florian, 2026-07-17)

- **Remplissage = fond de tuile.** Le **fond de la tuile** se remplit (montée verticale, `0` → `50 %` → `100 %` de bas en haut), pas la carapace de l'icône. L'icône tortue reste lisible par-dessus ; le niveau porte l'état (repère non-coloré, UX-DR14).
- **Placement = couche de composition top-bar (TD-4), traitée AVANT.** Pas de nouveau `fixed` empilé — refactor TD-4 dédié préalable, puis la tortue s'y insère (Task 4). Voir Dev Notes.
- **À 2/2 = reste visible.** Tuile **pleine + `disabled`** jusqu'au reset minuit (confirmation « fait »), ne se cache pas.

### Décisions ouvertes / dépendances

- **Task 0 bloquant** : `counter.tortues_repas` + l'automation reset minuit (Florian, HA). L'app ne peut pas être éprouvée sans.
- **⚠️ Dépendance TD-4** : le refactor **couche de composition top-bar** doit être **livré avant** la Task 4 de 6.3 (story/commit séparé — touche 6.1/6.2 livrés).
- **Signature `counter.increment`** (`@hakit/core`) à vérifier au dev.
- **`counter` vs `input_number`/2× `input_boolean`** : **`counter`** retenu (natif, `maximum` intégré → clamp, `counter.reset` simple pour l'automation). Alternative écartée : 2 `input_boolean` (matin/soir) — plus verbeux, pas de « niveau ».

### References

- [Source: epics.md#Epic 6 (Maison & coordination — couche coordination familiale, **primitives HA natives**, reflet AD-1/AD-3 + services AD-4, correct-course)]
- [Source: 6-1-sortie-poubelles.md (v0.3, commit `9f14001`) — **moule tuile top-bar `fixed`**, **HA source unique / pas d'optimiste**, `useService` impératif, helper pur + tests, mapping AD-7, gestion d'échec `.catch` (D2) ; leçon fuseau D1 **non applicable ici**]
- [Source: ARCHITECTURE-SPINE.md#AD-4 (**reset/échéancier dans HA** — automation) · #AD-1/AD-3 (HA source de vérité, app sans persistance) · #AD-6 (obsolescence) · #AD-7 (mapping `entities/`) · #AD-2 (accès `@hakit`)]
- [Source: Story 1.6 (obsolescence `useEntityValue`/`isStale`) · Story 2.7 (`useService` impératif `press`) · memory `target-device-and-layout` (1024×768 sans scroll)]
- [Source: TECH_DEBT.md#TD-4 (composition top-bar — empilement de `fixed`)]
- [Source: @hakit/core 6.0.2 — `counter.increment` / `counter.reset` (reset côté HA), `useEntity` (signature à vérifier au dev)]

## Dev Agent Record

### Agent Model Used

(à remplir au dev)

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-17 | 0.1 | Story 6.3 créée (correct-course, Ultimate context engine) — **tuile tortue** dans la barre supérieure, **compteur HA** 2 repas/jour, **`counter.increment`** au tap, **remplissage progressif** (vide/moitié/plein), **`disabled` à 2/2**, **reset minuit côté HA** (automation). Archi = reflet + service (AD-1/AD-4), **HA source unique, pas d'optimiste** (leçon 6.1 v0.3). Plus simple que 6.1 (compteur direct, pas de template ni timestamp → pas de souci fuseau). Risque identifié : **composition top-bar (TD-4)**, tortue permanente. Task 0 (counter + automation) + preuve device = Florian. → ready-for-dev. |
