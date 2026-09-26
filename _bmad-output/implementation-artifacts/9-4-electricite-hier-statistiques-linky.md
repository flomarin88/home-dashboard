---
baseline_commit: 9f761f838c8c30f237c334fd6e514607781cabdd
---

# Story 9.4: Électricité — hier, depuis les statistiques Linky

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Créée le 2026-09-26 par create-story, depuis sprint-change-proposal-2026-09-25.md (approuvée). Remplace la SOURCE de 9.1, pas son patron : tuile, page, formatteurs, mapping restent. -->
<!-- Identifiants fournis par Florian (2026-09-25/26) : conso `linky:24305788525104`, coût `linky:24305788525104_cost`. Format du second VÉRIFIÉ dans le code de ha-linky (`src/ha.ts:29` : `linky:${prm}_cost`, unité `€`, libellé « (costs) »). Son EXISTENCE dans le HA de Florian reste à confirmer au device-proof (Task 0). -->
<!-- Deux décisions Florian 2026-09-25 : (1) afficher le DERNIER JOUR COMPLET, toujours daté ; (2) coût calculé par HA (ha-linky `costs` en mode `entity_id`), l'app ne multiplie plus. -->

## Story

As a Florian,
I want voir ce que l'électricité m'a coûté **hier**, avec la conso, au tarif HC/HP réel,
so that je garde un œil sur ma facture sans exiger une donnée temps réel que Linky ne fournit pas.

## Contexte & valeur

**Pourquoi cette story existe.** La 9.1 a été livrée sur un placeholder `sensor.electricite_conso_jour` qui **ne peut pas exister** : la source du foyer est l'add-on **ha-linky**, qui n'expose aucune entité. Il écrit deux **statistiques à long terme** dans le recorder de HA, importées le matin (6h–7h30, repli 9h–10h30) pour **la veille**. Deux conséquences fermes : pas d'état d'entité (donc ni `useEntityValue`, ni `useHistory`, ni AD-6 sur la conso), et **jamais de « aujourd'hui »**. La story remplace le chemin de lecture et le jour affiché ; **le patron 9.1/9.2 (tuile, page, formatteurs, pill HC/HP, mapping) est réutilisé tel quel**.

**Ce qui est gagné au passage.** Le coût d'hier est calculé **par HA** (ha-linky `costs`, demi-heure par demi-heure, au prix courant lu dans HA). Le **saut de +68 %** à chaque bascule, assumé en 9.2, **disparaît de la tuile** — sans une ligne de logique tarifaire côté app (AD-4 renforcé).

**Architecture.** `recorder.get_statistics` est un **service à réponse** (`SupportsResponse.ONLY`, vérifié HA 2026.7.3) appelé via `callService` + `returnResponse: true` : c'est **AD-17 à la lettre**, deuxième instance après `calendar.get_events`. **Aucune exception AD-2**, aucun accès websocket brut, tout reste dans `src/hakit/`.

## Contrat d'interface HA ↔ app (à respecter des deux côtés)

| identifiant                          | nature                                 | unité | granularité | rôle                                        |
| ------------------------------------ | -------------------------------------- | ----- | ----------- | ------------------------------------------- |
| `linky:24305788525104`               | statistique externe (recorder)         | Wh    | heure       | conso — demander `units: { energy: "kWh" }` |
| `linky:24305788525104_cost`          | statistique externe produite par `costs` | €     | heure       | coût — **calculé par HA**                   |
| `binary_sensor.heures_creuses`       | entité (9.2, inchangée)                | on/off | —          | pill HC/HP courante                          |
| `input_number.prix_kwh_creuses/_pleines` | entités (9.2, inchangées)          | €/kWh | —           | tuile HC/HP de la page                      |
| `sensor.hc_hp_prochaine_bascule`     | entité (9.2, inchangée)                | ISO   | —           | prochaine bascule                           |
| `sensor.prix_kwh_courant`            | **entité HA neuve (Task 0)**, lue par ha-linky, **jamais par l'app** | €/kWh | — | prix instantané pour le calcul de coût côté add-on |

**Appel unique de lecture (les deux ids dans le même appel) :**

```ts
callService({
  domain: "recorder",
  service: "get_statistics",
  serviceData: {
    start_time: start.toISOString(),   // UTC ISO — HA fait `dt_util.as_utc`, aucune ambiguïté de fuseau
    end_time: end.toISOString(),
    statistic_ids: [cfg.consumptionStatisticId, cfg.costStatisticId],
    period: "day",                     // ou "hour" pour le graphe
    types: ["change"],                 // énergie/coût DE la période = sum(fin) − sum(début), calculé par HA
    units: { energy: "kWh" },          // convertit la conso Wh → kWh côté HA ; le coût (€) n'est pas touché
  },
  returnResponse: true,                // ⚠️ load-bearing (leçon 10.1) : sans lui la promesse résout `void`
});
```

**Réponse (forme vérifiée dans `recorder/services.py` @ 2026.7.3) :**

```json
{ "response": { "statistics": {
  "linky:24305788525104":      [{ "start": "2026-09-24T22:00:00+00:00", "end": "2026-09-25T22:00:00+00:00", "change": 8.213 }],
  "linky:24305788525104_cost": [{ "start": "2026-09-24T22:00:00+00:00", "end": "2026-09-25T22:00:00+00:00", "change": 1.07 }]
} } }
```

- `start`/`end` sont des **ISO UTC** ; le jour local se lit avec `new Date(start)` dans le fuseau du kiosque (la suite épingle `TZ=Europe/Paris`). Les buckets `day` sont alignés sur les **minuits locaux de HA**, pas sur `start_time`.
- `change` peut être **absent** sur la toute première ligne d'une statistique (pas de `sum` antérieur) et une **clé peut manquer** si l'id est inconnu → les deux cas se traitent comme « pas de donnée pour ce jour », jamais comme zéro.
- Une journée dont ha-linky n'a eu que la valeur quotidienne (au-delà de 7 jours) rend **une seule ligne horaire** entre 0h et 1h — fidèle, pas un bug.

## Acceptance Criteria

**AC1 — Mapping : deux identifiants de statistiques, zéro placeholder**
**Given** les identifiants relevés en Task 0
**When** la tuile ou la page lit sa source
**Then** `ElectricityConfig` porte `consumptionStatisticId` et `costStatisticId` **à la place de** `dailyKwhEntityId` (supprimé, plus aucun lecteur) ; les 4 entités de 9.2 restent
**And** un `STATISTIC_ID_RE` (`source:object_id`) valide leur forme dans un `AUX_STATISTIC_IDS` + `assertWellFormedStatisticIds()`, appelé dans le bloc `import.meta.env.DEV` à côté d'`assertWellFormedAuxIds()` — `ENTITY_ID_RE` ne matche pas un deux-points et **doit** rester strict
**And** `rg 'linky:' src --glob '!src/entities/**' --glob '!*.test.*'` ⇒ **vide** (AD-7)

**AC2 — Lecture par requête, dans le seam**
**Given** la connexion HA établie
**When** la tuile ou la page se monte
**Then** un hook `src/hakit/useStatistics.ts` appelle `recorder.get_statistics` **une fois pour les deux ids** (`period: "day"`, `types: ["change"]`, `units: { energy: "kWh" }`, `returnResponse: true`), sur la fenêtre **[J−2 00:00 local, J 00:00 local)** recalculée **au moment de l'appel**, jamais à la construction
**And** garde anti-course `requestSeq` + ref `alive` (moule `useCalendarEvents.ts:123-134,170,193,204`) ; `console.warn("électricité: recorder.get_statistics failed", err)` sur rejet ; **jamais de `catch {}` muet**
**And** rafraîchissement : au montage, au retour de connexion, au retour au premier plan, au **changement de jour civil**, et **toutes les 60 min** (`STATISTICS_REFRESH_MS`) — **pas plus court** ; un échec **ne consomme pas** le budget (retente au tick suivant, leçon P4 de 10.1)

**AC3 — La tuile montre le dernier jour complet, daté**
**Given** la réponse
**When** `ElectricityTile` se rend
**Then** héros = **coût du dernier jour complet** (`formatEuro`), sous-ligne = **conso du même jour** (`formatKwh`) **+ son libellé daté** (UX-DR30) : « Hier » si c'est J−1, sinon la date courte « mar. 23 » ; l'`aria-label` porte la forme longue (« hier, mercredi 24 septembre »)
**And** conso et coût sont **indépendants** : l'un manquant rend « — » sans effacer l'autre
**And** la **pill HC/HP** de 9.2 reste sur la chip (période **courante**, elle n'est pas datée : elle dit où on est maintenant)
**And** la chip ne s'élargit pas au-delà de son empreinte 9.2 — la date **remplace** un mot, elle ne s'ajoute pas ; device-proof top-bar exigé (6 chips + pill)

**AC4 — Aucun jour disponible = un état rendu**
**Given** aucune ligne exploitable dans la fenêtre (import jamais fait, ids inconnus, `change` absent)
**When** la tuile ou la page se rend
**Then** « **Pas encore de relevé** », **même empreinte** que la version peuplée (UX-DR27), jamais de blanc ni de spinner ; `loading` (première connexion, rien reçu) rend « — » dans la même empreinte

**AC5 — Échec et déconnexion**
**Given** la requête rejetée, ou `connectionStatus !== "connected"`
**When** la tuile ou la page se rend
**Then** **dernière réponse connue conservée** + obsolescence (`isStale`) : `opacity-60` et « hors ligne » dans l'`aria-label` sur la chip ; pill « Hors ligne · HH:MM » **sur la page**, horodatée de la **dernière requête réussie** (`since`), pas d'un `last_changed` — règle de famille 9.1/10.1
**And** une réponse **lente qui arrive après une plus récente** n'écrase rien (test dédié)

**AC6 — La page `/electricite` suit**
**Given** la page
**When** elle se rend
**Then** la tuile « Aujourd'hui » devient « **Hier · mercredi 24 septembre** » (ou la date du jour affiché) : coût HA héros, conso, **plus de ligne « prix × période »** (le prix ne s'applique plus au chiffre affiché)
**And** le graphe devient **les 24 heures du jour affiché** en **barres** (`period: "hour"`, `types: ["change"]`, second appel dont la fenêtre est **le jour sélectionné**), titre « Conso horaire — <libellé daté> », `unit="kWh"` ; `useHistory` **disparaît** de la page
**And** la tuile HC/HP de 9.2 (période courante, deux prix, marqueur « Appliqué », prochaine bascule) **reste intacte** ; page **sans scroll** à 1024×748

**AC7 — L'app ne calcule plus le coût affiché**
**Given** `electricity-cost.ts`
**When** la story est livrée
**Then** `electricityView` **ne prend plus `kwh` et ne rend plus `cost`** : signature `{ priceCreuses, pricePleines, period }` → `{ period, priceCreuses, pricePleines, appliedPrice }`, un seul point de parse pour la tuile HC/HP ; `normalisePeriod`, `toNumber` inchangés ; la règle **« pas de repli sur l'autre prix »** reste testée
**And** `rg '01:08|06:08|12:38|15:38|0\.0890|0\.1491' src --glob '!*.test.*'` ⇒ **vide** (gate 9.2 conservé) ; `rg -o 'eyJhbGciOi' dist/ | wc -l` ⇒ 0 après `build` sans token

**AC8 — Doc contrat**
**Given** `docs/home-assistant.md` § Électricité
**When** la story est livrée
**Then** la section 9.1 est **réécrite** : contrat = deux identifiants de statistiques + `sensor.prix_kwh_courant` + config `costs` de ha-linky ; le `utility_meter`, le placeholder et la note « 9.2 ajoutera » disparaissent ; l'approximation à la demi-heure (≈ 32 min/jour au tarif voisin, 1–2 %) et l'heure d'import (6h–10h30) sont **écrites**

## Tasks / Subtasks

- [ ] **Task 0 — hors-repo (Florian), préalable au device-proof** (AC: 1)
  - [ ] Capteur template **`sensor.prix_kwh_courant`** (YAML ci-dessous, § Dev Notes) — `state_class: measurement`, historisé par le recorder : ha-linky lit **l'historique** du prix, le capteur doit exister **avant** la journée importée
  - [ ] ha-linky → Configuration → `costs` : `- entity_id: sensor.prix_kwh_courant` (**pas** de `after`/`before` : incompatibles avec `entity_id`, et incapables de dire 01h08)
  - [ ] Import du lendemain **ou** « remise à zéro » de l'add-on ; puis **observer** dans Outils de développement → Statistiques la ligne `linky:24305788525104_cost` (unité €, source linky). Le format est prouvé par le code source ; **l'existence** ne l'est pas encore
  - [ ] ⚠️ Tasks 1–7 sont **codables et testables sans Task 0** (mocks `callService`). Seul le device-proof l'attend

- [x] **Task 1 — Mapping** (AC: 1) — TDD
  - [x] `src/entities/mapping.ts` : `ElectricityConfig` — retirer `dailyKwhEntityId`, ajouter `consumptionStatisticId: "linky:24305788525104"` et `costStatisticId: "linky:24305788525104_cost"` ; réécrire le bloc de commentaires `:455-477` (il raconte le placeholder) ; retirer `ELECTRICITY.dailyKwhEntityId` d'`AUX_ENTITY_IDS` (`:636`)
  - [x] `STATISTIC_ID_RE = /^[a-z0-9_]+:[a-z0-9_]+$/` + `AUX_STATISTIC_IDS` + `assertWellFormedStatisticIds()` exportée, appelée dans le bloc DEV (`:658-661`)
  - [x] `mapping.test.ts:181-230` : remplacer le test « exposes the daily-kWh sensor » par « exposes TWO statistic ids (conso + cost), `source:id` form, distinct » ; ajouter le test négatif (`"sensor.foo"` rejeté par `assertWellFormedStatisticIds`, `"linky:x"` rejeté par `assertWellFormedAuxIds`) ; `dailyKwhEntityId` `toBeUndefined()` (moule du test `priceEntityId`, `:210`)

- [x] **Task 2 — Module pur `src/energy/statistics.ts`** (AC: 3, 4, 6) — TDD, **`now`/`today` toujours en paramètre**
  - [x] Types : `StatRow { start: string; end: string; change?: number }`, `StatisticsResponse { statistics?: Record<string, StatRow[]> }`, `DayPoint { start: Date; value: number }`
  - [x] `parseRows(response, statisticId): DayPoint[]` — garde chaque ligne (`start` parse, `change` fini), trie par `start`, **ignore** les lignes sans `change` ; `countRawRows` pour le cas « reçu mais illisible » (moule `countRawEntries`, `agenda/select.ts`)
  - [x] `selectLastCompleteDay(rows, todayStart: Date): DayPoint | null` — la plus récente avec `start < todayStart`
  - [x] `dayLabel(dayStart: Date, today: Date): { short: string; long: string }` — `short` = « Hier » (J−1) sinon « mar. 23 » (`weekday: "short", day: "numeric"`) ; `long` = « hier, mercredi 24 septembre » / « mardi 23 septembre » — un **seul** formatteur, pas trois copies (précédent `formatClock`, `rangeLabel`)
  - [x] `lastTwoDaysWindow(now): { start: Date; end: Date }` = [J−2 00:00, J 00:00) local ; `dayWindow(dayStart)` = [dayStart, +1 j) pour le graphe
  - [x] `hourlySeries(rows): HistoryPoint[]` → `{ t: start.getTime(), value }`
  - [x] `src/energy/statistics.test.ts` : parse (ligne sans `change` ignorée, clé absente ⇒ `[]`, ordre), sélection (hier présent → hier ; hier absent → avant-hier ; aujourd'hui **jamais**), libellés aux deux formes, fenêtres autour de minuit **et** d'un changement d'heure (TZ épinglé), balayage anti-`NaN`

- [x] **Task 3 — Seam `src/hakit/useStatistics.ts`** (AC: 2, 5) — TDD, moule **`useCalendarEvents.ts` copié puis élagué**
  - [x] Signature : `useStatistics({ statisticIds, period, units?, range? }, refreshMs = STATISTICS_REFRESH_MS)` → `{ rows: Record<string, StatRow[]>, isStale, loading, since, unreadable }` ; `range` **undefined ⇒ `lastTwoDaysWindow(new Date())` calculé à l'appel** (rollover de minuit détecté au tick, comme `windowKey`) ; `range` explicite ⇒ **deux primitives** `startMs`/`endMs` dans les deps (leçon 10.2, `useCalendarEvents.ts:100-110`)
  - [x] `STATISTICS_REFRESH_MS = 60 * 60_000`, `TICK_MS = 60_000` ; un timer, deux raisons (fenêtre changée / période écoulée) ; `visibilitychange` ; relance sur `connected`
  - [x] `requestSeq` + `alive` ; `since = new Date().toISOString()` sur succès seulement ; **le `catch` n'avance ni `lastFetchAt` ni `fetchedWindow`**
  - [x] Cast unique au bord : `(res as { response?: unknown } | undefined)?.response` puis validation dans `src/energy/statistics.ts` — **rien n'est cru passé cette ligne**
  - [x] `src/hakit/useStatistics.test.ts` (moule `useCalendarEvents.test.ts:1-45`) : un seul appel pour deux ids ; `returnResponse: true` asserté ; `serviceData` exacte (`period`, `types`, `units`, `start_time`/`end_time` ISO **UTC** dont l'écart vaut 2 jours) ; rejet ⇒ `isStale` **et** `rows` conservées ; double montage/démontage sans fuite de timer ; réponse lente après une plus récente **ignorée** ; `range` explicite honoré ; rollover de minuit sous faux timers ⇒ nouvelle requête

- [x] **Task 4 — `ElectricityTile.tsx`** (AC: 3, 4, 5) — TDD, **suite réécrite** (le mock `useEntity` sur `kwh` ne correspond plus à rien)
  - [x] `useStatistics({ statisticIds: [cfg.consumptionStatisticId, cfg.costStatisticId], period: "day", units: { energy: "kWh" } })` + `useEntityValue(periodEntityId)` (pill) ; **plus de `useEntityValue` sur conso/prix**
  - [x] Sélection via `selectLastCompleteDay` pour **chaque** id indépendamment ; héros `formatEuro(cost)`, sous-ligne `${dayLabel.short} · ${formatKwh(kwh)}` ; `aria-label` : « Électricité : 1,07 € hier, mercredi 24 septembre, 8,2 kWh, heures creuses[ — hors ligne] — ouvrir le détail »
  - [x] `anyStale = stats.isStale || period.isStale` ; « Pas encore de relevé » quand aucun jour ; `loading` ⇒ « — » même empreinte ; **jamais `Date.now()` dans le composant** : `new Date()` passé **une fois** aux fonctions pures
  - [x] Tests (mock `@hakit/core` : `useEntity` pour la pill, `useHass` avec `helpers.callService` **et** `connectionStatus`) : hier présent ⇒ « Hier · 8,2 kWh » + coût ; hier absent ⇒ « mar. 23 · … » ; aujourd'hui dans la réponse ⇒ **ignoré** ; coût absent ⇒ « — » et conso affichée ; rien ⇒ « Pas encore de relevé » ; rejet ⇒ dernière valeur + `opacity-60` + « hors ligne » ; tap ⇒ `/electricite` ; pill inchangée ; **mutation** : faire retourner « aujourd'hui » par `selectLastCompleteDay` doit casser un test (leçon 10.1/11.1)

- [x] **Task 5 — `ElectricityDetail.tsx`** (AC: 4, 5, 6) — TDD
  - [x] Tuile gauche : titre `Hier · mercredi 24 septembre` (`dayLabel.long`, capitalisé), coût HA héros, conso, pill « Hors ligne · HH:MM » via `formatSince(stats.since)` ; **retirer** la ligne `formatPrice(appliedPrice) · periodName` (`:119-123`)
  - [x] Graphe : second `useStatistics({ statisticIds: [consumptionStatisticId], period: "hour", units, range: dayWindow(jourAffiché) })` → `hourlySeries` → `SensorHistoryChart kind="bar"` ; titre « Conso horaire — <short> » ; `useHistory` et `SPARKLINE_HOURS` **retirés** de ce fichier (`:3,:23,:75-84`)
  - [x] `SensorHistoryChart.tsx` : prop **`kind?: "line" | "bar"`** (défaut `"line"`), `BarChart`/`Bar` de Recharts, mêmes axes/tooltip/`isAnimationActive={false}` ; **aucun autre consommateur ne change** (`/meteo`, room-detail) ; le garde `series.length < 2` **reste**
  - [x] Tuile droite HC/HP : **ne pas toucher** (`:150-201`), sauf la lecture d'`electricityView` (signature Task 6)
  - [x] `ElectricityDetail.test.tsx` : mock `callService` retourne day **et** hour selon `serviceData.period` ; mock `recharts` **+ `BarChart`, `Bar`** ; le test `:84` réécrit (« Hier · … », conso, coût HA, graphe alimenté par 24 lignes) ; `:178` (« price line names the applied tariff ») **supprimé** avec justification (la ligne n'existe plus par spec) ; `:189` offline adapté à `since` ; tous les autres tests HC/HP **inchangés et verts**

- [x] **Task 6 — `electricity-cost.ts`** (AC: 7) — TDD
  - [x] `ElectricityInput` sans `kwh`, `ElectricityView` sans `kwh`/`cost` ; en-tête de module réécrit (il parle du coût du jour et du saut de 68 %)
  - [x] `electricity-cost.test.ts` : **supprimer** les tests `:49,:56,:63,:94,:107,:118` qui assertent un coût que la spec retire — le dire en Completion Notes (T0.3 : ce n'est pas un test qu'on plie, c'est un comportement retiré par `sprint-change-proposal-2026-09-25.md`) ; **conserver** `:73,:80,:101` (période inconnue, pas de repli, deux prix exposés)
  - [x] `consumption-format.ts` : inchangé (`formatEuro`/`formatKwh`/`periodLabel`/`periodName`/`periodTone` servent tels quels)

- [x] **Task 7 — Doc contrat** (AC: 8)
  - [x] `docs/home-assistant.md` § « Électricité — conso & coût (Story 9.1) » → « Électricité — conso & coût d'hier (Stories 9.1 → 9.4) » : source ha-linky, deux identifiants, `sensor.prix_kwh_courant` (YAML), `costs`, heure d'import, approximation demi-heure, `change` absent en première ligne, **aucun `utility_meter`, aucun placeholder** ; § 9.2 : la phrase « calcule le coût du jour au prix de cette période » devient « la pill et la page HC/HP reflètent la période courante ; le coût affiché est celui d'hier, calculé par ha-linky »
  - [x] `src/entities/mapping.ts` : commentaires (Task 1) ; `src/widgets/ElectricityTile.tsx` et `ElectricityDetail.tsx` : en-têtes JSDoc réécrits (ils décrivent `useEntityValue` sur la conso et le coût dérivé)

- [x] **Task 8 — Gates** (AC: 1, 7) — _sauf la preuve device_
  - [x] `npm run typecheck` · `npm run lint` · `npm test` verts ; **+ tests nets** attendus ≈ +35 (statistics ≈ 14, useStatistics ≈ 10, tuile ≈ 10 réécrits, page ≈ 3 nets, mapping ≈ 3, cost −6)
  - [x] `npm run build` **sans** `VITE_HA_TOKEN` (garde AD-8, `vite.config.ts:97`) ; `rg -o 'eyJhbGciOi' dist/ | wc -l` ⇒ 0 ; `rg -o 'linky:' dist/assets/*.js | wc -l` ⇒ **2** (les deux ids, et pas plus)
  - [x] Gates `rg` : `rg 'linky:' src --glob '!src/entities/**' --glob '!*.test.*'` ⇒ vide · `rg '01:08|06:08|12:38|15:38|0\.0890|0\.1491' src --glob '!*.test.*'` ⇒ vide · `rg 'Date\.now\(\)' src/energy src/widgets/ElectricityTile.tsx src/pages/ElectricityDetail.tsx` ⇒ vide
  - [ ] **Preuve device (Florian, iPad 1024×748, WebKit)** : chip « Hier · X kWh » + coût **≠ « — »** ; tap → page « Hier · <date> » + 24 barres + HC/HP intacte, **sans scroll** ; un matin **avant 7h30** la chip dit la date d'avant-hier ; coupure réseau ⇒ dernière valeur + « Hors ligne · HH:MM » ; **barre supérieure à 6 chips + pill sans chip coupée** un jour où `BinTile` est affichée — _en attente Florian_

## Dev Notes

### Le fork de lecture — cette fois c'est le chemin par requête

| chemin | module | quand | ici ? |
| --- | --- | --- | --- |
| état poussé | `useEntityValue` / `useHistory` | un `sensor.*` existe | **non** pour la conso (aucune entité) ; **oui** pour la pill et la tuile HC/HP |
| lecture par requête (AD-17) | `useCalendarEvents` → **`useStatistics`** | la donnée n'existe qu'en appelant un service à réponse | **oui** pour conso et coût |

Ne pas chercher un `entity_id` pour la conso : **il n'y en a pas**, et il n'y en aura pas (ha-linky écrit via `recorder/import_statistics`, `ha.ts:108`). La 11.1 avait le fork inverse (état poussé, déclencheur neuf). Ici la fraîcheur est **à gérer soi-même** : la réponse est datée de sa requête, `since` est l'horodatage de la **requête**, pas d'un relevé.

### Ce que `recorder.get_statistics` fait et ne fait pas (vérifié dans `services.py` @ 2026.7.3)

- Schéma : `start_time` (requis, `cv.datetime`), `end_time`, `statistic_ids` (liste), `period` ∈ {5minute, hour, day, week, month, year}, `types` (liste), `units` (dict `unit_class → unit`). **Pas de `target`** : c'est du `serviceData` pur.
- `change` = `sum(fin de période) − sum(début)` **calculé par HA**. L'app **ne somme ni ne découpe rien** (AD-4). Pour un jour, c'est l'énergie du jour ; pour une heure, l'énergie de l'heure.
- `units: { energy: "kWh" }` convertit la conso (unit_class `energy`, Wh) ; la statistique de coût (`€`) n'a pas d'unit_class énergie et **passe intacte**. Ne pas convertir côté app.
- `start`/`end` en **ISO UTC** (`utc_from_timestamp(...).isoformat()`). Le jour local vient de `new Date(start)` + `Intl` fr-FR dans le fuseau du kiosque. Ne **jamais** découper la chaîne ISO au caractère.
- Les buckets `day` suivent les **minuits locaux de HA** (Europe/Paris), quel que soit `start_time`. Envoyer `toISOString()` (UTC) : `dt_util.as_utc` le prend tel quel, zéro hypothèse sur le fuseau de HA — contrairement à `haDateTimeString` (naïf, interprété dans le fuseau HA), qui convenait à `calendar.get_events` mais n'a **aucune raison d'être copié ici**.
- Typage `@hakit/core` 6.0.2 : `recorder.getStatistics` est déclaré dans `supported-services.d.ts:72` (`statistic_ids: unknown`, `types` **au singulier** dans le typage alors que HA prend une liste — passer une liste, c'est HA qui a raison ; caster si le typage se plaint, avec un commentaire).

### Ce que ha-linky garantit (source `bokub/ha-linky`, relue 2026-09-26)

- `statistic_id` : `linky:${prm}` et `linky:${prm}_cost` (`ha.ts:29`) ; unités `Wh` / `€` (`:117`) ; `has_sum: true`. Libellé humain « … (costs) ».
- Import **deux fois par jour** : 6h–7h30 pour la veille, repli 9h–10h30. **Avant 7h30, hier n'existe pas encore** ⇒ la tuile montre avant-hier, daté. C'est un cas **nominal**, testé, pas une panne.
- Données **par demi-heure** pour les 7 derniers jours, quotidiennes au-delà ; **agrégées à l'heure** à l'écriture (`groupDataPointsByHour`, `index.ts:72,123`) ⇒ le graphe est **horaire**, jamais 48 pas.
- Coûts (`costs`, mode `entity_id`) : « récupère l'historique des prix de l'entité et applique le prix le plus récent au moment de chaque mesure ». Calcul **au moment de l'import** : une config `costs` posée aujourd'hui ne produit du coût qu'à partir du prochain import (ou après remise à zéro). Précision : la demi-heure — les bornes 01h08/06h08/12h38/15h38 ne sont **pas** représentables, ≈ 32 min/jour au tarif voisin, **1–2 % du coût, assumé, interdiction de compenser côté app**.

### YAML Task 0 — `sensor.prix_kwh_courant` (pour `docs/home-assistant.md`)

```yaml
template:
  - sensor:
      - name: "Prix kWh courant"
        unique_id: prix_kwh_courant
        unit_of_measurement: "€/kWh"
        state_class: measurement
        state: >-
          {{ states('input_number.prix_kwh_creuses')
             if is_state('binary_sensor.heures_creuses', 'on')
             else states('input_number.prix_kwh_pleines') }}
```

Une seule source des horaires (le `binary_sensor` de 9.2) et des prix (les deux helpers) : **rien n'est dupliqué** dans l'add-on. L'app **ne lit jamais** ce capteur.

### Pourquoi ni `useOptimisticControl`, ni `useHistory`, ni un capteur SQL

- `useHistory` lit l'historique **d'une entité** (`entityHistory` d'un `entity_id`) — sans entité, rien. Le retirer de la page **supprime** le graphe 24 h de 9.1 : c'est voulu, il aurait été plat.
- Un capteur `sql` côté HA sur la table `statistics` a été **écarté** (proposition § 3) : schéma interne, fuseau, ligne plate. Ne pas le réintroduire « pour garder `useEntityValue` ».
- Aucun état cible, aucune écriture ⇒ ni AD-5 ni AD-11 (comme 10.1).

### Pièges hérités — les plus probables ici

- **`returnResponse: true` oublié** ⇒ la promesse résout `void`, type-check OK, tuile vide (10.1). Test dédié.
- **Réponse lente qui écrase une plus récente** ⇒ `requestSeq` (revue 10.1, P5). Test dédié.
- **`catch` qui consomme le budget de rafraîchissement** ⇒ la tuile resterait fausse une heure après une coupure (P4). Ne pas avancer `lastFetchAt`.
- **Fenêtre calculée à la construction** ⇒ après minuit la requête décrit encore avant-hier (10.1, kiosque qui ne redémarre jamais). `lastTwoDaysWindow(new Date())` **à l'appel**.
- **`Date.now()` / `new Date()` dans une fonction pure** (leçon 9.2/11.1) ⇒ intestable sans faux timers. `today` en paramètre partout dans `src/energy/`.
- **Pollution inter-tests des mocks `vi.hoisted`** (9.2) : **réinitialiser chaque champ** dans `beforeEach`, y compris la fonction `callService` (`mockReset` + valeur par défaut).
- **Tests tautologiques** (10.1) : asserter la **structure** rendue (texte « Hier », `data-testid` sur le bloc daté), pas un `className` recopié ; **casser volontairement** `selectLastCompleteDay` pour voir le test tomber, et le noter en Debug Log.
- **Mutation de `useRef` pendant le rendu** ⇒ `useEffect` (1.6 #2).
- **Zéro et absence** : `change: 0` est **une valeur** (jour à 0 kWh, plausible en absence) ; `change` absent est **une absence**. `toNumber` ne suffit pas, il faut `typeof === "number" && Number.isFinite`.
- **Chip qui s'élargit** : la barre est à **6 chips + pill**, `TopBarSlots` coupe au lieu de déborder (`right-6` + `overflow-hidden`). La date **remplace** le mot « aujourd'hui » (qui n'était que dans l'`aria-label`) — la sous-ligne gagne ~6 caractères (« Hier · »). Si le device-proof montre une coupe, l'échappatoire est **la forme la plus courte** (« Hier » seul, date en `aria-label`), **pas** retirer la date : UX-DR30 l'exige.

### Contraintes de layout

- Barre supérieure **saturée** (6 chips + horloge + `BinTile` conditionnelle + pill HC/HP). Chip électricité = 5ᵉ. Mode d'échec : chip **coupée**. Device-proof obligatoire, un jour où `BinTile` est affichée (forçable via l'`input_datetime` de sortie).
- Page `/electricite` : `overflow-hidden`, `min-h-0`, `flex-1` — le graphe en barres occupe le même bloc que l'ancien graphe ligne ; **aucun test automatisé** ne garde l'invariant no-scroll (TD-9), vérification visuelle iPad.
- Cote : **1024×748** (viewport utile), la plus stricte des deux cotes écrites dans les stories précédentes.

### Project Structure Notes

Ordre d'ajout observé (`89dd0fe`, 10.1 ; repris en 11.1) : doc HA → mapping + test → seam `src/hakit/` + test → module pur + test → composants + tests → gates.

- **NEW** : `src/energy/statistics.ts` + `.test.ts` (module de domaine, **hors `src/widgets/`** — `src/hakit/` en aura besoin pour la validation de réponse ; précédent `src/agenda/select.ts`) ; `src/hakit/useStatistics.ts` + `.test.ts`.
- **UPDATE** : `src/entities/mapping.ts` + `.test.ts` ; `src/widgets/electricity-cost.ts` + `.test.ts` ; `src/widgets/ElectricityTile.tsx` + `.test.tsx` (suite réécrite) ; `src/pages/ElectricityDetail.tsx` + `.test.tsx` ; `src/widgets/SensorHistoryChart.tsx` (prop `kind`) ; `docs/home-assistant.md`.
- **Non touchés** : `src/App.tsx` (route et montage existent), `consumption-format.ts`, `ConsumptionIcons.tsx`, `TopBarSlots.tsx`, `useEntityValue.ts`, `stale.ts`, `useCalendarEvents.ts` (**copier, ne pas généraliser** : deux hooks lisibles valent mieux qu'un hook générique à trois branches — la duplication est assumée, comme le moule de chip).
- Import du seam **par chemin direct** (`../hakit/useStatistics`), jamais via le barrel `src/hakit/index.ts` (écart 10.1 revu et accepté).
- Tests : Vitest 4, `globals: false` (importer depuis `"vitest"`), `TZ: "Europe/Paris"` épinglé (`vitest.config.ts:30`), `@hakit` inliné, `setup.ts` fait le `cleanup`. Recharts **mocké** dans les tests de page.
- Gates : `build` + `typecheck` + `lint` (oxlint) + `test` ; pre-commit Husky (lint-staged → typecheck → test). Build AD-8 : `vite.config.ts:97` **échoue** si `VITE_HA_TOKEN` est présent — déplacer `.env.local` puis le restaurer (empreinte SHA-256 avant/après, comme en 9.2).

### Décisions tranchées (Florian, 2026-09-25)

- **Dernier jour complet disponible**, jamais aujourd'hui, **toujours daté** (UX-DR30).
- **Lecture `recorder.get_statistics`** (option B) — pas de capteur SQL, pas de websocket brut.
- **Coût calculé par HA** via ha-linky `costs` en mode `entity_id` sur `sensor.prix_kwh_courant`.
- **Approximation demi-heure acceptée**, documentée, jamais compensée.
- **9.1 close `done`**, patron réutilisé ; **9.4 avant 9.3**.

### Décisions ouvertes / à ratifier au device-proof

- **Forme du libellé sur la chip** : « Hier · 8,2 kWh » (relatif) vs « mer. 24 · 8,2 kWh » (daté même pour hier). UX-DR30 donne « Hier · mer. 24 » — trop long pour la chip. Défaut proposé : **relatif quand c'est hier, date courte sinon**, forme longue sur la page et dans l'`aria-label`. À confirmer sur l'iPad.
- **Existence de `linky:24305788525104_cost`** dans le HA de Florian (Task 0).
- **Jour à barre unique** (données quotidiennes seulement) : afficher la barre 0h–1h telle quelle, ou une mention « détail horaire indisponible » ? Défaut : **telle quelle** (fidèle), mention en `aria-label` du graphe.

### References

- [Source: \_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-25.md] — cause réelle, décisions actées, alternatives écartées, handoff
- [Source: \_bmad-output/planning-artifacts/epics.md#Story 9.4 · #AD-16 amendé · #AD-17 (deuxième instance) · #UX-DR23 amendé · #UX-DR30 · #FR-E1/FR-E4]
- [Source: \_bmad-output/implementation-artifacts/9-2-heures-creuses-pleines.md] — TDD tâche par tâche, pollution des mocks, une seule pill, tests qui mordent, gates `rg`
- [Source: \_bmad-output/implementation-artifacts/9-1-micro-tuile-electricite-conso-cout.md] — patron fondateur, clone `TopBarWeather`/`WeatherDetail`
- [Source: \_bmad-output/implementation-artifacts/11-1-tuile-temps-de-trajet.md#Pièges hérités] — `now` en paramètre, mutation de tests, fork de lecture
- [Source: src/hakit/useCalendarEvents.ts:93-248] — **le moule** : `callService` + `returnResponse`, `requestSeq`/`alive`, tick unique, `visibilitychange`, `catch` qui ne consomme pas le budget
- [Source: src/hakit/useCalendarEvents.test.ts:1-45] — moule du mock `useHass` avec `helpers.callService`
- [Source: src/agenda/select.ts:431] — `haDateTimeString` (naïf, fuseau HA) : **ne pas réutiliser**, `toISOString()` ici
- [Source: src/entities/mapping.ts:46 (`ENTITY_ID_RE`), :455-505 (`ElectricityConfig`), :628-661 (`AUX_ENTITY_IDS`, `assertWellFormedAuxIds`, bloc DEV)]
- [Source: src/widgets/ElectricityTile.tsx:38-109 · src/pages/ElectricityDetail.tsx:55-206 (tuile gauche `:93-146` à réécrire, tuile HC/HP `:150-201` intacte)]
- [Source: src/widgets/electricity-cost.ts:87-108 (`electricityView`) · electricity-cost.test.ts (tests à retirer/garder listés Task 6)]
- [Source: src/widgets/SensorHistoryChart.tsx:18-61 (props), :152-169 (formatteurs d'axe réutilisables pour les barres)]
- [Source: src/hakit/stale.ts:25 `formatSince` · src/ui/clock-format.ts `formatClock` · src/agenda/select.ts:382-410 `rangeLabel` — précédents de formatteurs fr-FR]
- [Source: docs/home-assistant.md:293-365 (§ 9.1 à réécrire), :366-507 (§ 9.2 : YAML du `binary_sensor`, moule du capteur template)]
- [Source: HA core @ 2026.7.3 — `homeassistant/components/recorder/services.py:73-87` (schéma), `:122-178` (handler, forme de la réponse), `:222` (`SupportsResponse.ONLY`) ; `util/dt.py:150` (`as_utc`) — **vérifié 2026-09-26 via l'API GitHub**]
- [Source: bokub/ha-linky `src/ha.ts:29,108-117` (ids, unités, import), `src/index.ts:72,123` (agrégation horaire), README § Calcul des coûts, § Bon à savoir — **vérifié 2026-09-26**]
- [Source: node_modules/@hakit/core/dist/types/types/supported-services.d.ts:72-79 — `recorder.getStatistics` typé]
- [Source: \_bmad-output/planning-artifacts/architecture/architecture-home-dashboard-2026-07-12/ARCHITECTURE-SPINE.md#AD-2 (aucun websocket ad hoc — respecté), #AD-4, #AD-6, #AD-7]
- [Source: \_bmad-output/implementation-artifacts/deferred-work.md:26 — robustesse `SensorHistoryChart` (série plate) : un jour à 24 barres nulles est ce cas]
- [Source: memory `target-device-and-layout` (iPad 1024×748, jamais de scroll) · `name-the-instrument-before-claiming-verified`]

## Dev Agent Record

### Agent Model Used

claude-fable-5-1 (Liza Pairing, Autonomous — bmad dev-story, 2026-09-26)

### Debug Log References

- **Ordre des tâches** : la Task 6 (module pur du coût) a été exécutée **avant** les Tasks 4 et 5, parce que la tuile et la page compilent contre sa nouvelle signature. Sans cela, `electricityView` aurait exigé un `kwh` que plus personne ne possède. Les huit tâches restent conformes à leur contenu.
- **Typage `@hakit/core` vs HA** : `recorder.getStatistics` type `types` comme un littéral **singulier** alors que HA exige une **liste** (`recorder/services.py:81-84`). Un seul cast `serviceData as never`, commenté, à l'endroit exact du désaccord — HA a raison, le typage est en retard.
- **Faux positif de gate** : `rg 'linky:' src --glob '!src/entities/**'` remonte deux **commentaires** (`linky:<PRM>` dans les en-têtes de `statistics.ts` et `useStatistics.ts`). Le gate effectif est `rg 'linky:[0-9]'` : un identifiant réel porte des chiffres, un commentaire non. Idem pour `Date.now()`, présent uniquement dans des commentaires qui l'interdisent.
- **Échec dépendant de l'ordre, mal diagnostiqué une première fois.** La suite complète a signalé **1 échec** sur la page (« charts the 24 HOURS… ») alors que le fichier seul passait. Première attribution : la pollution par le script de mutation qui tournait en parallèle — **fausse**, l'échec est revenu sur une exécution sans rien d'autre en cours. Cause réelle : `SensorHistoryChart` est chargé en `React.lazy` ; son import dynamique est une vraie E/S, pas un timer, et sous faux timers un `act` + `advanceTimersByTimeAsync(0)` ne l'attend pas toujours quand la machine est chargée. Remède : le test **préchauffe le module** (`await import(...)`) avant le rendu et flushe deux fois. Vérifié par deux exécutions complètes consécutives. Leçon : un test qui passe seul et échoue en suite est un test dépendant du temps réel, pas une victime — chercher l'E/S cachée.
- **Vérification de morsure (5 mutations, toutes concluantes, chacune annulée puis suite revérifiée) :**

  | Mutation | Test tombé |
  | --- | --- |
  | `selectLastCompleteDay` laisse passer aujourd'hui (`>=` → `>`) | tuile : *NEVER shows today…* |
  | `parseRows` transforme un `change` absent en 0 | statistics : *ignores rows whose change is absent…* |
  | `returnResponse` retiré | useStatistics : *asks recorder.get_statistics ONCE… returnResponse* |
  | garde anti-course retirée du succès | useStatistics : *a slow reply landing after a newer one…* |
  | « Hier » revendiqué pour avant-hier (`=== 1` → `<= 2`) | tuile : *before the morning import: falls back…* |

- **Build AD-8** : `.env.local` écarté puis restauré, empreinte SHA-256 identique avant/après. `dist/` : **0** JWT, **exactement 2** occurrences `linky:` (les deux ids), **0** horaire/prix.
- **Le gate horaires attrape aussi les commentaires** : `rg '01:08|…' src --glob '!*.test.*'` a remonté mon propre en-tête de `periodOfInterval`, qui citait les bornes en exemple. Reformulé sans chiffre. La règle 9.2 « aucun horaire dans `src/` hors tests » vaut pour la prose comme pour le code : un commentaire est dans le dépôt et se copie.
- **Graphe en barres non vu dans un navigateur** : `SensorHistoryChart kind="bar"` est testé avec Recharts **mocké** (jsdom ne mesure rien). Le passage de l'axe X en `type="category"` pour donner une largeur aux barres est une décision de code, pas une observation — **à vérifier au device-proof**, avec l'iPad comme instrument.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created (create-story, 2026-09-26).
- **Tasks 1 à 8 (hors preuve device) faites, en TDD tâche par tâche** : chaque suite vue **rouge** avant le code (3 sur le mapping, import manquant sur `statistics` et `useStatistics`, 1 sur le coût, 13 sur la tuile, 14 sur la page). Suite **481 → 516** (+35 net) : `statistics` +18, `useStatistics` +15, tuile 13 (réécrite, +1), page 14 (+1), mapping +2, coût **−6 retirés, +1 ajouté** (le test qui interdit le retour de `cost`/`kwh`).
- **Task 1** : `ElectricityConfig` porte `consumptionStatisticId` + `costStatisticId`, `dailyKwhEntityId` supprimé ; `STATISTIC_ID_RE`, `AUX_STATISTIC_IDS`, `assertWellFormedStatisticIds()` dans le bloc DEV. Test négatif croisé : un `sensor.*` n'est pas un id de statistique, et un `linky:…` n'est pas un `entity_id`.
- **Task 2** : `src/energy/statistics.ts`, 8 fonctions pures, `today`/`now` toujours en paramètre, `formatClock` réutilisé pour la date longue (un seul formatteur français). Fenêtres construites en champs calendaires, pas en millisecondes : test sur le jour de 25 h du 25 octobre.
- **Task 3** : `useStatistics` = copie élaguée de `useCalendarEvents` (identité par clé JSON parsée, pas décorative ; `requestSeq`/`alive` ; un tick, deux raisons ; `catch` qui ne consomme pas le budget ; relance horaire). Deux ids en **un** appel.
- **Task 4** : tuile sur `useStatistics` + pill entité ; libellé daté `data-testid="electricity-day"` ; conso et coût **indépendants** ; « Pas encore de relevé » et « — » à même empreinte ; jamais aujourd'hui.
- **Task 5** : page « Hier · jeudi 24 septembre », coût HA, conso, **plus de ligne prix × période** ; second appel horaire fenêtré sur le jour affiché ; `SensorHistoryChart` gagne `kind="bar"` (axe X catégoriel), défaut `line` inchangé pour `/meteo` et room-detail ; `useHistory` et `SPARKLINE_HOURS` retirés de la page. Tuile HC/HP **intacte**, ses 8 tests conservés.
- **Task 6** : `electricityView({ priceCreuses, pricePleines, period })` → `{ period, priceCreuses, pricePleines, appliedPrice }`. **Six tests supprimés** qui assertaient le coût du jour et le saut de +68 % — un comportement **retiré par la proposition approuvée**, pas un test plié ; un test ajouté verrouille l'absence de `cost`/`kwh`.
- **Task 7** : `docs/home-assistant.md` § Électricité réécrit (ha-linky, deux ids, `sensor.prix_kwh_courant`, `costs`, demi-heure, import 6h–10h30, `change` absent ≠ 0) ; § 9.2 : la sous-section « le coût saute » remplacée par « il est calculé par HA », bullets d'obsolescence et de test alignés.
- **Décision de conception à ratifier** : sur la chip, « Hier · 8,2 kWh » (relatif) et « mer. 23 · 6,1 kWh » (daté) ; forme longue sur la page et dans l'`aria-label`. La sous-ligne gagne ~6 caractères : **device-proof top-bar exigé** (6 chips + pill, jour avec `BinTile`). Échappatoire si coupe : « Hier » seul.
- **Ajout demandé par Florian (2026-09-26, hors AC, approuvé « Proceed ») — barres colorées HC/HP.** Chaque barre horaire d'hier prend la couleur de la période où HA était, **arrondie à l'heure par majorité** (≥ 30 min en creuses ⇒ HC : 01h–02h est HC, 06h–07h est HP). Source : **l'historique de `binary_sensor.heures_creuses`** via `useHistory`, avec `hoursToCover(jourAffiché, maintenant)` heures pour atteindre le début du jour — l'app **mesure les bascules de HA, elle ne calcule aucun horaire** (AD-4, gate `rg` toujours vide). `periodOfInterval` intègre l'état sur l'intervalle, exclut `unavailable`/`unknown`, rend `null` sans historique (barre neutre, jamais une devinette). `SensorHistoryChart` : `Cell` par barre (`point.color`), tooltip nommant la période (`point.label`). **Couleur jamais seule** : légende glyphe + mot sous le graphe (UX-DR14), tokens identiques à la pill. +8 tests purs, +4 tests page ; 4 mutations mordues (égalité, état de fin au lieu de majorité, heure inconnue devinée, barres non colorées). Doc HA : une ligne sur la dépendance à 3 jours d'historique du recorder.
- **Reste (non-agent, Florian)** : **Task 0** (capteur template, `costs`, import, **observer** `linky:24305788525104_cost` dans l'onglet Statistiques) et la **preuve device** (chip datée, coût ≠ « — », 24 barres visibles, HC/HP intacte, sans scroll, matin avant 7h30, coupure réseau).

### File List

**Créés :**

- `src/energy/statistics.ts`, `src/energy/statistics.test.ts` — module pur (parse, sélection du dernier jour complet, fenêtres, libellés, série horaire)
- `src/hakit/useStatistics.ts`, `src/hakit/useStatistics.test.ts` — seam AD-17 `recorder.get_statistics`

**Modifiés :**

- `src/entities/mapping.ts`, `src/entities/mapping.test.ts` — `ElectricityConfig` (2 statistic ids, `dailyKwhEntityId` retiré), `STATISTIC_ID_RE`, `AUX_STATISTIC_IDS`, `assertWellFormedStatisticIds`
- `src/widgets/electricity-cost.ts`, `src/widgets/electricity-cost.test.ts` — vue tarifaire sans coût ni kWh
- `src/widgets/ElectricityTile.tsx`, `src/widgets/ElectricityTile.test.tsx` — source statistiques, libellé daté ; suite réécrite
- `src/pages/ElectricityDetail.tsx`, `src/pages/ElectricityDetail.test.tsx` — jour daté, coût HA, graphe horaire en barres colorées HC/HP (historique du `binary_sensor` via `useHistory`), légende
- `src/widgets/SensorHistoryChart.tsx` — prop `kind?: "line" | "bar"` ; en barres, `Cell` par point (`color`) et nom de série par point (`label`)
- `docs/home-assistant.md` — § Électricité réécrit, § 9.2 aligné
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

**Non touchés, volontairement :** `src/App.tsx` (route et montage existants), `consumption-format.ts`, `ConsumptionIcons.tsx`, `useEntityValue.ts`, `stale.ts`, `useCalendarEvents.ts`.

## Change Log

| Date       | Version | Description |
| ---------- | ------- | ----------- |
| 2026-09-26 | 0.3     | **Ajout demandé par Florian : barres horaires colorées HC/HP**, période d'hier lue dans l'historique HA du `binary_sensor` (`useHistory`), arrondie à l'heure par majorité ; `Cell` par barre, tooltip nommant la période, légende glyphe + mot (UX-DR14). Aucun horaire dans le bundle (gate vérifié, y compris les commentaires). Suite 516 → 528, 4 mutations mordues. Test de page durci contre un échec dépendant de l'ordre (import `lazy` sous faux timers) ; le diagnostic initial « pollution par les mutations » était faux et est corrigé au Debug Log. |
| 2026-09-26 | 0.2     | **dev-story : Tasks 1–8 faites (hors preuve device), en TDD.** Mapping sur deux identifiants de statistiques ; module pur `src/energy/statistics.ts` ; seam `useStatistics` (`recorder.get_statistics`, AD-17) ; tuile et page sur le dernier jour complet, daté (UX-DR30) ; coût lu tel que calculé par HA, `electricityView` ne multiplie plus ; graphe horaire en barres ; doc HA réécrite. Suite 481 → 516, typecheck/lint/Prettier propres, build sans token : 0 JWT, 2 ids, 0 horaire. 5 mutations, toutes mordues. **Restent** : Task 0 (observer `_cost` côté HA) et preuve device — story en `in-progress`. |
| 2026-09-26 | 0.1     | Story créée (create-story) depuis `sprint-change-proposal-2026-09-25.md`. Identifiants réels fournis par Florian ; format du second **prouvé** dans le code de ha-linky, existence à confirmer en Task 0. Schéma et réponse de `recorder.get_statistics` vérifiés dans HA 2026.7.3. Trois points laissés à ratifier au device-proof (forme du libellé sur la chip, existence de la statistique de coût, jour à barre unique). |
