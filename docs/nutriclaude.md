# Configuration NutriClaude requise par le dashboard (feature Courses, v2)

La feature **Courses** (Epic 8) est une **surface kiosque read-write** sur **NutriClaude**,
une app séparée (Next.js + Supabase, écosystème « Le Cadre ») qui **possède** la liste de
courses du foyer. Contrairement au reste du dashboard, Courses **ne passe pas par Home
Assistant** : c'est un **2ᵉ système de vérité** (AD-12), consommé **directement** via le
client `@supabase/supabase-js` dans un **seam isolé `src/nutriclaude/`**, **jamais fusionné**
avec `src/hakit/` (AD-2, 2ᵉ exception). Ce document liste le setup **hors-repo (Task 0)** que
Florian doit réaliser côté NutriClaude avant que les stories 8.1–8.4 puissent être éprouvées,
et le **contrat d'interface** dont le code du dashboard dépend.

> **Nommage :** l'app est appelée **NutriClaude** (nom canonique). Son code interne la nomme
> **NutriCloud** (README + `package.json`) — à savoir pour un dev qui ouvre ce repo-là.
> Projet Supabase : `ywoubvebmlhtomwgouci` (org « Nutrition »).

---

## Task 0 — prérequis hors-repo (Florian, côté NutriClaude)

L'app **ne crée aucun de ces éléments** ; ils vivent dans le projet NutriClaude/Supabase.

- [ ] **1. Activer Realtime sur `grocery_list_items`** — ajouter la table à la publication
      `supabase_realtime` (Dashboard Supabase → Database → Replication, ou SQL). **Vérifié OFF
      en prod le 2026-07-20** (0 table publiée). Sans ça, le reflet quasi-temps réel (FR-1/FR-5)
      retombe sur le **fallback polling 15-30 s**.
- [ ] **2. Créer + onboarder le compte « cuisine »** — un utilisateur Supabase **dédié au
      kiosque** (appareil partagé, toujours-allumé), **onboardé dans le foyer Marin**
      (`redeem_household_invite`) pour que la RLS le voie. Auth = **email + password**
      (`signInWithPassword` ; magic-link non câblé côté NutriClaude). Attribution propre et
      **révocable indépendamment** de Florian.
- [ ] **3. Fournir la config publique, puis faire le login de setup** — `SUPABASE_URL` +
      **clé `anon`** sont de la **config publique** (sûres, bornées par la RLS) → injectées au
      **build**. Les **identifiants du compte cuisine** (email + mot de passe) servent **une
      seule fois**, au **login de setup sur le kiosque** : ils ne sont **ni bundlés ni
      commités**. Ensuite `supabase-js` **persiste la session (refresh token) au runtime**
      (localStorage) + auto-refresh — c'est _elle_ le « secret runtime non bundlé » d'AD-13,
      **pas le mot de passe**.

```dotenv
# Config PUBLIQUE (sûre, bornée par la RLS) — injectée au build. Valeurs = sortie du Task 0.
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
# ⚠️ PAS de mot de passe cuisine ici : une variable VITE_… est embarquée dans le bundle.
# Le login cuisine se fait une fois à l'écran de setup ; seule la session persiste au runtime.
```

> ⚠️ **Jamais `service_role`**, et **jamais le mot de passe cuisine dans une variable
> `VITE_…`** : une variable `VITE_`-préfixée est **embarquée dans le bundle client**, ce qui
> violerait le « non bundlé » d'AD-13. Seuls **URL + `anon key`** (publics) sont en build-time.
> Le nommage exact des `VITE_…` et l'écran de setup seront figés par la Story 8.1
> (`.env.example`) ; les identifiants cuisine restent hors dépôt.

---

## Contrat d'interface (⚠️ le code du dashboard en dépend)

Source : spike `spike-nutricloud-kiosk-2026-07-20.md` + `ARCHITECTURE-DELTA-V2.md` (schéma
confirmé live sur la prod, lecture seule, 2026-07-20).

### Table `public.grocery_list_items`

| colonne        | type / valeurs                           | note                           |
| -------------- | ---------------------------------------- | ------------------------------ |
| `id`           | uuid                                     | clé                            |
| `household_id` | uuid → `households` (on delete cascade)  | portée foyer (RLS)             |
| `name`         | text                                     | libellé de l'Article           |
| `quantity`     | numeric (optionnel)                      | affiché si présent             |
| `unit`         | text (optionnel)                         | affiché si présent             |
| `aisle_id`     | uuid (optionnel) → Rayon                 | inconnu → groupe « Autres »    |
| `recipe_id`    | uuid (optionnel)                         | provenance = recette (icône)   |
| `added_by`     | uuid → `auth.users` (on delete set null) | provenance = personne (prénom) |
| `status`       | `'pending'` \| `'bought'`                | à acheter / pris               |
| `created_at`   | timestamptz                              | —                              |

- **Pas d'`updated_at`** ⇒ pas de détection de changement par timestamp ; la convergence se
  fait par **refetch / Realtime**, pas par comparaison de date.
- Indexes : `(household_id, status)` et `(household_id, aisle_id)`.

### Vue `grocery_list_by_aisle`

- **Pending uniquement**, `security_invoker = true` (respecte la RLS de l'appelant), **triée
  par rayon** (parcours magasin). Sert la page détail (groupée) + le compteur « à acheter ».
- Les Articles **`bought`** se lisent sur la table de base filtrée `status = 'bought'`
  (section « panier »).

### RLS — policy `grocery_all`

- `grocery_list_items` a la **RLS activée** ; policy `grocery_all` **FOR ALL**
  `using / with check (household_id = current_household_id())`, où `current_household_id()`
  résout `profiles.id = auth.uid()`. **Pas de profil / mauvais foyer ⇒ rien de visible ni
  d'inscriptible.** Anonyme impossible.

### Écritures autorisées (périmètre kiosque = pointer + vider)

- **Pointer** : `update({ status: 'bought' }).eq('id', <id>)` — optimiste côté couche state,
  convergence via Realtime/refetch (AD-14).
- **Vider le panier** : `delete().eq('status', 'bought')` borné foyer — **delete direct sous
  RLS**. **Pas d'Edge Function** côté NutriClaude (les écritures y sont des Server Actions
  directes). Undo (NFR6) = compensation côté couche state avant flush.
- **Pas d'ajout d'Article au kiosque** — l'ajout passe par les canaux NutriClaude (Siri,
  Google Home, iOS, Claude/MCP, app web). Le kiosque **reflète** ces ajouts (FR-5).

### Bords durs

- **Régénération de menu** — la RPC `generate_grocery_list_from_menu` **supprime tout le
  `pending`** puis régénère depuis le menu. Traiter la liste pending comme **remplaçable en
  bloc** ; un pointage optimiste peut viser une ligne disparue → **converger vers la vérité
  serveur**, jamais d'assumption destructive.
- **Cloud vs LAN (NFR5)** — Supabase est **cloud** : Courses tombe en **obsolescence** si
  internet est coupé (même classe que Netatmo/Arlo). Indicateur « Hors ligne » + dernier état
  en mémoire (équivalent AD-6 hors HA, AD-14), jamais de blanc.

---

## Sécurité & garde-fous

- **Credential permanent sur appareil partagé** — mitigé : compte **bas-privilège** (clé
  `anon`), **borné au foyer** par la RLS, **non bundlé**, **rotable**. Blast radius = la liste
  de courses du foyer.
- **`service_role` proscrit** côté client (bypass RLS).
- **Isolation stricte** des deux couches d'état : `src/nutriclaude/` (Supabase) **jamais
  fusionné** avec `src/hakit/` (HA) — pas de store commun.
- **CORS** : le REST Supabase (anon) accepte les origines navigateur par défaut → OK depuis
  l'origine LAN du kiosque servi par HA.
