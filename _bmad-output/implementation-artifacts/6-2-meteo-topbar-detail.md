---
baseline_commit: a94ed8961c60df7ae4882270fd2551fbbc2516b0
---

# Story 6.2: Météo — widget barre supérieure + page détail

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Florian,
I want un **widget météo** dans la barre supérieure (icône du temps + température extérieure, tendance, humidité, batterie) qui **ouvre une page détail** (historique, prévisions 7 jours, pluie dans 1 h),
so that j'ai la météo extérieure d'un coup d'œil, sans quitter le dashboard.

## Contexte & valeur

Coup d'œil météo extérieur. **Tout via HA** (décision Florian) : temp/humidité/batterie/tendance = capteurs **Netatmo extérieurs** (fournis) ; condition/prévisions/pluie = **intégration météo HA** (`weather.*` + capteur pluie — ex. Météo-France : condition + 7 jours + « pluie dans l'heure »), **à ajouter côté HA** (Task 0). L'app **reflète** (AD-1/AD-2/AD-3), **aucun appel d'API externe côté client** (respect AD-1/AD-2/NFR5 — décision explicite contre l'API publique directe).

**Décisions produit (Florian, 2026-07-16) :**
1. **Widget barre supérieure** près de l'heure — même pattern TD-1 que `BinTile` (monté **sous le provider**, `fixed` en haut ; `TopBar`/`Clock` restent hors du gate).
2. **Icône** : thermomètre par défaut ; **icône de condition** dès qu'un `weather.*` est mappé (seam `conditionEntityId`, « à ajouter plus tard »).
3. **Tap → page `/meteo`** : actuel + historique (maintenant) + prévisions 7 j + pluie 1 h (dès l'intégration météo).
4. **Source = HA uniquement** (pas d'API publique directe côté app).

**entity_ids Netatmo extérieurs (fournis, réels) :** `sensor.interieur_exterieur_temperature` · `sensor.interieur_exterieur_humidite` · `sensor.interieur_exterieur_batterie` · `sensor.interieur_exterieur_temperature_trend`.

## Découpage buildable-maintenant vs seam-futur

- **Maintenant (données Netatmo réelles) :** widget barre sup. (temp + tendance + humidité + batterie, icône thermo) + page `/meteo` **Actuel** + **Historique température** (courbe via `useHistory`/`Sparkline`, réutilise 1.5).
- **Futur (Task 0 = intégration météo HA) :** icône de **condition** (map état `weather.*`), **prévisions 7 jours** (`weather.*` forecast), **pluie dans 1 h** (capteur nowcast). **Seams** dans le mapping (`conditionEntityId?`, `rainEntityId?`) → sections « à venir » tant qu'absents. **Aucun rework** quand ajoutés.

## Acceptance Criteria

1. **Widget barre supérieure (reflet Netatmo, AD-1/AD-3/AD-6).**
   **Given** les capteurs Netatmo extérieurs mappés
   **When** l'accueil s'affiche
   **Then** un **widget compact** apparaît **dans la zone barre supérieure, près de l'heure** : **icône** (thermo, ou condition si `weather.*` mappé) + **température extérieure** (valeur de coup d'œil, `tabular-nums`) + **tendance** (↑ `up` / ↓ `down` / → `stable`) + **humidité %** + **batterie** (petite, **colorée par niveau** — réutilise `batteryColorClass`).
   **And** lu **uniquement** via `@hakit` (AD-2), pas de cache (AD-3) ; capteur obsolète/`unavailable` → **obsolescence** (AD-6, `—`/atténué, jamais de blanc).

2. **Tap → page détail `/meteo` (AD-10).**
   **Given** le widget
   **When** je le tape
   **Then** une **page dédiée `/meteo`** s'ouvre (contenu seul, retour **« ‹ Accueil »**, layout paysage **sans scroll** — mémoire `target-device-and-layout`) avec :
   - **Actuel** : température + humidité + batterie + tendance (+ condition si dispo) ;
   - **Historique** : **courbe de température** (24 h, `useHistory` + `Sparkline`, réutilise 1.5) ;
   - **Prévisions 7 jours** : depuis `weather.*` (Task 0) — sinon **« à venir »** ;
   - **Pluie dans 1 h** : depuis le capteur nowcast (Task 0) — sinon **« à venir »**.
   **And** obsolescence par champ (AD-6).

3. **Réutilisation + kiosque + gates.**
   **Given** le widget + la page + le mapping
   **When** je termine
   **Then** obsolescence via `useEntityValue`/`isStale`, formatage via `formatSensorValue` (1.5), batterie via `batteryColorClass` (2.7), historique via `Sparkline`/`useHistory` (1.5), widget top-bar via le pattern `BinTile` (fixed sous provider), page via le pattern `VacuumDetail` (contenu-seul 2 colonnes) — **zéro duplication** ; tous les `entity_id` dans `src/entities/` (AD-7) ; **aucun `fetch` externe** (AD-1/AD-2) ; `build`+`typecheck`+`lint`+`test` **verts** ; **0 token** dans `dist/`.

## Tasks / Subtasks

- [x] **Task 0 — (Florian, HA) : intégration météo pour condition/prévisions** — _fait (2026-07-17)_
  - [x] Intégration météo HA fournie : **`weather.forecast_home`** (état = condition ; prévisions **daily + hourly** via `useWeather`/`weather.get_forecasts`). Mappée dans `WEATHER` (`conditionEntityId` + `forecastEntityId`). L'horaire remplace « pluie dans 1 h ». _(Un capteur nowcast « pluie dans l'heure » dédié reste possible plus tard, mais non requis — l'horaire couvre le besoin.)_

- [x] **Task 1 — Mapping météo** (AC: 1, 2, 3)
  - [x] `src/entities/mapping.ts` : config `WEATHER` (AD-7) : `tempEntityId`/`humidityEntityId`/`batteryEntityId`/`trendEntityId` (ids Netatmo réels) + **seams** `conditionEntityId?` / `forecastEntityId?` (souvent = le même `weather.*`) / `rainEntityId?`. Accesseur `weatherConfig()`.

- [x] **Task 2 — Helpers purs** (AC: 1, 2) — **TDD**
  - [x] `src/widgets/weather-format.ts` : `trendArrow(state): '↑'|'↓'|'→'|''` (`up`/`down`/`stable`/`unknown`) ; `conditionCategory(condition)` (map états HA `sunny`/`partlycloudy`/`cloudy`/`rainy`/`pouring`/`snowy`/`fog`/… → catégorie d'icône ; défaut `thermo`). Batterie via `parseBattery`/`batteryColorClass` (`vacuum-status`).
  - [x] Tests : chaque état tendance → flèche ; conditions connues → bonne catégorie ; défaut.

- [x] **Task 3 — Widget `TopBarWeather`** (AC: 1, 2) — **TDD (composant)**
  - [x] `src/widgets/TopBarWeather.tsx` : lit temp/humidité/batterie/tendance (via `useEntityValue`, obsolescence) ; icône (thermo ; condition seam) + `formatSensorValue(temp,1)` °C + `trendArrow` + humidité % + batterie (`batteryColorClass`). **Tappable** → `useNavigate('/meteo')`. **Fixed** haut-gauche (`left-44 top-4`) monté **sous le provider** (`KioskShell`, comme `BinTile`). Obsolète → `opacity-60` + dernière valeur connue.
  - [x] A11y : `aria-label` dynamique (« Météo extérieure 12.3 °C, humidité 78 %, en hausse — ouvrir le détail »). Le widget entier navigue (cible tactile ≥ 48 px).
  - [x] Test (mock `@hakit`) : temp/humidité/tendance rendus + flèche ; clic → navigation `/meteo` ; déconnecté → atténué + dernière valeur.

- [x] **Task 4 — Page `WeatherDetail` (`/meteo`)** (AC: 2) — **TDD (composant)**
  - [x] `src/pages/WeatherDetail.tsx` : **contenu seul** (ground/TopBar = KioskShell, TD-1), retour « ‹ Accueil » ; layout **paysage 2 colonnes de tuiles** sans scroll (patron `VacuumDetail`).
    - **Actuel** : temp (grande) + humidité + batterie + tendance.
    - **Historique** : `Sparkline` de la température (24 h) via `useHistory(tempEntityId, { hoursToShow: SPARKLINE_HOURS })` (réutilise 1.5 ; `useHistory` mocké en test).
    - **Prévisions 7 jours** : tuile **« À venir »** (seam) tant que `forecastEntityId`/`conditionEntityId` absents. Câblage `useWeather`/`weather.get_forecasts` reporté à Task 0 (API `@hakit` à vérifier sur une vraie entité `weather.*` — pas de code mort importé).
    - **Pluie dans 1 h** : tuile **« À venir »** (seam) tant que `rainEntityId` absent.
  - [x] `src/App.tsx` : route `/meteo` → `<WeatherDetail/>`.
  - [x] Test : Actuel + Historique rendus (mock `@hakit`) ; sans `conditionEntityId`/`rainEntityId` → 2× « À venir » ; « ‹ Accueil » navigue.

- [x] **Task 5 — Monter `TopBarWeather` sous le provider** (AC: 1)
  - [x] `src/App.tsx` (`KioskShell`) : `<TopBarWeather/>` **DANS `HakitProvider`** (à côté de `AppRoutes`/`BinTile`), `fixed` haut-gauche. **PAS** dans `TopBar` (TD-1). Météo à gauche, bins au centre → pas de chevauchement. _(3ᵉ élément top-bar HA → voir TD-4.)_

- [x] **Task 6 — Validation (gates)** (AC: 3)
  - [x] `build` (sans token) + `typecheck` + `lint` + `test` **verts** (115 tests) ; 0 `entity_id` en dur hors `entities/` (code non-test) ; **0 `fetch` externe** ; 0 token dans `dist/`.
  - [ ] **⏳ Preuve device (Florian, review)** : widget météo près de l'heure (temp/tendance/humidité/batterie réelles) ; tap → `/meteo` (Actuel + courbe historique) ; après ajout de l'intégration météo → condition + 7 j + pluie 1 h ; capteur coupé → obsolescence ; pas de scroll.

## Dev Notes

**Portée stricte.** Widget météo barre sup. (Netatmo) + page `/meteo` (Actuel + Historique maintenant ; condition/7j/pluie **seamés** pour l'intégration météo HA). **Hors scope — NE PAS construire :**
- **Appel d'API météo externe côté client** → **interdit** (AD-1/AD-2/NFR5 ; décision Florian). Tout via HA.
- **Logique de prévision côté client** → non ; on affiche les prévisions HA.
- **Historique CO₂/humidité étendu** → seule la température a une courbe ici (comme 1.5) ; humidité/batterie = valeurs.

**Contrainte TD-1 / provider** (comme `BinTile`) : `TopBarWeather` **sous le provider**, `fixed` près de l'horloge. `TopBar`/`Clock` restent hors du gate. _(3ᵉ élément HA de la barre sup. après bins ; pattern « barre sup. enrichie » à consolider un jour — noter, pas maintenant.)_

**Continuité (done, commit `a94ed89`).**
- **`useEntityValue`/`isStale`/`OfflinePill` (1.6)** : obsolescence de chaque capteur.
- **`formatSensorValue` (`room-sensor-format`, 1.5)** : format temp/humidité.
- **`Sparkline` + `useHistory` (`RoomSensorCard`/1.5)** : courbe d'historique température (mock `useHistory` en test — leçon 1.5, `@hakit` inliné vitest).
- **`parseBattery`/`batteryColorClass` (`vacuum-status`, 2.7)** : batterie du module extérieur.
- **`BinTile` (6.1)** : pattern **widget HA fixe monté sous le provider** dans `KioskShell`. **`VacuumDetail` (5.3)** : pattern **page profonde contenu-seul 2 colonnes de tuiles** sans scroll. Réutiliser les deux.
- **Mapping (`entities/`, AD-7)** ; **kiosque 1024×768 sans scroll** (mémoire).

**@hakit :** `useWeather(entityId)` pour les prévisions (`getSupportedForecastTypes`) — **vérifier l'API au dev** (ou `weather.get_forecasts` via service). `useHistory(id, { hoursToShow })` pour la courbe. Accès HA via `@hakit` seulement (AD-2).

**Tendance Netatmo :** `sensor.…_temperature_trend` — états probables `up`/`down`/`stable` (+ `unknown`/`unavailable`). **Vérifier les valeurs exactes au dev** ; `trendArrow` mappe.

### Project Structure Notes

- **NEW** : `src/widgets/TopBarWeather.tsx` (+ `.test.tsx`) ; `src/widgets/weather-format.ts` (+ `.test.ts`) ; `src/pages/WeatherDetail.tsx` (+ `.test.tsx`).
- **UPDATE** : `src/entities/mapping.ts` (+ `.test.ts`) (`WeatherConfig` + `WEATHER` + `weatherConfig()`) ; `src/App.tsx` (route `/meteo` + `<TopBarWeather/>` sous provider) ; `_bmad-output/implementation-artifacts/sprint-status.yaml` (6-2 → in-progress → review).
- **Direction de dépendance** : `widgets`/`pages` → `hakit`/`entities`. Widget `fixed` sous provider ; page contenu-seul.
- **Style** : Tailwind ; `tabular-nums` (temp) ; couleur + texte ; kiosque sans scroll ; accents/valeurs lisibles à 0-1 m.

### Décisions ouvertes / dépendances

- **Task 0 (futur)** : intégration météo HA (Météo-France) → `weather.*` + capteur pluie ; condition/7j/pluie « à venir » sans ça.
- **API `useWeather`/prévisions** : à vérifier au dev (types `@hakit`).
- **Valeurs `temperature_trend`** : à confirmer au dev.
- **Placement fixe** widget météo (gauche) vs `BinTile` (centre) : coordonner, valider sur iPad.

### References

- [Source: epics.md#Epic 6 / Story 6.2 (correct-course 2026-07-16)]
- [Source: ARCHITECTURE-SPINE.md#AD-1 (HA source unique — pas d'API externe) · #AD-2 (I/O HA via @hakit uniquement) · #NFR5 (LAN-first) · #AD-3 (pas de cache) · #AD-6 (obsolescence) · #AD-7 (mapping) · #AD-10 (page profonde)]
- [Source: DESIGN.md/EXPERIENCE.md (coup d'œil, tabular-nums, contraste, cibles) · UX-DR4 (température = valeur de coup d'œil)]
- [Source: Story 1.5 (`Sparkline`/`useHistory`/`formatSensorValue`) · 1.6 (`useEntityValue`) · 2.7 (`batteryColorClass`) · 5.3 (`VacuumDetail` pattern page) · 6.1 (`BinTile` pattern widget top-bar sous provider ; memory target-device-and-layout)]
- [Source: @hakit/core 6.0.2 — `useWeather`, `useHistory`, `useEntity` (à vérifier au dev)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / dev-story)

### Debug Log References

- Gate 1 (typecheck) : ✅ `tsc -b` clean.
- Gate 2 (lint) : ✅ `oxlint src` clean.
- Gate 3 (test) : ✅ `vitest run` — 25 fichiers, **115 tests** verts.
- Gate 4 (build) : ✅ build token-free (`VITE_HA_TOKEN=` override — le garde-fou AD-8 bloque
  correctement quand le token est présent dans `.env`) ; **0 token JWT dans `dist/`**.
- Guards : **0 `fetch`/axios/XHR** dans le code météo ; **0 `entity_id` en dur** hors
  `src/entities/` (seules des mentions en commentaires).

### Completion Notes List

- **Buildable-maintenant livré** : widget `TopBarWeather` (temp + tendance + humidité +
  batterie, icône thermo) monté sous le provider ; page `/meteo` avec **Actuel** + **Historique
  température 24 h** (`Sparkline`/`useHistory`, réutilise 1.5).
- **Seams futurs** (Task 0, non devinés) : icône de condition (`conditionCategory` prêt),
  **prévisions 7 j** et **pluie 1 h** rendues « À venir » tant que `conditionEntityId`/
  `forecastEntityId`/`rainEntityId` sont absents du mapping. **Décision** : ne PAS pré-câbler
  `useWeather` en branche morte — l'API `@hakit` doit être vérifiée sur une vraie entité
  `weather.*` (sinon un import non résolu casserait typecheck/runtime). Insertion propre au
  moment de Task 0, sans rework ailleurs.
- **Réutilisation (zéro duplication)** : `useEntityValue`/`isStale` (1.6), `formatSensorValue`
  (1.5), `Sparkline`+`useHistory` (1.5), `parseBattery`/`batteryColorClass` (2.7), pattern
  widget top-bar fixe sous provider (`BinTile`, 6.1), pattern page contenu-seul 2 colonnes
  (`VacuumDetail`, 5.3).
- **TD-4 ouvert** : 3ᵉ élément top-bar HA `fixed` placé à la main (coordonnées fragiles) —
  extraire une zone de composition top-bar dès un 4ᵉ élément ou un chevauchement constaté.
- **À valider au dev sur device réel** (dépend de la LAN, TD-3) : valeurs exactes de
  `sensor.…_temperature_trend` (`trendArrow` couvre `up`/`down`/`stable`), placement fixe
  météo (`left-44`) vs bins (centre) sur l'iPad, absence de scroll sur `/meteo`.

### File List

**NEW**
- `src/widgets/weather-format.ts` — `trendArrow`, `trendColorClass`, `conditionCategory`, `conditionLabel`, `forecastDayLabel`, `forecastHourLabel` (purs).
- `src/widgets/weather-format.test.ts`
- `src/widgets/WeatherIcon.tsx` — icône de condition (SVG par catégorie ; défaut thermo) + `DropletIcon` (humidité, partagé widget/détail).
- `src/widgets/SensorHistoryChart.tsx` — graphe historique 24 h **Recharts** générique (mesure-agnostique : `series`/`color`/`unit`/`tickSuffix`/`ariaLabel`). Interactif (tooltip tactile), axe Y + lignes pointillées, sans seuil. Default-export, **lazy-loadé** (chunk partagé `/meteo` + `/room`).
- `src/widgets/SensorHistoryChart.test.tsx` — branches (données → région graphe ; <2 points → placeholder).
- `src/widgets/TopBarWeather.tsx` — widget barre sup. (fixed, sous provider).
- `src/widgets/TopBarWeather.test.tsx`
- `src/pages/WeatherDetail.tsx` — page `/meteo` (Actuel + Historique + prévisions daily/hourly).
- `src/pages/WeatherDetail.test.tsx`

**UPDATE**
- `src/entities/mapping.ts` — `WeatherConfig` + `WEATHER` (ids Netatmo + `weather.forecast_home`) + `weatherConfig()`.
- `src/App.tsx` — route `/meteo` → `<WeatherDetail/>` ; `<TopBarWeather/>` monté sous le provider.
- `TECH_DEBT.md` — ajout **TD-4** (widgets top-bar HA `fixed` hand-placed).
- `package.json` / `package-lock.json` — dépendance **`recharts`** (graphes pages détail ; lazy-loadée ; accueil `Sparkline` reste SVG maison).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `6-2` → `review`.

### Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2026-07-16 | 0.1 | Story 6.2 implémentée (buildable-now : widget + `/meteo` Actuel/Historique ; condition/7j/pluie seamés pour Task 0). Gates verts (115 tests). Status → review. |
| 2026-07-17 | 0.2 | Retour Florian : batterie retirée du widget accueil (garde-la sur `/meteo`) ; icône goutte 💧 ajoutée pour l'humidité (bleu `accent-shutters`). Gates verts (115 tests). |
| 2026-07-17 | 0.3 | `weather.forecast_home` mappé (Task 0 done, Florian) : icône de condition (widget + Actuel), prévisions **7 j (daily)** + **horaires** via `useWeather` (l'horaire remplace « pluie 1 h »). Tendance colorée (↑ rouge / ↓ bleu). Widget aligné sur la rangée de boutons TopBar (`top-6`/`px-4`). Icône humidité sur `/meteo`. Blocs graphe/prévisions remplissent leur tuile. Prévisions inversées (horaire en haut, jour en bas). Gates verts. |
| 2026-07-17 | 0.4 | Graphe historique migré vers **Recharts** (interactif, décision Florian) — lazy-loadé sur `/meteo` (chunk séparé ~101 KB gz, hors bundle accueil) ; SVG maison `temp-chart`/`TempHistoryChart` supprimé. `Sparkline` accueil inchangé. Gates verts (122 tests). |
