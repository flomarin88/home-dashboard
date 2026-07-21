---
baseline_commit: 93c78397deffa7c7f21bdef910bb7ba31425707d
---

# Story 8.2: Page détail « Courses » — liste par Rayon (lecture)

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created (2026-07-21). -->
<!-- Page profonde (AD-10) en LECTURE seule : remplace le stub `/courses` par la vraie page — tous les Articles groupés par Rayon (vue `grocery_list_by_aisle`), section « panier » pour les pris, reflet Realtime. Les écritures (pointer 8.3 / vider 8.4) restent hors scope. -->

## Story

As a Florian,
I want une page détail `/courses` qui liste tous les Articles groupés par Rayon,
so that je vois précisément ce qu'il reste à acheter, organisé comme mon parcours en magasin.

## Acceptance Criteria

1. **Page profonde + en-tête (AD-10)** — taper la tuile Courses ouvre `/courses` (route **déjà câblée**, `HashRouter`) ; la page rend un **contenu-seul** (pas de barre supérieure, comme `WeatherDetail`) avec un **en-tête** = retour « ‹ Accueil · Liste de courses » (cible ≥ 44px, `navigate('/')`) + un **chip de progression** « **N** à acheter · **M** pris » (`tabular-nums`), teinté `accent-courses` (**pas vert**). Un retour ramène à l'accueil.

2. **Groupement par Rayon (FR-2)** — les Articles `pending` sont lus via la vue **`grocery_list_by_aisle`** (déjà triée par rayon, `security_invoker`, pending-only — **ne pas re-trier ni re-filtrer le statut**) et rendus **un groupe = une carte de rayon** (`SectionCard`), en-tête de carte = **icône + nom du rayon + `restant/total`** (`tabular-nums`). Le layout des cartes est une grille multi-colonnes (empreinte type mock : 3 colonnes, `align-content: start`).

3. **Ligne d'Article (UX-DR21)** — chaque ligne montre, dans l'ordre : un **glyphe case** (case à cocher **d'affichage seulement** en 8.2 ; l'interactif ≥48px est la Story 8.3), le **libellé**, la **quantité/unité si présentes** (`tabular-nums`), et la **provenance = prénom** (`added_by` → `profiles.display_name`) + une **icône recette si `recipe_id`** (avec `aria-label` « Recette »). **Aucun badge canal, aucun avatar.** `added_by` nul → pas de prénom, pas d'erreur.

4. **Section « panier » (pris)** — les Articles `bought` (lus sur la table de base `grocery_list_items` filtrée `status='bought'`) apparaissent **barrés** (`line-through`), atténués, **case remplie**, regroupés **en fin de leur carte de rayon** sous un séparateur « **Dans le panier** ». (Résolution de l'ambiguïté source : par-rayon, pas une section panier globale — cohérent avec le compteur `restant/total`.)

5. **Groupe « Autres »** — un Article dont le Rayon est inconnu (`aisle_id` nul) tombe dans un groupe **« Autres »** — pas d'erreur, pas de blanc.

6. **Scroll toléré (exception no-scroll)** — si la liste dépasse 1024×768, un **scroll vertical est toléré** sur cette page profonde (`overflow-y-auto` sur la région liste) — divergence assumée des 4 autres pages détail qui sont `overflow-hidden`. **Le no-scroll reste strict sur l'accueil.** Pas de scroll horizontal.

7. **Reflet quasi-temps réel + obsolescence (FR-5, AD-14)** — abonnement **Supabase Realtime** sur `grocery_list_items` + **fallback polling 20 s** ; un ajout/maj hors kiosque (Siri/Google Home/iOS/Claude/web) se reflète sans intervention. NutriClaude **injoignable** (réseau, JWT expiré, Realtime perdu) → **`OfflinePill` « Hors ligne »** + **dernier état connu**, **jamais de blanc ni de spinner**. Trois états dans une **empreinte stable** : loading (skeleton) / offline (dernier connu + pill) / live.

8. **Isolation & pas de cache persistant (AD-2/AD-12/AD-3)** — toute la lecture passe par le seam `src/nutriclaude/` (aucun import `hakit`, `isolation.test.ts` reste vert) ; la page consomme le seam **uniquement** via les exports publics de `../nutriclaude` (comme `CoursesTile`), jamais Supabase en direct. Dernier bon état en **ref éphémère** (pas de cache persistant — AD-3). Lecture **bornée foyer** par la RLS `grocery_all` (aucun filtre `household_id` codé en dur) ; compte sans profil/foyer → vide, pas de crash.

9. **Gates verts + tests** — `tsc -b --noEmit`, `oxlint`, **build sans secret**, `vitest` passent, **0 régression** (257 tests existants). Tests neufs : couche requête (`getGroceryDetail`) avec **client Supabase mocké** (groupement par rayon, section panier, groupe « Autres », résolution provenance, coercions null, erreurs) ; page/`CoursesDetailContent` (hook mocké → les 3 états, groupes, section panier, « Autres »).

## Tasks / Subtasks

- [ ] **Tâche 0 — Vérifier le contrat de la vue AVANT de coder (AC: 2, 3, 4)** ⚠️ bloquant partiel
  - [ ] Confirmer le **jeu de colonnes réel de `grocery_list_by_aisle`** : porte-t-elle `id, name, quantity, unit, aisle_id, recipe_id, added_by, created_at` **et le nom/icône du rayon** ? Vérifier via les `types.ts` de NutriCloud (`GroceryListByAisleRow`, cf. en-tête du spike) **ou** une requête read-only sur le projet `ywoubvebmlhtomwgouci` (`select * from grocery_list_by_aisle limit 1`). **Repli** si des colonnes manquent (provenance, nom de rayon) : lire le pending sur la table de base `grocery_list_items` `status='pending'` `order('aisle_id')` et résoudre le nom du rayon séparément. **Ne pas supposer** que la vue porte le nom du rayon.
  - [ ] Confirmer la lisibilité de `profiles` (`id, display_name`) pour les membres du foyer sous RLS.
- [ ] **Tâche 1 — Couche requête : `getGroceryDetail` (AC: 2, 3, 4, 5, 8)**
  - [ ] Ajouter `getGroceryDetail(client)` dans `src/nutriclaude/queries.ts` — miroir structurel de `getGrocerySummary` (`Promise.all`, throw sur `.error`, coercions défensives). **3 lectures parallèles** : (1) `grocery_list_by_aisle` (pending, **préserver l'ordre de la vue**), (2) `grocery_list_items` `.eq('status','bought')` (+ `aisle_id`), (3) `profiles` `.select('id, display_name')` → `Map<uuid, display_name>` résolu en JS.
  - [ ] **Provenance** : résoudre `added_by → display_name` via la **Map profiles** (PAS d'embedding PostgREST `profiles!added_by(...)` : `added_by` FK `auth.users` **pas** `profiles`, et l'embed à travers une vue est fragile).
  - [ ] **Grouper par `aisle_id` consécutif** (ordre de la vue), `aisle_id` nul → groupe « Autres ». Coercer `name`→`""`, `quantity/unit/aisle_id/recipe_id/added_by`→`null` (comme `getGrocerySummary`).
  - [ ] Types : `GroceryDetailItem` (`id, name, quantity, unit, aisleId, recipeId, addedByName, createdAt`), `GroceryAisleGroup` (`aisleId, aisleName, pending[], bought[]`), `GroceryDetail` (`groups[], pendingCount, boughtCount`).
- [ ] **Tâche 2 — Hook : `useGroceryDetail` (AC: 7, 8)**
  - [ ] Ajouter `src/nutriclaude/useGroceryDetail.ts` — **cloner la machinerie d'obsolescence de `useGrocerySummary`** : `latestSeq` (garde hors-ordre), `warned`-once (Rule 14), debounce 300 ms des events Realtime, ref éphémère `lastGood` (AD-3), `POLL_MS=20_000`, `ensureNutriSession()`. Canal Realtime **nom distinct** `"grocery-detail"` (éviter la collision avec `"grocery-summary"` de la tuile quand les deux sont montés).
  - [ ] Retour `GroceryDetailValue` (`groups, pendingCount, boughtCount, isStale, loading, since`), forme miroir de `GrocerySummaryValue`.
  - [ ] Exporter le hook + les types depuis `src/nutriclaude/index.ts`.
- [ ] **Tâche 3 — UI : composant carte de rayon (AC: 2, 3, 4, 5)**
  - [ ] **Étendre `SectionCard`** de façon additive avec des props optionnelles `icon?` + `right?` (ou `headerRight?`) — l'en-tête doit porter *icône + nom (gauche)* et *`restant/total` (droite)*. Rétro-compatible (les appelants existants ne passent ni l'un ni l'autre). **Ne pas dupliquer** les classes de `SectionCard` dans une carte bespoke (DRY Gate).
  - [ ] Ligne d'Article : glyphe case (display-only), libellé, qté/unité `tabular-nums`, prénom + icône recette (`aria-label` « Recette »). **Réutiliser `CartIcon`** (extrait de `CoursesTile`, ne pas le redessiner). Empreinte de ligne ≥ 48px (pour que 8.3 ajoute l'interactivité sans reflow) **sans handler de tap en 8.2**.
  - [ ] Bought : `line-through` + atténué + case remplie, en fin de carte sous séparateur « Dans le panier ».
- [ ] **Tâche 4 — Page `/courses` (AC: 1, 6, 7)**
  - [ ] Remplacer le corps du **stub** `src/pages/CoursesDetail.tsx` **sur place** (garder l'export nommé `CoursesDetail` — route déjà câblée dans `App.tsx`, **aucun changement App.tsx**). Split guard-wrapper + `CoursesDetailContent` (testable sans le garde de config), comme les 4 pages détail existantes.
  - [ ] Structure : racine contenu-seul `flex h-full flex-col gap-grid-gap` ; en-tête (retour + chip progression `accent-courses`, `tabular-nums`) ; **région liste `overflow-y-auto`** (divergence assumée du `overflow-hidden` des autres pages). **PAS** de bouton « Vider le panier » (8.4), **PAS** de hints voix/note (retirés en v2).
  - [ ] 3 états dans une empreinte stable : `Skeleton` / `OfflinePill`(dernier connu) / live.
- [ ] **Tâche 5 — (Optionnel, recommandé) Extraire `BackLink` (dette DRY)**
  - [ ] `BackLink` est dupliqué **verbatim dans 4 pages** (Weather/Vacuum/Climate/Room) + le stub ; c'est déjà consigné dans `deferred-work.md`. Extraire `src/ui/BackLink.tsx` (props `label?='‹ Accueil'`, `to?='/'`) + `BackLink.test.tsx`, et remplacer les 5 copies. **Vérifier** que les tests existants des 4 pages requêtent toujours le bouton par rôle/texte après extraction. Si blast-radius indésirable pour 8.2 : inliner une 5ᵉ fois et ficher l'extraction en ticket séparé (Rule 6). **Ne PAS** tenter un `PageShell` complet ici (refactor distinct — les grilles/en-têtes divergent).
- [ ] **Tâche 6 — Tests + gates (AC: 9)**
  - [ ] `src/nutriclaude/queries.test.ts` (existant) : ajouter les cas de `getGroceryDetail` avec **client Supabase mocké** (3 lectures) — groupement par rayon en préservant l'ordre, section panier, groupe « Autres » (aisle nul), résolution provenance via Map, coercions null, erreurs des 3 lectures.
  - [ ] `src/pages/CoursesDetail.test.tsx` (neuf) : hook mocké (`vi.hoisted`) dans `<MemoryRouter>` → les 3 états, rendu des groupes, section panier barrée, « Autres », chip progression.
  - [ ] **Lire `~/.liza/skills/testing/SKILL.md` avant d'écrire les tests** (protocole obligatoire).
  - [ ] `npm run typecheck` + `npm run lint` + `vitest run` + build **sans** `.env.local` → tout vert, 0 régression. Prettier sur les fichiers touchés.

## Dev Notes

### Le seam NutriClaude est déjà fondé (Story 8.1) — 8.2 étend la lecture

8.1 a livré le seam isolé (`config.ts`, `client.ts`, `queries.ts`, `useGrocerySummary.ts`, `summary-format.ts`, `isolation.test.ts`, `index.ts`) et la tuile `CoursesTile`. **8.2 ne refonde rien** : elle ajoute un 2ᵉ chemin de lecture (par rayon + panier + provenance) et la page profonde. **Réutilise les mêmes formes, ne réinvente pas.**

| Besoin 8.2 | Existant à imiter/réutiliser | Source |
| --- | --- | --- |
| Client + session | `getNutriClient()` / `ensureNutriSession()` (client unique, sign-in coalescé) | `src/nutriclaude/client.ts` |
| Obsolescence (AD-14) | `useGrocerySummary` (seq token, warn-once, debounce 300ms, ref éphémère, Realtime + poll 20s) | `src/nutriclaude/useGrocerySummary.ts` |
| Abonnement Realtime | `client.channel(...).on('postgres_changes',{table:'grocery_list_items'},…).subscribe()` + cleanup `removeChannel` | `useGrocerySummary.ts:103-118` |
| Horodatage relatif | `formatRelativeTime` (pur, `nowMs` injecté) | `src/nutriclaude/summary-format.ts` |
| Carte frostée par rayon | `SectionCard` (le `section-card` nommé par l'AC) — **à étendre** (icon + right) | `src/ui/SectionCard.tsx` |
| Offline / loading | `OfflinePill`, `Skeleton` | `src/ui/` |
| Icône panier | `CartIcon` (inline dans `CoursesTile`) — **à lever/réutiliser** | `CoursesTile.tsx:12-30` |
| Accent + tabular-nums | `accent-courses` (#ff6faf, rose), `tabular-nums` | `src/index.css:32,125-127` |

### Contrat de données (⚠️ points à vérifier — Tâche 0)

- **Vue `grocery_list_by_aisle`** : pending-only, **déjà triée par rayon** (parcours magasin), `security_invoker=true` (respecte la RLS de l'appelant). Grouper par `aisle_id` **consécutif** en préservant l'ordre ; ne pas re-trier. ⚠️ **Le jeu de colonnes exact n'est pas figé dans les docs** — vérifier (Tâche 0) qu'elle porte provenance (`added_by`, `recipe_id`) et le **nom du rayon** ; sinon repli sur la table de base.
- **Pris** : `grocery_list_items` `.eq('status','bought')`, **sélectionner aussi `aisle_id`** (pour placer les pris par rayon + calculer `total = pending + bought`).
- **Provenance** : `added_by` FK **`auth.users`** (pas `profiles`), `on delete set null`. Résoudre le prénom via une **lecture séparée de `profiles(id, display_name)` + Map** en JS. **Éviter** l'embedding `profiles!added_by(...)` (FK ambiguë + embed à travers une vue non fiable). C'est la dette explicitement reportée ici par `queries.ts:20-24`.
- **Pas d'`updated_at`** → convergence par refetch/Realtime uniquement, jamais par comparaison de date.
- **Bords durs** : la RPC `generate_grocery_list_from_menu` **supprime tout le pending en bloc** puis régénère → traiter le set pending comme **remplaçable en bloc**, converger vers la vérité serveur sur événement Realtime (pertinent surtout 8.3, mais le refetch de 8.2 doit être propre).

### Patterns de page (à suivre)

- **Route déjà câblée** : `/courses` → `CoursesDetail` (`App.tsx`), `HashRouter`. Remplacer le **corps du stub** sur place, garder l'export nommé — **aucun changement `App.tsx`**.
- **Idiome des 4 pages détail** : racine `flex h-full flex-col gap-grid-gap` (les autres ajoutent `overflow-hidden` — **8.2 met `overflow-y-auto` sur la liste**), en-tête `flex items-center` avec `BackLink`, corps en grille. Split export **guard-wrapper + `…Content`** pour la testabilité.
- **Mock `mock-courses.html`** : c'est un fichier standalone qui redessine tout le cadre (top bar, sol) — **ne pas reproduire** ; la page est **contenu-seul** (le sol + la barre appartiennent à `KioskShell`, TD-1). Le mock teinte le chip/accent en **vert** → **remplacer par `accent-courses` rose** (vert réservé sécurité). Le mock montre des **badges canal** et un bouton « Vider le panier » → **exclus** (UX-DR21 : personne + recette ; « vider » = 8.4).

### États (3, empreinte stable — miroir `CoursesTile`)

1. **loading** (rien jamais lu) → `Skeleton` (jamais de spinner). 2. **offline/stale** (injoignable) → dernier état connu + `OfflinePill` primaire, jamais blanc. 3. **live** → reflet Realtime. Modeler le hook sur `GrocerySummaryValue` pour une consommation uniforme de `isStale`/`loading`/`since`.

### Accessibilité

- État jamais par la couleur seule : provenance = **texte** ; icône recette = **icône + `aria-label`** ; bought = `line-through` **+** atténué **+** case remplie **+** séparateur « Dans le panier ».
- `tabular-nums` sur tout nombre vivant (chip N·M, restant/total, quantités) pour éviter le jitter de chiffres sur maj Realtime.
- `stale-text` lisible (≈7:1) pour l'état offline ; réserver la couleur `stale` au chrome de bordure (déjà géré par `OfflinePill`).
- 8.2 est **lecture seule** → la cible de **pointage ≥48px est la Story 8.3** ; garder l'empreinte de ligne ≥48px et le retour ≥44px.

### Portées — ce qui est HORS 8.2

- **Pointer un Article** (tap → `bought`, optimiste ≥48px) = **Story 8.3**.
- **Vider le panier** (delete + undo) = **Story 8.4**.
- **Canaux d'ajout** (Siri/Google Home/iOS/Claude/web) = jamais implémentés par l'app (elle reflète seulement).
- **Setup auth prod** (écran de login one-time) = follow-on (déjà noté en 8.1).

### Dépendance Task 0 (Florian, hors-repo)

Le **code se développe et se teste avec mocks sans Task 0** (comme 8.1). Mais la **preuve device** exige Task 0 : Realtime activé sur `grocery_list_items`, compte cuisine onboardé, `.env.local` (URL + anon key + creds cuisine). La RLS `grocery_all` + `current_household_id()` ont été **vérifiées saines le 2026-07-21** (revue 8.1, D1) ; la vue `grocery_list_by_aisle` est documentée comme existante sur la prod mais son **jeu de colonnes reste à confirmer (Tâche 0)**.

### Project Structure Notes

- **Nouveaux** : `src/nutriclaude/useGroceryDetail.ts` ; `src/pages/CoursesDetail.test.tsx` ; (optionnel) `src/ui/BackLink.tsx` + `BackLink.test.tsx`.
- **Modifiés** : `src/nutriclaude/queries.ts` (+`getGroceryDetail` + types) ; `src/nutriclaude/queries.test.ts` (+cas `getGroceryDetail`) ; `src/nutriclaude/index.ts` (+exports) ; `src/ui/SectionCard.tsx` (props `icon`/`right` additives) ; `src/pages/CoursesDetail.tsx` (corps réel) ; (si Tâche 5) `WeatherDetail.tsx`/`VacuumDetail.tsx`/`ClimateDetail.tsx`/`RoomDetail.tsx` (utiliser `BackLink`).
- **Aucun** changement `App.tsx`. **Aucun** import `hakit` sous `src/nutriclaude/` (isolation.test).
- Convention tests : co-localisés `*.test.tsx`, Vitest + `@testing-library/react`, `MemoryRouter`, hook mocké via `vi.hoisted`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.2] — ACs BDD, FR-2 (l.532), AD-12 (l.559)
- [Source: docs/nutriclaude.md#Vue grocery_list_by_aisle] — pending-only, security_invoker, tri rayon ; bought sur table de base ; RLS `grocery_all`
- [Source: docs/nutriclaude.md#Table grocery_list_items] — colonnes (`aisle_id`, `recipe_id`, `quantity`, `unit`, `added_by`→auth.users, `status`, `created_at`) ; pas d'`updated_at`
- [Source: _bmad-output/planning-artifacts/architecture/architecture-home-dashboard-2026-07-20/ARCHITECTURE-DELTA-V2.md] — AD-12/13/14, provenance prénom (l.49)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-home-dashboard-2026-07-12/ARCHITECTURE-SPINE.md] — AD-2/3/6/10
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-home-dashboard-2026-07-20/UX-DELTA-V2.md] — accent-courses (Décision #1), scroll toléré (Décision #2, l.36), provenance/pas de badge canal (l.37-38), UX-DR21
- [Source: _bmad-output/planning-artifacts/prds/prd-home-dashboard-2026-07-20/inputs/mock-courses.html] — layout de référence (cadre standalone à NE PAS reproduire)
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-home-dashboard-2026-07-12/DESIGN.md] — section-card (l.88-93), device-tile-stale (l.104-108), numeric-lg/tabular-nums
- [Source: src/nutriclaude/useGrocerySummary.ts] — patron d'obsolescence AD-14 à cloner
- [Source: src/nutriclaude/queries.ts:20-24] — provenance `added_by`→prénom explicitement reportée à 8.2
- [Source: src/pages/WeatherDetail.tsx] — idiome page détail contenu-seul + BackLink
- [Source: src/ui/SectionCard.tsx] — carte frostée à étendre
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#code review of 6-2] — dette duplication BackLink/coquille de page
- [Source: _bmad-output/implementation-artifacts/8-1-seam-nutriclaude-tuile-courses.md] — story précédente (seam, tuile, écarts, D1 RLS vérifiée)

## Dev Agent Record

### Agent Model Used

_(à remplir par le dev)_

### Debug Log References

### Completion Notes List

### File List
