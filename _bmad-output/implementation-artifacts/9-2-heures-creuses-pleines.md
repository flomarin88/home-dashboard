---
baseline_commit: d916df2  # rafraîchi le 2026-07-28 : le précédent (643dd5b) était antérieur au merge de 10.1 et à sa revue, une revue de 9.2 aurait ressorti tout 10.1
---

# Story 9.2: Heures creuses / pleines

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Données réelles fournies par Florian 2026-07-27 : fenêtres HC 01h08–06h08 et 12h38–15h38 ; prix Creuses 0,0890 €/kWh, Pleines 0,1491 €/kWh. Les fenêtres vivent DANS HA (AD-4), jamais dans le bundle. -->
<!-- Décision Florian 2026-07-27 : « on oublie la notion de tarifs » = PAS de `utility_meter` avec `tariffs:`, PAS de compteurs par tarif, PAS d'automation de bascule. Le compteur unique de 9.1 reste la seule source de conso. -->
<!-- Conséquence assumée : coût = conso_totale × prix_de_la_période_courante ⇒ le coût SAUTE de +68% à chaque bascule. Compromis explicite, voir « Ce que ce choix coûte ». -->
<!-- Décision Florian 2026-07-27 : prochaine bascule = capteur template HA `device_class: timestamp` (précédent `sensor.sun_next_rising`), PAS de calcul horaire côté app. -->
<!-- Décision Florian 2026-07-27 : pill HC/HP SUR la micro-tuile (UX-DR23 littéral) — élargit la 5ᵉ chip → device-proof 1024×768 obligatoire, échappatoire « HC/HP » compact documentée. -->

## Story

As a Florian,
I want voir sur la micro-tuile Électricité **si je suis en heures creuses ou pleines**, et que le **coût du jour soit calculé au prix de la période en cours**, avec les **deux prix, le tarif appliqué et la prochaine bascule** sur `/electricite`,
so that je sais **quand l'électricité est la moins chère** et à quel prix je consomme en ce moment.

## Contexte & valeur

**Epic 9 (v2) — 2ᵉ tranche.** 9.1 a fondé le patron « flux de consommation » (lecture HA read-only → coût dérivé → micro-tuile → page détail → obsolescence) avec **un prix flat**. 9.2 **ajoute la conscience tarifaire** : période courante reflétée depuis HA, **deux prix**, tarif appliqué marqué, prochaine bascule. 9.3 clonera le patron pour l'eau. Toujours **HA-natif, reflect-only** (AD-16), **zéro écriture**, **zéro logique horaire côté client** (AD-4).

**Données réelles (Florian, 2026-07-27)** — elles vivent dans HA, pas dans le code :

| | fenêtres | prix |
| --- | --- | --- |
| **Creuses** | **01h08–06h08** et **12h38–15h38** | **0,0890 €/kWh** |
| **Pleines** | le reste de la journée | **0,1491 €/kWh** |

### ⚠️ Ce que ce choix coûte — à lire avant d'implémenter

**Décision Florian : pas de compteurs par tarif.** Le `utility_meter` de 9.1 reste **unique** (cumul total du jour) ; on n'ajoute ni compteur tarifé, ni automation de bascule. Donc l'app **ne sait pas** combien de kWh ont été consommés en creuses vs en pleines, et le coût ne peut être que :

```
coût_du_jour = conso_totale_du_jour × prix(période_courante)
```

**Cette formule est fausse dès que la journée a traversé les deux périodes, et l'écart est gros** : 0,0890 → 0,1491 €/kWh, soit **+68 %**. Concrètement, à 06h08 le chiffre héros de la tuile **saute de +68 % sans qu'un seul kWh n'ait été consommé** — 8,2 kWh passent de **0,73 €** à **1,22 €** d'un coup, puis re-sautent en sens inverse à 12h38.

**C'est assumé, pas ignoré.** Le coût affiché est **indicatif** (« à ce rythme et à ce tarif »), pas une facture. Deux conséquences pour le dev :

1. **Ne pas essayer de compenser** ce saut côté app (lissage, mémorisation du kWh à la bascule, coût cumulé maison) — ce serait de l'état persisté, interdit par AD-1/AD-16, et de la logique tarifaire, interdite par AD-4.
2. **La porte de sortie est côté HA, pas côté app** : si le saut gêne au device-proof, ajouter `tariffs: [creuses, pleines]` au `utility_meter` donne les deux seaux et rend le coût exact. L'app aurait alors juste besoin de deux entrées kWh de plus — **le reste de cette story ne bougerait pas**. Le noter, ne pas le construire.

## Contrat d'interface HA ↔ app (à respecter des deux côtés)

**5 entités** lues **read-only** via `@hakit` (AD-2), reflétées sans cache (AD-3). La 1ʳᵉ existe depuis 9.1 et **ne change pas**.

| entité | rôle | état attendu | statut |
| --- | --- | --- | --- |
| `sensor.electricite_conso_jour` | **conso totale** du jour (valeur affichée + graphe + base du coût) | nombre, **kWh cumulés depuis 00:00**, reset minuit HA | 9.1, **inchangé** |
| `input_number.prix_kwh` | ⚠️ **retiré du mapping** — remplacé par les deux prix ci-dessous | — | 9.1, **supprimé** |
| `binary_sensor.heures_creuses` | **période courante** | `on` = **creuses**, `off` = **pleines** | **NEW** |
| `input_number.prix_kwh_creuses` | prix unitaire HC | nombre, €/kWh (**0.0890**) | **NEW** |
| `input_number.prix_kwh_pleines` | prix unitaire HP | nombre, €/kWh (**0.1491**) | **NEW** |
| `sensor.hc_hp_prochaine_bascule` | **prochaine transition** | **ISO 8601** (`device_class: timestamp`) | **NEW** |

**Invariants du contrat :**

- **`on` = creuses** est le contrat. L'app ne reconnaît que `on` / `off` ; **toute autre valeur** (`unavailable`, `unknown`, absente) ⇒ période **inconnue** ⇒ dégradation AD-6, **jamais de crash, jamais de prix deviné**.
- **Aucune fenêtre horaire, aucun prix en dur dans le bundle.** `01:08 / 06:08 / 12:38 / 15:38` et `0.0890 / 0.1491` n'apparaissent **que** dans `docs/home-assistant.md` et dans HA. Un `rg '01:08|12:38|0\.0890|0\.1491' src/` doit rester **vide** — c'est un gate de la Task 7.
- **Zéro automation, zéro compteur supplémentaire.** Le `binary_sensor` est un **template** qui évalue l'heure courante ; il n'écrit rien, ne déclenche rien.

Contrat **à documenter** : `docs/home-assistant.md` § « Électricité — heures creuses / pleines (Story 9.2) » (Task 6).

| état des entrées | micro-tuile (`src/widgets/ElectricityTile`) |
| --- | --- |
| tout numérique, période connue | coût héros (`conso × prix appliqué`) + sous-ligne conso + **pill « 🌙 Creuses » / « ☀ Pleines »** |
| une entrée `unavailable`/`unknown`/socket perdue | **obsolescence** (AD-6) : dernières valeurs connues, chip atténuée (`opacity-60`), **jamais de blanc ni de spinner** ; tuile **toujours tappable** (c'est un read) |
| période stale mais **déjà vue** | **dernier tarif connu** conservé ⇒ le coût reste affiché (AC3 de l'epic) |
| période **jamais vue** | pill « Période — » **et coût « — »** (pas de prix par défaut, pas de coût inventé) |

## Acceptance Criteria

1. **Indicateur de période, jamais porté par la couleur (FR-E2, UX-DR14/UX-DR24).**
   > 🔄 **AC amendé par Florian le 2026-07-28, APRÈS implémentation.** La clause « pill **neutre**, teintes vertes/orange du mock **écartées** » est **levée** : les couleurs de la maquette sont appliquées (`#5fd39a` creuses, `#ffb23e` pleines, fonds à 16 %). Ce qui **reste vrai** : la couleur n'est jamais seule — pictogramme **et** mot l'accompagnent partout, et une période inconnue reste **muette** plutôt que de recevoir une 3ᵉ teinte. Deux collisions signalées et acceptées : le vert frôle `--color-security-ok` que UX-DR18 réserve à la sécurité, et l'ambre **est** `--color-accent-lights`. Réversible en changeant 4 tokens dans `index.css`.
   **Given** la période courante exposée par HA (`binary_sensor.heures_creuses`, Task 0 — l'app **ne calcule pas** le planning tarifaire, AD-4)
   **When** la micro-tuile Électricité se rend
   **Then** une **pill neutre** affiche **pictogramme + libellé** — 🌙 « Creuses » / ☀ « Pleines » — **jamais la couleur seule**, **jamais d'accent de domaine** (chip neutre, UX-DR24 ; les teintes vertes/orange du mock sont écartées — le vert est réservé sécurité, UX-DR18).
   **And** la même information est reprise dans l'`aria-label` de la tuile.

2. **Le coût suit le prix de la période courante (FR-E1/FR-E2, AD-16).**
   **Given** la conso totale du jour et les deux prix
   **When** le coût du jour se calcule
   **Then** `coût = conso_totale × prix(période_courante)`, calculé **au rendu**, **jamais persisté** (AD-1/AD-16).
   **And** si la conso **ou** le prix applicable manque / n'est pas numérique ⇒ coût `null` ⇒ « — » : **pas de coût inventé, pas de prix par défaut, pas de zéro implicite**.
   **And** le coût **change** au passage d'une bascule — c'est le comportement voulu ici (voir « Ce que ce choix coûte ») ; **aucune tentative de lissage** côté app.

3. **Page `/electricite` — la tuile « Heures creuses / pleines » remplace le seam « À venir ».**
   **Given** la page détail livrée en 9.1 (colonne droite = `ComingSoon`)
   **When** j'ouvre `/electricite`
   **Then** la tuile de droite affiche : **la période courante** (pictogramme + libellé), **les deux prix** (€/kWh, tabular-nums) avec le **tarif appliqué marqué** par un repère **textuel** (« Appliqué »), **pas par la couleur seule**, et **la prochaine bascule**.
   **And** le seam `ComingSoon` de 9.1 **disparaît** (son test est **mis à jour**, pas supprimé).
   **And** la page reste **1024×768 sans scroll**.

4. **Prochaine bascule = lecture, jamais un calcul (AD-4).**
   **Given** `sensor.hc_hp_prochaine_bascule` (état ISO, `device_class: timestamp`)
   **When** la tuile HC/HP de la page se rend
   **Then** l'heure est **formatée** depuis l'état reflété via le précédent existant `formatSunTime` (`weather-format.ts:104`, déjà utilisé pour `sensor.sun_next_rising` sur `/meteo`) — **aucun calcul d'échéance, aucune fenêtre horaire, aucun timer, aucun `Date.now()` côté app**.
   **And** le libellé suit la période courante (« Passage en **pleines** à 06h08 » quand on est en creuses).
   **And** état absent/invalide ⇒ « — » (jamais de blanc, jamais de « Invalid Date »).

5. **Obsolescence + a11y + kiosque + gates.**
   **Given** les 5 entités, la tuile, la page et le mapping
   **When** je termine
   **Then** l'obsolescence réutilise `useEntityValue`/`isStale` : **toute** entrée stale atténue la chip (`opacity-60`, règle unique héritée de 9.1 et de la famille top-bar) et l'`aria-label` dit « hors ligne » ; la pill « Hors ligne · HH:MM » vit **sur la page** (parité 9.1).
   **And** période stale **déjà vue** ⇒ **dernier tarif connu** ⇒ coût toujours affiché (AC3 de l'epic) ; période **jamais vue** ⇒ « Période — » **et** coût « — ».
   **And** tous les nombres en `tabular-nums` ; tous les `entity_id` dans `src/entities/` (AD-7) ; **aucune fenêtre horaire ni prix en dur dans `src/`** ; **kiosque 1024×768 sans scroll** (accueil **et** page) et **pas de collision top-bar** (la 5ᵉ chip s'élargit — voir Dev Notes) ; `build`+`typecheck`+`lint`+`test` **verts** ; **0 token** dans `dist/`.

## Tasks / Subtasks

- [x] **Task 0 — ✅ FAIT (Florian, 2026-07-28)** — les 4 `entity_id` réels sont revenus **identiques aux placeholders proposés**, aucun renommage nécessaire : `binary_sensor.heures_creuses`, `sensor.hc_hp_prochaine_bascule`, `input_number.prix_kwh_creuses`, `input_number.prix_kwh_pleines`.
  > ⚠️ **Le coût reste « — » malgré tout** : la conso vient de `sensor.electricite_conso_jour`, dont la création relève de la **Task 0 de la story 9.1**, toujours ouverte. Sans kWh, pas de coût — quel que soit le tarif. Ce qui fonctionne dès maintenant : la **pill HC/HP**, les **deux prix** sur `/electricite`, le marqueur « Appliqué » et la **prochaine bascule**.
  - [x] **`binary_sensor.heures_creuses`** — capteur **template** : `on` quand l'heure courante tombe dans **01:08–06:08** ou **12:38–15:38**, `off` sinon. **Pas d'automation, pas de compteur** — un template qui s'auto-évalue. YAML fourni en Task 6.
  - [x] **`sensor.hc_hp_prochaine_bascule`** — capteur **template** `device_class: timestamp` : prochaine borne parmi les 4, sinon 01:08 du lendemain. YAML fourni en Task 6.
  - [x] **Deux helpers `input_number`** : `prix_kwh_creuses` = **0.0890**, `prix_kwh_pleines` = **0.1491** (€/kWh, `step: 0.0001`).
  - [x] **Ne PAS toucher** au `utility_meter` de 9.1 : il reste le compteur unique (total du jour, graphe, base du coût).
  - [x] **Confirmer les 4 `entity_id` réels** → remplacer les placeholders dans `mapping.ts`.
  - [x] _(Doc écrite en Task 6 — guide de création + YAML fournis.)_

- [x] **Task 1 — Mapping HC/HP** (AC: 1, 2, 4, 5)
  - [x] `src/entities/mapping.ts` — étendre `ElectricityConfig` (moule `WeatherConfig`, `:420-451`) : garder `dailyKwhEntityId` ; **retirer `priceEntityId`** ; ajouter `periodEntityId` (`binary_sensor.*`), `priceCreusesEntityId`, `pricePleinesEntityId`, `nextSwitchEntityId`. Placeholders commentés `⚠️ Task 0`.
  - [x] `AUX_ENTITY_IDS` (`:554`) — **retirer** `ELECTRICITY.priceEntityId`, **ajouter les 4 neufs** (le `binary_sensor.*` passe `ENTITY_ID_RE` = `^[a-z_]+\.[a-z0-9_]+$`). Leçon **7.1 D4** : sans ça, une typo ship en tuile silencieusement atténuée.
  - [x] `src/entities/mapping.test.ts` (suite « auxiliary entity_ids », `:164`) — couvrir les nouveaux ids.

- [x] **Task 2 — Dérivation coût tarifée (pur)** (AC: 2, 5) — **TDD, à écrire en premier**
  - [x] `src/widgets/electricity-cost.ts` — **étendre** `electricityView` (⚠️ **signature cassante** : `{ kwh, price }` → `{ kwh, priceCreuses, pricePleines, period }` ; **les deux appelants** — tuile + page — migrent dans la même passe, `tsc` les nommera).
    Sorties : `{ kwh, period, priceCreuses, pricePleines, appliedPrice, cost }`.
    - `period` : normalisation du `binary_sensor` — `"on"` ⇒ `"creuses"`, `"off"` ⇒ `"pleines"`, **tout le reste** ⇒ `null`. Insensible à la casse, trim.
    - `appliedPrice` : `priceCreuses` si `period === "creuses"`, `pricePleines` si `"pleines"`, **`null` si la période est inconnue** (**pas de prix par défaut**).
    - `cost = kwh × appliedPrice`, **`null` si l'un des deux est `null`**.
    - **AUCUNE logique horaire** (AD-4) : la fonction ne connaît ni horloge, ni fenêtre, ni `Date.now()`. **Pur mapping**, testable sans faux timers. _(9.3 clonera le patron pour l'eau — prix unique, pas de période.)_
  - [x] `src/widgets/consumption-format.ts` — ajouter `periodLabel(period): "Creuses" | "Pleines" | "—"` (parité « — pour null »). Réutiliser `formatEuro`/`formatKwh`/`formatPrice` tels quels.
  - [x] Tests : `on` ⇒ prix creuses appliqué, `off` ⇒ prix pleines ; `unavailable`/`unknown`/`""`/casse mixte ⇒ `period` null **et** `cost` null ; conso manquante ⇒ `cost` null ; prix applicable manquant ⇒ `cost` null **même si l'autre prix est présent** (piège : ne pas retomber sur l'autre) ; `appliedPrice` exposé pour l'affichage.

- [x] **Task 3 — Pill HC/HP sur `ElectricityTile`** (AC: 1, 2, 5) — **TDD (composant)**
  - [x] `src/widgets/ConsumptionIcons.tsx` — ajouter **`MoonIcon`** et **`SunIcon`** (SVG locaux 24×24, `stroke="currentColor"`, `strokeWidth="2"`, gabarit `BoltIcon`/`WeatherIcon`). **Pas de dépendance d'icônes externe.** Tracés repris du mock (`mock-conso-topbar.html:119` lune, `:161` soleil).
  - [x] `src/widgets/ElectricityTile.tsx` — lire les 5 entités via `useEntityValue` ; `anyStale` = **OU logique des 5** (règle de dimming unique, cohérente avec 9.1 et la famille top-bar) ; `electricityView(...)` → coût + période.
    - [x] Ajouter la **pill** à droite de la colonne coût/conso : `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption` + fond **neutre** (`bg-card-fill` / bordure `card-border` — **pas** d'accent, UX-DR24) ; contenu = `MoonIcon`/`SunIcon` + `periodLabel(...)`. Période `null` ⇒ « Période — » sans icône.
    - [x] `aria-label` étendu : « Électricité : 0,73 € aujourd'hui, 8,2 kWh, heures creuses[ — hors ligne] — ouvrir le détail ».
    - [x] **PAS de `useService`/optimiste/undo** — read pur + navigation (invariant 9.1).
  - [x] Tests (`ElectricityTile.test.tsx`) — ⚠️ le mock actuel dispatche sur `id.includes("prix")` : **le réécrire** pour distinguer `prix_kwh_creuses` / `prix_kwh_pleines` / `binary_sensor.` / `prochaine_bascule`. Cas : `on` ⇒ coût au prix creuses + pill « Creuses » ; `off` ⇒ coût au prix pleines + pill « Pleines » ; **le coût change entre les deux** (c'est le comportement spécifié, l'asserter explicitement pour qu'il soit intentionnel et non accidentel) ; période `unavailable` **jamais vue** ⇒ « Période — » **et** coût « — » ; `disconnected` ⇒ `opacity-60` + dernières valeurs + **tap navigue toujours**.

- [x] **Task 4 — Tuile « Heures creuses / pleines » sur `/electricite`** (AC: 3, 4, 5) — **TDD (page)**
  - [x] `src/pages/ElectricityDetail.tsx` — **remplacer `<ComingSoon .../>`** (`:126`) par le contenu réel, dans le `Tile` existant (colonne droite, `min-h-0 flex-1`) :
    - période courante (icône + libellé) + pill « Hors ligne · HH:MM » si stale (moule `:74-79`) ;
    - **deux lignes tarifaires** : « 🌙 Creuses — 0,0890 €/kWh » / « ☀ Pleines — 0,1491 €/kWh », celle en cours marquée d'un **repère textuel** « Appliqué » (fond/bordure neutres en appui, **jamais la couleur seule**) ;
    - **prochaine bascule** : « Passage en pleines à 06h08 » — libellé dérivé de la période **courante**, heure via **`formatSunTime(nextSwitch.value)`** (importer depuis `weather-format.ts`, **ne pas réécrire un formatteur**).
  - [x] Tuile « Aujourd'hui » (`:71-99`) : la ligne prix passe du prix flat au **prix appliqué + période** (« 0,0890 €/kWh · Creuses »). Conso et graphe **inchangés** (compteur unique).
  - [x] Supprimer le helper `ComingSoon` (`:168-175`) s'il devient inutilisé (oxlint le signalera).
  - [x] Page **1024×768 sans scroll** : la colonne droite passe de ~4 lignes à ~8 — **vérifier `overflow-hidden`/`min-h-0`** et compacter si besoin.
  - [x] Tests (`ElectricityDetail.test.tsx`) : ⚠️ **mettre à jour** le test `:84` `shows the HC/HP tariff tile as an "À venir" seam` — il asserte le seam que cette story remplace. **Le réécrire pour asserter le contenu réel**, ne pas le supprimer (T0.3 : un test ne se plie pas au code, mais sa spec a légitimement changé ici). Ajouter : deux prix rendus, marquage « Appliqué » sur le bon selon la période, prochaine bascule formatée, `nextSwitch` invalide ⇒ « — », stale ⇒ dernières valeurs + pill.

- [x] **Task 5 — Device-proof top-bar (préparer, ne pas solder la dette)** (AC: 5)
  > ⚠️ **Prémisse périmée au 2026-07-28.** Cette task décrivait `TopBarSlots` comme « un `absolute left-44` **sans aucune barrière code** » et interdisait de solder la dette. Les deux points ont bougé **avant** cette story : la revue de code de 10.1 a porté la barre à **six** chips, ce qui a atteint le déclencheur écrit dans `deferred-work.md` (« à revoir si un 5ᵉ élément arrive »), et Florian a tranché de **borner la rangée** (`right-6` + `overflow-hidden`, commit `3f0172a`). La dette est donc **soldée**, hors de cette story. Conséquence à connaître pour le device-proof : un débordement ne se voit plus par un dépassement franc, il **coupe** la chip en trop.
  - [x] **Aucun changement de layout par défaut.** La pill élargit la 5ᵉ chip d'une barre à 5 éléments ; `TopBarSlots` est un `absolute left-44` **sans aucune barrière code** contre le chevauchement (`deferred-work.md:21`, dette déjà déclenchée par 9.1).
  - [x] **Échappatoire préparée** (à activer **seulement** si le device-proof montre une collision) : libellé compact « **HC** » / « **HP** » — UX-DR23 prévoit explicitement ce repli responsive. **Un seul point de changement** : `periodLabel` (Task 2). Le laisser trivialement basculable et le noter en commentaire.
  - [x] **NE PAS solder la dette collision ici** (borne `max-w` / couche grid = tâche distincte contrainte par TD-1, Rule 6). Si le device-proof la révèle ⇒ **escalader**, ne pas corriger dans cette story.

- [x] **Task 6 — Doc contrat HA** (Doc Impact) (AC: 1, 2, 4)
  - [x] `docs/home-assistant.md` — nouvelle section **« ## Électricité — heures creuses / pleines (Story 9.2) »** juste après la section 9.1, sur le moule des sections existantes : (1) `binary_sensor` template **avec les 4 horaires réels**, (2) capteur template `prochaine_bascule`, (3) les 2 helpers prix **avec les valeurs réelles**, **### Contrat d'interface (⚠️ le code du dashboard en dépend)**, **### Appliquer & tester**.
  - [x] **Documenter le compromis** : le coût est calculé au tarif de l'instant sur le cumul total ⇒ **il saute à chaque bascule** ; la correction, si un jour souhaitée, est **`tariffs:` sur le `utility_meter`** (côté HA), pas un patch app.
  - [x] **Mettre à jour la section 9.1** : la note « la Story 9.2 ajoutera un 2ᵉ prix » devient un renvoi ; signaler que **`input_number.prix_kwh` (flat) n'est plus lu** par le dashboard et peut être supprimé après migration.
  - [x] **C'est ici — et nulle part ailleurs — que vivent les horaires et les prix.**

- [x] **Task 7 — Validation (gates)** (AC: 5)
  - [x] `build` (sans token, garde AD-8 — cf. note 9.1 : déplacer temporairement `.env.local`, **le restaurer**) + `typecheck` + `lint` (oxlint) + `test` verts ; **0 `entity_id` en dur** hors `entities/` ; **0 token dans `dist/`** ; Prettier OK.
  - [x] **Gate spécifique AD-4/AD-16** : `rg -n '01:08|06:08|12:38|15:38|0\.0890|0\.1491' src/` ⇒ **aucun résultat**.
  - [ ] **Preuve device (Florian)** : pill correcte à l'instant T ; coût = `conso × prix de la période` (vérifier à la main) ; page `/electricite` (2 prix + « Appliqué » sur le bon + prochaine bascule) **sans scroll** ; `binary_sensor` coupé après avoir été vu ⇒ **dernier tarif conservé, coût toujours là** ; **ET pas de collision/scroll top-bar** à **1024×768** avec la pill. — _en attente Florian_

## Dev Notes

**Portée stricte.** Conscience tarifaire sur le patron 9.1 : période reflétée + coût au tarif courant + deux prix + prochaine bascule. **Hors scope — NE PAS construire :**
- **Toute fenêtre horaire, tout calcul d'échéance, tout timer, tout `Date.now()` côté app** → **interdit (AD-4)**. Si tu écris `01:08` ou `0.0890` dans `src/`, la story est ratée.
- **Compteurs par tarif / `utility_meter` avec `tariffs:` / automation de bascule** → **explicitement écartés par Florian**. Ne pas les réintroduire, même « pour bien faire ».
- **Lisser ou compenser le saut de coût à la bascule** (mémoriser le kWh au moment du basculement, cumuler un coût maison, figer une valeur) → **interdit** : état persisté (AD-1/AD-16) **et** logique tarifaire (AD-4). Le saut est le comportement spécifié.
- **Tuile Eau** → **9.3** (elle clonera `electricityView` — prix unique, pas de période).
- **Historique/graphe du coût, cumuls semaine/mois, comparaisons HC vs HP dans le temps** → hors scope (option « riche » écartée en 9.1).
- **Popover / primitive flottante** → **non** (décision 9.1 maintenue : le détail vit sur la page).
- **Accent couleur de domaine, teintes vertes/orange du mock** → **non** (UX-DR24 : pill **neutre** ; le vert est réservé sécurité, UX-DR18 — **le spec gagne sur le mock**).
- **Solder la dette collision top-bar** → tâche distincte (Rule 6).

**Réutilisation maximale — tout est déjà là :**
- `src/widgets/ElectricityTile.tsx` (9.1) — la tuile à étendre ; **ne pas la recréer**.
- `src/pages/ElectricityDetail.tsx` (9.1) — la page ; le `Tile` de droite change de contenu, **la coquille ne bouge pas**.
- `src/widgets/weather-format.ts:104` **`formatSunTime`** — formatteur d'un état ISO de capteur timestamp (« 06h08 »), déjà éprouvé sur `sensor.sun_next_rising`. **Précédent exact du besoin « prochaine bascule ».** Ne pas en écrire un autre.
- `src/hakit/useEntityValue.ts` (`{value, unit, isStale, loading, since}`, dernière valeur en ref éphémère, AD-6) · `src/hakit/stale.ts` (`isStale`, `formatSince`).
- `src/widgets/consumption-format.ts` (9.1) — `formatEuro`/`formatKwh`/`formatPrice`, convention « — » pour `null`.
- `src/entities/mapping.ts` — `ElectricityConfig` (`:461-477`) + `AUX_ENTITY_IDS` (`:554`) + `assertWellFormedAuxIds` (leçon 7.1 D4).
- `src/widgets/ConsumptionIcons.tsx` — où poser `MoonIcon`/`SunIcon` à côté de `BoltIcon`.

**Le coût dépend de la période — d'où la règle du « dernier tarif connu ».** `useEntityValue` conserve la dernière valeur non-stale en ref éphémère (AD-6). Donc :
- période **déjà vue** puis stale ⇒ `electricityView` reçoit la dernière période connue ⇒ **le coût reste affiché** (chip atténuée). C'est exactement l'AC3 de l'epic.
- période **jamais vue** ⇒ `period = null` ⇒ `appliedPrice = null` ⇒ `cost = null` ⇒ « — ». **Ne pas** retomber sur un prix par défaut : afficher un coût au mauvais tarif est pire qu'afficher « — ».

**Piège de la fonction pure.** `appliedPrice` doit être `null` quand le prix **applicable** manque, **même si l'autre prix est présent**. Un `priceCreuses ?? pricePleines` serait un bug silencieux qui facture les heures creuses au tarif plein (+68 %). Un test dédié.

**Signature cassante assumée.** `electricityView({kwh, price})` devient `{kwh, priceCreuses, pricePleines, period}`. Les **deux** appelants (`ElectricityTile`, `ElectricityDetailContent`) migrent dans la même passe. C'est voulu : **un seul point de parse et de calcul du coût** (invariant posé en 9.1), pas deux formules qui divergent.

**Compteur unique — ce qui ne change pas.** `sensor.electricite_conso_jour` reste la seule source de conso : valeur affichée, graphe 24 h, base du coût. **Le graphe de 9.1 ne bouge pas** ⇒ zéro régression sur ce qui est déjà validé. Le **sawtooth de minuit** reste attendu et fidèle (commentaire in-code présent, `ElectricityDetail.tsx:53-56`) — ne pas « lisser ».

**A11y (UX-DR14/UX-DR24) — jamais la couleur seule.** La période est portée par **icône + mot** ; le tarif appliqué par un **mot** (« Appliqué »), pas par une bordure colorée seule ; l'obsolescence par **atténuation + pill textuelle**. `tabular-nums` sur tous les nombres. L'`aria-label` de la tuile porte coût + conso + période + « hors ligne » le cas échéant.

**Collision top-bar (dette ACTIVE, amplifiée par cette story).** 9.1 avait fait le choix inverse (tuile étroite) pour ne pas la déclencher ; Florian a tranché pour la pill (UX-DR23 littéral). La barre porte horloge + 5 chips, marge ~280px, **aucune barrière code**. **Device-proof 1024×768 obligatoire.** Échappatoire : « HC »/« HP » via `periodLabel` (un seul point). 9.3 ajoutera une **6ᵉ** tuile (eau) ⇒ UX-DR23 prévoit alors « 1 chip Conso fusionnée **ou** 2 chips » — **c'est 9.3 qui tranchera**, pas cette story.

### Project Structure Notes

- **UPDATE** : `src/entities/mapping.ts` (+ `.test.ts`) ; `src/widgets/electricity-cost.ts` (+ `.test.ts`) ; `src/widgets/consumption-format.ts` (+ `.test.ts`) ; `src/widgets/ConsumptionIcons.tsx` ; `src/widgets/ElectricityTile.tsx` (+ `.test.tsx`) ; `src/pages/ElectricityDetail.tsx` (+ `.test.tsx`) ; `docs/home-assistant.md` ; `sprint-status.yaml`.
- **NEW** : aucun fichier. Toute la story tient dans l'existant — signe que le patron 9.1 a tenu.
- **Pas de route neuve, pas de composant de page neuf, pas de dépendance neuve.**
- **Direction de dépendance** inchangée : `widgets`/`pages` → `hakit`/`entities`. `electricity-cost.ts` reste **pur** (aucun import `@hakit`, aucune horloge).
- **Style** : Tailwind ; cible ≥48px ; `tabular-nums` ; kiosque sans scroll (accueil **et** `/electricite`). Prettier + pre-commit Husky (commit → lint-staged → typecheck → test).

### Décisions tranchées

- **Pas de compteurs par tarif** (Florian, 2026-07-27, « on oublie la notion de tarifs ») : le `utility_meter` de 9.1 reste unique. Ni `tariffs:`, ni automation de bascule.
- **Coût = `conso_totale × prix(période courante)`** — **saut de +68 % à chaque bascule assumé** ; correction future = côté HA (`tariffs:`), pas côté app.
- **Période courante = `binary_sensor.heures_creuses`** (template HA, `on` = creuses). Les fenêtres vivent dans HA (AD-4).
- **Prochaine bascule = capteur template HA `device_class: timestamp`**, lu et formaté via `formatSunTime`. Aucun calcul d'échéance côté app.
- **Prix = 2 helpers `input_number` HA** (0,0890 / 0,1491 €/kWh), pas de config runtime — cohérent avec 9.1 et modifiable **sans redeploy**.
- **Pill HC/HP sur la micro-tuile** (UX-DR23 littéral) ⇒ device-proof obligatoire, échappatoire « HC/HP » compact.
- **Pill neutre, icône + mot** — teintes vertes/orange du mock écartées (UX-DR24 > mock).
- **Signature de `electricityView` cassée volontairement** : un seul point de parse et de calcul du coût.
- **`input_number.prix_kwh` (flat) retiré du mapping** — remplacé par les deux prix tarifaires.

### Décisions ouvertes / dépendances

- **Task 0 bloquant** pour le device-proof uniquement : 2 capteurs template + 2 helpers (Florian). **Codable et testable intégralement** avec les mocks `@hakit` sans Task 0.
- **`entity_id` réels** des 4 nouvelles entités — à confirmer au device-proof (placeholders en attendant).
- **Sémantique du `binary_sensor`** : `on` = creuses **proposé** (c'est le contrat de l'app). Si Florian préfère l'inverse ou un `sensor` texte, c'est **une ligne** dans la normalisation — mais à trancher **avant** la doc (Task 6).
- **Libellé de période sur la tuile** : « Creuses »/« Pleines » par défaut ; repli « HC »/« HP » **si et seulement si** le device-proof montre une collision.
- **Le saut de +68 % au device-proof** : s'il gêne à l'usage, la suite est **`tariffs:` côté HA** (nouvelle story, l'app ne bouge presque pas). À rouvrir sur constat, pas par anticipation.
- **Densité top-bar à 6 éléments** (9.3, eau) : chip Conso fusionnée vs 2 chips (UX-DR23) — **reporté à 9.3**.
- **Sort du helper `input_number.prix_kwh`** côté HA : le dashboard ne le lit plus ; suppression = choix de Florian après migration (aucun impact app).

### References

- [Source: epics.md#Epic 9 · #Story 9.2 (Heures creuses/pleines) · #FR-E1/FR-E2/FR-E4 · #UX-DR23/UX-DR24 · #AD-16] — _l'AC « le tarif appliqué suit la période courante » est **implémentée à la lettre** ; sa limite arithmétique (journée traversant les deux périodes) est **documentée et acceptée**, pas ignorée._
- [Source: 9-1-micro-tuile-electricite-conso-cout.md — **patron fondateur** : contrat d'interface HA, reflect-only, coût dérivé jamais persisté, page `/electricite`, seam HC/HP « À venir » **que cette story remplit**, déviation assumée « pill sur la page, pas sur la tuile » **que Florian inverse ici**]
- [Source: sprint-change-proposal-2026-07-21.md — origine Epic 9 (correct-course) : AD-16, UX-DR23/24, Task 0, séquence 9.1→9.2→9.3]
- [Source: ux-designs/ux-home-dashboard-2026-07-20/inputs/mock-conso-topbar.html — variante B ; **tracés SVG lune (`:119`) et soleil (`:161`)** à reprendre ; **teintes `--creuses`/`--pleines` écartées** (UX-DR24)]
- [Source: src/widgets/ElectricityTile.tsx (tuile à étendre) · ElectricityTile.test.tsx (⚠️ mock à réécrire — dispatche sur `id.includes("prix")`, or il y a deux prix maintenant)]
- [Source: src/pages/ElectricityDetail.tsx `:126` (`ComingSoon` à remplacer), `:71-99` (tuile Aujourd'hui), `:53-62` (graphe, **ne pas toucher**) · ElectricityDetail.test.tsx `:84` (⚠️ test du seam **à mettre à jour**)]
- [Source: src/widgets/weather-format.ts `:104` **`formatSunTime`** — précédent exact « état ISO d'un capteur timestamp → HHhMM » (`sensor.sun_next_rising`)]
- [Source: src/widgets/electricity-cost.ts (fonction pure à étendre) · consumption-format.ts (formatteurs, convention « — ») · ConsumptionIcons.tsx (`BoltIcon`, gabarit des icônes locales)]
- [Source: src/entities/mapping.ts `:461-477` (`ElectricityConfig`), `:554` (`AUX_ENTITY_IDS`), `:46` (`ENTITY_ID_RE`) · mapping.test.ts `:164`]
- [Source: src/hakit/useEntityValue.ts (dernière valeur en ref éphémère — **c'est elle qui rend possible le « dernier tarif connu »**) · src/hakit/stale.ts (`isStale`, `formatSince`)]
- [Source: src/ui/TopBarSlots.tsx (`absolute left-44`, layout-only) · src/App.tsx `:93-99` (5 chips montées)]
- [Source: ARCHITECTURE-SPINE.md#AD-1 (HA vérité, app sans persistance) · **#AD-4 `:70-73` (toute logique horaire vit dans HA — la contrainte structurante de cette story)** · #AD-6 `:80-83` (obsolescence) · #AD-7 `:85-88` (mapping) · #AD-8 (build sans secret) · #AD-10 (pages détail)]
- [Source: deferred-work.md `:21` — dette collision top-bar (amplifiée par la pill)]
- [Source: docs/home-assistant.md `:293-360` (§ Électricité 9.1, moule de section + note « 9.2 ajoutera un 2ᵉ prix » à mettre à jour)]
- [Source: **vérifié** 2026-07-27 sur https://www.home-assistant.io/integrations/utility_meter/ — l'option `tariffs:` (un capteur par tarif + `select.<meter>` + bascule par `select.select_option`, **aucun capteur de total**) existe et rendrait le coût exact. **Écartée par Florian pour cette story** ; consignée comme la porte de sortie si le saut de +68 % gêne au device-proof.]
- [Source: memory `target-device-and-layout` (iPad 1024×768, jamais de scroll) · `name-the-instrument-before-claiming-verified` (le device-proof WebKit est l'instrument) · @hakit/core 6.0.2]

## Dev Agent Record

### Agent Model Used

_(à remplir par dev-story)_

### Debug Log References

- **Gate AD-4/AD-16 (horaires & prix hors du bundle)** — `rg '01:08|06:08|12:38|15:38|0\.0890|0\.1491' src --glob '!*.test.*'` ⇒ **vide**. Les occurrences restantes sont **toutes** des fixtures de test : ce sont elles qui prouvent l'arithmétique (+68 % entre les deux tarifs), et elles ne partent pas dans le bundle. Preuve décisive prise sur le **bundle réel** : `npm run build` sans token puis `rg -o '01:08|…|0\.1491' dist/ | wc -l` ⇒ **0**, et `rg -o 'eyJhbGciOi' dist/ | wc -l` ⇒ **0**. `.env.local` déplacé puis restauré, **empreinte SHA-256 identique avant/après** (`a71a750a…`).
- **Gate AD-7** — aucun `entity_id` électricité hors `src/entities/`. Les seuls restes de la recherche sont `calendar.*` (un **domaine**, pas un id) et `calendar.get_events` (un **service**), pré-existants de 10.1.
- **Piège de test rencontré** — les nouveaux champs du mock de `ElectricityDetail.test.tsx` n'étaient pas réinitialisés dans `beforeEach` : cinq tests échouaient par **pollution inter-tests** et passaient en isolation. Symptôme trompeur : les erreurs parlaient de texte introuvable, pas d'état résiduel.
- **Deux pills « Hors ligne »** — ma première version en posait une sur la tuile HC/HP en plus de celle d'« Aujourd'hui ». L'AC5 en demande **une** sur la page ; la seconde a été retirée (l'atténuation de la tuile porte déjà l'information).

### Completion Notes List

- **AC1–AC5 satisfaits côté app ; la preuve device reste due** (elle seule couvre la collision de barre supérieure et le rendu réel).
- **+28 tests → 393 verts** (52 fichiers), typecheck, oxlint et Prettier propres, build sans token RC=0. Répartition : `electricity-cost` +12, `ElectricityTile` +10 (suite réécrite), `ElectricityDetail` +7, `mapping` +6, `consumption-format` +4.
- **Écrit en TDD**, tâche par tâche : chaque suite a été vue **rouge** avant implémentation (5 échecs sur le mapping, 12 sur la dérivation, 10 sur la tuile, 11 sur la page).
- **Le piège central de la story est verrouillé par un test dédié** : quand le prix de la période courante manque alors que l'autre est disponible, `appliedPrice` et `cost` valent `null`. Un `priceCreuses ?? pricePleines` factureraient les heures creuses au tarif plein — **+68 %** silencieux. Testé au niveau pur **et** au niveau composant.
- **Le saut de coût à la bascule est asserté**, pas subi : un test compare les deux périodes et vérifie que le rapport vaut exactement `0,1491 / 0,0890`. Quiconque « corrigera » ce saut devra supprimer un test qui explique pourquoi il existe.
- **Libellé compact « HC »/« HP » activé d'emblée** (décision Florian 2026-07-28) plutôt que gardé en réserve : la story 10.1 venait de porter la barre à six chips. `periodLabel` reste le point unique de bascule vers la forme longue. L'`aria-label` et la page, eux, épellent « heures creuses » — « HC » lu à voix haute ne dit rien (AC1).
- **`formatPrice` passe à 4 décimales.** La Task 2 disait de réutiliser les formatteurs « tels quels », mais l'AC3 et la doc rendent « 0,0890 €/kWh » : à 2 décimales, 0,0890 et 0,0899 s'affichent identiquement. L'AC (comportement observable) l'emporte sur l'indication d'implémentation. Le coût, lui, reste à 2 décimales — c'est de l'argent qu'on lit, pas un tarif qu'on compare.
- **Une seule pill « Hors ligne »** sur la page (AC5, parité 9.1), sur la tuile « Aujourd'hui ».
- **Jeu de couleurs de la maquette appliqué** (Florian, 2026-07-28, après coup — l'AC1 disait l'inverse) : 4 tokens `--color-tariff-*` dans `index.css`, un helper unique `periodTone` pour que la tuile et la page ne divergent pas. **Vérifié sur le CSS compilé**, pas seulement sur les chaînes de classe : les 6 utilitaires sont émis et les deux teintes présentes dans `dist/assets/*.css` — un test qui asserte un `className` ne dit rien de ce que Tailwind génère réellement.
- **Le test « aucun accent de domaine » a été réécrit, pas supprimé.** Il assertait l'inverse du nouveau besoin — et pire, sa regex (`bg-(green|orange|…)-`) n'aurait **jamais** matché `bg-tariff-creuses-soft` : il serait passé au vert en ne prouvant rien. Remplacé par trois tests : la teinte suit la période, elle n'est jamais seule (glyphe + mot présents), et une période inconnue reste muette.
- **`ComingSoon` supprimé** : plus aucun consommateur une fois le seam de 9.1 rempli. Son test a été **réécrit** (le seam était la spec en 9.1, le contenu réel l'est maintenant), pas supprimé.
- **Ce qui reste (non-agent, Florian)** :
  1. **Task 0** — créer les 2 capteurs template + les 2 helpers `input_number` (YAML fourni dans `docs/home-assistant.md`), puis confirmer les 4 `entity_id` réels et remplacer les placeholders du mapping.
  2. **Preuve device** — pill correcte à l'instant T ; coût = `conso × prix de la période` vérifié à la main ; `/electricite` sans scroll ; période coupée après avoir été vue ⇒ dernier tarif conservé ; **et surtout la barre supérieure à 1024×768 avec `BinTile` affichée** — désormais à six chips **plus** cette pill.
- **⚠️ Budget de barre supérieure** : la dette collision a été soldée pendant la revue de 10.1 (`TopBarSlots` borné, commit `3f0172a`), donc un débordement **coupe** au lieu de déborder. Ni 10.1 ni 9.2 n'ont encore été vues sur l'appareil — si la barre est trop chargée, le symptôme sera une chip tronquée.

### File List

**Créés :** aucun — toute la story tient dans l'existant, comme prévu.

**Modifiés :**

- `src/entities/mapping.ts` + `.test.ts` — `ElectricityConfig` passe de 2 à 5 entités (`priceEntityId` retiré, `periodEntityId`/`priceCreusesEntityId`/`pricePleinesEntityId`/`nextSwitchEntityId` ajoutés) ; `AUX_ENTITY_IDS` mis à jour
- `src/widgets/electricity-cost.ts` + `.test.ts` — `normalisePeriod` ajouté ; `electricityView` prend `{kwh, priceCreuses, pricePleines, period}` et rend `appliedPrice` en plus (signature cassée volontairement)
- `src/widgets/consumption-format.ts` + `.test.ts` — `periodLabel` (compact) et `periodName` (épelé) ajoutés ; `formatPrice` passe à 4 décimales
- `src/widgets/ConsumptionIcons.tsx` — `MoonIcon`, `SunIcon`, `PeriodIcon`
- `src/widgets/ElectricityTile.tsx` + `.test.tsx` — 4 entités lues, pill HC/HP, `aria-label` étendu ; suite de tests réécrite (l'ancien mock dispatchait sur `id.includes("prix")`, qui ne discrimine plus)
- `src/pages/ElectricityDetail.tsx` + `.test.tsx` — seam `ComingSoon` remplacé par la tuile réelle (période, deux tarifs, marqueur « Appliqué », prochaine bascule) ; helper `ComingSoon` supprimé
- `docs/home-assistant.md` — section « Électricité — heures creuses / pleines (Story 9.2) » + note de dépréciation sur `input_number.prix_kwh`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-28 | 0.4 | **Jeu de couleurs de la maquette appliqué** (demande de Florian après implémentation, renversant la clause « pill neutre » de son propre AC1) : 4 tokens `--color-tariff-*` repris verbatim de `mock-conso-topbar.html:13-14`, helper `periodTone` partagé entre la tuile et la page, ligne tarifaire active bordée et teintée de la couleur de **sa** période. **Ce qui n'a pas bougé** : la couleur n'est jamais le seul porteur — pictogramme et mot partout, marqueur « Appliqué » toujours textuel, période inconnue laissée muette. **Deux collisions signalées et acceptées** : le vert `#5fd39a` frôle `--color-security-ok` que UX-DR18 réserve à la sécurité, et l'ambre `#ffb23e` **est** `--color-accent-lights`. **Task 0 close** le même jour : les 4 `entity_id` réels sont revenus identiques aux placeholders. **399 tests verts** (+6), et les 6 classes utilitaires **vérifiées présentes dans le CSS compilé** — un `className` asserté en test ne prouve pas que Tailwind l'a émis. |
| 2026-07-28 | 0.3 | **Implémentée (dev-story).** Conscience tarifaire sur le patron 9.1 : `ElectricityConfig` passe de 2 à 5 entités, `electricityView` prend les deux prix + la période et rend `appliedPrice`, la micro-tuile porte une pill HC/HP, et la page `/electricite` remplit le seam « À venir » de 9.1 (période courante, **les deux** tarifs, marqueur textuel « Appliqué », prochaine bascule lue via `formatSunTime`). **Le piège de la story est verrouillé** : quand le prix de la période courante manque alors que l'autre est là, `appliedPrice` et `cost` valent `null` — un `??` aurait facturé les heures creuses au tarif plein, +68 % en silence. Testé au niveau pur ET composant. **Le saut de coût à la bascule est asserté**, pas subi : un test fixe le rapport à `0,1491/0,0890` pour qu'un futur « lissage » doive supprimer un test qui explique pourquoi il existe. **Écrit en TDD** — chaque suite vue rouge avant implémentation. **Libellé compact « HC »/« HP » activé d'emblée** (décision Florian) : la story 10.1 venait de porter la barre à six chips ; l'`aria-label` et la page épellent la période. **`formatPrice` passe à 4 décimales** — l'AC3 rend « 0,0890 €/kWh », que 2 décimales confondraient avec 0,0899. **Gates** : +28 tests → **393 verts**, typecheck/oxlint/Prettier propres, build sans token RC=0, **0 horaire, 0 prix et 0 token dans `dist/`** (vérifié sur le bundle, pas seulement sur `src/`), `.env.local` restauré à empreinte identique. **Reste** : Task 0 (2 capteurs template + 2 helpers côté HA, YAML fourni dans la doc) et la **preuve device** — d'autant que la barre supérieure porte désormais six chips **plus** cette pill, et qu'un débordement coupe au lieu de déborder depuis que `TopBarSlots` est borné. → review. |
| 2026-07-27 | 0.2 | **Réécrite après décision Florian « on oublie la notion de tarifs »** : suppression du `utility_meter` avec `tariffs:`, des compteurs par tarif et de l'automation de bascule. Le compteur unique de 9.1 reste la seule source de conso. **Période courante = `binary_sensor.heures_creuses`** (template HA, `on` = creuses, fenêtres **01h08–06h08 / 12h38–15h38** côté HA). **Prix réels fournis** : Creuses **0,0890 €/kWh**, Pleines **0,1491 €/kWh**, en 2 helpers `input_number`. **Coût = `conso_totale × prix(période)`** — **saut de +68 % à chaque bascule documenté et assumé** (8,2 kWh : 0,73 € → 1,22 € à 06h08), avec interdiction explicite de compenser côté app et la porte de sortie nommée (`tariffs:` côté HA, nouvelle story). Task 0 allégée : **2 capteurs template + 2 helpers**, zéro automation. Le reste (pill sur la tuile, prochaine bascule via `formatSunTime`, remplacement du seam `ComingSoon`, gates AD-4) est inchangé. |
| 2026-07-27 | 0.1 | Story 9.2 créée (create-story). Version initiale fondée sur des compteurs par tarif (`utility_meter` `tariffs:`) rendant le coût exact — **écartée par Florian** au profit d'un montage HA plus léger. Conservée en trace : l'analyse arithmétique (la journée traverse les deux tarifs) reste valide et explique pourquoi le coût saute dans la v0.2. |
