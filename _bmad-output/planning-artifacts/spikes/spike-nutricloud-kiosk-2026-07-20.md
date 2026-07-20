---
title: Spike — Intégration kiosque ↔ NutriCloud (liste de courses)
status: resolved
created: 2026-07-20
feeds: architecture-delta v2 (feature Courses, PRD §4.2 / §8)
source: inspection du code réel /Users/florianmarin/Documents/Claude/Projects/Le Cadre - Nutrition/
---

# Spike — le dashboard comme client read-write de la liste de courses NutriCloud

**Question :** comment un client **kiosque** (dashboard @hakit/Vite, statique, servi en LAN depuis HA) s'authentifie et lit/écrit `grocery_list_items` en respectant la **RLS foyer**, et que se passe-t-il **hors-ligne** ?

**Verdict global : FAISABLE, sans nouveau backend.** La cible est une **app réelle et stable** (schéma + RLS + CRUD courses implémentés de bout en bout), pas du scaffold. Le kiosque devient un **2ᵉ client Supabase** de la même base, sous RLS, via un seam isolé.

> ✅ **Vérifié en direct sur la prod** (`ywoubvebmlhtomwgouci`, connecteur Supabase, lecture seule, 2026-07-20) : RLS `grocery_list_items` = **active** (policy `grocery_all` FOR ALL `household_id = current_household_id()`) ; publication `supabase_realtime` = **0 table** ⇒ Realtime **OFF**.

> ⚠️ **Nom réel = `NutriCloud`** (README + package.json). « NutriClaude » n'est que le nom du fichier d'archi. À aligner dans nos docs.

## Findings clés (corrigent le pressenti)

| Sujet | Ce que je pensais | Réalité (code) |
|---|---|---|
| Auth | magic-link | **email + password** (`signInWithPassword`) — magic-link **non câblé** |
| RLS | à confirmer | **Réelle et stricte** : `household_id = current_household_id()`, résolu par `profiles.id = auth.uid()`. Pas de profil ⇒ rien de visible ni inscriptible. Anonyme impossible. |
| Clé | anon | **anon key + URL uniquement**, `service_role` **absent** partout ✅ |
| Vider le panier | Edge Function `clear-grocery-list` | **Pas d'Edge Functions du tout.** Écritures = **directes** sur la table (Server Actions) sous RLS. « Vider » = **delete des items `bought`**. |
| Temps réel | Supabase Realtime | **Realtime OFF**, non configuré. Le web app est SSR + `revalidatePath`. Realtime exigerait d'ajouter la table à la publication `supabase_realtime` (**changement projet NutriCloud**). |
| Stack | — | `@supabase/supabase-js ^2.45`, `@supabase/ssr ^0.5`, Next 14 App Router. |

**Autres faits :**
- `grocery_list_items` : `id, household_id, name, quantity numeric, unit, product_id, aisle_id, recipe_id, added_by, status('pending'|'bought'), created_at`. **Pas d'`updated_at`** (pas de détection de changement par timestamp).
- Vue `grocery_list_by_aisle` = **pending-only**, `security_invoker=true` (respecte la RLS de l'appelant), triée par rayon. Les `bought` se lisent sur la table de base filtrée.
- RPC `generate_grocery_list_from_menu` **supprime tous les items `pending`** puis régénère depuis le menu → **le set pending peut être remplacé en bloc** quand le web app régénère.
- Patterns réutilisables : `lib/supabase/client.ts` (factory), `queries.ts` (`getCurrentProfile`/`requireProfile`), `types.ts` (`GroceryListItem`, `GroceryListByAisleRow`), `grocery/actions.ts` (formes exactes des appels).

## Architecture recommandée pour le client kiosque

**Auth — compte « cuisine » dédié dans le foyer.**
- Créer un user Supabase **dédié au kiosque** (« cuisine ») et l'**onboarder dans le foyer Marin** (`redeem_household_invite`). Attribution propre, pas « comme Florian ».
- Le kiosque se connecte **une fois** (email+password au setup), `supabase-js` persiste la **session (refresh token)** et l'auto-refresh. Secret runtime **gitignoré, non bundlé** (calque AD-8). Clé **anon + URL** seulement (publiques, sûres). **Jamais** de `service_role`.
- RLS voit `auth.uid()` = compte cuisine → lecture/écriture bornées au foyer.

**Lecture.** Vue `grocery_list_by_aisle` (pending, triée rayon) pour la page détail + compteur ; table de base `status='bought'` pour le panier.

**Écriture (périmètre kiosque = pointer + vider).** `update({status:'bought'}).eq('id',…)` pour pointer ; **delete des `bought`** pour vider le panier (miroir de `clearBought`). Optimiste dans **notre** couche state (réutilise le pattern Epic 2, transport = Supabase, pas @hakit) + refetch/convergence.

**Mises à jour live — décision requise (voir ci-dessous).** Realtime OFF aujourd'hui.

**Hors-ligne / obsolescence.** Pas de cache persistant (esprit AD-3) ; dernier état en mémoire ; sur déconnexion / échec refresh JWT → indicateur « Hors ligne » (équivalent AD-6 hors HA). Reconnexion au retour réseau. CORS : Supabase autorise les origines navigateur par défaut pour le REST anon → OK depuis l'origine LAN du kiosque.

**Isolation.** Seam `src/nutricloud/`, client Supabase propre, **jamais fusionné** avec `src/hakit/`. 2ᵉ exception AD-2 (après le média caméras).

## Risques & bords

- **Credential permanent sur appareil partagé** — mitigé : compte bas-privilège, borné foyer par RLS, clé anon. Rotation possible.
- **Régénération menu wipe le pending** (`generate_grocery_list_from_menu`) → le kiosque doit traiter la liste pending comme **remplaçable en bloc** ; un pointage pendant une régen peut viser une ligne supprimée → converger vers la vérité serveur, pas d'assumption destructive.
- **Pas d'`updated_at`** → convergence par refetch/Realtime, pas par timestamp.
- **Cloud vs LAN** (NFR5) : Supabase est cloud → Courses en obsolescence internet coupé (cohérent Netatmo/Arlo).

## Décisions (tranchées par Florian, 2026-07-20)

1. **Mises à jour live → activer Realtime.** Ajouter `grocery_list_items` à la publication `supabase_realtime` côté NutriCloud = **Task 0 (hors-repo)**. Le kiosque s'abonne → reflet quasi-instantané. Fallback documenté = polling si Realtime pose problème.
2. **Identité kiosque → compte « cuisine » dédié**, onboardé dans le foyer (attribution propre, révocable indépendamment).

## Task 0 (hors-repo, préalables NutriCloud)

- [ ] Activer Realtime sur `grocery_list_items` (publication `supabase_realtime`). *(Vérifié OFF en prod 2026-07-20 — 0 table publiée.)*
- [ ] Créer le compte Supabase « cuisine » + l'onboarder dans le foyer Marin (`redeem_household_invite`).
- [ ] Fournir au kiosque : `NEXT_PUBLIC_SUPABASE_URL` + `ANON_KEY` + identifiants du compte cuisine (secret runtime gitignoré).
