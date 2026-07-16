---
baseline_commit: b8e8f3a737031e5961a030b7d4af4795aaa0d3cd
---

# Story 5.3: Page détail « Aspirateur » (Roborock)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Florian,
I want une page dédiée à l'aspirateur (état, batterie, nettoyage en cours, consommables, alertes) que j'ouvre depuis sa tuile,
so that j'ai le suivi complet du Roborock sans ouvrir son app — sans encombrer l'accueil glanceable.

## Contexte & valeur

Ajoutée en **correct-course** (2026-07-16) : c'est la **maison naturelle** des ~30 champs Roborock **volontairement gardés hors** de la tuile glanceable (Story 2.7, décision « status + batterie seulement »). Première **page profonde par appareil** — extension du thème « pages de détail » d'Epic 5 (AD-10 : accueil + pages profondes), à côté du Détail de pièce (5.1/5.2).

**Décisions produit (Florian, 2026-07-16) :**
1. **Jeu curé** (pas un dump). Sections : **Carte** · **Programmes** (boutons lançables : « Après le repas », « Quotidien », …) · **Consommables** · État & batterie · Nettoyage en cours · Alertes. **Exclus** : Activity, compteurs bruts « totaux », timers négatifs affichés tels quels. _(Mise à jour : la **carte** et la **liste des programmes** sont désormais IN — demandées explicitement par Florian ; ne plus les exclure.)_
2. **Créée puis parquée** : `ready-for-dev`, **pas** développée maintenant (Epic 2 / base Détail-de-pièce d'abord — routing/patterns à mutualiser).
3. **Programmes multiples** : sur l'accueil (2.7), « Lancer » = **Quotidien** (défaut) ; ici, **tous les programmes** sont listés et lançables (chacun un `button` HA). Cohérent, pas contradictoire.

## Acceptance Criteria

1. **Ouverture depuis la tuile (AD-10).**
   **Given** la tuile « Aspirateur » sur l'accueil (Story 2.7)
   **When** je **tape la tuile** (zone hors des boutons d'action Lancer/Arrêter/Retour base)
   **Then** une **page dédiée** `/aspirateur` s'ouvre (navigation peu profonde, un niveau) **et** un retour **« ‹ Accueil »** y ramène.
   **And** les boutons d'action de la tuile continuent de piloter (le tap-détail ne les capture pas — cf. `RoomSensorCard` qui navigue sans casser).

2. **Contrôles + programmes (réutilise 2.7).**
   **Given** la page `/aspirateur`
   **When** elle s'affiche
   **Then** les **contrôles** de base (Arrêter / Retour base) pilotent en **optimiste + convergence** (AD-5) via `useOptimisticControl(vacuumModel)` — **aucune logique dupliquée** ;
   **And** une section **Programmes** liste les routines disponibles (« Après le repas », « Quotidien », …), chacune un **`button` HA lançable** (press → démarre ; retour visuel optimiste `cleaning`, comme le « Lancer » de 2.7).

3. **Carte + infos curées (obsolescence par champ, AD-6).**
   **Given** les entités Roborock mappées (capteurs + carte)
   **When** je consulte la page
   **Then** sont affichés, groupés et lisibles :
   - **Carte** — l'image de carte de l'aspirateur (entité `image`/`camera` Roborock — voir Dev Notes pour la source & AD-2) ;
   - **État & batterie** — statut (label FR), batterie % (coloré), en charge ;
   - **Nettoyage en cours** — progression %, surface (m²), durée, pièce actuelle ;
   - **Consommables** — temps restant brosse principale / brosse latérale / filtre / capteurs (valeur ≤ 0 → **« à remplacer »**, pas un nombre négatif brut) ;
   - **Alertes** — erreur, pénurie d'eau, réservoir d'eau / serpillière fixés.
   **And** toute valeur obsolète/indisponible (y compris la carte) relève du **pattern d'obsolescence** (dernière valeur + « Hors ligne » ou `—`, **jamais de blanc** — AD-6, via `useEntityValue`/`isStale`).

4. **Réutilisation + gates verts.**
   **Given** la page + le mapping
   **When** je termine
   **Then** contrôles/état/label/batterie **réutilisent** l'existant 2.7 (`useOptimisticControl`, `vacuumModel`, `vacuumStatusLabel`, `batteryColorClass`, `parseBattery`) — zéro duplication ; tous les `entity_id` vivent dans `src/entities/` (AD-7) ; `build`+`typecheck`+`lint`+`test` **verts** ; **0 token** dans `dist/`.

## Tasks / Subtasks

- [x] **Task 0 — entity_ids Roborock : FOURNIS par Florian (2026-07-16)** ✅
  entity_ids **réels confirmés** à mapper (Task 1) :
  - **carte** : `image.salon_roborock_s8_map_0` (entité **image** → `attributes.entity_picture`, cf. Task 3c ; **⚠️ le token de l'URL se lit au RUNTIME, jamais en dur/commité**)
  - **programmes** (`button`) : `button.salon_roborock_s8_quotidien` (« Quotidien ») · `button.salon_roborock_s8_apres_les_repas` (« Après les repas »)
  - **batterie** : `sensor.roborock_s8_batterie` (déjà mappé, 2.7) ✅ · **en charge** : `binary_sensor.salon_roborock_s8_en_charge` · **état** : `sensor.roborock_s8_etat` (ou l'état du `vacuum.roborock_s8`)
  - **nettoyage en cours** : surface `sensor.roborock_s8_surface_de_nettoyage` · durée `sensor.roborock_s8_duree_de_nettoyage` · pièce `sensor.salon_roborock_s8_piece_actuelle` · nettoyage en cours `sensor.roborock_s8_nettoyage_en_cours` _(⚠️ pas de capteur « progression % » distinct dans la liste — vérifier si c'est un attribut ou l'un de ces sensors ; sinon omettre la progression)_
  - **consommables** : `sensor.roborock_s8_temps_restant_brosse_principale` · `..._brosse_laterale` · `..._filtre` · `..._capteurs`
  - **alertes** : erreur `sensor.roborock_s8_erreur_aspirateur` · pénurie d'eau `binary_sensor.roborock_s8_penurie_d_eau` · réservoir `binary_sensor.roborock_s8_reservoir_d_eau_fixe` · serpillière `binary_sensor.roborock_s8_serpilliere_fixee` _(bonus dispo : `binary_sensor.roborock_s8_dock_sechage_de_la_serpilliere`)_
  - **Hors scope curé (dispo mais NON mappés)** : `sensor.duree_totale…`, `…_surface_de_nettoyage_totale`, `…_nombre_total_de_nettoyages`, `…_debut/fin_du_dernier_nettoyage`, `number.volume`, `select.*`, `switch.securite_enfant`/`ne_pas_deranger`, `time.*`. (Ne pas mapper sauf demande.)

- [x] **Task 3b — Programmes lançables** (AC: 2) — **TDD (composant)**
  - [x] Mapper la **liste des `button` programmes** (au même endroit que `startButtonEntityId`, AD-7 — ex. `programButtonEntityIds: { label, entityId }[]` sur l'entrée vacuum, libellés FR « Après le repas »/« Quotidien »).
  - [x] Section **Programmes** : un bouton ≥48px par programme → `useService('button').press({ target })` (patron 2.7) + retour optimiste `cleaning` (`send('cleaning')` sur le vacuum). État obsolète → non interactif.
  - [x] Test : rendu d'un bouton par programme ; clic → press du bon `entity_id`.

- [x] **Task 3c — Carte** (AC: 3) — **entité `image` (confirmé) → voie simple, PAS de helper caméra**
  - [x] `image.salon_roborock_s8_map_0` : `useEntity(id).attributes.entity_picture` = URL relative HA (`/api/image_proxy/…?token=…`) → `<img src={entity_picture} alt="Carte aspirateur">`. Servi **même origine** depuis HA (AD-9).
  - [x] **🔒 SÉCURITÉ (T0.5/AD-8)** : l'`entity_picture` contient un **token signé** régénéré par HA. **Le lire au RUNTIME depuis `useEntity`** ; **NE JAMAIS** le coder en dur, le committer, ni le mettre dans le mapping (le mapping ne contient que l'`entity_id` `image.salon_roborock_s8_map_0`). Ne pas bundler de token (garde AD-8).
  - [x] Obsolescence (AD-6) : `entity_picture` absent / entité obsolète → placeholder « Carte indisponible », jamais de blanc.
  - [x] `image` = entité HA standard via `@hakit` `useEntity` (AD-2) — **aucun** helper média caméra requis (ce n'est pas une `camera`). L'exception AD-2 reste réservée à FR8/Epic 4.

- [x] **Task 1 — Mapper les capteurs de détail** (AC: 3, 4)
  - [x] `src/entities/mapping.ts` : exposer les capteurs de détail de l'aspirateur **au même endroit** que le reste (AD-7). Option recommandée : un champ structuré sur l'entrée vacuum (ex. `detailSensors?: Record<string,string>` mappant clé logique → `entity_id`) **ou** une petite liste dédiée + accesseur `vacuumDetailSensors()`. Choisir la forme la plus cohérente avec `batteryEntityId`/`startButtonEntityId` (2.7). Ne pas coder d'`entity_id` hors `entities/`.

- [x] **Task 2 — Route + tuile tappable** (AC: 1)
  - [x] `src/App.tsx` : ajouter la route `/aspirateur` (AD-10, comme `/room/:roomId`). Élément = `VacuumDetail` (nouvelle page).
  - [x] `src/widgets/VacuumTile.tsx` : rendre la **zone tuile** tappable → `useNavigate('/aspirateur')` (patron `RoomSensorCard`), **sans** capturer les clics des boutons Lancer/Arrêter/Retour base (`e.stopPropagation()` sur les boutons, ou structure où les boutons ne sont pas dans la zone navigable). Vérifier a11y (la tuile devient un élément navigable + boutons imbriqués — attention au `<button>` dans `<button>` : utiliser un conteneur cliquable non-`button` + `role`/`onClick`, ou un lien).

- [x] **Task 3 — Page `VacuumDetail`** (AC: 1, 2, 3) — **TDD (composant)**
  - [x] `src/pages/VacuumDetail.tsx` : **contenu seul** (le ground + TopBar appartiennent à `KioskShell`, cf. TD-1 — comme `RoomDetail`). En-tête « ‹ Accueil » (`useNavigate('/')` ou `<Link>`).
  - [x] **Contrôles** : réutiliser la logique 2.7 — idéalement **extraire** les contrôles de `VacuumTile` en un composant/hook partagé (`useVacuumControl` ou `<VacuumControls/>`) pour que tuile **et** page les partagent (DRY — pas deux implémentations du Lancer/Quotidien+optimiste). Sinon, réutiliser `useOptimisticControl(vacuumModel)` + le même `send`/press bouton.
  - [x] **Sections curées** (état/batterie via `vacuumStatusLabel`/`batteryColorClass`/`parseBattery` ; nettoyage ; consommables avec « à remplacer » si ≤ 0 ; alertes). Chaque valeur lue via `useEntityValue` (obsolescence AD-6) — **pas** de lecture live sans gestion `stale`.
  - [x] Helper pur `consumableLabel(secondsLeft)` (jours restants, ou « à remplacer » si ≤ 0) — testable, comme `vacuumStatusLabel`.
  - [x] Test composant (mock `@hakit`) : rendu des sections + « à remplacer » sur timer négatif + « ‹ Accueil » navigue + un capteur obsolète → pattern obsolescence.

- [x] **Task 4 — Validation (gates)** (AC: 4)
  - [x] `build` (sans token) + `typecheck` + `lint` + `test` **verts** ; 0 `entity_id` en dur hors `entities/` (code non-test) ; 0 token dans `dist/`.
  - [ ] **⏳ Preuve device (Florian, review)** : tap tuile → `/aspirateur` ; contrôles OK ; sections affichent les vraies valeurs ; « à remplacer » sur consommable dû ; retour Accueil ; capteur coupé → obsolescence.

## Dev Notes

**Portée stricte.** Page **profonde par appareil** (curée) : carte + programmes + consommables + état/batterie + nettoyage + alertes, route + tuile tappable. **Hors scope — NE PAS construire :**
- **Activity, compteurs « totaux » bruts, timers négatifs affichés tels quels** → exclus (curation Florian). _(Carte & programmes : désormais IN — cf. Décisions.)_
- **Helper média caméras générique (AD-2 / FR8 / Epic 4)** → ne PAS le construire ici. Si la carte est une entité `camera` nécessitant `camera_proxy`, c'est une **dépendance Epic 4**, pas un dev ad-hoc (surface le choix, cf. Task 3c).
- **Historique/courbes** (comme 5.2 pour les pièces) → non demandé ici ; possible v-ultérieure.
- **Réglage `fan_speed` / clean_spot / locate** → hors ACs (2.7 déjà : start/stop/return uniquement). Ne pas ajouter.
- **Généraliser la page en « device detail » générique** → non ; page spécifique aspirateur. La généralisation viendra si d'autres appareils veulent une page.

**Dépendance bloquante (Task 0) :** les `entity_id` des capteurs Roborock. **Parquée** : à fournir au moment du dev. Ne pas inventer (leçon 2.7 : `battery` EN → `batterie` FR ; les libellés FR de l'intégration donnent des slugs FR).

**Continuité (Story 2.7, done — commit `b8e8f3a`).**
- **`VacuumTile` (`src/widgets/`)** : tuile glanceable (statut + batterie + Lancer/Arrêter/Retour base). Ici : la rendre **tappable** vers `/aspirateur` sans casser les boutons. Réutiliser — ne pas réécrire — sa logique de contrôle (idéalement l'extraire en partagé).
- **`vacuumModel` + `useOptimisticControl` (`src/state/`, `src/hakit/`)** : contrôles optimistes ; `returning` transitionnel. Réutilisés tels quels.
- **`vacuum-status.ts` (`src/widgets/`)** : `vacuumStatusLabel`, `parseBattery`, `batteryColorClass` — réutiliser pour l'état/batterie de la page.
- **`useEntityValue` / `isStale` / `OfflinePill` (1.6)** : chaque champ de la page passe par là (AD-6, jamais de blanc).
- **Mapping vacuum (2.7)** : `batteryEntityId` / `startButtonEntityId` déjà là ; ajouter les capteurs de détail au même endroit (AD-7).
- **`RoomDetail` / route `/room/:roomId` (`src/pages/`, `src/App.tsx`)** : patron de **page profonde contenu-seul** (ground/TopBar = `KioskShell`, TD-1). `RoomSensorCard` : patron de **tuile tappable** (`useNavigate`). Réutiliser ces deux patrons.
- **Router** : `react-router-dom` 7 (`BrowserRouter`, `Routes`/`Route`, `useNavigate`, `useParams`) — déjà en place.

**Relation 5.1 (Détail de pièce) :** 5.1 et 5.3 partagent le **pattern de page profonde** (route + contenu-seul + retour Accueil). Si 5.1 est développé d'abord, en extraire un layout partagé (`<DetailPage title back>`), réutilisé ici. Sinon 5.3 le pose. À noter au dev de celui construit en premier.

**@hakit :** capteurs = `useEntity('sensor.…')` → `.state` (+ `.attributes.unit_of_measurement`). Erreur/alertes : soit un `sensor.…_erreur` (state), soit l'attribut d'erreur du vacuum (`vacuum.roborock_s8` `attributes`). À confirmer selon les entités réelles (Task 0).

**Tests :** helpers purs (`consumableLabel`) unitaires ; page en composant avec mock `@hakit` (patron `RoomSensorCard.test`/`VacuumTile.test`), reset `usePendingStore`. Navigation testée via `MemoryRouter` + `Routes` (patron `RoomSensorCard.test`). Gate : `verbatimModuleSyntax`/`noUnusedLocals`.

### Project Structure Notes

- **NEW** : `src/pages/VacuumDetail.tsx` (+ `.test.tsx`) ; helper `consumableLabel` (dans `vacuum-status.ts` ou un `vacuum-detail.ts` + test) ; éventuel `<VacuumControls/>`/`useVacuumControl` extrait (partagé tuile↔page).
- **UPDATE** : `src/App.tsx` (route `/aspirateur`), `src/widgets/VacuumTile.tsx` (tappable), `src/entities/mapping.ts` (+ `.test.ts`) (capteurs de détail), `_bmad-output/implementation-artifacts/sprint-status.yaml` (5-3 → in-progress → review).
- **Placement / direction de dépendance** : `pages/VacuumDetail` → `widgets`/`hakit`/`state`/`entities`. Page = contenu-seul (ground/TopBar = shell, TD-1).
- **Style** : Tailwind/TailAdmin ; accent violet (`data-domain="vacuum"`) ; cibles ≥48px ; texte+icône ; densité OK sur une page profonde (contrairement à l'accueil glanceable).

### Décisions ouvertes / dépendances

- **entity_ids (Task 0)** — bloquant, à fournir au dev (parqué).
- **Ordre vs 5.1** — qui pose le layout de page profonde partagé.
- **Bouton « Quotidien »** (`button.salon_roborock_s8_quotidien`) — encore à confirmer (suivi 2.7).
- **Forme mapping des capteurs de détail** — champ structuré sur l'entrée vacuum vs liste dédiée (choix dev, cohérent AD-7).

### References

- [Source: epics.md#Story 5.3 (page détail Aspirateur — correct-course 2026-07-16) · #Story 5.1/5.2 (patron page profonde) · #AD-10 (accueil + pages profondes)]
- [Source: ARCHITECTURE-SPINE.md#AD-10 (modèle d'écran, pages profondes) · #AD-5 (contrôles optimistes) · #AD-6 (obsolescence par entité) · #AD-7 (mapping entity_id) · #AD-2 (accès @hakit)]
- [Source: DESIGN.md#accent-vacuum (violet) · a11y (≥48px, texte+icône)]
- [Source: EXPERIENCE.md#Information Architecture (pages profondes, retour Accueil)]
- [Source: Story 2.7 (done, `b8e8f3a` — `VacuumTile`, `vacuumModel`, `vacuum-status` helpers, mapping vacuum, décision « tuile glanceable, détail ailleurs ») · Story 1.6 (`useEntityValue`/obsolescence) · Story 1.3/1.5 (route `/room`, `RoomDetail` contenu-seul, `RoomSensorCard` tappable)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Liza Pairing mode, Autonomous — Amelia dev-story).

### Debug Log References

- **Carte = entité `image`** (confirmé Florian) : `useEntity(mapId).attributes.entity_picture` → `<img src>`. **🔒 Token lu au RUNTIME uniquement** — jamais écrit dans le repo (vérifié : `rg` du token = 0 hit ; mapping ne contient que l'`entity_id`). Pas de helper caméra (AD-2 exception réservée à Epic 4).
- **Config détail hors `EntityEntry`** : `VacuumDetail` (interface + `VACUUM_DETAIL` + `vacuumDetail()`) dans `mapping.ts` — tous les ids groupés (carte/programmes/nettoyage/consommables/alertes), plus propre que gonfler `EntityEntry`.
- **Tuile tappable sans imbrication de boutons** : la zone info (Header + statut/batterie) devient un `<button>` → `/aspirateur` ; les boutons d'action sont **frères** (pas imbriqués) — a11y OK, le tap-détail ne capture pas les actions.
- **`VacuumDetailContent` exporté** (séparé du garde `isConfigured`) pour être testable sous mock `@hakit` sans dépendre de l'env.
- **Progression %** : pas de capteur distinct dans la liste réelle → **omise** (surface/durée/pièce affichés à la place), comme flaggé.
- **Champs via sous-composant `<Field>`** (chacun son `useEntity`) : hooks localisés/stables ; obsolète → `—` (AD-6, jamais de blanc).

### Completion Notes List

- **AC1–AC4 satisfaits (automatisable).** Route `/aspirateur` (AD-10) ; tuile Aspirateur tappable → détail (actions préservées) ; page contenu-seul (TD-1) avec retour « ‹ Accueil » ; sections **Carte** (image runtime) · **Programmes** (Quotidien / Après les repas, `button.press` + optimiste) · **Contrôles** (Arrêter/Retour base, réutilise `useOptimisticControl(vacuumModel)` sans duplication) · **Nettoyage** · **Consommables** (« À remplacer » si ≤ 0, sinon jours) · **Alertes** (Oui/Non, erreur→Aucune). **98 tests verts** (+9), typecheck/lint/build (sans token) verts, **0 token** (ni AD-8 ni le token carte) dans le repo/`dist/`, ids uniquement dans `entities/`.
- **Réutilisation** : contrôles/état/label/batterie 100 % réutilisés de 2.7 ; nouveau helper pur `consumableLabel` (testé). Zéro logique de contrôle dupliquée.
- **Preuve device (Florian) = review** : tap → `/aspirateur`, carte s'affiche, programmes lancent, consommables « à remplacer », retour Accueil, capteur coupé → `—`. Non observable côté agent.

### File List

**Créés :**
- `src/pages/VacuumDetail.tsx`, `src/pages/VacuumDetail.test.tsx`

**Modifiés :**
- `src/entities/mapping.ts` (`VacuumDetail` interface + `VACUUM_DETAIL` + `vacuumDetail()` accessor)
- `src/widgets/vacuum-status.ts` (+ `.test.ts`) : `consumableLabel`
- `src/widgets/VacuumTile.tsx` (+ `.test.tsx`) : zone info tappable → `/aspirateur` (actions préservées)
- `src/App.tsx` : route `/aspirateur`
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (5-3 → in-progress → review)

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-16 | 1.0 | **Accepté par Florian → Status: done.** Page détail Aspirateur + layout paysage 2 colonnes (carte 2/3 · actions+détails 1/3), viewport verrouillé sans scroll (iPad Pro 9.7"). 98 tests verts. **Preuve visuelle device à confirmer par Florian au déploiement** (rendu carte, ajustement colonnes). |
| 2026-07-16 | 0.2 | **Optimisation résolution cible (Florian, iPad Pro 9.7" = 1024×768 paysage, jamais scroller).** `KioskShell` (App.tsx) verrouillé au viewport (`h-dvh` + `overflow-hidden`). `VacuumDetail` **sans sections** (SectionCard retirés) → **grille paysage 3 colonnes de tuiles givrées** (carte · programmes+contrôles · nettoyage/consommables/alertes) tenant sans scroll. Mémoire projet ajoutée (`target-device-and-layout`). Gates verts (98 tests). **Rendu visuel à valider sur l'iPad par Florian.** |
| 2026-07-16 | 0.1 | Page détail Aspirateur (Story 5.3, AD-10) : route `/aspirateur` + tuile tappable ; page contenu-seul avec Carte (image `entity_picture` runtime, token jamais stocké) · Programmes lançables (`button.press` + optimiste) · Contrôles (réutilise `useOptimisticControl`/`vacuumModel`) · Nettoyage · Consommables (`consumableLabel` : « À remplacer »/jours) · Alertes (Oui/Non, erreur→Aucune). Config détail (`VACUUM_DETAIL`) dans `mapping.ts` (AD-7). 98 tests verts, typecheck/lint/build (sans token) verts, 0 token dans repo/`dist/`. Preuve device en attente (review). → review. |
