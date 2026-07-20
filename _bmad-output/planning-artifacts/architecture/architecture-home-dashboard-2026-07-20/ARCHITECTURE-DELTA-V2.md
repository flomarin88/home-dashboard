---
title: Home Dashboard v2 — Architecture Delta
status: final
created: 2026-07-20
builds_on: ../architecture-home-dashboard-2026-07-12/ARCHITECTURE-SPINE.md (AD-1…AD-11)
inputs:
  - ../../prds/prd-home-dashboard-2026-07-20/prd.md
  - ../../spikes/spike-nutricloud-kiosk-2026-07-20.md
---

# Home Dashboard v2 — Architecture Delta

v2 ajoute la **couche coordination familiale** par **2 rituels** : **Arrosage** (HA-natif) et **Courses** (surface sur NutriClaude/Supabase). Ce doc ne réécrit pas la spine : il **hérite de tous les AD-1…AD-11** et ne formalise que le **neuf** et les **amendements**.

> **Nommage :** l'app nutrition est appelée **NutriClaude** (nom canonique retenu par Florian). Le code de l'app la nomme **NutriCloud** en interne — à savoir pour un dev qui ouvre ce repo-là. Supabase project : `ywoubvebmlhtomwgouci` (org « Nutrition »).

## Invariants amendés

- **AD-1 (HA = seul système de vérité / pas de backend propre)** — **amendé, borné.** HA reste la vérité unique pour **toute la domotique + l'Arrosage**. La feature **Courses** consomme un **2ᵉ système de vérité** — NutriClaude/Supabase — car ce contexte borné (nutrition) est **déjà possédé** par une app dédiée. Aucun backend *propre au dashboard* n'est créé : on est **client** d'un backend existant, pas propriétaire.
- **AD-2 (connectivité HA via `@hakit`, exception unique = média caméras)** — **amendé : 2ᵉ exception.** Le seam **`src/nutriclaude/`** (client `@supabase/supabase-js`) accède à NutriClaude. **Jamais fusionné** avec `src/hakit/` ; les deux couches d'état restent séparées (pas de store commun).

## Nouveaux AD

### AD-12 — Source NutriClaude (2ᵉ vérité, bornée, isolée)
La **Liste de courses** vit dans `public.grocery_list_items` (Supabase, RLS foyer). Le dashboard en est un **client direct read-write borné** : lecture via la vue `grocery_list_by_aisle` (pending, `security_invoker`) + table filtrée `status='bought'` ; écriture = `update status→bought` (pointer) et `delete` des `bought` (vider). **Pas de cache persistant** (miroir AD-3) ; la vérité est serveur. Seam isolé `src/nutriclaude/`.

### AD-13 — Auth NutriClaude au kiosque
Compte **« cuisine » dédié**, membre du **foyer** (la RLS `grocery_all` exige `household_id = current_household_id()`, résolu par `profiles.id = auth.uid()`). Login **email+password** une fois (au setup) ; session (**refresh token**) persistée en **secret runtime gitignoré, non bundlé** — *extension d'AD-8*. **Clé `anon` + URL** seulement ; **jamais `service_role`** (bypass RLS interdit). Les identifiants du compte cuisine sont un secret.

### AD-14 — Optimiste + obsolescence, abstraits du transport
Le pilotage optimiste + convergence (AD-5) et l'obsolescence (AD-6) sont **découplés du transport**. Pour NutriClaude : optimistic UI dans la **couche state** (réutilise l'infra Epic 2), **convergence via Supabase Realtime** + refetch ; **obsolescence** = perte de l'abonnement Realtime / échec de refresh JWT → indicateur **« Hors ligne »** + dernier état en mémoire, **jamais de blanc**. NutriClaude étant **cloud**, Courses dépend d'internet (même classe que Netatmo/Arlo, NFR5).

### AD-15 — Pattern « rituel partagé » (généralisation Epic 6)
Un rituel = **lire** un état partagé → **rendre** en tuile (défaut / actif / **stale**) → **faire avancer** en optimiste via un service. Le **transport est pluggable** : `@hakit`/HA (Arrosage) ou `@supabase`/NutriClaude (Courses). Composants communs : tuile, toast Undo, indicateur d'obsolescence, planchers a11y (≥48/56px, jamais la couleur seule). Seul l'**adapter de données** diffère.

## Placement des features

| Feature | Emplacement | Transport | Task 0 |
|---|---|---|---|
| **Arrosage** | `widgets/` + `TopBarSlots` (tuile plante) | HA `@hakit` (`counter`/`input_boolean`) | HA : compteur + automation reset minuit |
| **Courses** | tuile accueil + page `pages/` détail + seam `src/nutriclaude/` | Supabase (`@supabase/supabase-js`) | NutriClaude : Realtime + compte cuisine |

## Design d'accès Courses (détail)

- **Lecture** : `grocery_list_by_aisle` → détail groupé par Rayon + compteur pending ; `grocery_list_items` `status='bought'` → panier.
- **Écriture** : `update({status:'bought'}).eq('id',id)` (pointer) ; `delete().eq('status','bought')` borné foyer (vider) — direct, sous RLS. **Undo** (NFR6) = ré-`update`/ré-`insert` compensatoire côté couche state avant flush, ou snapshot local restauré.
- **Live** : abonnement Realtime sur `grocery_list_items` — **Task 0** (publication `supabase_realtime`, **vérifiée OFF en prod 2026-07-20**). **Fallback** : polling (15-30 s) + refetch après écriture.
- **Bord dur** : la RPC `generate_grocery_list_from_menu` **supprime tout le pending** puis régénère → traiter la liste pending comme **remplaçable en bloc** ; un pointage optimiste peut viser une ligne disparue → **converger vers la vérité serveur**, pas d'assumption destructive.
- **Provenance** : lue depuis `added_by` (personne) + `recipe_id` (recette) — **pas** un « canal » voix/note ; remapper les badges du mock à l'étape UX.

## Vérification live (prod `ywoubvebmlhtomwgouci`, 2026-07-20, lecture seule)

- **RLS** `grocery_list_items` = **enabled** ; policy `grocery_all` FOR ALL `using/check (household_id = current_household_id())`. ✅
- Publication `supabase_realtime` = **0 table publique** ⇒ Realtime **OFF**. ✅ (Task 0 confirmé nécessaire.)
- Schéma confirmé (DDL fourni) : indexes `(household_id,status)` + `(household_id,aisle_id)` ; `status` pending/bought ; **pas d'`updated_at`**.

## Task 0 (hors-repo, préalables)

- **HA** — entité compteur Arrosage (`counter.plantes_arrosees` 0..1 ou `input_boolean`) + automation reset minuit.
- **NutriClaude** — activer Realtime sur `grocery_list_items` ; créer + onboarder le compte « cuisine » dans le foyer ; fournir au kiosque `SUPABASE_URL` + `anon key` + identifiants cuisine (secret runtime gitignoré).

## Sécurité & garde-fous

- Secret compte cuisine sur appareil partagé toujours-allumé : **bas-privilège** (anon key), **borné foyer** par RLS, **non bundlé**, rotable. Blast radius = la liste de courses du foyer.
- **Isolation stricte** des 2 couches d'état (HA/`@hakit` vs NutriClaude/`@supabase`) — jamais mélangées.
- **CORS** : le REST Supabase (anon) accepte les origines navigateur par défaut → OK depuis l'origine LAN du kiosque servi par HA.
- `service_role` **proscrit** côté client.

## Renvoyé à l'UX / au build

- Accent design Courses (**pas de vert** — réservé sécurité).
- Rendu de la provenance (personne / recette) et de l'état stale d'une source non-HA.
- Ergonomie undo sur un delete (vider le panier) contre un backend sans `updated_at`.
