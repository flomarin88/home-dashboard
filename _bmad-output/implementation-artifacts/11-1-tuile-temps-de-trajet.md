---
baseline_commit: 12755ba2692274bf965657e9fc16d77957ff59e2
---

# Story 11.1: Tuile Temps de trajet (rafraîchissement à la demande)

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Florian,
I want connaître mon temps de trajet vers le travail d'un tap,
so that je sais s'il faut partir plus tôt sans sortir mon téléphone.

## Acceptance Criteria

**AC1 — Mapping, jamais d'`entity_id` en dur**
**Given** l'entrée Waze créée côté HA et son `entity_id` relevé (Task 0)
**When** la tuile lit sa source
**Then** l'id vit dans une config dédiée de `src/entities/mapping.ts` (moule `WeatherConfig`/`ElectricityConfig`) **et** est enregistré dans `AUX_ENTITY_IDS` — 0 `entity_id` en dur hors `src/entities/` (AD-7)

**AC2 — État « jamais rafraîchie » : aucun chiffre**
**Given** l'accueil qui s'affiche et une entité **non rafraîchie dans la session courante**
**When** la tuile se rend
**Then** elle affiche un **appel à l'action** (« Toucher pour actualiser ») et **aucune durée** — ni chiffre grisé, ni valeur barrée (AD-18b)
**And** c'est une **exception bornée** à UX-DR10/NFR4 : ce n'est pas un blanc, c'est un état rendu ; l'exception ne vaut que pour une **durée**, dont la péremption est invisible

**AC3 — Le tap déclenche le relevé**
**Given** la tuile au repos
**When** je la tape (cible **≥ 48px**, NFR2)
**Then** `homeassistant.update_entity` est appelé sur l'entité via `src/hakit/` (AD-2), **sans `returnResponse`** — le service est déclaré `SupportsResponse.NONE` côté HA (`supports_response` absent de `async_register`), et pour ce niveau le paramètre **ne doit pas être présent** : le passer ferait refuser l'appel, donc échouer chaque tap
**And** l'appel suit l'idiome déjà établi par `BinTile` : `void Promise.resolve(callService({…})).catch((err) => console.warn(…))` — détection d'échec **best-effort**, assumée comme telle
**And** la perte de connexion n'a pas besoin de cette détection : `isStale()` la couvre déjà (`connectionStatus !== "connected"`), donc HA injoignable rend « Indisponible » sans jamais entrer en attente
**And** la tuile passe en **attente visible**

**AC4 — L'attente se résout dans tous les cas**
**Given** la tuile en attente
**When** un nouvel état arrive **ou** que le **délai de garde (≥ 10 s)** s'écoule sans événement
**Then** l'attente se résout dans les deux cas — HA **n'émet pas** `state_changed` quand état et attributs sont inchangés, et un trafic stable est le **cas nominal**, pas une panne (AD-18a)
**And** le plancher de 10 s vient du debouncer du coordinator HA (`REQUEST_REFRESH_DEFAULT_COOLDOWN = 10`) : un délai plus court se désynchroniserait sur un double tap

**AC5 — Valeur fraîche horodatée**
**Given** un relevé dont l'attente s'est **résolue** dans la session
**When** la tuile se rend
**Then** elle affiche la **durée en minutes** (`tabular-nums`, UX-DR14) et **l'heure de la demande** via `formatSince` — la fraîcheur est portée à l'écran, pas supposée
**And** l'horodatage est celui de **la demande**, pas d'un `last_changed` qui n'a pas bougé

**AC6 — Échec et indisponibilité**
**Given** la promesse rejetée (quand le transport en rejette une), ou l'entité à `unknown`/`unavailable` (la source Waze tombe — documenté, pas hypothétique)
**When** la tuile se rend
**Then** un **état affiché** occupe la **même empreinte** que la version peuplée (UX-DR27), sans blanc ni spinner (NFR4)
**And** l'échec est journalisé `console.warn("trafic: homeassistant.update_entity failed", err)` — sur un iPad sans console, un `entity_id` fautif, un droit HA révoqué et une coupure réseau rendraient sinon le même « Indisponible »

**AC7 — Aucun repli payant**
**Given** AD-18c
**When** la source échoue
**Then** **aucun repli** vers Google ou HERE n'est déclenché — l'échec reste un échec visible

**AC8 — Empreinte constante**
**Given** les quatre états (jamais rafraîchie / attente / fraîche / indisponible)
**When** la tuile passe de l'un à l'autre
**Then** sa **largeur et sa hauteur ne changent pas** — largeur fixée en dur (`w-[…]`), pas dictée par le contenu
**And** l'espace de remplissage est un **insécable ` `** : `truncate` pose `white-space: nowrap`, qui collapse un espace ordinaire et fait remonter le bloc (~7px)

**AC9 — ⚠️ PLACEMENT NON TRANCHÉ**
**Given** qu'aucune maquette n'existe pour cette tuile et que la décision UX est **explicitement reportée** (choix de Florian, 2026-07-29)
**When** la tuile est montée
**Then** cette AC est **ouverte** — voir Task 6, seule tâche non exécutable en l'état
**And** la preuve device restera **invalidable** tant que ce point n'est pas décidé (précédent 9.1)

## Tasks / Subtasks

- [ ] **Task 0 — hors-repo, préalable au code** (AC: 1)
  - [ ] Confirmer l'`entity_id` **réel** de l'entrée Waze (`sensor.temps_trajet` est **annoncé, non vérifié**)
  - [ ] Vérifier que l'entrée est en **région `eu`**, origine `zone.home` → destination `zone.travail`
  - [ ] Couper **« Enable polling for updates »** dans les options système de l'entrée — **et non l'entité** : `CoordinatorEntity.async_update` sort sur `if not self.enabled: return`, une entité désactivée rend le tap silencieusement inopérant
  - [ ] ⚠️ **Ne pas coder sur placeholder.** 10.1 a fermé parce que Task 0 était levée avant l'écriture ; 9.1 est bloquée depuis 6 jours pour l'avoir fait dans l'autre sens

- [x] **Task 1 — Mapping** (AC: 1)
  - [x] `TrafficConfig` + `trafficConfig()` dans `src/entities/mapping.ts`, moule `ElectricityConfig` (`:478`/`:503`)
  - [x] Enregistrer l'id dans `AUX_ENTITY_IDS` (`:628`) — sans ça, une typo ship en tuile silencieusement vide (leçon 7.1 D4)
  - [x] Couvrir dans la suite « auxiliary entity_ids » de `src/entities/mapping.test.ts:164`

- [x] **Task 2 — Module pur de décision** (AC: 2, 5, 6)
  - [x] `src/widgets/traffic-view.ts` — fonction pure qui prend `{ value, isStale, loading, requestedAt, pending, failed, now }` et rend `{ kind: "idle" | "pending" | "fresh" | "unavailable", hero, sub, aria }`
  - [x] **`now` est un paramètre**, jamais `Date.now()` (leçon 9.2) — une fonction pure sans horloge se teste sans faux timers
  - [x] `src/widgets/traffic-view.test.ts` colocalisé, les 4 états + les bascules

- [x] **Task 3 — Seam de rafraîchissement** (AC: 3, 4, 6)
  - [x] `src/hakit/useEntityRefresh.ts` — hook qui expose `{ refresh(), pending, requestedAt, failed }`
  - [x] Appel `callService({ domain: "homeassistant", service: "update_entity", target })` — **sans `returnResponse`** (service `SupportsResponse.NONE` : le paramètre ferait refuser l'appel), enveloppé dans l'idiome `void Promise.resolve(...).catch(console.warn)` de `BinTile`
  - [x] **Garde anti-course** : `requestSeq` monotone + ref `alive`, moule `useCalendarEvents.ts:144,170,193,204` — une réponse lente ne doit pas écraser une plus récente
  - [x] Délai de garde ≥ 10 s, `clearTimeout` au démontage
  - [x] `console.warn` sur rejet, jamais de `catch {}` muet (constat de revue récurrent n°1)
  - [x] `src/hakit/useEntityRefresh.test.ts` : succès, rejet, double tap, démontage pendant l'attente, réponse lente après une plus récente

- [x] **Task 4 — Icône** (AC: 8)
  - [x] `src/widgets/TrafficIcons.tsx`, SVG **local** 24×24 `stroke="currentColor"`, moule `ConsumptionIcons.tsx`/`AgendaIcons.tsx` — aucune dépendance d'icônes externe

- [x] **Task 5 — Tuile** (AC: 2, 3, 5, 6, 8)
  - [x] `src/widgets/TrafficTile.tsx`, sans prop, moule barre supérieure : `inline-flex min-h-[56px] items-center gap-2 rounded-lg border border-card-border bg-card-fill px-4 backdrop-blur-glass`
  - [x] **`min-h-[56px]`, pas 52px** : le conflit UX-DR28 (cote de maquette) vs code a été tranché en 10.1 — on suit le code, l'invariant protégé est l'alignement avec les voisines
  - [x] Racine `<button type="button">` — la tuile est **interactive**, contrairement aux chips en lecture seule qui restent des `<div>`
  - [x] Chip **neutre**, aucun accent de domaine, **pas de vert** (UX-DR24 : palette saturée, vert réservé sécurité)
  - [x] `opacity-60` si stale — règle de la famille barre supérieure ; **pas de `OfflinePill` sur la chip** (règle de famille établie en 9.1, reprise en 10.1 ; la pill vit sur la page détail)
  - [x] Largeur du bloc texte fixée (`w-[…]`, moule `AgendaTile.tsx:79`)
  - [x] `src/widgets/TrafficTile.test.tsx`, moule `ElectricityTile.test.tsx` (mock `@hakit/core` entier via `vi.hoisted`)

- [ ] **Task 6 — ⚠️ Montage : BLOQUÉE par la décision UX** (AC: 9)
  - [ ] **Ne pas exécuter avant arbitrage de Florian.** Les tâches 1-5 livrent un composant complet et testé ; celle-ci le monte
  - [ ] Si barre supérieure : import + enfant de `<TopBarSlots>` dans `src/App.tsx:96-107`, **à l'intérieur de `<HakitProvider>`** (TD-1)
  - [ ] Si rangée d'accueil : `push` dans la liste `tiles` de `HomeContent` (`src/pages/Home.tsx:93-124`) — attention au plafond de 6 par rangée
  - [ ] Preuve device à 1024×748 **un jour où `BinTile` est affichée** (forçable en avançant l'`input_datetime` de sortie)

## Dev Notes

### Le fork de lecture — à ne pas se tromper

« Rafraîchie à la demande » recouvre deux chemins **incompatibles** dans ce projet, et l'erreur la plus probable est de prendre le mauvais :

| chemin | quand | module | fraîcheur |
| --- | --- | --- | --- |
| **état poussé** | un `sensor.*` existe, HA pousse son état | `src/hakit/useEntityValue.ts` | AD-6, gratuite |
| **lecture par requête** (AD-17) | la donnée n'existe qu'en appelant un service à réponse | `src/hakit/useCalendarEvents.ts` | à gérer soi-même |

**Ici c'est le chemin poussé.** `sensor.temps_trajet` est une entité HA ordinaire : `useEntityValue` s'applique, AD-6 couvre son obsolescence. **Seul le déclencheur du relevé est neuf.** Ne pas cloner `useCalendarEvents` — en reprendre uniquement la garde anti-course et la discipline de `catch`.

### Ce que l'entité fournit (vérifié dans le code de HA, 2026-07-29)

- State = durée en **minutes** (`UnitOfTime.MINUTES`, float)
- Attributs : `duration`, `distance`, `route`, `origin`, `destination`
- `WazeTravelTimeCoordinator(DataUpdateCoordinator[WazeTravelTimeData])`, `SCAN_INTERVAL = 5 min`, `config_entry` passé au parent — donc `pref_disable_polling` s'applique

### Pourquoi `useOptimisticControl` ne convient pas

`useOptimisticControl<D, T extends string>` suppose que `T` est un **token d'état HA** et que `model.isConverged(target, state)` est décidable. `update_entity` n'a **pas d'état cible** : la réponse légitime peut être « la même valeur qu'avant ». `isConverged` est indécidable, il n'y a rien à afficher optimistiquement, et le timeout marquerait un échec **systématique**. Ce n'est pas un contournement de confort — le hook est structurellement inapplicable (AD-18).

### ⚠️ Deux trous UX, à concevoir dans cette story

1. **L'attente sans spinner.** Le spinner est **interdit** (UX-DR19, UX-DR23, UX-DR27, `DESIGN.md:238`). Aucun UX-DR, aucun token, aucun composant ne couvre « demande → attente → arrivée ». Il faut inventer une attente **dans une puce de 56px, qui dure ≥ 10 s** — ce n'est pas un flash. NFR1 (< 200 ms) **ne s'applique pas** : il vise l'optimiste vers une cible connue.
2. **L'appel à l'action sans chiffre (AC2) contredit la lettre d'UX-DR10/NFR4** (« toujours la dernière valeur connue »). Réconciliable — un rendu n'est pas un blanc — mais l'exception n'est **écrite nulle part côté UX**. Sans un UX-DR neuf, elle sera relevée en revue comme une violation.

### Pièges hérités des stories précédentes

- **Mutation de `useRef` pendant le rendu** → capturer en `useEffect` (1.6 #2, redit en 10.1). Récurrent.
- **`loading` vs `offline`** : ne jamais tourner en skeleton perpétuel après un échec (`loading: !settled && !failed`).
- **Tests tautologiques** : un test qui compare un `className` littéral du JSX ne mord pas (jsdom ne fait aucun layout). Remède adopté en 10.1 : assertion structurelle **+ casser volontairement le code** pour vérifier que le test échoue.
- **Un échec ne consomme pas le budget de rafraîchissement** : ne pas avancer l'horodatage dans le `catch`.
- **Direction de dépendance** : si `src/hakit/` a besoin de logique pure, elle ne va **pas** dans `src/widgets/` — sortir un module de domaine (précédent `src/agenda/select.ts`).
- **Cascade Tailwind** : une seule utilitaire `border-*`/`text-*` par état, en classes conditionnelles, pas d'empilement.

### Contraintes de layout

- Barre supérieure **saturée** : 6 chips + horloge + `BinTile` conditionnelle + pill HC/HP dans ~280px. `TopBarSlots` est **borné** (`right-6` + `overflow-hidden`) : le mode d'échec choisi est **une chip coupée**, pas un débordement. Ta chip serait la **7ᵉ**.
- Rangée d'accueil : plafond **6 tuiles**, colonnes dérivées de `tiles.length` via `GRID_COLS`, classes **jamais interpolées**.
- Budget vertical UX-DR25 : 179px libres, **partagés**, premier servi premier consommé. Aucun test automatisé ne garde l'invariant no-scroll (**TD-9**) — vérification **visuelle sur l'iPad**.
- ⚠️ **Cote incohérente entre stories** : 9.1 dit « 1024×768 », 10.1 dit « 1024×748 ». Ni l'une ni l'autre n'explique l'écart (probablement écran vs viewport utile). **À trancher avant d'écrire un test de layout.**

### Preuve device — ce qui compte

« Vérifié sur le Mac » a été **explicitement rejeté** en 10.1 : *un navigateur de bureau ne dit rien du kiosque*. Deux points ne se vérifient que sur l'iPad : le rendu sous **WebKit 16.6** et la **collision de barre supérieure à 1024×748**.

### Project Structure Notes

Ordre d'ajout observé sur le dernier ajout de micro-tuile (commit `89dd0fe`) :
`docs/home-assistant.md` → `src/entities/mapping.ts` + test → seam `src/hakit/` + test → module pur + test → icônes → tuile + test → `src/App.tsx`.

- Import du seam **par chemin direct**, jamais via le barrel `src/hakit/index.ts` (écart de 10.1 revu et **accepté** — l'ajouter créerait une 2ᵉ façon d'importer le seam)
- Pas de composant partagé `TopBarChip` : le moule est **copié-collé**, duplication assumée
- Tests : Vitest, `globals: false` (importer `describe/it/expect/vi` depuis `"vitest"`), `TZ: "Europe/Paris"` épinglé, `@hakit` inliné
- Gates : `build` + `typecheck` + `lint` + `test` ; pre-commit Husky. Build AD-8 : `vite.config.ts:97` **échoue** si `VITE_HA_TOKEN` est présent

### References

- [Source: \_bmad-output/planning-artifacts/epics.md#Epic 11] — epic, Task 0, stories 11.1/11.2
- [Source: \_bmad-output/planning-artifacts/epics.md#AD-18] — fraîcheur à la demande, conséquences (a)(b)(c)
- [Source: \_bmad-output/planning-artifacts/spikes/spike-info-trafic-2026-07-29.md] — chiffrage des paliers, fragilité de la source, conception à deux entités
- [Source: src/hakit/useEntityValue.ts] — chemin de lecture poussé
- [Source: src/hakit/useCalendarEvents.ts:144,170,193,204] — garde anti-course
- [Source: src/hakit/stale.ts] — `isStale`, `formatSince`
- [Source: src/hakit/useOptimisticControl.ts:49-52] + [src/state/control-model.ts:31-36] — pourquoi l'optimiste ne s'applique pas
- [Source: src/widgets/AgendaTile.tsx:70,79] + [src/widgets/ElectricityTile.tsx:78] — moule de la chip
- [Source: src/entities/mapping.ts:478,503,628,644] — config dédiée + `AUX_ENTITY_IDS`
- [Source: src/ui/TopBarSlots.tsx:24-35] — bornage et mode d'échec
- [Source: \_bmad-output/implementation-artifacts/10-1-agenda-du-jour-accueil.md] — leçons, règle de famille, preuve device
- [Source: \_bmad-output/implementation-artifacts/9-1-micro-tuile-electricite-conso-cout.md] — le coût d'un placeholder

## Dev Agent Record

### Agent Model Used

claude-opus-5 (dev-story, 2026-07-29)

### Debug Log References

**🚨 AC3 EST FACTUELLEMENT FAUX — implémentation arrêtée sur Task 3.**

AC3 exige `returnResponse: true`. Vérifié dans le code de HA le 2026-07-29 :

```python
hass.services.async_register(
    DOMAIN, SERVICE_UPDATE_ENTITY, async_handle_update_service,
    schema=SCHEMA_UPDATE_ENTITY,
)
```

`supports_response` est **absent** ⇒ défaut `SupportsResponse.NONE`. Pour ce niveau,
la règle HA est : *le paramètre `return_response` ne doit pas être présent*. Le passer
fait **refuser l'appel** — chaque tap échouerait.

Ce que la story avait manqué : le cas que `returnResponse` devait attraper (connexion
non prête) est **déjà couvert un étage plus bas**. `isStale(state, connected)` renvoie
`true` dès que `connectionStatus !== "connected"` (`src/hakit/stale.ts:10-15`), donc HA
injoignable rend la tuile « Indisponible » sans jamais entrer en attente. La détection
recherchée existait déjà.

**Correction proposée (non appliquée — les AC sont hors des sections modifiables) :**
appel **sans** `returnResponse`, enveloppé dans l'idiome déjà établi par `BinTile`
(`src/widgets/BinTile.tsx:70-91`) :

```ts
void Promise.resolve(callService({ domain: "homeassistant", service: "update_entity", target }))
  .catch((err) => console.warn("trafic: homeassistant.update_entity failed", err));
```

La détection d'échec devient best-effort côté promesse ; le **délai de garde** reste le
vrai résolveur (AC4, inchangé) et la perte de connexion est couverte par AD-6 (AC6,
inchangé). Aucune autre AC n'est affectée.

**Vérification de morsure des tests (leçon « tests tautologiques », 10.1).**
`traffic-view.ts` muté volontairement (branche `idle` renvoyant `"34 min"`) → les deux
tests visés, *NEVER shows a duration before a refresh settled* et *keeps the digits out
of idle*, sont passés au rouge ; 9 autres restaient verts. Mutation annulée, suite
revenue à 11/11. Les tests mordent.

### Completion Notes List

- **Task 1 (Mapping) — faite.** `TrafficConfig` + `trafficConfig()` ajoutés après
  `calendarsConfig()`, id enregistré dans `AUX_ENTITY_IDS`. 2 tests ajoutés, suite
  mapping à 37/37.
  ⚠️ **Limite assumée** : l'appartenance à `AUX_ENTITY_IDS` n'est pas assertée
  directement — la constante est module-privée, comme pour **toutes** les autres
  configs. Les tests garantissent la bonne forme, pas l'enregistrement. Exporter
  `AUX_ENTITY_IDS` rendrait la leçon 7.1 D4 réellement testable, mais c'est un
  changement de convention transverse, hors périmètre de cette story.
- **Task 2 (Module pur) — faite.** `traffic-view.ts` : 4 états, `now` jamais lu depuis
  l'horloge, `formatSince` réutilisé plutôt que réécrit. 11 tests, dont un balayage
  anti-`NaN` sur 7 formes d'entrée et un test d'empreinte constante.
  Décision de conception : une 5ᵉ nuance a été ajoutée à `unavailable` —
  **« Valeur illisible »**, distincte d'« Indisponible ». Une dérive de format HA ne
  doit pas se déguiser en panne (leçon `unreadable` de la 10.1). Le `kind` reste
  `unavailable`, seul le libellé change.
- **Task 3 (Seam) — faite** après correction d'AC3 (autorisée par Florian, 2026-07-30).
  `useEntityRefresh(entityId, settleKey, guardMs)` : deux sorties d'attente (arrivée
  d'état **ou** délai de garde), garde anti-course `requestSeq` + ref `alive`,
  `clearTimeout` au démontage, `console.warn` sur rejet. 11 tests.
  Garde à **12 s** — au-dessus du plancher de 10 s du debouncer HA, avec marge.
- **Task 4 (Icône) — faite.** `RouteIcon` dans `TrafficIcons.tsx`, SVG local 24×24,
  aucune dépendance ajoutée. Pas de test dédié : les icônes du repo n'en ont pas, elles
  sont couvertes par les tests de tuile.
- **Task 5 (Tuile) — faite.** `TrafficTile.tsx`, moule barre supérieure, 12 tests.
- **Task 6** — bloquée par la décision UX de placement. **Réponse donnée le 2026-07-30 :
  un rail de navigation à gauche** (Accueil / Actions / Pièces / Trajets), qui donnerait
  enfin un point d'entrée à cette tuile. C'est une **refonte de navigation**, pas une
  tâche de cette story : instruite à part dans
  `spikes/spike-sidebar-navigation-2026-07-30.md`. Task 6 reste ouverte jusqu'à ce que ce
  chantier aboutisse.

**Décisions de conception prises dans cette story, qu'aucun UX-DR ne couvre :**

1. **L'attente est portée par les mots + `animate-pulse`** sur la sous-ligne. Le spinner
   est interdit par UX-DR19/23/27 et `DESIGN.md:238` ; un pulse n'en est pas un. Deux
   tests verrouillent l'absence de `.animate-spin` et de `role="progressbar"`.
   ⚠️ **À ratifier en UX-DR** — c'est une invention, pas l'application d'une règle.
2. **Le bouton reste tappable pendant l'attente.** `disabled` verrouillerait la tuile
   12 s sans échappatoire si l'attente se bloquait ; HA regroupe de toute façon les
   appels rapprochés derrière son debouncer de 10 s.
3. **La clause « insécable » d'AC8 est sans objet** : aucun état ne produit de ligne
   vide (verrouillé par un test dans `traffic-view.test.ts`), donc il n'y a pas d'espace
   de remplissage à protéger. Insérer un `\u00a0` factice aurait été du culte du cargo.
4. **`data-testid="traffic-lines"`** ajouté pour que l'assertion de largeur porte sur la
   structure et non sur un littéral de `className` recopié depuis le JSX — le mode
   d'échec exact des tests tautologiques relevé en 10.1.

**Vérification de morsure (4 mutations, toutes concluantes) :**

| Mutation | Test tombé |
| --- | --- |
| `idle` renvoie « 34 min » | *NEVER shows a duration…* + *keeps the digits out of idle* |
| garde anti-course retirée du `catch` | *does not let a superseded call clobber the newer one* |
| `settle()` retiré du délai de garde | *settles on the guard delay even when NO state event arrives* |
| `requestedAt ?? Date.now()` dans la tuile | *shows a call to action and NO duration…* |
| `w-[132px]` retiré | *pins the text block width…* |

Chaque mutation a été annulée et la suite revérifiée verte.
- **Task 0** — non levée : `sensor.temps_trajet` est rapporté par Florian, jamais
  observé depuis ici. Le polling coupé, la région `eu` et `zone.travail` restent
  invérifiables sans accès à son HA.

### File List

| Fichier | État |
| --- | --- |
| `src/entities/mapping.ts` | modifié — `TrafficConfig`, `trafficConfig()`, `AUX_ENTITY_IDS` |
| `src/entities/mapping.test.ts` | modifié — import `trafficConfig` + suite « traffic mapping » |
| `src/widgets/traffic-view.ts` | **nouveau** — module pur, 4 états |
| `src/widgets/traffic-view.test.ts` | **nouveau** — 11 tests |
| `src/hakit/useEntityRefresh.ts` | **nouveau** — seam AD-18 |
| `src/hakit/useEntityRefresh.test.ts` | **nouveau** — 11 tests |
| `src/widgets/TrafficIcons.tsx` | **nouveau** — `RouteIcon` |
| `src/widgets/TrafficTile.tsx` | **nouveau** — la tuile |
| `src/widgets/TrafficTile.test.tsx` | **nouveau** — 12 tests |

**Non touchés, volontairement :** `src/App.tsx` et `src/pages/Home.tsx` — le montage est
la Task 6, bloquée. La tuile existe, compile et est testée, mais **n'est rendue nulle part**.

## Change Log

| Date       | Version | Description                                                                                                                     |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-29 | 0.1     | Story créée (create-story). Contexte issu du spike du jour + 4 analyses parallèles. AC9 (placement) laissée ouverte sur décision de Florian. |
| 2026-07-30 | 0.3     | AC3 corrigé sur autorisation de Florian (`returnResponse` retiré). Tasks 3-4-5 implémentées : seam, icône, tuile. 34 tests ajoutés au total, suite 481 → 517. Tasks 0 et 6 restent ouvertes. |
| 2026-07-29 | 0.2     | dev-story : Tasks 1-2 implémentées et vertes (13 tests ajoutés). HALT sur Task 3 — AC3 exige `returnResponse: true`, or `homeassistant.update_entity` est déclaré `SupportsResponse.NONE` : le paramètre ferait refuser l'appel. Correction proposée en Debug Log, non appliquée (AC hors sections modifiables). |
