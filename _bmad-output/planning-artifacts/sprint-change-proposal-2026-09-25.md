---
title: Sprint Change Proposal — Epic 9 « Électricité : hier au lieu d'aujourd'hui »
status: approved
approved_by: Florian
approved_on: 2026-09-25
created: 2026-09-25
mode: correct-course (batch)
scope_classification: Modéré (nouvelle story 9.4, amendements planning, clôture 9.1)
supersedes_blocker: deferred-work.md § « Bloqué (non différé) — story 9.1 »
---

# Sprint Change Proposal — Epic 9 : la conso Linky est une statistique J-1, pas un capteur

## Section 1 — Résumé du déclencheur

**Story déclencheuse.** 9.1 « Micro-tuile Électricité (conso + prix + coût) », en `review`
depuis le 2026-07-23, code livré sur `master`, Task 0 (source de conso) jamais levée.

**Catégorie.** Limitation technique découverte à l'implémentation, **mal qualifiée pendant
deux mois**. La cause consignée (« intégration fournisseur HS, problème d'API ») était fausse.

**Cause réelle.** La source de consommation du foyer est l'add-on **ha-linky**. Il n'expose
**aucune entité** : il écrit une **statistique à long terme** dans le recorder de HA,
identifiant `linky:24305788525104`, unité Wh, source `linky`. Deux propriétés de cette source
rendent la 9.1 insatisfiable telle qu'écrite, **par nature et non par panne** :

1. **Pas d'état d'entité** ⇒ `useEntityValue`, `useHistory`, l'obsolescence AD-6 et le
   placeholder `sensor.electricite_conso_jour` n'ont rien à lire. Il n'existe pas
   d'`entity_id` à relever.
2. **Données J-1** ⇒ Enedis ne fournit la journée que le lendemain ; ha-linky importe entre
   6h et 7h30 (repli 9h–10h30). « Conso depuis 00:00 » et « coût du jour » n'existeront jamais
   avec cette source.

**Évidence.**
- Outils de développement → Statistiques, ligne collée par Florian le 2026-09-25 :
  `Linky consumption · linky:24305788525104 · Wh · linky · No issue`.
- README ha-linky (relu le 2026-09-25 via l'API GitHub) : « Les données d'une journée ne sont
  pas accessibles en temps réel, il faut attendre le lendemain » ; « Une fois entre 6h et 7h30
  du matin pour récupérer les données de la veille » ; « données par demi-heure » pour les
  7 derniers jours ; section « Calcul des coûts » (`costs`, statistique suffixée `(costs)`).
- HA **2026.7.3** sur le Pi (`ha core info`) ; le service **`recorder.get_statistics`** est
  déclaré dans le typage `@hakit/core` 6.0.2 (`supported-services.d.ts`) avec
  `start_time`, `end_time`, `statistic_ids`, `period`, `types`, `units`.
- Décision Florian (2026-09-25) : **afficher « hier » au lieu d'« aujourd'hui »**.

## Section 2 — Analyse d'impact

**Epic 9.** Reste réalisable, mais son postulat « coût du jour » est faux pour l'électricité.
Le patron « flux de consommation » fondé par 9.1 (mapping, module pur, tuile, page détail,
formatteurs) **sert intégralement** ; seul le **chemin de lecture** et le **jour affiché**
changent. La 9.3 Eau portait déjà la note « l'affichage peut montrer hier » : elle s'aligne.

**Stories.**
- **9.1** — livrée avec un placeholder ; sa Task 0 devient **sans objet** (la source
  demandée ne peut pas exister). Passe `done` (décision Florian), source reprise par 9.4.
- **9.2** — `done`, inchangée. La tuile HC/HP de la page détail (période courante, prochaine
  bascule, deux prix) reste pertinente. Le **saut de +68 %** du coût courant disparaît de
  la tuile : le coût d'hier est calculé par HA au bon tarif, demi-heure par demi-heure.
- **9.3** — `backlog`, texte inchangé ; hérite du patron 9.4 si SAUR est aussi J-1.
- **9.4 (nouvelle)** — « Électricité : hier, depuis les statistiques Linky ». Priorité
  **avant 9.3**.

**Artefacts.**
- **PRD** — pas de conflit (ligne backlog « conso élec (Linky/TotalÉnergies) »). Tout est
  centralisé dans `epics.md`, comme décidé le 2026-07-21.
- **`epics.md`** — FR-E1, FR-E4, AD-16, AD-17, UX-DR23, intro Epic 9, Task 0 Epic 9, FR
  Coverage Map : amendements § 4. Nouvelle UX-DR30, nouvelle Story 9.4.
- **Architecture spine** — **non touchée**. `recorder.get_statistics` est un service à
  réponse appelé via `callService` + `returnResponse: true` : c'est **AD-17 à la lettre**,
  aucune tension avec AD-2 (pas d'appel websocket ad hoc). AD-4 renforcé : le coût HC/HP
  d'hier est calculé par HA, plus par l'app.
- **`sprint-status.yaml`** — 9-1 → `done`, 9-4 → `backlog`, commentaire epic-9.
- **`docs/home-assistant.md`** § Électricité — à réécrire par la 9.4 (contrat = deux
  identifiants de statistiques + capteur template de prix courant + config `costs`).
- **`deferred-work.md`** § « Bloqué (non différé) — story 9.1 » — à clore : cause requalifiée.
- **Code** (périmètre 9.4, pas de cette proposition) : `mapping.ts` (`ElectricityConfig`),
  nouveau seam `src/hakit/useStatistics*.ts`, `ElectricityTile`, `ElectricityDetail`,
  `electricity-cost.ts` (le produit `conso × prix` sort de la tuile), tests associés.

**Point de vigilance git.** La PR #1 (branche `feat/11-1-…`) ajoute AD-18 juste sous AD-17
et l'Epic 11 en fin de fichier. Les amendements ci-dessous touchent AD-16/AD-17 : **conflit
probable** sur une dizaine de lignes à la fusion, résolution manuelle.

## Section 3 — Approche recommandée

**Option 1 — Ajustement direct.** Nouvelle story 9.4 dans l'epic existant, 9.1 close,
amendements de planning centralisés dans `epics.md`.
- **Effort :** Moyen (un seam neuf mais sur précédent `useCalendarEvents`, deux composants
  réécrits partiellement, une doc HA). **Risque :** Faible.
- **Rejeté :** Option 2 (rollback) — rien à annuler, le code 9.1 sert. Option 3 (révision
  MVP) — sans objet, la coordination v2 n'est pas concernée.

**Alternatives écartées le 2026-09-25 (traçabilité).**
- **Capteur SQL côté HA** sur la table `statistics` : schéma interne non garanti entre
  versions, piège de fuseau à minuit, graphe 24 h devenu ligne plate. Écarté.
- **Source temps réel** (module TIC Lixee ZLinky, pince Shelly EM) : satisferait la 9.1
  sans la modifier, mais coût matériel. Reste une **porte de sortie** documentée : si un
  jour un capteur temps réel existe, AD-16 amendé le couvre toujours.
- **Coût = kWh d'hier × prix pleines** : chiffre faux de 68 % dans un sens, exactement ce
  que la 9.2 a refusé. Écarté.

## Section 4 — Propositions de changement détaillées

### 4.1 Décisions actées (Florian, 2026-09-25)

1. **Jour affiché = le dernier jour complet disponible**, jamais « aujourd'hui ». Avant
   l'import du matin, c'est avant-hier : la tuile porte **toujours la date** en libellé.
2. **Chemin de lecture = `recorder.get_statistics`** (service à réponse, AD-17). Aucune
   config HA supplémentaire pour la conso.
3. **Coût d'hier calculé par HA** via la section `costs` de ha-linky, en mode **`entity_id`**
   pointant sur un capteur template `sensor.prix_kwh_courant` (HC → prix creuses, sinon prix
   pleines, dérivé du `binary_sensor.heures_creuses` et des deux helpers de la 9.2). HA reste
   la source unique des horaires et des prix (AD-4) ; rien n'est dupliqué dans l'add-on.
4. **Approximation acceptée** : ha-linky calcule à la demi-heure ; les fenêtres HC du foyer
   commencent à 01h08 et 12h38. Environ **32 min/jour** sont facturées au tarif voisin, de
   l'ordre de **1 à 2 % du coût**. Consigné, non compensé côté app.
5. **9.1 passe `done`** à l'approbation : code livré, Task 0 sans objet, source reprise par 9.4.

### 4.2 `epics.md` — Functional Requirements v2

```
FR-E1
OLD: **Micro-tuile Électricité** — conso (capteur HA Linky/TotalÉnergies) + **coût du jour**
     dérivé (`conso × prix`), **HC/HP-aware** ; **reflect-only** ; obsolescence AD-6 ; jamais
     de blanc.
NEW: **Micro-tuile Électricité** — conso et **coût du dernier jour complet** lus depuis les
     **statistiques à long terme** de HA (source Linky, J-1, `recorder.get_statistics`,
     AD-17) ; coût **calculé par HA** au tarif HC/HP réel de chaque demi-heure (AD-4) ;
     **libellé daté** obligatoire (UX-DR30) ; **reflect-only** ; obsolescence AD-17 ;
     jamais de blanc.
Rationale : la source n'est ni un capteur ni du jour ; le coût HC/HP exact est disponible
côté HA, l'app n'a plus à multiplier.

FR-E4 (transverse)
OLD: **Source & prix** — conso = **capteurs HA read-only** (Task 0 : vérifier/activer les
     intégrations par fournisseur) ; prix = helpers HA `input_number` ou config runtime ;
     **coût = dérivation d'affichage** (pas d'état persisté, AD-1) ; **repli** = seam
     read-only isolé (exception AD-2 conditionnelle, précédent NutriClaude) si un
     fournisseur n'a pas d'intégration HA.
NEW: **Source & prix** — conso = **HA read-only**, sous l'une de deux formes : **capteur**
     (état d'entité, AD-3/AD-6) quand la source est temps réel, ou **statistique à long
     terme** (`recorder.get_statistics`, AD-17) quand la source n'existe qu'en J-1 (Linky).
     Prix = helpers HA `input_number`. **Coût** = statistique de coût **calculée par HA**
     quand l'intégration la fournit (ha-linky `costs`), sinon dérivation d'affichage
     `conso × prix` côté app ; **jamais un état persisté côté app** (AD-1). **Repli** = seam
     read-only isolé (exception AD-2 conditionnelle) si un fournisseur n'a pas
     d'intégration HA.
Rationale : FR-E4 ne connaissait qu'une forme de source ; la seconde est désormais réelle.
```

### 4.3 `epics.md` — Additional Requirements (AD-16 amendé, AD-17 étendu)

```
AD-16
OLD: **[AD-16 — Flux de consommation : lecture HA read-only + coût dérivé]** La conso
     élec/eau vient de **capteurs HA** (reflet AD-3, obsolescence AD-6, mapping AD-7),
     **read-only**. Le **coût** est une **dérivation d'affichage** (`conso × prix`), **pas
     un état persisté** (AD-1). […]
NEW: **[AD-16 amendé (2026-09-25) — Flux de consommation : lecture HA read-only, capteur
     OU statistique]** La conso élec/eau vient de HA en **lecture seule**, sous deux formes
     selon la source : (a) un **capteur** (état d'entité — reflet AD-3, obsolescence AD-6)
     quand la donnée est temps réel ; (b) une **statistique à long terme** (`recorder.
     get_statistics`, lecture par requête AD-17, identifiant de statistique dans le mapping
     AD-7 au même titre qu'un `entity_id`) quand la donnée n'existe qu'en **J-1** (Linky).
     En (b), la tuile affiche le **dernier jour complet** et le **dit** (UX-DR30). Le
     **coût** reste une valeur d'affichage **jamais persistée côté app** (AD-1) : **calculé
     par HA** quand l'intégration produit une statistique de coût (ha-linky `costs`), sinon
     `conso × prix` côté app. Les **prix** et le **planning HC/HP** vivent dans HA (AD-4) —
     y compris pour le calcul de coût de l'add-on, alimenté par un capteur template de
     prix courant, jamais par des horaires dupliqués. Repli seam read-only si un
     fournisseur n'a pas d'intégration HA (inchangé).
Rationale : la forme (b) est la réalité du foyer ; l'écrire évite qu'une prochaine story
reparte d'un placeholder `sensor.*`.

AD-17
OLD: **[AD-17 — Lecture par requête : service HA à réponse, bornée au seam]** Les événements
     d'agenda ne sont **pas un état d'entité** : […] Précédent : `useHistory` […].
NEW: (texte existant conservé intégralement) + ajout en fin :
     **Deuxième instance (2026-09-25) : les statistiques à long terme.** Une statistique du
     recorder (ex. `linky:<PRM>`) n'a **ni état, ni entité, ni événement** ; elle se lit par
     **`recorder.get_statistics`** (`callService` + `returnResponse: true`, HA ≥ 2025.1),
     avec `period`, `types` (`change` pour l'énergie d'une période) et `units` (conversion
     Wh → kWh **par HA**). Mêmes règles : dans `src/hakit/`, fraîcheur propre (la réponse
     est datée de sa requête), rafraîchissement explicite (jour civil, connexion,
     premier plan, **et une relance horaire** parce que l'import J-1 tombe entre 6h et
     10h30), dernière réponse + obsolescence sur échec, jamais de blanc. L'app **ne
     découpe ni ne somme** des périodes : elle demande à HA la granularité qu'elle
     affiche (AD-4).
Rationale : AD-17 était écrit pour l'agenda ; sa généralisation est la seule pièce
d'architecture que 9.4 requiert. Aucune exception AD-2.
```

### 4.4 `epics.md` — UX Design Requirements (UX-DR23 amendé, UX-DR30 nouveau)

```
UX-DR23
OLD: […] icône + **coût du jour** (€, tabular-nums) en **valeur héros** + **sous-ligne
     conso** (kWh / m³ sur la tuile) ; pill d'état HC/HP à droite (élec). […] popover
     tarifaire = coût + conso du jour […] **Obsolescence** = dernière valeur connue +
     **pill « Hors ligne · HH:MM »** (horodatage du dernier relevé) […]
NEW: […] icône + **coût du jour affiché** (€, tabular-nums) en **valeur héros** + **sous-
     ligne conso** (kWh / m³) **+ libellé daté quand le jour n'est pas aujourd'hui**
     (UX-DR30) ; pill d'état HC/HP à droite (élec). […] (popover → page détail, décision
     9.1 du 2026-07-23, inchangée) […] **Obsolescence** = dernière valeur connue + pill
     « Hors ligne · HH:MM » sur la **page détail** (règle de famille 9.1/10.1 : pas de pill
     sur la chip), atténuation sur la chip ; pour une source J-1, l'horodatage est celui
     de la **requête**, pas d'un relevé.
Rationale : aligne la règle sur ce qui a été livré (page détail, pill hors chip) et sur
la source J-1.

UX-DR30 (nouveau)
**Donnée différée = valeur datée.** Toute valeur qui n'est **pas** celle d'aujourd'hui porte
**sa date dans son libellé** — « Hier · mer. 24 », « Avant-hier · mar. 23 » — jamais un
chiffre nu qu'on lirait comme courant. Le libellé suit le jour réellement affiché (le
**dernier jour complet disponible**), pas un jour calendaire supposé. L'absence de tout jour
disponible est un **état rendu** (« Pas encore de relevé »), même empreinte que la version
peuplée (UX-DR27). Instancie UX-DR14 (le sens ne repose jamais sur une seule modalité) pour
la dimension temporelle.
Rationale : une durée ou un coût périmé est indiscernable d'un chiffre frais (leçon AD-18b,
Epic 11) ; la date rend la péremption visible.
```

### 4.5 `epics.md` — Epic 9 : intro, Task 0, note 9.1, Story 9.4

```
Epic 9 — intro (les deux occurrences : Epic List l.628 et section l.793)
OLD: […] reflètent en lecture seule la conso élec & eau depuis HA et en dérivent le coût
     du jour, avec l'état heures creuses/pleines. […]
NEW: […] reflètent en lecture seule la conso élec & eau depuis HA et en donnent le **coût
     du dernier jour disponible** — **hier** pour Linky (donnée J-1, statistiques HA,
     Story 9.4), le jour courant si un capteur temps réel existe — avec l'état heures
     creuses/pleines. […]

Epic 9 — Task 0 (hors-repo)
OLD: […] exposer côté HA les capteurs de conso élec (Enedis / TotalÉnergies) + eau (SAUR /
     HACS) en **cumul journalier** […]
NEW: […] exposer côté HA la conso élec **et** eau : soit un capteur en cumul journalier
     (source temps réel), soit une **statistique à long terme** (ha-linky pour l'élec —
     **fait**, `linky:24305788525104`) ; la **période HC/HP courante** et les **deux prix**
     (**faits**, Story 9.2) ; pour le coût J-1, la config `costs` de l'add-on alimentée par
     un capteur template de prix courant (Story 9.4, Task 0). […]

Story 9.1 — note à insérer sous le titre
> **Livrée le 2026-07-23 sur placeholder `sensor.electricite_conso_jour`, clôturée `done`
> le 2026-09-25.** Sa Task 0 est **sans objet** : la source du foyer (ha-linky) est une
> statistique J-1, pas un capteur (voir `sprint-change-proposal-2026-09-25.md`). La tuile,
> la page et le patron sont **réutilisés tels quels** par la Story 9.4, qui remplace le
> chemin de lecture et le jour affiché.
```

**Story 9.4 — texte complet à insérer après 9.2, avant 9.3 :**

```
### Story 9.4: Électricité — hier, depuis les statistiques Linky

_Remplace la source de 9.1 : la conso du foyer n'est pas un état d'entité mais une
**statistique à long terme** importée **J-1** (ha-linky). Lecture par requête (AD-17,
`recorder.get_statistics`), coût calculé par HA (AD-4), valeur datée (UX-DR30). Reflect-only,
AD-16 amendé._

As a Florian,
I want voir ce que l'électricité m'a coûté **hier**, avec la conso, au tarif HC/HP réel,
So that je garde un œil sur ma facture sans exiger une donnée temps réel que Linky ne
fournit pas.

**Acceptance Criteria:**

**Given** les identifiants de statistiques relevés en Task 0 — conso `linky:24305788525104`
et son pendant coût suffixé `(costs)` — inscrits dans `ElectricityConfig`
(`src/entities/mapping.ts`, AD-7) à la place de `dailyKwhEntityId`
**When** la tuile ou la page lit sa source
**Then** l'appel est **`recorder.get_statistics`** via `callService` + `returnResponse: true`
dans un seam `src/hakit/` (AD-17, moule `useCalendarEvents` : garde anti-course, `catch`
journalisé), `period: "day"`, `types: ["change"]`, `units: { energy: "kWh" }`, sur une
fenêtre couvrant **les deux derniers jours civils** ; **0 `entity_id`/statistic_id en dur**
hors `src/entities/` ; **aucun appel websocket hors seam** (AD-2 intact)

**Given** la réponse
**When** la tuile se rend
**Then** elle affiche le **dernier jour complet disponible** : coût héros (€, tabular-nums),
sous-ligne conso (kWh) **et le libellé daté** « Hier · mer. 24 » ou « Avant-hier · mar. 23 »
(UX-DR30) — jamais une valeur sans date, jamais le jour courant
**And** le coût est **celui calculé par HA** (statistique de coût), l'app ne multiplie plus
`conso × prix` pour cette valeur ; `electricity-cost.ts` garde `normalisePeriod` pour la
tuile HC/HP de la page

**Given** aucun jour disponible dans la fenêtre (import jamais fait, statistiques vides)
**When** la tuile se rend
**Then** un **état rendu** « Pas encore de relevé », **même empreinte** (UX-DR27), jamais de
blanc ni de spinner

**Given** la requête rejetée, ou la connexion perdue
**When** la tuile se rend
**Then** **dernière réponse connue + obsolescence** horodatée de la requête (AD-17), atténuée
sur la chip, pill « Hors ligne · HH:MM » sur la page (règle de famille) ;
`console.warn("électricité: recorder.get_statistics failed", err)` ; jamais de blanc

**Given** l'import ha-linky entre 6h et 10h30
**When** le jour civil change, la connexion revient, l'app repasse au premier plan, **ou une
heure s'est écoulée** depuis la dernière réponse
**Then** la requête est relancée ; **pas de polling plus court** — la donnée change au plus
une fois par jour

**Given** la page `/electricite`
**When** elle se rend
**Then** la tuile « Aujourd'hui » devient « **Hier · date** » (coût HA + conso), le graphe
montre les **24 heures du jour affiché** (`period: "hour"`, `types: ["change"]`, barres
horaires — la granularité des statistiques à long terme est l'heure), la tuile HC/HP de la
9.2 (période courante, deux prix, prochaine bascule) **reste** ; page **sans scroll**

**Given** la préférence de tarif
**When** le coût d'hier se calcule
**Then** il l'est **côté HA** par ha-linky, au prix du capteur template
`sensor.prix_kwh_courant` à chaque demi-heure ; l'approximation aux frontières 01h08/06h08/
12h38/15h38 (≈ 32 min/jour au tarif voisin, 1–2 % du coût) est **documentée et assumée**,
interdiction de la compenser côté app

> **Task 0 (hors-repo, préalable au device-proof) :**
> 1. Créer le capteur template **`sensor.prix_kwh_courant`** (€/kWh) = `input_number.
>    prix_kwh_creuses` si `binary_sensor.heures_creuses` est `on`, sinon `input_number.
>    prix_kwh_pleines` — `state_class: measurement`, enregistré par le recorder (ha-linky lit
>    **l'historique** du prix, le capteur doit exister **avant** le jour importé).
> 2. Dans ha-linky, onglet Configuration, encadré `costs` : `- entity_id: sensor.prix_kwh_
>    courant` (aucun `after`/`before` : incompatibles avec `entity_id`, et de toute façon
>    incapables de dire 01h08).
> 3. Attendre l'import du lendemain **ou** faire une « remise à zéro » de l'add-on pour que
>    les coûts soient calculés sur l'historique.
> 4. Relever dans Outils de développement → Statistiques l'**identifiant exact** de la
>    statistique de coût (suffixe `(costs)`) — **jamais deviné**, précédent 9.1/11.1.
> 5. Documenter le tout dans `docs/home-assistant.md` § Électricité (réécriture : contrat =
>    deux identifiants de statistiques + capteur template ; le `utility_meter` et le
>    placeholder disparaissent).
>
> **Porte de sortie :** si un capteur temps réel apparaît un jour (TIC, pince), AD-16 (a)
> s'applique et la 9.1 telle qu'écrite redevient possible ; 9.4 ne l'interdit pas.
```

### 4.6 `epics.md` — FR Coverage Map

```
OLD: FR-E1: Epic 9 — Micro-tuile Électricité (conso + prix + coût, reflect-only)
NEW: FR-E1: Epic 9 — Micro-tuile Électricité (9.1 patron + 9.4 source statistiques J-1)
OLD: FR-E4: Epic 9 — Source HA read-only + prix config + repli seam (transverse)
NEW: FR-E4: Epic 9 — Source HA read-only (capteur ou statistique) + prix config + repli seam
```

### 4.7 `sprint-status.yaml`

```
9-1-micro-tuile-electricite-conso-cout: review → done
  # ✅ done 2026-09-25 (décision Florian, correct-course). Code livré 2026-07-23 ; Task 0
  # SANS OBJET : la source (ha-linky) est une statistique J-1 sans entité, pas un capteur.
  # La cause « API fournisseur HS » consignée le 2026-07-29 était fausse. Source reprise
  # par 9-4. Preuve device transférée à 9-4.
9-4-electricite-hier-statistiques-linky: backlog   (nouvelle, insérée après 9-2, avant 9-3)
  # créée 2026-09-25 par correct-course (sprint-change-proposal-2026-09-25.md). Lecture
  # recorder.get_statistics (AD-17), coût calculé par HA (ha-linky costs), valeur datée
  # (UX-DR30). Task 0 : sensor.prix_kwh_courant + costs + relever l'id « (costs) ».
epic-9: in-progress  # commentaire : + « 9.1 close, 9.4 remplace la source, 9.3 après »
last_updated: 2026-09-25
```

### 4.8 Autres artefacts

- **`_bmad-output/implementation-artifacts/9-1-micro-tuile-electricite-conso-cout.md`** —
  `Status: done` ; Change Log : « 0.3 — clôturée par correct-course 2026-09-25, Task 0 sans
  objet, source reprise par 9.4 » ; Task 0 et preuve device : laissées **non cochées** avec
  mention « sans objet / transférée à 9.4 » (on ne coche pas ce qui n'a pas été fait).
- **`deferred-work.md`** § « Bloqué (non différé) — story 9.1 » — marquer **requalifié** :
  cause réelle = statistique J-1, résolution = 9.4.
- **`docs/home-assistant.md`** § Électricité — réécriture **dans la 9.4** (Doc Impact de la
  story), pas dans cette proposition.
- **Code** — aucun changement dans cette proposition.

## Section 5 — Handoff & implémentation

- **Classification :** **Modéré** (nouvelle story, clôture d'une story en review, amendements
  planning) → PO/DEV = **Florian**.
- **Séquence :**
  1. Approbation de cette proposition → appliquer §§ 4.2–4.8 sur la branche
     `docs/correct-course-epic-9-hier`, PR vers `master` (conflit attendu avec la PR #1 sur
     le bloc AD-16/17/18 : résolution manuelle).
  2. **Task 0 de 9.4** (Florian, côté HA) : capteur template de prix courant, `costs` dans
     ha-linky, import ou remise à zéro, relevé de l'identifiant `(costs)`. **Ne pas créer la
     story sur un identifiant supposé** (leçon 9.1 et 11.1).
  3. `create-story 9-4` → `dev-story` → `code-review` → preuve device iPad (1024×748, WebKit) :
     tuile datée, coût HA, graphe 24 barres, état « Pas encore de relevé » forçable, absence
     de collision top-bar.
- **Critères de succès :** au terme de 9.4, la barre supérieure montre **le coût et la conso
  d'hier, datés**, calculés par HA au tarif HC/HP réel, sans jamais d'écran blanc ni de
  chiffre présenté comme courant ; le blocage 9.1 est clos avec sa vraie cause écrite.
