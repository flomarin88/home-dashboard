---
baseline_commit: d54f7c67ba4bef831651a9eecc40d84e0ba51edc
---

# Story 2.6: Climatisation — étage

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Florian,
I want piloter la climatisation de l'étage depuis l'accueil — voir son état (mode, consigne, température ambiante, ventilation), l'allumer/l'éteindre, régler la consigne (−/+), changer de mode (chaud/froid/auto), la ventilation (fan) et l'oscillation (swing),
so that je règle le confort thermique de l'étage sans ouvrir une autre app.

## Contexte & valeur

Première tuile de pilotage à **attributs numériques / multi-facettes** — le point que 2.7 avait explicitement anticipé :
> _« `useOptimisticControl` réutilisé tel quel … aucune modification du hook (contrairement à ce qu'exigeront 2.5/2.6, **numériques**). »_ [Source: 2-7-robot-aspirateur-roborock.md#Debug Log References]

Une entité `climate` n'est pas un domaine à **état-chaîne** simple comme `light`/`vacuum` : son `entity.state` porte le **hvac_mode** (`off`/`heat`/`cool`/`auto`…), mais la **consigne** (`attributes.temperature`), la **ventilation** (`attributes.fan_mode`) et l'**oscillation** (`attributes.swing_mode`) sont des **attributs** que `useOptimisticControl` (2.1, `T extends string`, cible = state token) **n'expose pas** et que la **couche pending unique par `entity_id`** (AD-11, un seul slot, last-command-wins) **ne peut pas** porter en parallèle du mode.

**Décision d'architecture (Florian, 2026-07-18) — approche « local overlay » :**
- **Mode + on/off** = un domaine **état-chaîne** ⇒ réutilise `useOptimisticControl` + un nouveau `climateModel` (convergence sur `entity.state` = hvac_mode). **2.1 infra inchangée.**
- **Consigne + fan + swing** = **attributs** ⇒ **overlay optimiste local au composant** (`useState`), réconcilié sur l'écho de l'attribut HA, avec timeout de repli. C'est de l'**état UI éphémère** (autorisé AD-1/AD-3), pas un cache. La préoccupation d'AD-11 (course entre **deux widgets** sur la même entité) **ne s'applique pas** : une **seule** tuile possède cette entité. On n'étend **pas** la couche pending partagée (éviterait un changement d'invariant qui touche lumières/aspirateur — reporté, voir TECH_DEBT).

**Périmètre vs epic (Rule 6 / Atomic Intent — à noter) :** l'AC de l'epic (FR6) couvre **on/off + consigne + mode**. Florian a **étendu** cette story à **fan (ventilation)** et **swing (oscillation)** [décision 2026-07-18]. Ces deux contrôles sont **dans le périmètre de 2.6** et signalés comme extension au-delà de FR6.

**Décision produit (Florian, 2026-07-18) :** `entity_id` réel **`climate.climatiseur_etage_room_temperature`** (unité unique de l'étage). **Confirmé** : entités fournies par Florian ⇒ intégration **Daikin Onecta** (gateway + indoor/outdoor unit) ; le suffixe `_room_temperature` est le **nommage Onecta** de l'entité `climate` de commande, **pas** un capteur. Device-proof levé sur ce point.

**⚠️ Contrainte majeure — source CLOUD à quota (Daikin Onecta), pas locale/push.** La présence de `sensor.climatiseur_etage_gateway_ratelimit_remaining_day` prouve une **API cloud à limite journalière** ; l'état est **poll**é (pas push WebSocket instantané comme lumières/aspirateur locaux) et un `button.climatiseur_etage_refresh` existe justement parce que le rafraîchissement auto est espacé. Climate rejoint donc la **famille cloud/obsolescence** (Netatmo/Arlo — NFR5/AD-6). Deux impacts sur le design optimiste de cette story (voir Dev Notes « Cloud & quota ») :
- **écho HA lent** ⇒ un timeout d'overlay court **ferait revenir la consigne en arrière** avant l'écho → overlay à convergence **douce / timeout généreux**, on **ne revient pas** brutalement au confirmé ;
- **quota** ⇒ **debounce** des commandes de consigne (coalescer les −/+ rapides en **un** `set_temperature`), ne pas émettre un appel par tap.

**Réutilisation / nouveauté :** un `ControlModel` de plus (mode) ; **zéro** logique optimiste dupliquée pour le mode ; **nouvel** helper pur `climate-status.ts` (labels FR + steps + clamp, testé à part comme `vacuum-status.ts`) ; **aucun nouveau token** (accent cyan `--color-accent-climate` déjà posé en 1.2 — appliqué via utilitaires `text/bg/border-accent-climate`, cf. Task 5). **Pas d'undo** (unité unique, pas d'action de groupe à fort impact — hors AC 2.2).

**⚠️ Signature finale = device-proof requis (Florian).** Cette story **ne peut pas** être clôturée sur les seuls gates verts : AC1/AC2/AC3/AC4 dépendent d'un **HA réel** (source cloud, capacités/valeurs exactes, intervalle de poll pour caler les timeouts). Le dev livre code + tests verts ; la **preuve device** (mode/consigne/fan/swing sans faux « Échec », offline→Hors ligne) est un pas séparé, comme 2.7. Les tests unitaires **mockent** `@hakit` — ils prouvent la logique, pas le comportement sur l'appareil.

## Acceptance Criteria

1. **Tuile clim — état lisible + accent cyan (FR6, UX-DR6, UX-DR11).**
   **Given** l'entité `climate.climatiseur_etage_room_temperature` mappée
   **When** j'ouvre l'accueil
   **Then** une tuile « Climatisation » (accent **cyan**, `data-domain="climate"`, **FloorPill étage = 1**) affiche : la **consigne** en grand chiffre tabulaire cyan (`numeric-xl`), la **température ambiante** en secondaire (`current_temperature` de l'entité `climate` ; **repli** sur `sensor.climatiseur_etage_climatecontrol_room_temperature` si l'attribut est null — les intégrations cloud exposent souvent l'ambiant sur un capteur dédié, cf. batterie aspirateur 2.7), le **mode** courant (chips dérivés dynamiquement des `hvac_modes` de l'entité — Chaud/Froid/Auto/Sec/Ventilation selon capacité ; `off` = commande power séparée, pas un chip), la **ventilation** (fan) et l'**oscillation** (swing) courantes — l'état porté par **texte (+ icône)**, jamais la couleur seule (UX-DR14).
   **And** entité obsolète (`unavailable`/`unknown`/socket perdu) → tuile **non interactive** + pill « Hors ligne » comme cue **primaire** (pattern 1.6 via `isStale`), **jamais de blanc** (NFR4/AD-6).

2. **On/off + mode optimistes + convergence (AD-5, AD-4, AD-11).**
   **Given** la tuile clim en ligne
   **When** j'appuie sur **Éteindre/Allumer** ou choisis un **mode** (Chaud=`heat` / Froid=`cool` / Auto=`heat_cool`, + Sec=`dry` / Ventilation=`fan_only` si affichés)
   **Then** `climate.set_hvac_mode` est appelé via `@hakit` (`off`/`heat`/`cool`/`heat_cool`/`dry`/`fan_only`), avec **retour visuel optimiste < 200 ms** (NFR1) via la **couche pending unique** (AD-11) puis **convergence** sur l'écho `entity.state` (AD-5). ⚠️ **L'écho Onecta est lent (poll cloud)** : le `timeoutMs` du modèle DOIT dépasser l'intervalle de poll (voir Task 2) — sinon « Échec » s'affiche à **chaque** changement de mode avant l'écho. « Échec » ne doit apparaître que sur une **vraie** perte (pas d'écho après le grand timeout), pas sur la latence normale.
   **And** aucune logique d'automatisation côté client — seuls des services HA sont appelés (AD-4).

3. **Consigne (stepper −/+) optimiste sur attribut (AD-5).**
   **Given** la clim allumée (mode ≠ `off`)
   **When** j'appuie sur **−** ou **+** (boutons **≥48px**, **≥56px** si tuile kid — ici non-kid)
   **Then** la consigne affichée **change immédiatement** (overlay local, pas d'attente de HA) ; les −/+ rapides sont **debouncés** en **un seul** `climate.set_temperature` (protection quota cloud) avec la cible bornée aux `min_temp`/`max_temp` et snappée au `target_temp_step` ; l'overlay **tient jusqu'à l'écho** (pas de revert temporisé court qui « clignoterait » en arrière avant le poll cloud) : `attributes.temperature` == cible → efface l'overlay (convergé) ; une valeur confirmée **différente** (changement externe) gagne ; un **filet de sécurité long** (≥ intervalle de poll, cf. Task 4) efface l'overlay si rien n'arrive ; **`target ≠ current_temperature` est légitime, pas un échec** (AD-5) — la clim qui n'a pas atteint la consigne est **normal**, jamais « Échec ».
   **And** consigne **désactivée / masquée** quand elle n'est pas réglable : mode `off` **OU** `attributes.temperature` **null** (ex. `dry`/`fan_only` n'exposent pas de consigne) — capability-driven, même règle que fan/swing (AC4).

4. **Ventilation (fan) + oscillation (swing) optimistes sur attribut — extension de périmètre (Florian 2026-07-18).**
   **Given** la clim allumée et supportant `fan_mode` / `swing_mode`
   **When** je change la **ventilation** ou l'**oscillation**
   **Then** `climate.set_fan_mode` / `climate.set_swing_mode` sont appelés, avec **overlay optimiste local** puis convergence sur `attributes.fan_mode` / `attributes.swing_mode` (même modèle que la consigne). Formes réelles (Florian 2026-07-18) :
   - **fan** = **7 valeurs** (`Auto, Quiet, 1, 2, 3, 4, 5`) → un **cycle** au tap (avance dans `fan_modes`) ou un mini-sélecteur ; libellé = valeur HA (mapper « Quiet »→« Silencieux », « Auto » tel quel si utile).
   - **swing** = **2 états** (on=Oscillation / off=Fixe) → un **toggle** (pas un cycle).
   **And** lire les listes **depuis l'entité** (`fan_modes`/`swing_modes`), ne pas coder les valeurs en dur ; un contrôle dont l'entité **ne déclare pas** la capacité (liste absente/vide) est **masqué** (pas de bouton mort) — dégradation gracieuse.

5. **Réutilisation + gates verts (AD-7).**
   **Given** le modèle mode + la tuile + le helper
   **When** je termine
   **Then** **on/off + mode** se branchent sur `useOptimisticControl` **sans le modifier** ; la **2.1 infra (`useOptimisticControl`, `pending`) n'est pas touchée** ; `build` + `typecheck` + `lint` + `test` **verts** (aucun test préexistant cassé) ; l'`entity_id` vit **uniquement** dans `src/entities/` (AD-7) ; **0 token** dans `dist/`.

## Tasks / Subtasks

- [x] **Task 1 — Mapper l'entité climate** (AC: 1, 5)
  - [x] `src/entities/mapping.ts` : ajouter une section `CLIMATE` (comme `VACUUM`) avec l'entrée **réelle** `{ entityId: 'climate.climatiseur_etage_room_temperature', room: 'chambre_parents', domain: 'climate', service: 'climate.set_hvac_mode' }` (**pas** de `placeholder`). L'ajouter à `ENTITIES`. `room` : l'unité couvre **l'étage**, pas une pièce canonique — utiliser `chambre_parents` (étage) par **défaut de champ requis**, non signifiant pour l'affichage (la tuile passe `FloorPill floor={1}` en littéral, comme `VacuumTile` passe `floor={0}`). [Source: src/widgets/VacuumTile.tsx:130-133]
  - [x] **Ambiant sur capteur dédié** : ajouter un champ optionnel `ambientEntityId?: string` à `EntityEntry` (miroir de `batteryEntityId`, même justification : l'attribut vit sur une AUTRE entité) et le renseigner `'sensor.climatiseur_etage_climatecontrol_room_temperature'`. La tuile lit l'ambiant de l'attribut `current_temperature` **et** de ce capteur en repli (Task 5). [Source: src/entities/mapping.ts:30-35,169-181]
  - [x] Accesseur `climate(): EntityEntry | undefined` (cohérent avec `vacuum()`). `EntityDomain` inclut **déjà** `'climate'` [Source: src/entities/mapping.ts:16-17] ; `DeviceDomain` inclut **déjà** `'climate'` [Source: src/ui/DeviceTile.tsx:4-5]. `assertCanonicalMapping` passe (id bien formé + unique).
  - [x] Tests mapping : `climate()` renvoie l'entrée ; `assertCanonicalMapping` OK ; l'entité n'est **pas** `placeholder`.
  - [x] **Capacités confirmées (Florian 2026-07-18)** : `hvac_modes` = `heat_cool`(Auto)/`heat`/`cool`/`dry`/`fan_only`/`off` ; `fan_modes` = Auto/Quiet/1-5 (7) ; `swing_modes` = on/off ; `preset_modes` = boost/away/none (hors-scope, voir Extensions différées). Reste à vérifier au 1ᵉʳ run (non devinable) : (a) les **valeurs string exactes** de `fan_modes` (`'1'` vs `'Level 1'`…) et `swing_modes` (`on/off` vs `Swing/Stop`) — les libellés s'adaptent (lus de l'entité) mais confirmer le mapping `swingLabel` ; (b) `current_temperature` **peuplé** sur l'entité `climate` ou null (⇒ repli capteur `ambientEntityId`).
  - [x] **Entités clim HORS PÉRIMÈTRE 2.6** (fournies par Florian, listées pour ne pas les re-mapper à l'aveugle) : `sensor.*_outdoor_temperature` (extérieur), `binary_sensor.*_is_in_error/warning/caution_state` (défauts), `binary_sensor.*_is_powerful_mode_active` (boost), `binary_sensor.*_is_holiday_mode_active`, `select.*_schedule` (planning — AD-4, vit dans HA), `button.*_refresh`, `update.*_firmware`. **Candidats naturels pour une future page « Détail climatisation »** (comme l'aspirateur : tuile accueil glanceable en 2.7 vs page détail riche en 5.3). Ne PAS les charger sur la tuile d'accueil (densité faible NFR2). Voir « Extensions différées » en Dev Notes.

- [x] **Task 2 — Modèle de contrôle `climateModel` (mode / on-off)** (AC: 2) — **TDD**
  - [x] `src/state/control-model.ts` : `export type ClimateModeTarget = 'off' | 'heat' | 'cool' | 'heat_cool' | 'dry' | 'fan_only'` (capacités **réelles** de l'unité, Florian 2026-07-18 : « Heat/Cool (Auto), Heat, Cool, Dry, Fan only, off ») — ⚠️ **« Auto » = `heat_cool`** en HA (PAS `auto`). `climateModel: ControlModel<'climate', ClimateModeTarget>` :
    - `domain: 'climate'`
    - `isConverged(target, state) => state === target` (l'`entity.state` d'une clim **EST** le hvac_mode courant — convergence = égalité d'état).
    - **Pas** de `isTransitional` au niveau du mode : un changement de hvac_mode est **immédiat** côté état HA. Le « transitionnel » d'AD-5 pour la clim (`target ≠ current`) concerne la **température**, gérée par l'overlay consigne (Task 4), **pas** ce modèle. [Source: src/state/control-model.ts:9-27 ; ARCHITECTURE-SPINE.md#AD-5]
    - `apply(entity, target) => entity.service.setHvacMode({ hvac_mode: target })` — **services HA uniquement** (AD-4).
    - `timeoutMs` **GRAND** (~**120000**, 2 min) — **PAS** 5000 : `useOptimisticControl` fait converger sur l'**écho HA**, et l'écho **Onecta est cloud/poll** (bien plus lent que la latence serveur d'une lampe locale). Un `timeoutMs` court ferait `setFailed(true)` avant l'écho → « Échec » à **chaque** changement de mode (`useOptimisticControl.ts:101-119` : au deadline, état encore non convergé + pas de `isTransitional` ⇒ `clearPending`+`setFailed`). Un grand timeout ⇒ « Échec » **seulement** sur une vraie perte. **Régler ~sur l'intervalle de poll réel** au device-proof (le relever si des faux « Échec » persistent, l'abaisser prudemment sinon). C'est **la** valeur de cette story à ne pas deviner à la baisse. [Source: src/state/control-model.ts:36-42 ; src/hakit/useOptimisticControl.ts:101-119]
  - [x] Tests : `isConverged('heat','heat')===true`, `('heat','off')===false` ; `apply` appelle `setHvacMode({hvac_mode})` avec la bonne cible par mode (mock `entity.service`).
  - [x] **Décision on/off :** « Éteindre » ⇒ `send('off')`. « Allumer » ⇒ `send(<dernier mode non-off connu, sinon 'heat'>)` — dériver le mode de rappel dans la tuile (Task 5), pas dans le modèle (le modèle reste sans état). ⚠️ Vérifier au device-proof que l'unité n'exige pas `climate.turn_on` séparé ; sur la plupart des intégrations `set_hvac_mode` suffit.

- [x] **Task 3 — Helper pur `climate-status.ts`** (AC: 1, 3, 4) — **TDD**
  - [x] `src/widgets/climate-status.ts` (miroir de `vacuum-status.ts` : logique pure, testée sans React) :
    - `hvacModeLabel(state): string` — `off→'Éteint'`, `heat→'Chaud'`, `cool→'Froid'`, `auto→'Auto'`, `heat_cool→'Auto'`, `dry→'Sec'`, `fan_only→'Ventilation'`, sinon la valeur brute (jamais masquer l'info — pattern `vacuumStatusLabel`). [Source: src/widgets/vacuum-status.ts]
    - `parseTemp(v): number | null` (parse `attributes.temperature`/`current_temperature`, `null` si non-numérique — réutiliser le pattern `parseBattery`).
    - `clampSetpoint(value, min, max, step): number` — borne + snap au `target_temp_step` (défaut step 0.5, min 16, max 30 **si l'entité ne les fournit pas** — commenter que ce sont des replis, l'entité est prioritaire).
    - `formatSetpoint(n): string` (ex. `'21.5'`, `tabular-nums` côté rendu).
    - `fanLabel(mode): string` — `Quiet→'Silencieux'`, `Auto→'Auto'`, `1..5` tels quels (« Vitesse 1 » optionnel), sinon brut.
    - `swingLabel(mode): string` — `on→'Oscillation'`, `off→'Fixe'`, sinon brut. (⚠️ confirmer au device-proof que les valeurs HA sont bien `on`/`off` et non `Swing`/`Stop` — mapper les deux jeux par sécurité.)
  - [x] Tests : labels connus + fallback brut ; `clampSetpoint` (borne haute/basse, snap au step, valeurs hors-plage) ; `parseTemp` numérique/non-numérique/`null`.

- [x] **Task 4 — Overlay optimiste local pour attributs (consigne / fan / swing)** (AC: 3, 4) — **TDD (via la tuile)**
  - [x] **Ne pas** toucher `useOptimisticControl` ni `pending` (décision « local overlay »). Implémenter l'optimisme d'attribut **dans la tuile** avec `useState` :
    - à l'action (ex. `+`), calculer la cible bornée (`clampSetpoint`), **poser l'overlay local** (`setPendingSetpoint(target)`) → affichage immédiat (<200 ms). L'appel service est **debouncé** : chaque tap met à jour l'overlay tout de suite, mais `climate.set_temperature` (via `useService('climate')` ou `entity.service.setTemperature({ temperature })`) n'est émis qu'après **~400-600 ms sans nouveau tap** → une rafale −/+/+ = **un seul** appel cloud (protection quota Onecta). Fan/swing (valeurs discrètes) : debounce léger ou immédiat, mais **coalescer** les changements rapides.
    - **convergence** (`useEffect`) : quand `attributes.temperature` (écho HA) **égale** l'overlay → **effacer l'overlay** (retour à la valeur confirmée). Idem `fan_mode` / `swing_mode`.
    - **Tenir jusqu'à l'écho (cloud lent) — PAS de revert temporisé court.** L'overlay tient jusqu'à ce que l'état confirmé **change** : match cible → efface (convergé) ; valeur confirmée **différente** (changement externe) → le confirmé gagne. **Aucun** timeout court (30 s aurait clignoté en arrière avant un poll Onecta plus long, exactement le snap-back qu'on interdit). **Filet de sécurité long uniquement** (~120 s, ≥ intervalle de poll) qui efface l'overlay si vraiment rien n'arrive — jamais d'« Échec » sur un attribut (l'appel a été accepté). Nettoyer timer/debounce au unmount / à la nouvelle action (last-command-wins **local**).
    - **⚠️ Ne PAS** faire converger la consigne sur `current_temperature` : la convergence = HA a **accepté la consigne** (`attributes.temperature` == cible), **pas** la pièce a atteint la consigne. L'écart `temperature` (cible) vs `current_temperature` (ambiant) est **permanent et normal** (AD-5), à afficher, jamais un échec/pending. [Source: ARCHITECTURE-SPINE.md#AD-5]
  - [x] Garde offline : comme `useOptimisticControl.send`, **ne rien émettre** si `isStale` (AD-6) — pas d'overlay sur une entité qu'on ne voit pas.
  - [x] Tests (composant) : `+`/`−` bougent la consigne immédiatement + appellent `set_temperature` avec la valeur bornée ; l'overlay s'efface à l'écho ; borne min/max respectée ; fan/swing parcourent leurs listes et appellent le bon service ; capacité absente (`fan_modes` vide) → contrôle masqué.

- [x] **Task 5 — Widget `ClimateTile`** (AC: 1–4) — **TDD (composant)**
  - [x] `src/widgets/ClimateTile.tsx` : compose `useOptimisticControl(id, climateModel)` (mode/on-off : `displayState` = hvac_mode, `isStale`, `failed`, `send`) **et** un `useEntity(id)` direct pour les **attributs** (`temperature`, `current_temperature`, `fan_mode`, `swing_mode`, `hvac_modes`, `fan_modes`, `swing_modes`, `min_temp`, `max_temp`, `target_temp_step`) — le hook de contrôle n'expose **pas** les attributs (2 abonnements même id, dédupliqués par le store `@hakit`, pattern `VacuumTile`). [Source: src/widgets/VacuumTile.tsx:29-42 ; 2-7…md#Debug Log References] **+ un 3ᵉ** `useEntity(entry.ambientEntityId)` (repli ambiant) : afficher `current_temperature` de l'entité `climate` si peuplé, **sinon** l'état du capteur ambiant dédié — pattern `batteryEntityId`/`useEntity(batteryId)` de `VacuumTile`. [Source: src/widgets/VacuumTile.tsx:33-34]
    - **Rendu** : conteneur tuile givré (tokens `tile-fill`/`tile-border`), en-tête « Climatisation » + `FloorPill floor={1}` ; **consigne** (`numeric-xl` cyan tabulaire) encadrée des boutons **− / +** (`≥48px`, `buttonMinWidth 56px`, radius 12px — cf. `climate-stepper` DESIGN) ; **ambiant** en secondaire ; **chips mode** dérivés dynamiquement de `hvac_modes` **moins `off`** (labels via `hvacModeLabel` : Chaud/Froid/Auto/Sec/Ventilation), le mode courant mis en avant, + **Éteindre/Allumer** (`off` = power) ; **fan** = bouton **cycle** (avance dans `fan_modes`, label `fanLabel`) ; **swing** = **toggle** on/off (`swingLabel`) ; fan/swing **masqués si capacité absente**. [Source: DESIGN.md#climate-stepper (lignes 132-137) ; DESIGN.md#UX-DR6 (ligne 220)]
    - **⚠️ Accent cyan = utilitaires explicites, PAS `data-domain` seul.** Sur un conteneur maison (façon `VacuumTile`, **sans** la classe `.device-tile`), `data-domain="climate"` est **décoratif** : les règles d'accent d'`index.css` sont scopées `.device-tile[data-domain=…]`. Colorer via `text-accent-climate` / `bg-accent-climate/15` / `border-accent-climate/50` (exactement comme `VacuumTile` fait pour le violet). [Source: src/widgets/VacuumTile.tsx:106 ; src/index.css:109-123]
    - **Budget layout (no-scroll 1024×768, NFR2) :** la tuile est **dense** (consigne + 2 steppers + jusqu'à 5 chips + power + fan + swing) — plus riche que le `climate-stepper` DESIGN (1 chip). Tenir dans **une colonne (~1/3 de 1024px)** sans scroll : disposer **consigne+steppers** en ligne principale, **chips mode** en ligne qui **wrap**, **fan+swing** sur **une** ligne meta compacte. Valider au rendu réel (Task 6) ; si ça déborde, réduire (fan/swing en icônes, chips secondaires repliés).
    - `displayState==='off'` **ou** consigne non réglable (`attributes.temperature` null en `dry`/`fan_only`) → stepper **désactivé/masqué** (E2/AC3) ; en `off`, bouton « Allumer » proéminent.
    - `failed` (timeout mode) → indice « Échec » (texte, pas couleur seule — pattern `LightTile`). [Source: src/widgets/LightTile.tsx:42-51]
    - `isStale` → **retour anticipé** : tuile non interactive `state="stale"` + « Hors ligne » (pattern `LightTile`/`VacuumTile`). [Source: src/widgets/LightTile.tsx:27-35]
  - [x] `data-state` : réutiliser `on`/`stale`/`default` de `DeviceTile` si la tuile s'appuie dessus ; sinon reproduire les classes givrées (la tuile clim est **plus riche** que `DeviceTile` — comme `VacuumTile` qui **ne** passe **pas** par `DeviceTile`). Choisir selon la densité : recommandé = conteneur maison façon `VacuumTile` (le stepper + chips ne rentrent pas dans le contrat `DeviceTile { label, value, onPress }`).
  - [x] Tests (RTL) : rendu mode/consigne/ambiant ; tap mode → `send` ; `off` désactive le stepper ; `isStale` → « Hors ligne » non interactif ; `failed` → « Échec ».

- [x] **Task 6 — Intégration accueil** (AC: 1) — **TDD (Home)**
  - [x] `src/pages/Home.tsx` : peupler la **colonne « Climatisation »** (aujourd'hui un `<div />` vide, 3ᵉ colonne du grid Éclairage·Volets·Climatisation) avec `<ClimateTile entry={climateEntry} />`, gardé `isConfigured && climateEntry` (éviter le non-null assertion — pattern `vacuumEntry`). [Source: src/pages/Home.tsx:35-43,23]
  - [ ] **⚠️ Device-proof (Florian)** — vérifier **no-scroll 1024×768** (mémoire target-device-and-layout) : la tuile clim tient dans sa colonne sans casser la grille ni introduire de scroll. Layout construit selon le budget (stepper en ligne · chips qui wrap · fan/swing une ligne) mais **non vérifiable sans écran réel** (jsdom n'a pas de moteur de layout). Idem 2.7 → device-proof séparé.
  - [x] Mettre à jour le commentaire d'en-tête de `Home` (« Volets / Climatisation to come » → Climatisation posée).

- [x] **Task 7 — Gates & DoD** (AC: 5)
  - [x] `npm run typecheck` + `npm run lint` (oxlint — attention `no-non-null-assertion`) + `npm test` **verts** ; `npm run build` **sans token** (garde AD-8 : build local sans token attendu ; vérifier `dist/` **0 token**). [Source: 2-7…md#Debug Log References]
  - [x] pre-commit sur les fichiers touchés (husky/lint-staged).
  - [x] Doc Impact : `docs/home-assistant.md` — **ajouter** le contrat de l'entité clim (id, services `set_hvac_mode`/`set_temperature`/`set_fan_mode`/`set_swing_mode`, attributs consommés) si ce fichier documente les contrats d'entités (vérifier le pattern bins/turtles). Test Impact : couverts par Tasks 1-6.

## Dev Notes

### Architecture patterns & constraints

- **AD-4 — zéro logique côté client** : la tuile **appelle** des services HA (`set_hvac_mode`/`set_temperature`/`set_fan_mode`/`set_swing_mode`), aucune règle si/alors/horaire. [Source: ARCHITECTURE-SPINE.md#AD-4]
- **AD-5 — optimiste + convergence, transitionnel ≠ échec** : mode via pending (AD-11) + convergence d'état ; **consigne/fan/swing via overlay local + convergence d'attribut**. Le gap `temperature`(cible) vs `current_temperature`(ambiant) est **normal**, jamais un échec. [Source: ARCHITECTURE-SPINE.md#AD-5]
- **AD-11 — un slot pending par `entity_id`** : c'est **la raison** pour laquelle consigne/fan/swing **ne passent pas** par la couche pending (le mode occupe déjà le slot ; last-command-wins écraserait). L'overlay local est **distinct** et **par-facette**, propriété d'une **seule** tuile ⇒ pas de course inter-widget (le mal qu'AD-11 prévient). [Source: ARCHITECTURE-SPINE.md#AD-11 ; src/hakit/useOptimisticControl.ts:137-153]
- **AD-3 — pas de cache d'état** : l'overlay local est de l'**intention en vol éphémère** (comme la couche pending), pas un cache d'état confirmé. On lit toujours l'état live via `@hakit`. [Source: ARCHITECTURE-SPINE.md#AD-3]
- **AD-6 — dégradation par entité** : `isStale` (via `useOptimisticControl`) → tuile « Hors ligne » non interactive ; ne jamais commander une entité stale. [Source: src/hakit/useOptimisticControl.ts:139-140]
- **AD-7 — mapping unique** : l'`entity_id` **uniquement** dans `src/entities/mapping.ts`, section `CLIMATE` + accesseur `climate()`. [Source: src/entities/mapping.ts:183-203]
- **Styling** : Tailwind/TailAdmin primaire ; ne pas mélanger avec l'Emotion de `@hakit/components` ; réutiliser les tokens (`--color-accent-climate`, `data-domain="climate"` déjà en `index.css:30,115`). [Source: ARCHITECTURE-SPINE.md#Consistency Conventions ; src/index.css:30,115-117]

### Source tree — fichiers à créer / modifier

**Créer :**
- `src/widgets/ClimateTile.tsx` (+ `ClimateTile.test.tsx`)
- `src/widgets/climate-status.ts` (+ `climate-status.test.ts`)

**Modifier :**
- `src/state/control-model.ts` (+ `.test.ts`) : `ClimateModeTarget` + `climateModel`
- `src/entities/mapping.ts` (+ `.test.ts`) : section `CLIMATE` (`climate.climatiseur_etage_room_temperature`, réel) + accesseur `climate()`
- `src/pages/Home.tsx` (+ `Home.test.tsx`) : peupler la colonne Climatisation
- `_bmad-output/implementation-artifacts/sprint-status.yaml` : `2-6…` backlog → (dev) in-progress → review
- éventuellement `docs/home-assistant.md` (contrat entité clim — voir Task 7)

**Ne PAS toucher (décision « local overlay ») :** `src/hakit/useOptimisticControl.ts`, `src/state/pending.ts`. Toute modif de ces fichiers = signal que l'approche a dérivé vers « extend shared layer » (non retenue) → **stop & re-checkpoint**.

### `@hakit` — services & attributs climate (à vérifier au 1ᵉʳ run réel)

- Services : `climate.set_hvac_mode({ hvac_mode })`, `climate.set_temperature({ temperature })`, `climate.set_fan_mode({ fan_mode })`, `climate.set_swing_mode({ swing_mode })`. Via `entity.service.setHvacMode(...)` etc., ou `useService('climate')` (pattern `useService('button')` dans `VacuumTile`). [Source: src/widgets/VacuumTile.tsx:35]
- Attributs lus : `temperature` (consigne), `current_temperature` (ambiant), `hvac_modes`, `fan_mode`/`fan_modes`, `swing_mode`/`swing_modes`, `min_temp`, `max_temp`, `target_temp_step`. `entity.state` = hvac_mode courant.
- **Capacités variables** : masquer fan/swing si `fan_modes`/`swing_modes` absents/vides (dégradation gracieuse, AC4).

### Cloud & quota (Daikin Onecta) — contrainte transverse

L'unité est derrière l'API **cloud Daikin Onecta** (entités `gateway`/`indoorunit`/`outdoorunit`, `ratelimit_remaining_day`, `refresh`, `firmware_update`). Conséquences pour cette story :
- **Poll, pas push** : l'écho d'état est **lent/espacé** (contrairement aux lumières/aspirateur locaux). ⇒ overlay attribut **tenu jusqu'à l'écho** + filet long ~120 s, **jamais** de snap-back court (Task 4) ; **et** `climateModel.timeoutMs` **grand (~120 s dès le départ**, PAS 5000 — Task 2/C1). Ces deux valeurs sont **une seule** décision : le seuil de « vraie perte » doit dépasser l'intervalle de poll Onecta. Le hook re-teste l'état live au deadline (`useOptimisticControl.ts:101-119`) et ne « fail » que s'il n'est ni convergé ni transitionnel — avec 5000, ce serait **à chaque** changement de mode. Régler au device-proof sur l'intervalle réel. [Source: src/hakit/useOptimisticControl.ts:96-121]
- **Quota journalier** : chaque commande consomme des appels API. ⇒ **debounce** consigne (Task 4) ; ne pas ajouter de polling maison ; ne pas mapper `button.*_refresh` en auto-refresh. Le nombre exact de la limite n'est **pas** affirmé ici (lire `sensor.…_ratelimit_remaining_day` si besoin de le montrer un jour) — l'important est le **principe** : économiser les appels.
- **Obsolescence (AD-6/NFR5)** : climate = source cloud comme Netatmo ⇒ `isStale`/« Hors ligne » s'applique pleinement (déjà couvert par `useOptimisticControl.isStale`). Une coupure internet gèle l'unité socket ouvert → dernière valeur + pill. [Source: ARCHITECTURE-SPINE.md#AD-6 ; #NFR5]

### Extensions différées (future page « Détail climatisation »)

Florian a fourni un riche jeu d'entités clim (défauts, extérieur, boost/holiday, planning, refresh, firmware). **Hors périmètre 2.6** (la tuile d'accueil reste glanceable, NFR2) — candidats à une future story de **page détail**, sur le modèle **aspirateur** (tuile accueil 2.7 → page `/aspirateur` 5.3) :
- `sensor.*_climatecontrol_outdoor_temperature` — température extérieure ;
- `binary_sensor.*_is_in_error/warning/caution_state` (indoor + outdoor) + `sensor.*_error_code` — bandeau **défaut/alerte** ;
- **Présets `climate.set_preset_mode`** = `boost` (Boost) / `away` (Away/éco) / `none` — **confirmés exposés** (Florian 2026-07-18) ; les binary_sensors `*_is_powerful_mode_active` / `*_is_holiday_mode_active` en sont le reflet lecture. Contrôlables en **une story dédiée** (ou re-scope 2.6 si Florian veut Boost sur l'accueil — même overlay que fan/swing, ~10 lignes) ;
- `select.*_climatecontrol_schedule` — planning (AD-4 : la logique vit dans HA, l'UI ne fait que sélectionner) ;
- `button.*_refresh`, `update.*_firmware` — maintenance.

Ne PAS les inclure sans une story dédiée (Atomic Intent). Si Florian veut un sous-ensemble sur l'accueil dès maintenant, re-scoper explicitement 2.6.

### Testing standards

- Vitest + Testing-Library (jsdom). Logique pure (`climate-status.ts`, `climateModel`) testée **sans React** (comme `vacuum-status`) ; tuile en RTL. TDD : rouge → vert → refactor. Ne pas tester `@hakit` lui-même — mocker `useEntity`/`useService` au besoin (voir `VacuumTile.test.tsx` / `LightTile.test.tsx` pour le pattern de mock). Aucun test préexistant cassé (AC5).

### Previous-story intelligence (2.1 / 2.2 / 2.7)

- **2.1** a posé `useOptimisticControl` + `ControlModel` (le hook reste **agnostique** ; chaque domaine fournit un modèle). [Source: src/state/control-model.ts:3-27]
- **2.2** a durci `failed` : un timeout affiche « Échec » **texte** (pas de snap-back silencieux, pas couleur seule), et la tuile reste pressable (le tap suivant retente + efface `failed`). [Source: src/widgets/LightTile.tsx:39-51 ; useOptimisticControl.ts:84-94]
- **2.7** : 1ᵉʳ appareil réel ; **2 abonnements même id** (contrôle + attribut) dédupliqués ; `Home` gate `isConfigured && entry` (pas de `!`) ; build local **sans token** attendu (garde AD-8). **A explicitement prévu que 2.6 serait numérique** → cette story matérialise ce cas. [Source: 2-7…md#Debug Log/Completion Notes]

### Project structure notes

- La colonne « Climatisation » **existe déjà** dans la grille de `Home` (placeholder `<div />`) — 2.6 la remplit ; alignement UX-DR11 (zones accueil : barre · Scènes · Ambiance · Éclairage · Volets · **Climatisation**). [Source: src/pages/Home.tsx:33-43 ; DESIGN.md#UX-DR11]
- Contrainte **no-scroll 1024×768** paysage (mémoire target-device-and-layout) : valider que la tuile clim (plus haute que les tuiles simples) ne pousse pas la grille au scroll.
- **Tech debt à ouvrir si pertinent** (`TECH_DEBT.md`) : « optimisme d'attribut par overlay local (2.6) — non unifié avec la couche pending partagée ; si un 2ᵉ widget doit un jour piloter le même `climate`/attribut, promouvoir vers une couche pending par (entity_id, facet). Trigger : 2ᵉ propriétaire d'un attribut d'entité. » (dette délibérée, avec trigger de remboursement — Rule 3.)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.6: Climatisation — étage]
- [Source: _bmad-output/planning-artifacts/epics.md#Requirements Inventory] — FR6, NFR1/NFR2/NFR4, UX-DR6/UX-DR11/UX-DR14
- [Source: _bmad-output/planning-artifacts/architecture/architecture-home-dashboard-2026-07-12/ARCHITECTURE-SPINE.md] — AD-3, AD-4, AD-5, AD-6, AD-7, AD-11
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-home-dashboard-2026-07-12/DESIGN.md] — accent-climate cyan (l.23), climate-stepper (l.132-137), UX-DR6 (l.220), tokens target-min/typography
- [Source: src/hakit/useOptimisticControl.ts] — hook de contrôle (mode/on-off)
- [Source: src/state/control-model.ts] — `ControlModel`, `lightModel`, `vacuumModel` (patterns)
- [Source: src/widgets/VacuumTile.tsx] + [src/widgets/vacuum-status.ts] — tuile riche multi-abonnement + helper pur (analogues les plus proches)
- [Source: src/widgets/LightTile.tsx] — `isStale`/`failed`, pattern minimal
- [Source: src/ui/DeviceTile.tsx] + [src/index.css:30,115-140] — base tuile, tokens, `data-domain`/`data-state`
- [Source: src/pages/Home.tsx] — composition + colonne Climatisation
- [Source: _bmad-output/implementation-artifacts/2-7-robot-aspirateur-roborock.md] — learnings appareil réel

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Liza Pairing mode, Autonomous — dev-story).

### Debug Log References

- **Deux formes d'appel `@hakit` distinctes** (typecheck a rattrapé mon 1ᵉʳ jet — TS2769) :
  - service **lié à l'entité** (`entity.service.setHvacMode` dans `climateModel`) = signature **no-target** ⇒ `{ serviceData: { hvac_mode } }` (PAS `{ hvac_mode }` direct) ;
  - service via **`useService("climate")`** (tuile, attributs) = signature **with-target** ⇒ `{ target: id, serviceData: { … } }` (comme `useService("button").press({ target })` en 2.7).
- **Optimisme d'attribut = hook local `useOptimisticAttr`** (consigne/fan/swing) dans `ClimateTile` — **2.1 infra intacte** (`useOptimisticControl.ts` et `pending.ts` non modifiés, vérifié). Debounce 500 ms (rafale −/+ → **1** appel cloud) ; **tenu jusqu'à l'écho** (efface quand le confirmé quitte la base : convergé OU changement externe) ; **filet 120 s** ; **aucun** revert court.
- **`climateModel.timeoutMs = 120000`** (C1) — grand car écho Onecta = poll cloud ; évite le faux « Échec » à chaque changement de mode.
- **Ambiant** = 3ᵉ `useEntity(ambientEntityId)` en repli (pattern batterie 2.7) ; le mock de test distingue par le préfixe `sensor.`.
- **Build local `vite build` bloqué par la garde AD-8** (`VITE_HA_TOKEN` présent dans `.env.local`) — **attendu** (précédent 2.7). `tsc -b` passe ; la garde **garantit structurellement 0 token** dans `dist/` (elle refuse d'inliner). Un bundle sans token se produit en env/CI sans token.
- **`Home.test.tsx` non modifié** : sans provider, `Home` rend le fallback « non configuré » (`isConfigured` faux en test), donc le chemin de composition de la tuile n'y est pas exercé — couvert par `ClimateTile.test.tsx`.

### Completion Notes List

- **AC1–AC4 implémentés (partie automatisable) ; AC5 gates verts.** `climate.climatiseur_etage_room_temperature` mappé (réel, Onecta, pas placeholder) + capteur ambiant en repli ; `climateModel` (mode/on-off, `heat_cool`=Auto) branché sur `useOptimisticControl` **sans le modifier** ; `ClimateTile` = consigne (stepper −/+, overlay local debouncé + tenu-jusqu'à-l'écho), chips mode dynamiques, power, fan (cycle 7), swing (toggle), accent cyan via utilitaires `accent-climate`, `isStale`→« Hors ligne », `failed`→« Échec » ; colonne Climatisation peuplée sur l'accueil.
- **188 tests verts** (+ mapping 3, control-model 4, climate-status 17, ClimateTile 12) ; typecheck + lint (oxlint) verts ; prettier appliqué. Build bloqué par la garde token (attendu), 0 token par construction.
- **Réutilisation prouvée** : un `ControlModel` de plus (mode) ; l'optimisme numérique/attribut est un **hook local** (décision « local overlay »), la 2.1 infra reste intacte.
- **TECH_DEBT TD-6** ouvert (overlay local non unifié à la couche pending — trigger : 2ᵉ propriétaire d'un attribut). **Doc** `docs/home-assistant.md` : contrat entité clim + note quota (Onecta = stock, aucun helper HA à créer).
- **⚠️ DEVICE-PROOF (Florian) — PENDANT, requis avant `done`** (comme 2.7) : (a) **no-scroll 1024×768** visuel (subtask laissée `[ ]`) ; (b) valeurs string exactes `fan_modes`/`swing_modes` (labels s'adaptent ; confirmer `swingLabel` on/off vs Swing/Stop) ; (c) `current_temperature` peuplé sur l'entité `climate` ou repli capteur ; (d) **pas de faux « Échec »** sur la latence cloud → caler `climateModel.timeoutMs` sur l'intervalle de poll réel ; (e) confirmer que `set_hvac_mode` suffit (pas de `turn_on` séparé). Les tests **mockent** `@hakit` : ils prouvent la logique, pas le comportement sur l'appareil.

### File List

**Créés :**
- `src/widgets/ClimateTile.tsx`, `src/widgets/ClimateTile.test.tsx`
- `src/widgets/climate-status.ts`, `src/widgets/climate-status.test.ts`

**Modifiés :**
- `src/state/control-model.ts` (+ `.test.ts`) : `ClimateModeTarget` + `climateModel`
- `src/entities/mapping.ts` (+ `.test.ts`) : champ `ambientEntityId`, section `CLIMATE` (réel), accesseur `climate()`
- `src/pages/Home.tsx` : colonne « Climatisation » peuplée (gated `isConfigured && climateEntry`)
- `docs/home-assistant.md` : contrat entité clim + note quota Onecta
- `TECH_DEBT.md` : TD-6 (overlay local non unifié)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` : `2-6…` → in-progress → review

## Change Log

| Date | Version | Description | Author |
| --- | --- | --- | --- |
| 2026-07-18 | 0.1 | Story créée (create-story). Décisions Florian : local overlay (2.1 infra intacte), swing = « switch », fan inclus (extension FR6). | Liza (create-story) |
| 2026-07-18 | 0.2 | Entity ids réels fournis ⇒ intégration **Daikin Onecta** identifiée. Device-proof (entité climate) levé. Ajout contraintes **cloud à quota** : debounce consigne + convergence douce/timeout généreux ; ambiant sur capteur dédié (repli) ; extensions clim (défauts/extérieur/boost/planning) listées hors-périmètre → future page détail. | Liza (create-story) |
| 2026-07-18 | 0.3 | Capacités device confirmées. `ClimateModeTarget` = heat/cool/**heat_cool(=Auto)**/dry/fan_only/off. Chips mode dynamiques depuis `hvac_modes`. Fan = cycle 7 valeurs (Auto/Quiet/1-5), swing = toggle on/off, labels `fanLabel`/`swingLabel`. Présets Boost/Away confirmés exposés → hors-scope (Boost sur future page détail, Florian 2026-07-18). | Liza (create-story) |
| 2026-07-18 | 0.4 | **validate-create-story** (revue fresh-context adversariale). Corrigés : C1 `climateModel.timeoutMs` 5000→~120000 (faux « Échec » garanti sur cloud poll) ; C2 overlay tenu-jusqu'à-l'écho, plus de revert court 30 s ; E1 accent cyan via utilitaires explicites (pas `data-domain` seul) ; E2 stepper masqué si `temperature` null (dry/fan_only) ; E3 budget layout no-scroll ; O1 chips mode alignés AC1↔Task5 ; O2 guidance timeout consolidée ; O3 device-proof requis pour signature. | Liza (create-story + validate) |
| 2026-07-18 | 1.0 | **dev-story** — implémentation complète. `climateModel` + `climate-status` helper + `ClimateTile` (overlay local `useOptimisticAttr`, debounce + tenu-jusqu'à-l'écho) + mapping (`ambientEntityId`, `climate()`) + accueil. 188 tests verts, typecheck/lint verts, build bloqué par garde token (attendu, 0 token). TD-6 + doc HA. Status → review. Device-proof (Florian) pendant. | Liza (dev-story) |
