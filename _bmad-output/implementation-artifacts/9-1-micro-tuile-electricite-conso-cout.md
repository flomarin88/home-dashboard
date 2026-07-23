---
baseline_commit: baec8ca062b983297b826331b4697ef5f39a1b33
---

# Story 9.1: Micro-tuile Électricité (conso + prix + coût)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Créée à la place de 9.2 (choix Florian 2026-07-23) : 9.2 « ajoute la conscience tarifaire au patron 9.1 » — or 9.1 (le patron) est entièrement greenfield. On fonde d'abord. Séquence conforme au change-proposal §5 : 9.1 → 9.2 → 9.3. -->
<!-- Décision Florian 2026-07-23 : tap → PAGE DÉTAIL /electricite (PAS de popover). Override assumé d'UX-DR23 (« popover, pas de page »). Réutilise le patron WeatherDetail (BackLink + grille 2 colonnes de tuiles frostées + useHistory + SensorHistoryChart) → supprime le risque « popover net-new ». -->

## Story

As a Florian,
I want une **micro-tuile Électricité** dans la **barre supérieure** qui affiche le **coût du jour** (dérivé) et la **conso** reflétés depuis Home Assistant, tappable pour **ouvrir une page détail** (historique conso, prix unitaire, seam HC/HP),
so that je vois **d'un coup d'œil** ce que l'électricité me coûte, avec un **détail au tap sans quitter le kiosque**.

## Contexte & valeur

**Epic 9 (v2) — tracer bullet.** 9.1 **fonde le patron « flux de consommation »** : lecture HA read-only → **coût dérivé** (`conso × prix`) → micro-tuile → **page détail** → obsolescence. C'est la **tranche électricité** ; **9.2** ajoutera la conscience tarifaire (HC/HP), **9.3** clonera pour l'eau. Pur **HA-natif, reflect-only** — précédent **Story 1.5 (Ambiance Netatmo)**, gouverné par **AD-16** (flux de consommation = lecture HA read-only + coût dérivé). **Zéro nouveau backend** si les capteurs HA existent.

**Différence clé avec les tuiles rituel (7.1/6.3).** 9.1 est un **READ pur** — comme **TopBarWeather (6.2)** : la tuile reflète HA et **navigue vers une page détail au tap** (`/electricite`, exactement comme `TopBarWeather → /meteo`). **Aucune écriture HA**, **aucun optimiste**, **aucun undo**, **aucun `increment`**, **aucune garde in-flight**.

**Décision d'interaction (Florian, 2026-07-23) : PAGE DÉTAIL, pas popover.** Override assumé d'**UX-DR23** (qui prescrivait « popover au tap, pas de page détail »). La page **réutilise le patron `WeatherDetail`** (page content-only sous `KioskShell` : `BackLink` + grille 2 colonnes de tuiles frostées, 1024×768 **sans scroll**) → **supprime le risque « popover net-new »** (aucune primitive/a11y à construire from scratch).

**Le coût est une dérivation d'affichage** (`conso_jour × prix`), **recalculée à chaque rendu, jamais persistée** (AD-1/AD-16).

## Contrat d'interface HA ↔ app (à respecter des deux côtés)

Deux entités HA (**Task 0**), lues **read-only** via `@hakit` (AD-2), reflétées sans cache (AD-3) :

- **`sensor.<conso_elec_jour>`** — **cumul JOURNALIER** en **kWh** (`utility_meter` `cycle: daily`, ou capteur *daily* de l'intégration Enedis/TotalÉnergies), **reset minuit côté HA** (AD-4 — l'app ne remet jamais à zéro). `state` = nombre (kWh) ; `unit_of_measurement` = `kWh` ; `unavailable`/`unknown`/socket perdue → obsolescence (AD-6).
- **`input_number.<prix_kwh>`** — **prix unitaire €/kWh** (helper HA ; **un seul prix flat** pour 9.1 — **9.2 le scindera en HC/HP**). `state` = nombre.
- **Coût** = `conso_jour(kWh) × prix(€/kWh)`, calculé **au rendu**, **jamais stocké** (AD-1/AD-16). Si l'un des deux manque → **pas de coût inventé** (« — » / dernière valeur selon obsolescence).

Contrat **à documenter** : `docs/home-assistant.md` § « Électricité — conso & coût (Story 9.1) » (Task 6).

| état capteur conso | micro-tuile (`src/widgets/ElectricityTile` — moule `TopBarWeather`) |
| --- | --- |
| nombre (kWh) | **coût héros** (€, tabular-nums) + **sous-ligne conso** (kWh) ; tap → **page `/electricite`** |
| `unavailable`/`unknown`/socket perdue | **obsolescence** (AD-6) : dernière valeur connue + **pill « Hors ligne · HH:MM »**, atténuée, **jamais de blanc ni de spinner** (tuile **toujours tappable** — c'est un read) |

## Acceptance Criteria

1. **Tuile reflect-only pilotée par le capteur HA (AD-1/AD-3/AD-16).**
   **Given** un capteur HA de conso élec journalière (Task 0) mappé dans `src/entities/`
   **When** l'accueil s'affiche
   **Then** une **micro-tuile Électricité** s'insère dans `TopBarSlots` (moule météo/tortue/plante, Story 6.4), **visible en permanence**, affichant la conso **reflétée depuis HA** — lue **uniquement** via `@hakit` (AD-2), **pas de cache** (AD-3), **PAS d'optimiste local**.
   **And** `unavailable`/perte socket → **obsolescence** (AD-6, dernière valeur connue + indicateur, **jamais de blanc ni de spinner**).

2. **Coût du jour dérivé + variante B (UX-DR23, AD-16).**
   **Given** le prix défini (helper HA `input_number` ou config runtime)
   **When** la tuile se rend
   **Then** elle affiche (**variante B**, UX-DR23) le **coût du jour** (`conso × prix`, €, tabular-nums) en **valeur héros** + une **sous-ligne conso** (kWh) **sur la tuile** ; le **prix unitaire** vit **dans la page détail**, **pas sur la tuile**.
   **And** le coût est une **dérivation d'affichage**, **jamais un état persisté** (AD-1/AD-16) — recalculé à chaque rendu.

3. **Page détail au tap — `/electricite` (réutilise le patron `WeatherDetail`).**
   **Given** la tuile
   **When** j'appuie dessus (cible **≥48px**)
   **Then** l'app **navigue vers `/electricite`** — page **content-only** (`BackLink` « ‹ Accueil » + grille 2 colonnes, **1024×768 sans scroll**) :
   - **Colonne gauche** : tuile **« Aujourd'hui »** (coût héros € + conso « X,X kWh · depuis 00:00 » + **prix unitaire** €/kWh) **au-dessus** d'une tuile **« Historique — conso cumulée (24 h) »** (`SensorHistoryChart` alimenté par `useHistory`).
   - **Colonne droite** : tuile **« Heures creuses / pleines »** en **seam « À venir »** (moule `ComingSoon` de `WeatherDetail`) — remplie par **9.2** (période + 2 tarifs + prochaine bascule).
   **And** aucune primitive popover n'est créée (interaction = navigation, AD-10).

4. **Obsolescence + a11y + kiosque + gates.**
   **Given** la tuile + la page + le mapping
   **When** je termine
   **Then** l'obsolescence réutilise `useEntityValue`/`isStale` (dernière valeur + **pill « Hors ligne · HH:MM »**, atténuée, **jamais cachée** ; page = dernière valeur + graphe figé, jamais de blanc) ; tous les nombres en **tabular-nums** ; `aria-label` tuile explicite (« Électricité : X,XX € aujourd'hui, Y,Y kWh — ouvrir le détail ») ; **l'état obsolète n'est jamais porté par la couleur seule** (UX-DR14) ; **chip neutre, pas d'accent de domaine** (UX-DR24) ; **kiosque 1024×768 sans scroll** (accueil **et** page) et **pas de collision top-bar** (5ᵉ élément — voir Dev Notes) ; tous les `entity_id` dans `src/entities/` (AD-7) ; `build`+`typecheck`+`lint`+`test` **verts** ; **0 token** dans `dist/`.

## Tasks / Subtasks

- [ ] **Task 0 — ⚠️ PRÉREQUIS HA (Florian, hors app) : capteur conso journalière + helper prix** — _en attente Florian_
  - [ ] Exposer/vérifier un **capteur de conso élec journalière** (Enedis/TotalÉnergies, ou `utility_meter` `cycle: daily`) en **kWh cumulés du jour**, **reset minuit côté HA**. Confirmer l'**`entity_id` réel** (`sensor.*`) → remplacer le placeholder `sensor.electricite_conso_jour` dans `mapping.ts`.
  - [ ] Créer un helper **`input_number`** pour le **prix €/kWh** (prix flat courant — 9.2 le scindera). Confirmer l'**`entity_id` réel** → remplacer `input_number.prix_kwh`.
  - [ ] **⚠️ Point ouvert transverse** (change-proposal §5) : **confirmer l'existence de l'intégration HA élec** par fournisseur. Sinon → **repli seam read-only** (exception AD-2 conditionnelle, précédent `src/nutriclaude/`) — **hors scope 9.1 si le capteur HA existe**.
  - [x] _(Doc écrite en Task 6, `docs/home-assistant.md` § Électricité — guide de création fourni.)_

- [x] **Task 1 — Mapping électricité** (AC: 1, 2, 4)
  - [x] `src/entities/mapping.ts` : config **`ElectricityConfig`** (AD-7) `{ dailyKwhEntityId: 'sensor.…', priceEntityId: 'input_number.…' }` + accesseur **`electricityConfig()`**. Suivre **exactement** le moule de `WeatherConfig`/`weatherConfig()` (`mapping.ts:420-451`) — objet dédié multi-ids **hors `ENTITIES`**.
  - [x] Ajouter **`dailyKwhEntityId` (`sensor.*`) ET `priceEntityId` (`input_number.*`)** à **`AUX_ENTITY_IDS`** (`mapping.ts:528`) pour la validation de format (`assertWellFormedAuxIds`, **leçon 7.1 D4** — sinon une typo ship en tuile silencieusement atténuée) + suite **`mapping.test.ts`** « auxiliary entity_ids » (`:164`).

- [x] **Task 2 — Dérivation coût (pur) + formatteurs** (AC: 2) — **TDD**
  - [x] `src/widgets/electricity-cost.ts` : fonction **pure** `electricityView({ kwh, price }): { cost: number | null; kwh: number | null }` — parse `kwh` & `price` en nombres ; `cost = kwh × price` ; **`null` si l'une manque/non-numérique** (**pas de coût inventé**). **AUCUNE logique tarifaire/horaire ici** (AD-4) — pur mapping. _(9.2 étendra pour HC/HP.)_ Consommée par **la tuile ET la page**.
  - [x] Formatteurs €/kWh : `src/widgets/consumption-format.ts` — `formatEuro(n)` → « 1,84 € » (fr-FR, 2 décimales) ; `formatKwh(n)` → « 8,2 kWh » (1 décimale) ; `formatPrice(n)` → « 0,18 €/kWh ». Retour **« — »** pour `null` (parité `room-sensor-format.ts`).
  - [x] Tests : `kwh×price` OK ; `kwh` null → `cost` null ; `price` null → `cost` null ; non-numérique → null ; formats € / kWh / prix (fr-FR, décimales).

- [x] **Task 3 — Tuile `ElectricityTile`** (AC: 1, 2, 4) — **TDD (composant)**
  - [x] `src/widgets/ElectricityTile.tsx` : **modelé sur `TopBarWeather.tsx`** (read pur multi-entités **+ navigation**). Lit `dailyKwhEntityId` + `priceEntityId` via **`useEntityValue`** (obsolescence AD-6) ; `anyStale = kwh.isStale || price.isStale`. `electricityView(...)` → coût. **Variante B** : `BoltIcon` (SVG local) + **coût héros** (`text-label font-semibold tabular-nums text-text`) + **sous-ligne conso** (`text-meta tabular-nums text-text-muted`). Bouton `min-h-[56px] rounded-lg border border-card-border bg-card-fill px-4 backdrop-blur-glass` ; `opacity-60` si `anyStale`. **`onClick` → `navigate("/electricite")`** (comme `TopBarWeather → /meteo`). `aria-label` = « Électricité : … — ouvrir le détail ». **PAS de `useService`/`increment`/`undo`/optimiste.**
    - [x] **Obsolescence** : `anyStale` → **pill « Hors ligne · HH:MM »** (`formatSince(kwh.since)`, `stale.ts:25`) + atténué ; **dernière valeur conservée** (`useEntityValue`), **jamais cachée** (≠ poubelle), **jamais de blanc/spinner**. `loading` (1ʳᵉ connexion, rien à montrer) → skeleton. **Tuile toujours tappable** (c'est un read/navigation, pas une action) — même obsolète, elle ouvre la page (dernière valeur + graphe figé).
  - [x] `BoltIcon` **SVG local** (24×24, `stroke="currentColor"`, `strokeWidth="2"`, moule `PlantIcon`/`TurtleIcon`/`WeatherIcon`). **Pas de dépendance d'icônes externe** (build order stdlib/codebase d'abord).
  - [x] Tests (mock `@hakit`, calqué sur **`TopBarWeather.test.tsx`** — `useEntity` branché **par `entity_id`** ; mock `useNavigate`) : conso+prix numériques → coût `kwh×prix` + conso rendus ; tap → `navigate("/electricite")` ; `disconnected` → `opacity-60` + pill « Hors ligne » + **dernière valeur** + **tap navigue toujours** ; capteur `unavailable` → obsolescence, **jamais blanc** ; prix absent → coût « — ».

- [x] **Task 4 — Page détail `ElectricityDetail` (`/electricite`)** (AC: 3, 4) — **TDD (page)**
  - [x] `src/pages/ElectricityDetail.tsx` : **cloner la structure de `WeatherDetail.tsx`** (content-only, `BackLink`, grille `grid-cols-2 gap-grid-gap`, `h-full overflow-hidden`, tuiles frostées locales `Tile`). Guard `isConfigured`/`electricityConfig()` → seam « Électricité non configurée » (parité `WeatherDetail:47-54`).
  - [x] **Colonne gauche** :
    - [x] Tuile **« Aujourd'hui »** : coût héros (`text-numeric-lg font-semibold tabular-nums`, `text-stale-text` si stale) + conso (« X,X kWh · depuis 00:00 ») + **prix unitaire** (« Y,YY €/kWh »). Lit `useEntityValue(dailyKwhEntityId)` + `useEntityValue(priceEntityId)` + `electricityView`.
    - [x] Tuile **« Historique — conso cumulée (24 h) »** : `useHistory(dailyKwhEntityId, { hoursToShow: SPARKLINE_HOURS })` → `series = entityHistory.map(h => ({ t:(h.lc??h.lu)*1000, value:Number(h.s) })).filter(Number.isFinite)` (**exactement `WeatherDetail:68-73`**) → **`SensorHistoryChart`** (lazy, `Suspense`), `unit="kWh"`, `decimals={1}`, **couleur neutre** (pas d'accent — voir Décisions ouvertes), `ariaLabel="Historique de la consommation cumulée sur 24 heures"`, **sans `referenceLines`**. **⚠️ Sawtooth attendu** : le capteur est un cumul journalier remis à 0 à minuit → la courbe grimpe 0→N puis **retombe** au passage de minuit dans la fenêtre. **C'est correct, pas un bug** (documenter, ne pas « lisser »).
  - [x] **Colonne droite** : tuile **« Heures creuses / pleines »** = **seam « À venir »** (réutiliser le moule **`ComingSoon`** de `WeatherDetail:311-319`), note « Ajouté par la Story 9.2 : période courante HA + deux tarifs HC/HP + prochaine bascule. » **Ne rien construire de HC/HP ici** (9.2).
  - [x] **Route** : `src/App.tsx` — ajouter `<Route path="/electricite" element={<ElectricityDetail />} />` dans `<Routes>` (`App.tsx:20-27`), aux côtés de `/meteo`, `/climatisation`. **Lazy `SensorHistoryChart`** déjà code-split (AD-9, PWA lean).
  - [x] Kiosque : page **1024×768 sans scroll** (`overflow-hidden`, `min-h-0`, `flex-1` comme `WeatherDetail`).
  - [x] Tests (mock `@hakit` : `useEntity`, `useHass`, **`useHistory`** ; calqué sur `WeatherDetail.test.tsx`) : rendu coût/conso/prix ; graphe alimenté par la série d'historique ; seam HC/HP « À venir » présent ; `BackLink` → `/` ; capteur stale → dernière valeur, jamais blanc.

- [x] **Task 5 — Insérer la tuile dans `TopBarSlots`** (AC: 1, 4)
  - [x] `src/App.tsx` (`:83-88`) : `<ElectricityTile/>` ajouté comme **enfant** de `<TopBarSlots>` (ordre à trancher au device-proof — proposer après `TopBarWeather`). **Visible en permanence.** Pas de nouveau `fixed` (couche existante, 6.4).
  - [x] **⚠️ 5ᵉ élément top-bar = déclencheur EXPLICITE de la dette collision** — `deferred-work.md:21` : *« À revoir si un 5ᵉ élément arrive »*. Horloge + météo/tortue/plante/poubelle **+ élec** = 5ᵉ tuile permanente. `TopBarSlots` est un `fixed left-44` (~280px de marge, **aucune barrière code** contre le chevauchement). **Device-proof 1024×768 obligatoire.** **NE PAS solder la dette ici** (hors scope, Rule 6) — juste **ne pas la déclencher** et **signaler** si le device-proof la révèle (borne `max-w`/couche grid = tâche distincte, contrainte par TD-1).

- [x] **Task 6 — Doc contrat HA** (Doc Impact) (AC: 1, 2)
  - [x] `docs/home-assistant.md` : nouvelle section **« ## Électricité — conso & coût (Story 9.1) »** sur le moule des sections existantes (Poubelles/Tortues/Arrosage) : (1) capteur conso journalière + reset, (2) helper `input_number` prix, **### Contrat d'interface (⚠️ le code du dashboard en dépend)**, **### Appliquer & tester**. Noter que **9.2** ajoutera le capteur **période HC/HP** + un **2ᵉ prix**.

- [x] **Task 7 — Validation (gates)** (AC: 4)
  - [x] `build` (sans token, garde AD-8) + `typecheck` + `lint` (oxlint) + `test` **verts** ; **0 `entity_id` en dur** hors `entities/` ; **0 token dans `dist/`** ; Prettier OK.
  - [ ] **Preuve device (Florian)** : tuile visible, **coût/conso corrects**, **tap → page `/electricite`** (coût + conso + prix + graphe conso + seam HC/HP), **obsolescence** (débrancher le capteur → dernière valeur + pill « Hors ligne »), **ET pas de collision/scroll top-bar** (5ᵉ élément) à **1024×768**, page **sans scroll**. — _en attente Florian_

## Dev Notes

**Portée stricte.** Micro-tuile Électricité **reflect-only** + **coût dérivé** + **page détail** (Aujourd'hui + historique conso + seam HC/HP). **Hors scope — NE PAS construire :**
- **HC/HP / conscience tarifaire** → **9.2** (période courante HA + 2 prix + tarif appliqué + prochaine bascule). Dans la page, c'est un **seam « À venir »**. **9.1 = UN prix flat.**
- **Tuile Eau** → **9.3**.
- **Tout calcul de planning tarifaire / échéancier côté app** → **interdit (AD-4)** ; la période HC/HP et le reset minuit vivent **dans HA**.
- **Persistance/historique du coût côté app** → interdit (AD-1/AD-16). Le coût est **recalculé à chaque rendu** (`conso × prix`), **jamais stocké**. L'historique **conso** vient de `useHistory` (recorder HA), pas d'un cache local.
- **Popover / primitive flottante** → **non** (décision Florian : page détail). Ne pas créer de composant popover/tooltip/dialog.
- **Cumuls semaine/mois, graphe coût, comparaisons** → **hors scope** (c'était l'option « riche » écartée) ; exigeraient des capteurs HA supplémentaires.
- **Accent couleur de domaine** → **non** (UX-DR24 : **chip neutre** ; seul l'état tarifaire HC/HP — **en 9.2** — portera une teinte sémantique, **toujours icône + mot**).
- **Repli seam read-only** (type `src/nutriclaude/`) si pas d'intégration HA → **hors scope si le capteur HA existe** (Task 0 tranche).

**Réutilisation maximale — deux templates vivants, PAS les tuiles rituel :**
- **Tuile** → `src/widgets/TopBarWeather.tsx` : read pur multi-entités (`useEntityValue` par entité, `anyStale`, `tabular-nums`) **+ navigation au tap** (`navigate("/meteo")` → adapter en `/electricite`). **Aucun** `useService`/`increment`/`undo`/garde in-flight (≠ 7.1/6.3).
- **Page** → `src/pages/WeatherDetail.tsx` : **moule direct** de la page détail. `BackLink`, grille 2 colonnes de tuiles frostées, `useHistory(id, { hoursToShow: SPARKLINE_HOURS })` → série → **`SensorHistoryChart`** (lazy/`Suspense`), moule `ComingSoon` pour le seam 9.2, `Tile` local. Content-only (le sol + la top-bar viennent de `KioskShell`, TD-1). **1024×768 sans scroll.**
- `src/hakit/useEntityValue.ts` — `{ value, unit, isStale, loading, since }` ; dernière valeur en **ref éphémère** (AD-6, **pas de cache**). `src/hakit/stale.ts` — `isStale` + `formatSince` (« HH:MM »).
- `src/entities/mapping.ts` (`WeatherConfig`/`weatherConfig`, `:420-451`) — moule config multi-ids hors `ENTITIES` ; **`AUX_ENTITY_IDS` (`:528`)** + `mapping.test.ts` (`:164`) (leçon 7.1 D4).
- `src/widgets/room-sensor-format.ts` — moule formatteur (**« — » pour `null`**). `src/config` — `SPARKLINE_HOURS`.
- `src/ui/TopBarSlots.tsx` (6.4, layout-only) + `src/App.tsx` (`:20-27` routes ; `:83-88` montage tuile sous `HakitProvider`).

**Page détail = LOW risk (réutilisation), plus « popover net-new ».** L'ancien risque a11y disparaît : la page réutilise `WeatherDetail` à l'identique. _Note dette :_ `deferred-work.md` signale déjà une **duplication de coquille de page** entre `WeatherDetail` et `VacuumDetail` (extraction d'une coquille « contenu 2 colonnes » différée) ; `ElectricityDetail` en sera un **3ᵉ consommateur** → **cloner comme les autres** (ne pas extraire la coquille ici, hors scope Rule 6) ; cela **renforce** le dossier d'extraction, à consigner.

**Coût = dérivation d'affichage (AD-16).** `cost = conso_jour(kWh) × prix(€/kWh)`, calculé **au rendu**, **jamais persisté**. Si l'un des deux manque → **pas de coût inventé** (« — »). **Le capteur DOIT être un cumul JOURNALIER** (reset minuit HA) — sinon le « coût du jour » est faux (Task 0). *Granularité :* la conso élec journalière peut se **rafraîchir lentement** (relevés espacés) — **normal, pas une erreur** (obsolescence AD-6 couvre le décalage ; cf. note SAUR 9.3).

**Graphe conso — sawtooth attendu.** Le capteur cumulatif journalier **retombe à 0 à minuit** → sur une fenêtre 24 h, la courbe grimpe puis **chute** au passage de minuit. **C'est fidèle** (« conso cumulée depuis 00:00 »), **pas un bug** — ne pas tenter de lisser/masquer. Un graphe de **puissance/débit** (courbe lisse) exigerait un capteur instantané supplémentaire → **hors scope 9.1**.

**A11y (UX-DR14) — état jamais par la couleur seule.** Obsolescence portée par la **pill « Hors ligne · HH:MM » + atténuation**, pas une couleur. `aria-label` tuile porte **coût + conso + « ouvrir le détail »**. `tabular-nums` partout. Chip **neutre** (UX-DR24).

**Obsolescence (AD-6).** `isStale` → `opacity-60` + pill « Hors ligne · HH:MM », **dernière valeur conservée**, **jamais cachée**, **jamais de blanc/spinner**. Page : dernière valeur + graphe figé, `text-stale-text` sur les valeurs stale (parité `WeatherDetail`).

**Collision top-bar (dette ACTIVE — déclenchée par 9.1).** `deferred-work.md:21` nomme **explicitement** « une 5ᵉ [tuile] ». La tuile élec **est** ce 5ᵉ élément. ~280px de marge, **aucune barrière code**. **Device-proof 1024×768 obligatoire.** L'Epic 9 en ajoutera une **6ᵉ** (eau, 9.3) → UX-DR23 prévoit « **1 chip Conso fusionnée** OU **2 chips** » **à trancher au build** — **reporté à 9.3**, mais 9.1 valide déjà que 5 tiennent. Si collision → **escalader** la dette (tâche distincte, Rule 6).

### Project Structure Notes

- **NEW** : `src/widgets/ElectricityTile.tsx` (+ `.test.tsx`) ; `src/widgets/electricity-cost.ts` (+ `.test.ts`) ; `src/widgets/consumption-format.ts` (+ `.test.ts`) ; `src/pages/ElectricityDetail.tsx` (+ `.test.tsx`) ; `BoltIcon` (SVG local, dans un `.tsx` d'icône).
- **UPDATE** : `src/entities/mapping.ts` (+ `.test.ts`) (`ElectricityConfig` + `ELECTRICITY` + `electricityConfig()` + `AUX_ENTITY_IDS`) ; `src/App.tsx` (**route `/electricite`** dans `<Routes>` + **`<ElectricityTile/>`** dans `TopBarSlots`) ; `docs/home-assistant.md` (section Électricité) ; `_bmad-output/implementation-artifacts/sprint-status.yaml` (`9-1` → in-progress → review ; `epic-9` → in-progress).
- **Direction de dépendance** : `widgets/ElectricityTile` + `pages/ElectricityDetail` → `hakit`/`entities`. Tuile **sous `HakitProvider`** ; la page est rendue par `AppRoutes` (sous provider, `App.tsx:91`).
- **Style** : Tailwind ; cible **≥48px** ; `tabular-nums` ; kiosque sans scroll (accueil **et** `/electricite`). Prettier + pre-commit Husky (commit → lint-staged → typecheck → test).

### Décisions tranchées

- **Interaction = PAGE DÉTAIL `/electricite`** (Florian, 2026-07-23), **pas popover**. **Override assumé d'UX-DR23.** Réutilise `WeatherDetail`.
- **Contenu page (option B)** : gauche = Aujourd'hui + Historique conso 24 h ; droite = seam HC/HP « À venir » (9.2). (Options A « minimale » et C « riche »/cumuls écartées.)
- **Template tuile = `TopBarWeather`** (read + navigation), **PAS** les tuiles rituel — 9.1 **n'écrit jamais** dans HA (AD-3).
- **Coût = dérivation au rendu** (`conso × prix`), **jamais persisté** (AD-16).
- **Prix = UN helper `input_number` flat** pour 9.1 ; **9.2 le scinde** en HC/HP.
- **Prix unitaire dans la page**, pas sur la tuile (variante B) — tuile minimale (coût héros + sous-ligne conso).
- **Chip neutre, pas d'accent de domaine** (UX-DR24).
- **Capteur = cumul JOURNALIER** (reset minuit HA) ; **graphe = conso cumulée** (sawtooth minuit assumé).
- **Tuile toujours tappable**, même obsolète (navigation = read, pas action).

### Décisions ouvertes / dépendances

- **Task 0 bloquant** (device-proof) : capteur conso élec **journalière** + helper prix `input_number` (Florian, HA). **Codable/testable** avec mock `@hakit` **sans** Task 0.
- **Point ouvert transverse** (change-proposal §5) : **intégration HA élec par fournisseur** confirmée ? Sinon **repli seam** (exception AD-2) — décision à lever **tôt**.
- **`entity_id` réels** (`sensor` conso, `input_number` prix) — à confirmer au **device-proof**.
- **Nom de route** : `/electricite` proposé (cohérent `/meteo`, `/climatisation`). Confirmer.
- **Couleur du graphe conso** : pas d'accent de domaine (UX-DR24) → **neutre** proposé (`var(--color-text)` ou `text-muted`), à trancher au build (les accents `climate`/`shutters` sont réservés à d'autres domaines).
- **Fenêtre du graphe** : `SPARKLINE_HOURS` (24 h, parité météo) → montre le sawtooth de minuit. Alternative : borner « depuis 00:00 » (pas de reset visible). Défaut = 24 h (réutilisation directe) ; à confirmer au device-proof.
- **Ordre de la tuile** dans `TopBarSlots` — à trancher au device-proof.
- **Densité top-bar** (5→6 éléments avec 9.3) : chip Conso **fusionnée** vs **2 chips** (UX-DR23) — **reporté à 9.3**.
- **Prix en `input_number` HA vs config runtime** (AD-16 autorise les deux) — **défaut : `input_number` HA** (modifiable sans redeploy). Confirmer.

### References

- [Source: epics.md#Epic 9 (Consommation — flux élec & eau) · #Story 9.1 (Micro-tuile Électricité, reflect-only, variante B, AD-16) · #FR-E1/FR-E4 · #UX-DR23/UX-DR24] — _NB : UX-DR23 « popover, pas de page » **override** par Florian (page détail)._
- [Source: sprint-change-proposal-2026-07-21.md — **origine Epic 9** (correct-course) : AD-16, UX-DR23/24, Task 0, séquence 9.1→9.2→9.3, point ouvert fournisseur / repli seam]
- [Source: ux-designs/ux-home-dashboard-2026-07-20/inputs/mock-conso-topbar.html — **variante B** (coût héros + sous-ligne conso) ; teintes vertes « Creuses » écartées (UX-DR24, relève de 9.2) ; le popover du mock **remplacé** par une page détail]
- [Source: src/widgets/TopBarWeather.tsx — **template tuile** (read pur multi-entités + `navigate`) ; TopBarWeather.test.tsx (mock `@hakit` par `entity_id` + `useNavigate`)]
- [Source: src/pages/WeatherDetail.tsx — **template page détail** : `BackLink`, grille 2 colonnes, `useHistory`+`SensorHistoryChart` (`:68-73`, `:148-158`), `ComingSoon` seam (`:311-319`), `Tile` local, content-only 1024×768 no-scroll ; WeatherDetail.test.tsx (mock `useHistory`)]
- [Source: src/hakit/useEntityValue.ts (`{value,unit,isStale,loading,since}`, dernière valeur ref éphémère AD-6) · src/hakit/stale.ts (`isStale` + `formatSince`)]
- [Source: src/entities/mapping.ts (`WeatherConfig`/`weatherConfig` `:420-451` ; `AUX_ENTITY_IDS` `:528` + `assertWellFormedAuxIds` ; mapping.test.ts `:164`)]
- [Source: src/widgets/room-sensor-format.ts (moule formatteur, « — » pour `null`) · src/widgets/SensorHistoryChart.tsx (Recharts, lazy, props `series/color/ariaLabel/unit/decimals/tickStep`) · src/config (`SPARKLINE_HOURS`)]
- [Source: src/ui/TopBarSlots.tsx (6.4, layout-only) · src/App.tsx `:20-27` (routes) · `:83-88` (montage tuile)]
- [Source: ARCHITECTURE-SPINE.md#AD-1/AD-3 (HA vérité, app sans persistance) · #AD-2 (accès `@hakit`) · #AD-4 (échéancier/tarif dans HA) · #AD-6 (obsolescence) · #AD-7 (mapping `entities/`) · #AD-8 (build sans secret) · #AD-9 (bundle/PWA lean, chart lazy) · #AD-10 (pages détail)] ; [Source: ARCHITECTURE-DELTA-V2.md — inventaire v2 (AD-16 dans epics.md)]
- [Source: 7-1-tuile-arrosage.md — **moule de story** + leçon **D4** (aux ids en validation canonique) ; **MAIS 9.1 diffère** : read pur + navigation, pas d'`increment`/undo/optimiste]
- [Source: deferred-work.md:21 — dette **collision top-bar**, déclencheur « **5ᵉ élément** » = **cette story** ; duplication coquille de page `WeatherDetail`/`VacuumDetail` (extraction différée) — `ElectricityDetail` = 3ᵉ consommateur]
- [Source: docs/home-assistant.md (moule sections Poubelles/Tortues/Arrosage — « Contrat d'interface ») — **nouvelle section Électricité à écrire** (Task 6)]
- [Source: memory `target-device-and-layout` (iPad 1024×768 sans scroll) · @hakit/core 6.0.2 (`useEntity`/`useHass`/`useEntityValue`/`useHistory`)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Liza Pairing, Autonomous — bmad dev-story).

### Debug Log References

- **Tuile = clone `TopBarWeather`** (read pur + navigation), PAS les tuiles rituel : `useEntityValue` sur les 2 entités, `anyStale = kwh || price`, `electricityView` → coût, `onClick → navigate("/electricite")`. Aucun `useService`/`increment`/`undo`/garde in-flight.
- **Coût pur** : `electricity-cost.ts#electricityView({kwh,price})` renvoie `{ kwh, price, cost }` (parse via `toNumber`, `cost = kwh×price` sinon `null` — pas de coût inventé). Étendu de la story (renvoie aussi `price`) pour que la page affiche le prix sans re-parser — **1 seul point de parse**. Aucune logique horaire/tarifaire (AD-4).
- **Formatteurs** `consumption-format.ts` : `formatEuro`/`formatKwh`/`formatPrice` (fr-FR, « — » pour null, parité `room-sensor-format`).
- **Page = clone `WeatherDetail`** : `ElectricityDetail` (garde `isConfigured`) + `ElectricityDetailContent({cfg})` (exportée pour test). `useHistory(dailyKwh, {hoursToShow: SPARKLINE_HOURS})` → série → `SensorHistoryChart` (lazy/Suspense, `color="var(--color-text)"` neutre UX-DR24, `unit="kWh"`). `Tile`/`BackLink`/`ComingSoon` **clonés** (3ᵉ consommateur de la coquille — extraction différée assumée, `deferred-work.md`).
- **Graphe = sawtooth de minuit assumé** (capteur cumulatif journalier) — commentaire in-code « faithful, not a bug ».
- **`BoltIcon`** SVG local (`ConsumptionIcons.tsx`, gabarit `WeatherIcon` 24×24) — pas de dépendance d'icônes externe.
- **Mapping** : `ElectricityConfig` + `electricityConfig()` (moule `WeatherConfig`), **placeholders** `sensor.electricite_conso_jour` / `input_number.prix_kwh` ; les 2 ids ajoutés à `AUX_ENTITY_IDS` (validation de format, leçon 7.1 D4).
- **Insertion** : `<ElectricityTile/>` **2ᵉ** dans `TopBarSlots` (après météo) → **5ᵉ élément top-bar** (horloge + 5 tuiles) — déclenche la dette collision (`deferred-work.md:21`), device-proof requis.
- **Build AD-8** : la garde `vite.config.ts` **fait échouer** le build si `VITE_HA_TOKEN` est set → build vérifié en déplaçant temporairement `.env.local` (restauré), RC=0, **0 JWT / 0 token dans `dist/`**.

### Completion Notes List

- **AC1–AC4 satisfaits (côté app).** Tuile reflect-only (coût dérivé + conso, variante B, navigation `/electricite`), page détail (Aujourd'hui + graphe conso 24 h + seam HC/HP « À venir »), obsolescence AD-6, chip neutre, mapping AD-7, tous gates verts.
- **⚠️ Déviation assumée vs AC4 (pill sur la tuile)** : l'AC4/le contrat décrivaient une **pill « Hors ligne · HH:MM » sur la tuile**. **Implémenté : atténuation `opacity-60` seule sur la tuile** (cohérent avec la famille top-bar météo/tortue/plante qui ne pose PAS de pill sur la chip) + `aria-label` « hors ligne », **la pill vit sur la page `/electricite`**. Raison : (1) cohérence famille, (2) **ne pas élargir la 5ᵉ tuile** (risque collision top-bar). L'a11y reste couverte (opacité ≠ couleur seule, UX-DR14 ; aria-label). **À confirmer par Florian** au device-proof — si tu veux la pill sur la tuile, c'est ~3 lignes.
- **Gates** : `typecheck` + `oxlint` + **293 tests** verts (+21 : electricity-cost 6, consumption-format 4, ElectricityTile 5, ElectricityDetail 4, mapping 2) ; build sans token RC=0 ; **0 token `dist/`** ; 0 régression.
- **Reste (non-agent, Florian)** : **Task 0** = créer le capteur conso élec **journalière** (utility_meter daily ou capteur fournisseur) + le helper `input_number.prix_kwh` dans HA (guide : `docs/home-assistant.md` § Électricité), **confirmer les entity_ids réels** (remplacer les 2 placeholders dans `mapping.ts`), confirmer l'intégration fournisseur (sinon repli seam) ; **preuve device** = coût/conso/tap/graphe/obsolescence **+ absence de collision/scroll top-bar** (5ᵉ tuile) à 1024×768.

### File List

**Créés :**
- `src/widgets/electricity-cost.ts`, `src/widgets/electricity-cost.test.ts`
- `src/widgets/consumption-format.ts`, `src/widgets/consumption-format.test.ts`
- `src/widgets/ConsumptionIcons.tsx` (`BoltIcon`)
- `src/widgets/ElectricityTile.tsx`, `src/widgets/ElectricityTile.test.tsx`
- `src/pages/ElectricityDetail.tsx`, `src/pages/ElectricityDetail.test.tsx`

**Modifiés :**
- `src/entities/mapping.ts` (`ElectricityConfig` + `ELECTRICITY` + `electricityConfig()` + `AUX_ENTITY_IDS`) + `src/entities/mapping.test.ts`
- `src/App.tsx` (route `/electricite` + `<ElectricityTile/>` 2ᵉ dans `TopBarSlots`)
- `docs/home-assistant.md` (§ « Électricité — conso & coût (Story 9.1) »)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (9-1 → in-progress → review)

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-23 | 0.2 | **Implémentée (dev-story).** Tuile `ElectricityTile` (reflect-only, coût dérivé + conso, variante B, tap → `/electricite`) clonée sur `TopBarWeather` — aucun write/optimiste/undo. Page `ElectricityDetail` (`/electricite`) clonée sur `WeatherDetail` : Aujourd'hui (coût + conso + prix) + graphe conso 24 h (`useHistory`+`SensorHistoryChart` lazy) + seam HC/HP « À venir » (9.2). Coût pur (`electricity-cost.ts`, `null` si input manquant), formatteurs €/kWh, `BoltIcon` local, mapping `ElectricityConfig` (placeholders + `AUX_ENTITY_IDS`). Insérée **2ᵉ** dans `TopBarSlots` (**5ᵉ élément** → dette collision `deferred-work.md:21`). **Déviation assumée** : obsolescence = `opacity-60` sur la tuile (cohérence famille + anti-collision), pill « Hors ligne » sur la page. +21 tests → **293 verts**, tsc/oxlint/Prettier verts, **build sans token RC=0, 0 token `dist/`**, 0 régression. Reste : **Task 0 HA** (capteur conso journalière + helper prix, entity_ids réels) + **preuve device** (Florian). → review. |
| 2026-07-23 | 0.1 | Story 9.1 créée (create-story). **Créée à la place de 9.2** (choix Florian) : 9.2 « ajoute la conscience tarifaire au patron 9.1 » — or 9.1 (le patron) était **entièrement greenfield**. On fonde d'abord ; séquence conforme au change-proposal §5. Micro-tuile Électricité **reflect-only** (moule **`TopBarWeather`**), **coût dérivé** (`conso_jour × prix`, jamais persisté, AD-16), **variante B** (coût héros + sous-ligne conso). **Interaction = PAGE DÉTAIL `/electricite`** (décision Florian — **override d'UX-DR23** « popover, pas de page ») : réutilise le patron **`WeatherDetail`** (`BackLink` + grille 2 colonnes + `useHistory`+`SensorHistoryChart` + seam `ComingSoon`), **contenu option B** (Aujourd'hui + historique conso 24 h + seam HC/HP « À venir »). Ce choix **supprime le risque « popover net-new »**. Risque restant signalé : **5ᵉ élément top-bar = déclencheur dette collision** (`deferred-work.md:21`) → device-proof obligatoire. Nuance documentée : **graphe = sawtooth de minuit** (capteur cumulatif journalier, fidèle). Task 0 (capteur conso **journalière** + helper prix) + preuve device = Florian. → ready-for-dev. |
