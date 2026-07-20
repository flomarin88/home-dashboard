# Story 8.1: Seam NutriClaude & tuile Courses (lecture)

Status: ready-for-dev

<!-- Ultimate context engine analysis completed - comprehensive developer guide created (2026-07-20). -->
<!-- Tracer bullet d'Epic 8 : établit le 2ᵉ backend (NutriClaude/Supabase) derrière un seam isolé, en LECTURE, et le rend visible via la tuile Courses de l'accueil. Les écritures (pointer/vider) sont les stories 8.3/8.4. -->

## Story

As a Florian,
I want une tuile Courses sur l'accueil qui reflète en quasi-temps réel le nombre d'Articles à acheter du foyer et les derniers ajouts,
so that je vois d'un coup d'œil ce qu'il reste à acheter sans rouvrir mon téléphone.

## Acceptance Criteria

1. **Seam isolé** — un dossier `src/nutriclaude/` est créé, contenant le client `@supabase/supabase-js` (dépendance ajoutée). **Aucun import** entre `src/nutriclaude/` et `src/hakit/` dans les deux sens ; les deux couches d'état ne partagent aucun store (AD-2 2ᵉ exception, AD-12).
2. **Config sans secret bundlé** — la config Supabase est résolue depuis l'environnement (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) par un **resolver pur testable** (moule `resolveHassConfig`) exposant `nutriIsConfigured`. **Clé `anon` + URL uniquement**, `service_role` **absent du code**. Un **build sans secret reste vert** : `nutriIsConfigured === false` → la tuile rend un état dégradé (jamais de blanc), pas de crash.
3. **Auth compte « cuisine »** — au bootstrap, le client établit la session (`signInWithPassword`) ; `supabase-js` **persiste la session** (refresh token, localStorage, auto-refresh). En **dev**, les identifiants viennent d'un `.env.local` gitignoré ; le **garde `vite.config.ts` est étendu** pour **throw si un mot de passe cuisine est présent dans un build de production** (miroir du garde AD-8/T0.5 du token HA) — le mot de passe n'est **jamais** inliné dans `dist/` (AD-13).
4. **Lecture bornée foyer** — la tuile lit le **nombre d'Articles `pending`** et un **aperçu des derniers ajoutés** (`name` + provenance `added_by`), bornés au foyer par la RLS `grocery_all`. Un compte sans profil/foyer ne voit rien (pas de crash, état vide).
5. **Reflet quasi-temps réel (FR-5)** — abonnement **Supabase Realtime** sur `grocery_list_items` ; **fallback polling 15-30 s** si Realtime est indisponible (Task 0 : publication `supabase_realtime` **vérifiée OFF le 2026-07-20**, à activer par Florian). Un Article ajouté **hors kiosque** (Siri/Google Home/iOS/Claude/web) met à jour compteur + aperçu sans intervention. L'app **n'implémente aucun de ces canaux**.
6. **Tuile Courses (accueil)** — une **device-tile givrée** (moule `RoomSensorCard`) : `TileHeader` (icône panier + « Courses » + `onOpen` → route `/courses`), **grand compteur N** (`text-numeric-lg`, `tabular-nums`) + « à acheter », **aperçu des derniers Articles** (ex. « Poivrons, Lait, Café +9 ») + **provenance de la dernière maj** (qui + horodatage relatif). **Teintée `accent-courses`** quand la liste est non vide (état actif), neutre si vide. Trois états occupant la **même empreinte** : `loading` (skeleton) / `offline` (dernier connu + pill) / `live`.
7. **Obsolescence source non-HA (AD-6 étendu, AD-14)** — NutriClaude injoignable (Realtime perdu, échec refresh JWT, fetch en erreur) → **`OfflinePill` « Hors ligne »** + **dernier compteur connu**, **jamais de blanc ni de spinner**. Le dernier bon état est gardé dans une **ref éphémère** (pas de cache persistant — miroir `useEntityValue`/AD-3).
8. **Token `accent-courses`** — ajouté au design system : `--color-accent-courses: #ff6faf` dans le bloc `@theme` de `src/index.css` + règle `.device-tile[data-domain="courses"] { --tile-accent: var(--color-accent-courses); }`. **Non-vert** (vert réservé sécurité), distinct des accents existants (UX-DR18).
9. **Gates verts** — `tsc -b --noEmit`, `oxlint`, **build sans secret**, et `vitest` passent. Tests neufs : resolver config (pur), formatage du résumé tuile (pur), tuile (client Supabase **mocké**, les 3 états). Pas de régression sur les 223 tests existants.

## Tasks / Subtasks

- [ ] **Tâche 1 — Dépendance + seam config (AC: 1, 2)**
  - [ ] `npm i @supabase/supabase-js` (v2, `^2.45` confirmé côté NutriClaude par le spike ; prendre la dernière 2.x stable).
  - [ ] Créer `src/nutriclaude/config.ts` : `resolveNutriConfig({ url, anonKey, isProd })` pur → `{ supabaseUrl, supabaseAnonKey, isConfigured }`, appliqué à `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Exporter `nutriIsConfigured`. **Ne jamais** lire ou référencer `service_role`.
  - [ ] `src/nutriclaude/index.ts` (barrel) — exports publics du seam. Vérifier **zéro import** de/vers `src/hakit/`.
- [ ] **Tâche 2 — Client + session cuisine (AC: 3)**
  - [ ] `src/nutriclaude/client.ts` : singleton `createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })`.
  - [ ] Bootstrap de session : `signInWithPassword` avec les identifiants cuisine (dev : `.env.local`). Exposer un statut de connexion (connecté / non authentifié / erreur) consommable par le hook d'obsolescence.
  - [ ] Étendre le garde de `vite.config.ts` (bloc `command === "build"`) : `loadEnv(..., "VITE_NUTRICLAUDE")` puis **throw** si `VITE_NUTRICLAUDE_CUISINE_PASSWORD` est défini pour un build prod (message calqué sur le garde `VITE_HA_TOKEN`).
  - [ ] `.env.example` : ajouter `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (config publique) + un **commentaire** disant que le mot de passe cuisine ne se met **pas** en `VITE_…` pour un build prod (login de setup one-time ; cf. `docs/nutriclaude.md`).
- [ ] **Tâche 3 — Lecture + Realtime/polling (AC: 4, 5)**
  - [ ] `src/nutriclaude/queries.ts` : `getGrocerySummary()` → `{ pendingCount, lastAdded: {name, addedBy, createdAt}[] }`. Compteur via `.select('id',{count:'exact',head:true}).eq('status','pending')` ; aperçu via `.select('name, added_by, created_at').eq('status','pending').order('created_at',{ascending:false}).limit(N)`. **Résoudre `added_by` → prénom** (voir Question ouverte n°2).
  - [ ] `src/nutriclaude/useGrocerySummary.ts` : hook renvoyant `{ pendingCount, lastAdded, since, isStale, loading }` (**forme miroir de `EntityValue`**). Abonnement Realtime (`supabase.channel(...).on('postgres_changes', { table:'grocery_list_items' }, refetch)`) **+ fallback polling** 15-30 s ; dernier bon état en **ref éphémère**.
  - [ ] `src/nutriclaude/stale.ts` (ou réutiliser `formatSince` de `hakit/stale`) : `isStale` pour source non-HA = déconnecté Realtime **ou** échec JWT/fetch. **NE PAS importer depuis `hakit/`** si ça crée un couplage ; dupliquer `formatSince` si besoin (petite fonction).
- [ ] **Tâche 4 — Token accent + tuile (AC: 6, 7, 8)**
  - [ ] `src/index.css` : ajouter `--color-accent-courses: #ff6faf` dans `@theme` + la règle `.device-tile[data-domain="courses"]`.
  - [ ] `src/widgets/CoursesTile.tsx` : **cloner la structure de `RoomSensorCard`** (device-tile, 3 états, `TileHeader`, `Skeleton`, `OfflinePill`, `tabular-nums`). `onOpen` → `navigate('/courses')` (la route est livrée en 8.2 ; en 8.1, un placeholder de route ou un no-op documenté suffit — **ne pas** 404). Teinte active via `data-domain="courses"` quand `pendingCount > 0`.
  - [ ] Placement accueil : tuile de **coordination groupée avec l'Ambiance** (UX-DR19, défaut ajustable) — l'insérer dans `src/pages/Home.tsx`. Monter le provider/contexte NutriClaude indépendamment de `HakitProvider` (voir Question ouverte n°3).
- [ ] **Tâche 5 — Tests + gates (AC: 9)**
  - [ ] Tests purs : `resolveNutriConfig` (dev/prod, avec/sans secret) ; formatage du résumé (compteur, « +N », horodatage relatif).
  - [ ] Test tuile : client Supabase **mocké** → 3 états (loading / offline avec dernier connu + pill / live avec compteur + aperçu) ; teinte active seulement si `pendingCount > 0`.
  - [ ] Lancer `npm run typecheck` + `oxlint` + build **sans** `.env.local` + `vitest` → tout vert, 0 régression.

## Dev Notes

### Architecture — le seam NutriClaude est un miroir du seam HA, transport différent

Le dashboard a **déjà** un seam de backend : `src/hakit/`. Story 8.1 en crée un **second, isolé** pour NutriClaude. **Réutilise les mêmes formes, ne réinvente pas** :

| Besoin | Modèle HA existant (à imiter) | À créer pour NutriClaude |
|---|---|---|
| Config depuis env, pure & testable | `src/hakit/config.ts` (`resolveHassConfig` → `{hassUrl, hassToken, isConfigured}`) | `src/nutriclaude/config.ts` (`resolveNutriConfig` → `{supabaseUrl, supabaseAnonKey, isConfigured}`) |
| Connexion/seam | `src/hakit/HakitProvider.tsx` (`HassConnect`) | `src/nutriclaude/client.ts` (`createClient`) + bootstrap session |
| Lecture + obsolescence par entité | `src/hakit/useEntityValue.ts` (`EntityValue { value, isStale, loading, since }`) | `src/nutriclaude/useGrocerySummary.ts` (**même forme de retour**) |
| Détection stale | `src/hakit/stale.ts` (`isStale`, `formatSince`) | équivalent non-HA (Realtime perdu / JWT échec) |
| Garde secret hors prod | `vite.config.ts` (throw si `VITE_HA_TOKEN` en build) | **étendre** le même garde pour le mot de passe cuisine |

**Isolation stricte (AD-2/AD-12)** : `src/nutriclaude/` ne doit **jamais** importer `@hakit/*` ni `src/hakit/*`, et réciproquement. Pas de store commun. `formatSince` est trivial — si l'importer depuis `hakit/stale` gêne l'isolation, **duplique-le** (3 lignes) plutôt que de coupler les couches.

### La tuile = clone de `RoomSensorCard` (le moule device-tile à 3 états)

`src/widgets/RoomSensorCard.tsx` est le patron canonique : `button` → `bg-tile-fill border rounded-md`, `TileHeader` en haut, **hauteurs de lignes fixes** (loading/offline/live occupent la même empreinte — évite le CLS), `Skeleton` en loading, `OfflinePill` en offline, `tabular-nums` sur les nombres. **Copie cette ossature** pour `CoursesTile` ; seule la **source de données** change (`useGrocerySummary` au lieu de `useEntityValue`).
- États : `loading` (jamais connecté, rien à montrer → skeleton) · `offline` (`isStale` avec dernier connu → `OfflinePill`) · `live` (compteur + aperçu). Mappe exactement la logique `loading`/`offline` de `RoomSensorCard` (lignes 56-63).
- `TileHeader` (`src/ui/TileHeader.tsx`) : passe `onOpen` pour que le titre/tuile tape vers `/courses` (`openLabel` pour l'a11y). Icône panier (ajouter un SVG local façon `WeatherIcon`).
- Teinte active : le mécanisme d'accent existe déjà — `.device-tile[data-domain="…"]` pose `--tile-accent` et l'état « on » en dérive tint/border/glow (`src/index.css` ~104-131). Ajoute `data-domain="courses"` et l'accent rose. `RoomSensorCard` n'utilise PAS ce mécanisme (il pose `bg-tile-fill` en dur) — pour la teinte active de Courses, préfère le mécanisme `.device-tile` (cohérent avec `LightTile`/`ClimateTile`).

### Obsolescence pour une source non-HA (AD-6 étendu, AD-14)

`useEntityValue` (`src/hakit/useEntityValue.ts`) est le modèle exact : garde le **dernier bon état dans une `ref`** (capturé en `useEffect`, jamais muté en render), expose `isStale` + `since`, distingue `loading` (rien vu) d'`offline` (dernier connu + pill). **Réplique ce comportement** dans `useGrocerySummary` : `isStale` = Realtime déconnecté **ou** échec refresh JWT **ou** dernière requête en erreur. Réutilise `OfflinePill` (`src/ui/OfflinePill.tsx`, prend `since` ISO → « Hors ligne · dernière donnée HH:MM »). **Pas de cache persistant** (miroir AD-3) : la ref est en mémoire de session uniquement.

### Auth & secrets (AD-13, T0.5)

- **Clé `anon` + URL** = config publique (sûres, bornées par la RLS) → `VITE_…` en build-time, OK.
- **Mot de passe cuisine** = ne doit **jamais** être inliné dans `dist/`. En **dev**, on l'accepte via `.env.local` gitignoré (comme `VITE_HA_TOKEN`) ; le **garde `vite.config.ts`** (déjà là pour le token HA, lignes ~20-31) doit **throw** si un `VITE_NUTRICLAUDE_CUISINE_PASSWORD` est présent pour un `command === "build"`. En **prod**, le login cuisine est une action de **setup one-time** (la session persiste ensuite au runtime). Détail dans `docs/nutriclaude.md`.
- **Jamais `service_role`** nulle part dans le client.

### Realtime OFF aujourd'hui → polling indispensable en 8.1

La publication `supabase_realtime` est **vérifiée à 0 table (OFF)** en prod (2026-07-20) ; l'activer est un **Task 0** de Florian (hors app). Donc **8.1 doit fonctionner sans Realtime** : implémente le **polling (15-30 s) comme baseline** + l'abonnement Realtime qui prend le relais quand la publication sera activée. Ne suppose pas Realtime actif.

### Bord dur — pas d'`updated_at`, régénération de menu

`grocery_list_items` n'a **pas d'`updated_at`** → la convergence se fait par **refetch/Realtime**, pas par timestamp. La RPC `generate_grocery_list_from_menu` **supprime tout le `pending` en bloc** puis régénère : traite la liste comme **remplaçable en bloc**, ne garde pas d'état local qui contredirait le serveur (pertinent surtout en 8.3, mais le hook de 8.1 doit re-fetcher proprement après un événement Realtime de suppression massive).

### Testing standards

Vitest + Testing Library (setup `src/test/setup.ts`, 223 tests verts aujourd'hui). Les widgets HA mockent `@hakit` ; ici, **mocke le client Supabase** (`src/nutriclaude/client.ts`) dans les tests de tuile/hook. Garde les fonctions **pures** (`resolveNutriConfig`, formatage résumé) séparées et testées directement (comme `resolveHassConfig` / `room-sensor-format`). Le **build sans secret** doit passer (gate CI) → `nutriIsConfigured === false` rend un état propre.

### Project Structure Notes

- Nouveau dossier **`src/nutriclaude/`** : `config.ts`, `client.ts`, `queries.ts`, `useGrocerySummary.ts`, `stale.ts` (ou réutilisation), `index.ts`. Convention alignée sur `src/hakit/` (barrel `index.ts`, resolver pur + consts).
- Nouveau widget **`src/widgets/CoursesTile.tsx`** (+ test `.test.tsx`) — les widgets vivent dans `src/widgets/`, les composants d'UI partagés dans `src/ui/`.
- Modifs : `src/index.css` (token accent), `src/pages/Home.tsx` (placement tuile), `vite.config.ts` (garde secret), `.env.example` (vars publiques). Route `/courses` = story 8.2 ; en 8.1 le `onOpen` ne doit pas mener à un 404 (placeholder ou route stub documentée).
- **Montage du provider NutriClaude** : indépendant de `HakitProvider` (App.tsx monte `HakitProvider` autour d'`AppRoutes` quand `isConfigured`). Voir Question ouverte n°3.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.1] (user story, AC, périmètre tracer bullet)
- [Source: prds/prd-home-dashboard-2026-07-20/prd.md#4.2] + FR-1, FR-5
- [Source: architecture/architecture-home-dashboard-2026-07-20/ARCHITECTURE-DELTA-V2.md] — AD-12 (source/accès), AD-13 (auth/secrets), AD-14 (optimiste+obsolescence hors transport), AD-15 (pattern rituel), « Design d'accès Courses », « Vérification live »
- [Source: ux-designs/ux-home-dashboard-2026-07-20/UX-DELTA-V2.md] — accent-courses #ff6faf (UX-DR18), Tuile Courses accueil (UX-DR19)
- [Source: spikes/spike-nutricloud-kiosk-2026-07-20.md] — auth email+password, RLS stricte, anon-only, pas d'Edge Function, Realtime OFF, pas d'updated_at, patterns `client.ts`/`queries.ts`/`types.ts`/`actions.ts`
- [Source: docs/nutriclaude.md] — Task 0 + contrat d'interface (schéma, vue, RLS, écritures) + sécurité
- [Source: src/hakit/config.ts] — resolver pur + consts (à imiter)
- [Source: src/hakit/HakitProvider.tsx] — seam de connexion (à imiter)
- [Source: src/hakit/useEntityValue.ts] — forme `EntityValue` + dernier-connu en ref (à imiter)
- [Source: src/hakit/stale.ts] — `isStale` / `formatSince`
- [Source: src/widgets/RoomSensorCard.tsx] — moule device-tile 3 états (à cloner)
- [Source: src/ui/TileHeader.tsx], [src/ui/OfflinePill.tsx], [src/ui/Skeleton.tsx] — composants partagés à réutiliser
- [Source: src/pages/Home.tsx] — grille d'accueil (placement)
- [Source: src/App.tsx] — montage des providers / routes (HashRouter)
- [Source: src/index.css#@theme] — tokens d'accent + mécanisme `.device-tile[data-domain]`
- [Source: vite.config.ts] — garde secret AD-8/T0.5 (à étendre)

### Questions ouvertes / décisions à confirmer (à trancher avant/pendant le dev)

1. **Auth prod (setup one-time)** — le login cuisine en prod : écran de setup dédié dans l'app, ou pré-provisionner la session `localStorage` au setup de l'iPad ? (AD-13 dit « login une fois, session persiste ».) Pour l'itération 8.1 sur l'iPad de Florian, le chemin dev-creds suffit à la preuve device ; l'écran de setup prod peut être un follow-on. **À confirmer : est-ce dans le périmètre de 8.1 ou une story 8.x dédiée ?**
2. **Provenance `added_by` → prénom** — `grocery_list_items.added_by` est un `uuid` (auth.users). Afficher le **prénom** (UX-DR21 `display_name`) demande de résoudre via `profiles`. Options : embedding PostgREST `.select('…, profiles!added_by(display_name)')` si la FK existe, une vue, ou un lookup séparé. **À vérifier côté schéma NutriClaude** (le spike mentionne `profiles`/`getCurrentProfile`). Repli acceptable si bloquant : afficher l'aperçu **sans** le prénom en 8.1 et compléter en 8.2.
3. **Point de montage du provider NutriClaude** — la tuile vit dans `Home` (sous `HakitProvider` quand HA configuré). Le client NutriClaude doit rester **isolé** de HA mais accessible à la tuile. Proposition : un `NutriClaudeProvider` (contexte du client + statut session) montant autour d'`AppRoutes` **indépendamment** de `HakitProvider`, jamais imbriqué pour un état partagé. **À valider à l'implémentation.**

## Dev Agent Record

### Agent Model Used

_(à remplir par l'agent dev)_

### Debug Log References

### Completion Notes List

### File List
