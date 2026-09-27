---
baseline_commit: 4a0d54f  # master au 2026-09-27 (contient 9.4 in-progress : code livré, preuve device ouverte)
---

# Story 9.5: Électricité — naviguer dans le passé et vue mensuelle

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Créée le 2026-09-27 par create-story, sur demande directe de Florian (pas de correct-course : aucune story existante n'est modifiée, 9.4 reste telle quelle). -->
<!-- Décision Florian 2026-09-27 : ROUVRE l'option « cumuls mois / comparaisons » écartée le 2026-07-23 (story 9.1, option C). Assumée comme nouvelle décision. -->
<!-- Décisions Florian 2026-09-27 : (1) source « identique à l'actuel » = les deux statistiques ha-linky de 9.4 ; (2) coût des périodes passées = la statistique de coût CALCULÉE PAR HA (ha-linky costs), jamais kWh × prix côté app ; (3) un jour passé garde son graphe horaire ; (4) story d'abord, branche neuve, 11.1 en pause. -->
<!-- Dépendance : 9.4 doit être `done` (Task 0 : existence de `linky:…_cost`, preuve device) avant la preuve device de 9.5. Le code de 9.5 est codable et testable avant, sur les mêmes mocks. -->

## Story

As a Florian,
I want revenir sur n'importe quel jour passé et voir un mois entier sur `/electricite` — conso, coût, et l'écart avec le mois précédent et le même mois l'an dernier,
so that je sais si ma consommation dérive, et de combien, sans ouvrir l'app Enedis.

## Contexte & valeur

La 9.4 a donné à `/electricite` sa vraie source : deux **statistiques à long terme** (`linky:<PRM>` en Wh, `linky:<PRM>_cost` en €, importées J-1 par ha-linky), lues par `useStatistics` (AD-17) avec un coût **calculé par HA**. Elle répond à une question : *hier, combien ?* Cette story ajoute la seconde : *est-ce que ça dérive ?* Elle **ne change ni la source, ni le seam, ni le coût** — elle **déplace la fenêtre** demandée à HA et ajoute une granularité (`month`) que HA sait déjà servir.

Le moule de navigation existe : la rangée de contrôle de `/agenda` (Story 10.2, UX-DR29) — bascule, flèches, rappel de période, bouton de retour. Le moule de lecture existe : `useStatistics` accepte déjà une `range` explicite. Le moule de rendu existe : `SensorHistoryChart kind="bar"` trace autant de barres qu'on lui donne.

**Ce que ce choix coûte.**
- Le **coût** d'une période n'existe que si ha-linky l'a calculé : à partir de la configuration `costs` (Task 0 de 9.4), ou sur **tout l'historique** si une remise à zéro a suivi. Avant : « — », **jamais une estimation** (AD-16).
- La **variation « an dernier »** exige 13 mois de statistiques. ha-linky importe **jusqu'à 1 an de quotidien** au premier lancement (README, § Import d'historique CSV) : selon la date d'installation, le premier mois comparable peut être plus tard. « — » tant que la référence manque.
- La **couleur HC/HP des barres** d'un jour passé vient de l'historique du `binary_sensor` (9.4) ; le recorder ne garde cet historique que ~10 jours (`purge_keep_days`). Au-delà : barres **neutres**, légende inchangée — jamais une devinette d'horaire (AD-4).

## Acceptance Criteria

**AC1 — Rangée de contrôle, moule `/agenda`**
**Given** `/electricite` ouverte
**When** elle se rend
**Then** sous le lien « ‹ Accueil », une **rangée de contrôle unique de 52px** (UX-DR29) porte : bascule **Jour / Mois** (`role="tablist"`, onglets `role="tab"` 44px, `aria-selected`), flèches **‹ ›** (44px, `aria-label` « Période précédente » / « Période suivante »), **rappel de période** en mots, et un bouton **« Dernier relevé »** (44px)
**And** l'état (vue + ancrage) est **local à la page**, réinitialisé à chaque visite (AD-1/AD-3, précédent 10.2) ; l'ancrage est conservé au changement de vue (le 3 août en Jour → août en Mois)
**And** aucun contrôle n'est jamais `disabled` (précédent 6.1/10.2) : `›` au-delà de la borne et « Dernier relevé » déjà atteint sont **idempotents** (même plage, aucune requête)

**AC2 — Sans navigation, la 9.4 à l'identique**
**Given** la page ouverte sans toucher aux contrôles (vue Jour, ancrage « dernier relevé »)
**When** elle se rend
**Then** le rendu est **celui de la 9.4** : tuile « Hier · jeudi 24 septembre » (coût HA, conso), 24 barres horaires colorées HC/HP, légende, tuile HC/HP à droite — les tests existants d'`ElectricityDetail.test.tsx` passent **sans changer leurs assertions** (seuls les sélecteurs qui heurtent la nouvelle rangée peuvent être resserrés)
**And** les requêtes sont **celles de la 9.4** (fenêtre par défaut de deux jours, `day` + `hour`) — aucune requête supplémentaire tant qu'on ne navigue pas

**AC3 — Jour passé**
**Given** la vue Jour ancrée sur un jour **D** choisi aux flèches
**When** la page se rend
**Then** la tuile de gauche s'intitule par le jour (`dayLabel(D).long` capitalisé : « Avant-hier · mardi 23 septembre », « Mercredi 3 septembre ») et affiche **conso et coût de D** (`day`, `change`, fenêtre `[D, D+1)`, les deux ids) — chaque valeur pour **ce jour exactement** (`pointOn`), « — » sinon
**And** le graphe montre les **24 heures de D** (`hour`, `change`, même fenêtre), complétées par `padHours` : une heure manquante reste un **trou visible**
**And** les barres portent la couleur de la période HC/HP **quand l'historique du `binary_sensor` couvre D** ; sinon neutres, légende inchangée, `aria-label` du graphe le dit (« période tarifaire non disponible pour ce jour »)
**And** la borne haute est le **dernier jour complet** (`selectLastCompleteDay` sur la fenêtre par défaut) : `›` ne dépasse jamais ce jour ; **aujourd'hui n'est jamais atteignable** (UX-DR30)
**And** un jour sans ligne : « **Pas de relevé ce jour-là** », même empreinte (UX-DR27) — pas « Pas encore de relevé », qui décrit l'attente de l'import

**AC4 — Mois : conso, coût, deux variations**
**Given** la vue Mois ancrée sur un mois **M**
**When** la page se rend
**Then** la tuile de gauche s'intitule par le mois (« Août 2026 ») et affiche le **coût de M** en héros (statistique de coût, `month`, `change`) et la **conso de M** (`month`, `change`, kWh)
**And** deux lignes de **variation**, chacune pour la conso ET le coût : **vs le mois précédent** et **vs le même mois l'an dernier** — pourcentage **signé**, arrondi à l'unité, `tabular-nums`, avec le mot de référence (« vs août : conso +12 % · coût +9 % », « vs sept. 2025 : conso −5 % · coût — ») ; le sens n'est **jamais** porté par la couleur seule (UX-DR14), une teinte éventuelle est un renfort
**And** une variation dont la **référence manque** (mois sans ligne, coût non calculé, référence à 0) affiche « — » : **aucun zéro implicite, aucune division par zéro maquillée** (AD-16)
**And** le graphe devient **la conso par jour de M** (`day`, `change`, fenêtre `[M, M+1)`), barres neutres, un créneau par jour civil du mois (`padDays`, analogue de `padHours`) — les jours sans donnée restent des trous
**And** la borne haute est le **mois en cours** ; `›` ne va pas au-delà

**AC5 — Mois en cours : comparaison « à date », calculée par HA**
**Given** la vue Mois ancrée sur le mois en cours, dont les données s'arrêtent au dernier jour complet **J** (jour du mois **N** = `J.getDate()`)
**When** les variations se calculent
**Then** les références sont demandées à HA sur des **fenêtres tronquées** : `month` sur `[M−1, M−1 + N jours)` et `month` sur `[M−12, M−12 + N jours)` — HA rend le `change` de la portion (`_reduce_statistics` réduit les lignes de la plage demandée, `change` = différence de `sum` aux bornes), **l'app ne somme rien** (AD-17 : « elle demande à HA la granularité qu'elle affiche »)
**And** le titre le dit : « Septembre 2026 · à date (26 j) », et les lignes de variation portent « à date »
**And** un mois **clos** compare mois entier à mois entier (une seule requête `month` sur `[M−13, M+1)` sert M, M−1 et M−12) — sans mention « à date »

**AC6 — Fraîcheur et obsolescence (AD-17, inchangé)**
**Given** une vue servie par des requêtes explicites
**When** la connexion tombe ou une requête échoue
**Then** la **dernière réponse connue** reste affichée, la surface passe en `opacity-60`, la pill « Hors ligne · HH:MM » (horodatage de la dernière requête réussie) sur la tuile de gauche — une seule pill sur la page (règle 9.2) ; `console.warn("électricité: recorder.get_statistics failed", err)` — le comportement existant de `useStatistics`, **non modifié**
**And** un changement de fenêtre (navigation) relance la requête **immédiatement** (`windowKey` change) ; une réponse arrivée après une requête plus récente est **ignorée** (`requestSeq`)
**And** `unreadable` rend « Valeur illisible », distinct de « Pas de relevé » (D2)

**AC7 — Ni horaire, ni tarif, ni somme côté app (AD-4/AD-17)**
**Given** l'ensemble du code de la story
**When** les gates s'exécutent
**Then** `rg '01:08|06:08|12:38|15:38|0\.0890|0\.1491' src --glob '!*.test.*'` ⇒ vide ; `rg 'Date\.now\(\)' src/energy src/pages/ElectricityDetail.tsx` ⇒ vide ; aucun `reduce`/somme de `change` dans `src/energy/` ni `src/pages/` — la **seule** arithmétique ajoutée est `variation(cur, ref) = (cur − ref) / ref`, dans une fonction pure testée
**And** `useStatistics` ne change que par l'ajout de `"month"` à `StatisticsPeriod` (et son test) : politique de fraîcheur, garde anti-course, parse, `types: ["change"]` **intacts**

**AC8 — Le kiosque tient**
**Given** l'iPad à 1024×748 en PWA
**When** chacune des vues se rend (dernier relevé, jour passé, mois clos, mois en cours)
**Then** **aucun scroll**, rangée de contrôle sans collision avec « ‹ Accueil », la tuile HC/HP de droite **inchangée** — preuve **sur l'appareil, WebKit** (TD-9, mémoire « nommer l'instrument »)

## Tasks / Subtasks

- [ ] **Task 0 — HA (hors repo, Florian)** (AC: 4, 5)
  - [ ] Outils de développement → Statistiques → `linky:24305788525104` : noter le **premier jour disponible** (borne basse de la navigation utile ; conditionne « vs an dernier »)
  - [ ] Même chose pour `linky:24305788525104_cost` : depuis quand le coût existe (dépend de la Task 0 de 9.4 : `costs` posé, import ou remise à zéro)
  - [ ] Si le coût ne couvre pas l'historique et que la comparaison de coût compte : **remise à zéro** de ha-linky (`action: reset` puis `sync`, README § Remise à zéro) — recalcule les coûts sur tout l'historique réimporté (1 an de quotidien). Décision Florian, pas agent
  - [ ] Relever `recorder.purge_keep_days` (défaut 10) : profondeur de la couleur HC/HP des barres passées

- [ ] **Task 1 — Extraire les helpers de plage dans un module neutre** (AC: 1) — **commit séparé**, intent `refactor`
  - [ ] `src/dates/range.ts` (+ `.test.ts`) : déplacer `dayRange`, `weekRange`, `monthRange`, `shiftAnchor`, `rangeLabel`, `RangeUnit` depuis `src/agenda/select.ts:285-415` ; `select.ts` les ré-exporte (`export { … } from "../dates/range"`) pour ne pas toucher `AgendaDetail`/`useCalendarEvents` ; tests migrés avec
  - [ ] Pourquoi : la page électricité ne doit pas importer `src/agenda/` (couplage inter-domaines, revue 10.1 D4). `src/energy/statistics.ts` garde ses fenêtres (`startOfDay`, `dayWindow`) — pas de fusion, Rule 6
  - [ ] `npm test` vert, 0 changement de comportement

- [ ] **Task 2 — Module pur `src/energy/statistics.ts`** (AC: 3, 4, 5, 7) — TDD, `now`/`today` en paramètre
  - [ ] `monthWindow(monthStart)`, `monthsWindow(monthStart, backMonths)` = `[M−back, M+1)`, `truncatedMonthWindow(monthStart, days)` = `[M, M + days)` — champs calendaires, jamais `× 24 h` (DST)
  - [ ] `padDays(rows, window)` — un créneau par jour civil, `null` si absent (moule `padHours`)
  - [ ] `pointOnMonth(rows, monthStart)` (ou généraliser `pointOn` à un instant : c'est déjà une égalité de `start`) ; `daysCoveredIn(rows, monthStart)` = jour du mois de la dernière ligne (le N de AC5)
  - [ ] `variation(cur: number | null, ref: number | null): number | null` — `null` si l'un manque ou `ref === 0` ; **pas d'arrondi** (le formatteur arrondit)
  - [ ] `monthLabel(monthStart)` → « Août 2026 » ; `monthShort(monthStart)` → « août », « sept. 2025 » (année seulement si différente) — un formatteur `Intl` fr-FR par forme
  - [ ] `clampDay(d, lastComplete)`, `clampMonth(m, currentMonth)` — les bornes de `›`
  - [ ] Tests : 28/29/30/31 jours, décembre → janvier, 25 octobre (25 h), référence `null`/`0`, mois sans ligne, `padDays` 30 lignes ⇒ 31 créneaux, `daysCoveredIn` sur mois plein et partiel

- [ ] **Task 3 — `consumption-format.ts`** (AC: 4) — TDD
  - [ ] `formatVariation(v: number | null)` → « +12 % », « −5 % », « 0 % », « — » (signe typographique `−`, espace fine avant `%` comme les autres formatteurs fr-FR du fichier)

- [ ] **Task 4 — `useStatistics`** (AC: 6, 7) — TDD
  - [ ] `StatisticsPeriod = "hour" | "day" | "month"` ; un test qui envoie `period: "month"` et vérifie `serviceData.period`
  - [ ] Rien d'autre : la `range` explicite, `windowKey`, `requestSeq`, la relance horaire servent tels quels

- [ ] **Task 5 — Page `ElectricityDetail.tsx`** (AC: 1, 2, 3, 4, 5, 6, 8) — TDD
  - [ ] État : `view: "jour" | "mois"`, `anchor: Date | null` (`null` = dernier relevé en Jour, mois en cours en Mois) ; `today = startOfDay(new Date())` une fois par rendu
  - [ ] Rangée de contrôle : copier la structure `AgendaDetail.tsx:108-162` (tablist, `NavButton`, rappel, bouton) ; libellés « Jour » / « Mois », bouton « Dernier relevé » → `setAnchor(null)` ; rappel = `dayLabel(...).long` capitalisé en Jour, `monthLabel` en Mois (+ « · à date (N j) » sur le mois en cours)
  - [ ] Colonne gauche : trois compositions — `LatestDay` (**le code 9.4 tel quel**, extrait sans modification), `PastDay(D)` (requêtes `day` + `hour` sur `[D, D+1)`, `useHistory` du `binary_sensor` avec `hoursToShow` = heures entre `D 00:00` et maintenant, plafonné à `PERIOD_HISTORY_MAX_HOURS = 240` — change **uniquement** à la navigation, pas à l'heure, donc la réserve de la revue 2026-09-27 #5 est respectée), `Month(M)` (requête `month` `[M−13, M+1)` ; requête `day` `[M, M+1)` pour le graphe ; mois en cours : deux requêtes `month` tronquées supplémentaires)
  - [ ] Tuile HC/HP de droite : **ne pas toucher** ; `anyStale` inclut les hooks de la composition active
  - [ ] Bornes : `›` en Jour clampé sur `selectLastCompleteDay(fenêtre par défaut)` — la requête par défaut (2 jours) reste montée pour connaître la borne ; en Mois clampé sur le mois de `today`
  - [ ] Tests (`ElectricityDetail.test.tsx`) : mock `callService` aiguillé par `serviceData.period` **et** par `start_time` (les fenêtres diffèrent maintenant) ; `vi.useFakeTimers` + `setSystemTime` (moule `AgendaDetail.test.tsx`) ; cas : rendu 9.4 intact par défaut ; ‹ ⇒ fenêtre `[J−2, J−1)` demandée ; › depuis le dernier relevé ⇒ **aucune** nouvelle requête ; « Dernier relevé » ⇒ retour ; Mois ⇒ `period: "month"` sur 14 mois ; variations calculées (+12 %, −5 %), référence manquante ⇒ « — », référence 0 ⇒ « — » ; mois en cours ⇒ deux requêtes tronquées avec `end_time` = début + N jours et libellé « à date (N j) » ; jour sans ligne ⇒ « Pas de relevé ce jour-là » ; barres neutres quand l'historique ne couvre pas D ; **mutations** : `variation` avec `ref = 0` renvoyant `Infinity`, clamp retiré, fenêtre tronquée non tronquée — chacune doit casser un test

- [ ] **Task 6 — Docs** (AC: 4, 5)
  - [ ] `docs/home-assistant.md` § Électricité : sous-section « Naviguer dans le passé et vue mensuelle (Story 9.5) » — profondeur d'import ha-linky (1 an), coûts recalculés à la remise à zéro, `purge_keep_days` et la couleur des barres, ce que « — » veut dire dans chaque cas
  - [ ] `deferred-work.md` : si la Task 1 est refusée, consigner le couplage `pages/Electricity → agenda`
  - [ ] En-tête JSDoc d'`ElectricityDetail.tsx` réécrit (il décrit une page à une seule vue)

- [ ] **Task 7 — Gates** (AC: 7)
  - [ ] `npm run typecheck && npm run lint && npm test && npm run format:check`
  - [ ] `rg '01:08|06:08|12:38|15:38|0\.0890|0\.1491' src --glob '!*.test.*'` ⇒ vide · `rg 'Date\.now\(\)' src/energy src/pages/ElectricityDetail.tsx` ⇒ vide · `rg -n 'from "\.\./agenda' src/pages/ElectricityDetail.tsx src/energy` ⇒ vide
  - [ ] Build sans token (`.env.local` écarté puis restauré, SHA-256 identique) ; `rg -o 'eyJhbGciOi' dist/ | wc -l` ⇒ 0 ; `rg -o 'linky:[0-9]' dist/assets/*.js | wc -l` ⇒ 2

- [ ] **Task 8 — Preuve device (Florian, iPad, WebKit)** (AC: 8)
  - [ ] Quatre vues sans scroll ; navigation au doigt ; mois antérieur au coût ⇒ « — » honnête ; « Dernier relevé » revient ; barres neutres sur un jour de plus de 10 jours

## Dev Notes

### Ce qui existe — réutiliser, ne pas réécrire

| Besoin | Existe déjà | Où |
| --- | --- | --- |
| Lire des statistiques sur une fenêtre | `useStatistics({ statisticIds, period, units, range })` | `src/hakit/useStatistics.ts` |
| Valider la réponse, choisir un jour, fenêtres jour | `parseRows`, `pointOn`, `selectLastCompleteDay`, `startOfDay`, `dayWindow`, `padHours`, `dayLabel`, `periodOfInterval` | `src/energy/statistics.ts` |
| Barres, trous visibles, couleur par point | `SensorHistoryChart kind="bar"`, `HistoryPoint.value: number \| null`, `color`, `label` | `src/widgets/SensorHistoryChart.tsx` |
| Rangée de contrôle, flèches, bouton de retour | `AgendaDetail.tsx:108-162`, `NavButton :224-` | `src/pages/AgendaDetail.tsx` |
| Plages mois, pas mensuel calé sur le 1er, libellés | `monthRange`, `shiftAnchor`, `rangeLabel` | `src/agenda/select.ts:339-415` → **Task 1** |
| Formatteurs fr-FR | `formatEuro`, `formatKwh`, `formatSince` | `consumption-format.ts`, `hakit/stale.ts` |

### Ce que HA fait pour nous (vérifié à la source, 2026-09-27)

- `recorder.get_statistics` : `period ∈ {5minute, hour, day, week, month, year}` (`recorder/services.py:85-87`) — `month` est **déjà** accepté ; seul le type TS de `useStatistics` le restreint.
- **Fenêtre tronquée** : `statistics_during_period` charge les lignes horaires de `[start_time, end_time)` puis `_reduce_statistics` (`statistics.py:1180-1245`) les réduit en buckets `month` ; le `change` d'un bucket = différence des `sum` aux bornes **des lignes chargées**. Une fenêtre `[1er août, 27 août)` rend donc **la conso du 1er au 26 août inclus**, calculée par HA. C'est ce qui rend AC5 possible sans somme côté app.
- Le bucket du **mois en cours** est naturellement « à date » : ses lignes s'arrêtent au dernier import.
- `start`/`end` sont des **ISO UTC** ; le mois local se lit avec `new Date(start)` dans le fuseau du kiosque (`TZ=Europe/Paris` épinglé en test). Les buckets `month` sont alignés sur les **1ers du mois locaux de HA**.
- `change` **absent** sur la première ligne d'une statistique et clé absente pour un id inconnu ⇒ « pas de donnée » (déjà géré par `parseRows`).

### Ce que ha-linky garantit (README relu 2026-09-27)

- Premier lancement : **jusqu'à 1 an** de données **quotidiennes** ; demi-heure pour les 7 derniers jours ; import plus long et horaire via CSV.
- Coûts **calculés à l'import** ; pas recalculés sur l'existant **sauf remise à zéro** (`action: reset` → `sync`), qui réimporte tout l'historique avec les coûts.
- Conséquence : la profondeur du coût est une **décision de Florian** (Task 0), pas un défaut de l'app.

### Modèle de navigation

```text
view   ∈ { "jour", "mois" }
anchor ∈ { null, Date }        null = « dernier relevé » (Jour) / mois en cours (Mois)

Jour, anchor null → composition 9.4 (fenêtre 2 jours, selectLastCompleteDay)
Jour, anchor D    → day [D, D+1) ×2 ids · hour [D, D+1) · useHistory(binary_sensor, h(D))
Mois, anchor M    → month [M−13, M+1) ×2 ids · day [M, M+1) conso
                    + si M = mois courant : month [M−1, M−1+N) ×2 · month [M−12, M−12+N) ×2
‹ › : Jour ±1 jour (clamp haut = dernier jour complet) · Mois ±1 mois via shiftAnchor (clamp haut = mois de today)
```

Pourquoi `anchor: null` et pas « la date du dernier relevé » : le dernier relevé **bouge** (import du matin) ; un `null` suit ce mouvement, une date figée montrerait avant-hier après l'import.

### Pièges connus (revues 9.1 → 9.4)

- Mock `callService` **aiguillé par la requête** (`period` ET `start_time`) : plusieurs hooks `useStatistics` cohabitent maintenant sur la page.
- **Réinitialiser** chaque champ du mock dans `beforeEach` (9.2 : 5 tests pollués) ; `mockReset` + valeur par défaut.
- `React.lazy` du graphe sous faux timers : **préchauffer le module** (`await import(...)`) avant le rendu (Debug Log 9.4).
- Dépendances React sur **primitives** (`startMs`/`endMs`) — `useStatistics` le fait déjà ; ne pas lui passer un objet `range` recréé sans stabilité… c'est justement pourquoi il lit `getTime()`.
- `hoursToShow` de `useHistory` : la revue 2026-09-27 #5 l'a rendu **constant** parce qu'une valeur dérivée de l'horloge résiliait l'abonnement chaque heure. Ici la valeur dépend de **l'ancrage**, qui ne change qu'au tap : acceptable, à écrire en commentaire.
- `tsc` ne couvre pas les tests (TD-2) : `npm test` après tout changement de signature.
- Matchers : « Hier » apparaît dans le titre **et** le rappel de période → resserrer (`getByRole("tab")`, `data-testid`).
- Build AD-8 : `vite build` refuse `VITE_HA_TOKEN` défini ; empreinte SHA-256 de `.env.local` avant/après.
- Un `className` asserté ne prouve pas que Tailwind émet la classe : vérifier `dist/assets/*.css`.

### Décisions de conception à ratifier (Florian)

1. **Libellé du bouton de retour : « Dernier relevé »** — pas « Aujourd'hui » (il n'existe pas, UX-DR30), pas « Hier » (faux avant 7h30).
2. **Task 1 (extraction `src/dates/range.ts`)** plutôt qu'un import `pages/Electricity → agenda`. Refus possible : alors import direct + dette consignée.
3. **Variations en une ligne par référence** (« vs août : conso +12 % · coût +9 % ») plutôt qu'un tableau 2×2 — la tuile de gauche partage la colonne avec le graphe, la hauteur est comptée.
4. **Mois en cours = « à date » par fenêtres tronquées HA** (AC5). Alternative refusée : sommer les jours côté app (contredit AD-17 « ne somme pas »).

### Project Structure Notes

- **NEW** : `src/dates/range.ts` (+ `.test.ts`, Task 1).
- **UPDATE** : `src/agenda/select.ts` (ré-exports), `src/energy/statistics.ts` (+ `.test.ts`), `src/hakit/useStatistics.ts` (+ `.test.ts`, un type), `src/widgets/consumption-format.ts` (+ `.test.ts`), `src/pages/ElectricityDetail.tsx` (+ `.test.tsx`), `docs/home-assistant.md`.
- **Non touchés** : `ElectricityTile.tsx` (la chip reste « hier »), `mapping.ts` (aucun id nouveau), `SensorHistoryChart.tsx`, `useCalendarEvents.ts`, `App.tsx`.
- Direction des dépendances : `pages` → `hakit` / `energy` / `dates` / `widgets` ; `hakit` et `energy` n'importent **jamais** `pages`/`widgets` (10.1 D4).
- Config BMM dit `English` ; les stories du dépôt sont en français, celle-ci aussi.

### Gates

```bash
npm run typecheck && npm run lint && npm test && npm run format:check
rg '01:08|06:08|12:38|15:38|0\.0890|0\.1491' src --glob '!*.test.*'     # vide
rg 'Date\.now\(\)' src/energy src/pages/ElectricityDetail.tsx            # vide
rg -n 'from "\.\./agenda' src/pages/ElectricityDetail.tsx src/energy      # vide (Task 1)
rg -o 'linky:[0-9]' dist/assets/*.js | wc -l                             # 2
```

### References

- [Source: _bmad-output/implementation-artifacts/9-4-electricite-hier-statistiques-linky.md] — seam, module pur, décisions du 25/09, revue du 27/09, pièges `lazy` + faux timers
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-25.md §3–§4] — alternatives écartées (capteur SQL, kWh × prix), décisions actées
- [Source: _bmad-output/planning-artifacts/epics.md — FR-E1/FR-E4, AD-16 amendé, AD-17 (2ᵉ instance), UX-DR23 amendé, UX-DR29, UX-DR30]
- [Source: _bmad-output/implementation-artifacts/10-2-page-detail-agenda-semaine-mois.md] — navigation, bouton de retour jamais `disabled`, budget vertical
- [Source: src/hakit/useStatistics.ts:21-31 (query), :94-100 (clés primitives), :123-191 (fetch)]
- [Source: src/energy/statistics.ts:58-70 (`parseRows`), :89-99 (`selectLastCompleteDay`), :207-236 (`pointOn`, `padHours`)]
- [Source: src/pages/ElectricityDetail.tsx:108-187 (composition 9.4 à extraire telle quelle), :271-323 (tuile HC/HP intacte)]
- [Source: src/pages/AgendaDetail.tsx:81-95, :108-162, :224-] — moule de la rangée de contrôle
- [Source: src/agenda/select.ts:339-415] — `monthRange`, `shiftAnchor`, `rangeLabel` (Task 1)
- [Source: src/pages/ElectricityDetail.test.tsx:1-95] — mocks `callService`/`useHistory`/recharts à étendre
- [Source: HA core `dev` — `recorder/services.py:82-96` (schéma, `month`), `recorder/statistics.py:1180-1245` (`_reduce_statistics`), lus le 2026-09-27]
- [Source: bokub/ha-linky README §§ Import d'historique CSV, Remise à zéro, Calcul des coûts — lu le 2026-09-27]
- [Source: TECH_DEBT.md#TD-9 · memory `target-device-and-layout` · `name-the-instrument-before-claiming-verified`]

## Dev Agent Record

### Agent Model Used

Claude Fable 5.1 (create-story, 2026-09-27)

### Debug Log References

### Completion Notes List

### File List
