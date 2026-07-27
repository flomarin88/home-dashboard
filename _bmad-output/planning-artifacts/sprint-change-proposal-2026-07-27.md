---
title: "Sprint Change Proposal — Epic 10 : Agenda (Google Calendar via HA)"
date: "2026-07-27"
author: "Florian MARIN + Liza (correct-course)"
status: "proposé"
scope_classification: "Moderate — réorganisation de backlog"
---

# Sprint Change Proposal — Epic 10 : Agenda (Google Calendar via HA)

## Section 1 — Résumé du déclencheur

**Type de changement :** nouvelle demande d'une partie prenante (Florian, 2026-07-27).
Ce n'est **pas** une découverte d'implémentation ni un échec d'approche — aucune story
n'a révélé ce besoin.

**Demande :** voir les événements Google Calendar **du jour** sur l'accueil, et une **page
détail semaine / mois** avec un **filtre basique**.

**Constat de départ :** la demande n'existe **nulle part** dans les artefacts. Vérifié :

- Aucun des 9 epics ne mentionne d'agenda ou de calendrier. Les occurrences de « Google »
  concernent **Google Nest pour la voix** (spine `architecture-voix-rituels-2026-07-23`) ;
  l'unique « calendar » d'`epics.md` désigne une **primitive HA** de l'échéancier poubelles.
- `sprint-status.yaml` ne porte aucune story correspondante.
- `src/entities/mapping.ts` n'expose aucun domaine `calendar` (uniquement `sensor`, `light`,
  `climate`, `vacuum`).

Conséquence : `create-story` a été **arrêté à l'étape 1** — il n'y avait rien à
contextualiser, et son auto-découverte aurait produit `2-5-volets-ouvrir-fermer-position`,
sans rapport avec la demande. Le chemin du projet pour du périmètre neuf est
`correct-course` (précédent : epic 9, `sprint-change-proposal-2026-07-21.md`).

## Section 2 — Analyse d'impact

### Impact epics

| | |
|---|---|
| Epics existants modifiés | **aucun** |
| Epics invalidés | **aucun** |
| Nouvel epic | **Epic 10 — Agenda** |
| Dépendances | **aucune** — l'epic 10 ne dépend d'aucun epic en cours |

**Point de séquencement :** trois epics sont déjà `in-progress` (2, 8, 9) pour **une seule
story actionnable** (`8-2`). Ouvrir un quatrième front étalerait sans faire avancer.
L'epic 10 entre donc en **`backlog`**, pas `in-progress`.

**Ressource partagée nouvellement identifiée :** les epics 3 (Scènes), 4 (Sécurité/caméras)
et 5 (Détail de pièce) convoiteront le **même espace d'accueil**. Le budget vertical
devient une ressource rare et partagée — d'où UX-DR25 (ci-dessous).

### Conflits d'artefacts

- **PRD** — aucun conflit d'objectif. Le MVP v1 est livré ; ceci est du périmètre **additif
  v2**, comme les epics 7, 8 et 9. Ajout de FR à l'inventaire v2.
- **Architecture** — **aucun conflit**, une **addition** (AD-17). Point vérifié dans les
  types de `@hakit/core` :

  ```ts
  callService: { <ResponseType, T, M>(args: CallServiceArgs<T, M, true>): Promise<ServiceResponse<ResponseType>> }
  calendar: { getEvents: ServiceFunction<…, { start_date_time?, end_date_time?, duration? }> }
  ```

  Le domaine `calendar` **est** exposé et `returnResponse: true` **est** supporté. La
  faisabilité tient donc **à l'intérieur d'AD-2** : pas de second seam, pas d'OAuth ni de
  secret côté kiosque — contrairement à AD-12 (NutriClaude). C'est le résultat le plus
  structurant de cette analyse.
- **UX** — **action requise** : le placement sur l'accueil n'est pas décidé, et aucune
  maquette n'existe. Trois UX-DR ajoutés (25-27).
- **Autres** — `docs/home-assistant.md` recevra son contrat d'interface **au moment de la
  Story 10.1** (convention du projet : le doc décrit la config HA qui existe).
  `mapping.ts` gagnera la liste des calendriers (AD-7). **TD-9** (invariant de hauteur non
  testé) devient directement pertinent.

### Impact technique

Un **mode de lecture neuf** pour cette app : un service HA **qui retourne des données**,
au lieu d'un état d'entité poussé par le WebSocket. Précédent partiel : `useHistory`
(sparklines, Story 1.5) fait déjà cohabiter donnée récupérée et état reflété — le patron
existe, la tuyauterie non. Conséquence non évidente et facile à rater : **le pattern
d'obsolescence AD-6 ne couvre pas cette donnée**, car il est fondé sur l'état d'entité.

## Section 3 — Approche recommandée

**Retenu : Option 1 — Direct Adjustment.** Nouvel epic 10 dans la structure existante.

| Option | Verdict | Motif |
|---|---|---|
| 1. Direct Adjustment | **viable — retenue** | Effort moyen, risque faible-moyen. Les deux risques sont le **placement UX** et la **vue mois sans scroll**, tous deux traitables en amont du dev. |
| 2. Rollback | **sans objet** | Rien à défaire ; aucun travail livré n'entre en conflit. |
| 3. Revue du MVP | **non nécessaire** | Le MVP v1 est livré ; périmètre additif, comme les epics 7-9. |

## Section 4 — Propositions de changement détaillées

### 4.1 Décisions actées avec Florian (2026-07-27)

1. **Source des données : via Home Assistant** (entités `calendar.*`, intégration Google
   côté HA). Écarté : appel direct à l'API Google — OAuth depuis un client statique sans
   backend, alors que le build échoue déjà volontairement si un secret risque d'être inliné
   (AD-8).
2. **Filtre : par calendrier** (montrer/masquer des entités). Écarté : par personne, qui
   demanderait de la logique de dérivation.
3. **Placement sur l'accueil : décision UX ouverte**, bornée par le budget de UX-DR25.
4. **État du filtre : non persisté** (local à la vue), pour ne pas créer d'état propre au
   dashboard (AD-1).

### 4.2 `epics.md` — `### Functional Requirements` (ajout)

```markdown
_(Feature Agenda — HA-natif, lecture par requête)_

FR-A1: **Agenda du jour (accueil)** — afficher les événements du **jour courant** des
calendriers mappés, reflétés depuis HA en **lecture seule** : heure, titre, calendrier
d'origine. « Aucun événement » est un **état affiché**, jamais un blanc (UX-DR27) ;
obsolescence → **dernière réponse connue + indicateur** (AD-17).
FR-A2: **Page détail Agenda — semaine / mois** — tap sur la surface d'accueil → **page
profonde** (AD-10) avec **bascule semaine / mois** ; la plage choisie pilote la requête
`calendar.get_events` ; le retour ramène à l'accueil.
FR-A3: **Filtre par calendrier** — montrer/masquer chaque entité `calendar.*` mappée ; le
filtre porte le **nom** du calendrier (UX-DR26), cibles **≥ 48px** (NFR2) ; l'état du
filtre est **local à la vue, non persisté** (AD-1).
FR-A4: **Lecture par requête HA (transverse)** — les plages viennent de
**`calendar.get_events`** via `src/hakit/` (AD-17) ; l'app **ne calcule ni récurrences ni
fuseaux** (AD-4) ; les `entity_id` vivent dans le **mapping central** (AD-7) ; activer
l'intégration Google Calendar dans HA = **Task 0**, hors app.
```

### 4.3 `epics.md` — `### Additional Requirements` (ajout AD-17)

```markdown
- **[AD-17 — Lecture par requête : service HA à réponse, bornée au seam]** Les événements
  d'agenda ne sont **pas un état d'entité** : `calendar.*` n'expose que l'événement
  **courant/suivant**. Une **plage** (jour, semaine, mois) s'obtient par
  **`calendar.get_events`**, un service HA **qui retourne des données** (`callService` +
  `returnResponse: true`, exposé par `@hakit/core`). Ce mode reste **dans `src/hakit/`** —
  **aucune exception AD-2, aucun secret client**, contrairement à AD-12. Il **n'entre ni
  dans la couche pending (AD-11) ni dans l'optimisme (AD-5)** : c'est de la lecture. En
  revanche il a sa **propre politique de fraîcheur** — la réponse est datée de sa requête,
  **non poussée par le WebSocket** — donc **l'obsolescence AD-6, fondée sur l'état
  d'entité, ne la couvre pas** : rafraîchissement explicite (changement de plage, retour au
  premier plan, période), et sur échec **dernière réponse connue + indicateur
  d'obsolescence**, jamais de blanc. L'app **ne calcule ni récurrences ni fuseaux** —
  `get_events` renvoie les occurrences déjà déployées (AD-4). Précédent : `useHistory`
  (sparklines, Story 1.5) fait déjà cohabiter donnée récupérée et état reflété.
```

### 4.4 `epics.md` — `### UX Design Requirements` (ajouts UX-DR25 → 27)

```markdown
UX-DR25: **Budget vertical de l'accueil — contrainte dure, mesurée (2026-07-27).** À
1024×748, il reste **179px** libres sous la dernière rangée. Une rangée standard coûte
**~265px** (titre + gaps + tuile de 225) : **une 3ᵉ rangée standard ne rentre pas**. Toute
surface ajoutée choisit entre — (a) **micro-tuile en barre supérieure** (5ᵉ élément ; seuil
signalé comme déclencheur de dette collision en Story 9.1), (b) **5ᵉ colonne** dans une
rangée (les tuiles passent de 237 à ~190px, toutes), (c) **bande compacte sans titre, sous
165px**. Budget **partagé** avec les epics 3, 4 et 5 : le premier servi le consomme. Aucun
test automatisé ne garde cet invariant (TD-9) — vérification visuelle, sur l'appareil.

UX-DR26: **Couleur de calendrier jamais seule.** Si les événements sont teintés par
calendrier, la distinction porte **aussi** un libellé ou un glyphe (instancie UX-DR14). Le
filtre affiche le **nom** du calendrier, pas une pastille de couleur seule.

UX-DR27: **Agenda vide = un rendu, pas du vide.** « Aucun événement aujourd'hui » est un
état à part entière — jamais un blanc ni un spinner (AD-6/NFR4) — et la surface conserve
**la même empreinte** qu'avec des événements, pour éviter le saut de mise en page (mêmes
hauteurs de lignes fixes que les cartes de pièce, Story 1.5).
```

### 4.5 `epics.md` — `### FR Coverage Map (v2)` (ajouts)

```
FR-A1: Epic 10 — Agenda du jour sur l'accueil (lecture HA par requête)
FR-A2: Epic 10 — Page détail Agenda (bascule semaine / mois)
FR-A3: Epic 10 — Filtre par calendrier
FR-A4: Epic 10 — Lecture par requête `calendar.get_events` (transverse)
```

### 4.6 `epics.md` — `## Epic List (v2)` (ajout)

```markdown
### Epic 10: Agenda — coup d'œil sur la journée
Les événements **Google Calendar** du foyer, reflétés depuis HA en lecture seule : les
rendez-vous **du jour** sur l'accueil, et une **page profonde semaine / mois** avec un
**filtre par calendrier**. HA-natif de bout en bout (intégration Google côté HA, **aucun
secret côté kiosque**, aucun second seam) — mais un **mode de lecture neuf** : la plage
vient d'un **service à réponse** (`calendar.get_events`, AD-17), pas d'un état d'entité.
Après cet epic, Florian voit sa journée en passant dans la cuisine, et déplie la semaine ou
le mois d'un tap.
**FRs covered:** FR-A1, FR-A2, FR-A3, FR-A4
```

### 4.7 `epics.md` — section complète Epic 10

```markdown
## Epic 10: Agenda — coup d'œil sur la journée

Les événements des calendriers Google du foyer, reflétés depuis HA. Les stories procèdent
par tranches : fonder la **lecture par requête** (AD-17) et la surface « jour », puis la
page profonde semaine/mois, puis le filtre. Lecture seule de bout en bout — aucune écriture
d'événement dans cet epic.

> **Task 0 (hors-repo, préalable à cet epic) :** activer l'intégration **Google Calendar**
> dans HA (OAuth **côté HA**, jamais côté kiosque) ; vérifier que les calendriers voulus
> apparaissent en entités `calendar.*` ; relever leurs `entity_id` **et** leur libellé
> humain pour le mapping (AD-7) ; vérifier que **`calendar.get_events` répond** sur ces
> entités (HA ≥ 2023.8).
>
> **Réf. design :** **aucune maquette n'existe.** Le **placement sur l'accueil est une
> décision UX ouverte**, bornée par le budget de UX-DR25. À trancher avant la Story 10.1.

### Story 10.1: Agenda du jour (accueil)

_Tracer bullet : fonde la **lecture par requête** (AD-17) — le chemin `calendar.get_events`
dans `src/hakit/`, le mapping des calendriers (AD-7), et la surface « jour ». Lecture seule._

As a Florian,
I want voir les événements du jour sur l'accueil,
So that je sais ce qui m'attend sans ouvrir mon téléphone.

**Acceptance Criteria:**

**Given** l'intégration Google Calendar activée côté HA et les `entity_id` relevés (Task 0),
inscrits dans le **mapping central** (AD-7, jamais en dur)
**When** l'accueil s'affiche
**Then** une surface **Agenda du jour** rend les événements du **jour courant** — heure de
début, titre, calendrier d'origine — **triés par heure**, en **lecture seule** (AD-3)

**Given** AD-17
**When** la surface se monte
**Then** les événements viennent de **`calendar.get_events`** appelé via `src/hakit/` sur la
plage `[aujourd'hui 00:00 → demain 00:00)`, **jamais** des attributs d'entité — qui n'exposent
que l'événement **courant/suivant** ; l'app **ne déploie ni récurrences ni fuseaux** (AD-4)

**Given** une réponse obtenue
**When** la plage change, l'app **revient au premier plan**, ou la période de rafraîchissement
s'écoule
**Then** la requête est **rejouée** — la fraîcheur n'est **pas** poussée par le WebSocket et
**AD-6 ne couvre pas** cette donnée (AD-17)

**Given** la requête en échec ou HA injoignable
**When** la surface se rend
**Then** **dernière réponse connue + indicateur d'obsolescence**, **jamais** de blanc ni de
spinner (AD-17/AD-6/NFR4)

**Given** aucun événement aujourd'hui
**When** la surface se rend
**Then** « **Aucun événement aujourd'hui** » s'affiche dans **la même empreinte** que la
version peuplée — pas de saut de mise en page (UX-DR27)

**Given** le budget vertical de l'accueil (UX-DR25) et le placement tranché en UX
**When** la surface est intégrée
**Then** elle tient dans l'option retenue **sans repousser le contenu hors des 748px**, et le
résultat est **vérifié sur l'iPad** — aucun test automatisé ne garde cet invariant (TD-9)

### Story 10.2: Page détail Agenda — semaine / mois

_Page profonde (AD-10) sur le même chemin de lecture que 10.1 : seule la plage change._

As a Florian,
I want déplier la semaine ou le mois depuis l'agenda du jour,
So that je situe un rendez-vous dans la durée sans sortir le téléphone.

**Acceptance Criteria:**

**Given** la surface d'accueil (Story 10.1)
**When** je la tape
**Then** une **page `/agenda`** s'ouvre (un niveau, AD-10) avec un **en-tête** = fil d'Ariane
« ‹ Accueil · Agenda » + une **bascule Semaine / Mois** ; le retour ramène à l'accueil

**Given** la bascule
**When** je choisis une plage
**Then** **`calendar.get_events`** est rejoué sur cette plage (**semaine courante** lun→dim,
**mois courant**) et les événements sont **groupés par jour**, l'aujourd'hui distingué **pas
seulement par la couleur** (UX-DR14)

**Given** le kiosque **1024×748 sans scroll** (invariant) et un mois chargé
**When** la vue mois se rend
**Then** elle **réduit la densité** plutôt que de déborder — grille jour × compteur/pastilles
plutôt que titres complets — et **ne scrolle jamais**

**Given** une plage sans événement, ou la requête en échec
**When** la vue se rend
**Then** état affiché (UX-DR27) / dernière réponse connue + obsolescence (AD-17), jamais de blanc

### Story 10.3: Filtre par calendrier

_Petit périmètre : montrer/masquer des entités `calendar.*` dans la vue courante._

As a Florian,
I want masquer certains calendriers,
So that je ne vois que ce qui me concerne quand la semaine est chargée.

**Acceptance Criteria:**

**Given** plusieurs calendriers mappés (AD-7)
**When** la page `/agenda` se rend
**Then** une rangée de contrôles présente chaque calendrier par son **nom** (UX-DR26 — jamais
une pastille de couleur seule), cibles **≥ 48px** (NFR2)

**Given** un calendrier masqué
**When** la vue se rend
**Then** ses événements disparaissent de la vue courante ; l'état du filtre est **local à la
vue et non persisté** (FR-A3/AD-1)

**Given** tous les calendriers masqués
**When** la vue se rend
**Then** l'état vide s'affiche (UX-DR27) — jamais un écran blanc qui ressemblerait à une panne
```

### 4.8 `sprint-status.yaml` — bloc Epic 10

```yaml
  # Epic 10 — Agenda : coup d'œil sur la journée (v2)
  epic-10: backlog  # ajouté 2026-07-27 via correct-course (sprint-change-proposal-2026-07-27.md) ; Task 0 HA (intégration Google Calendar) + décision UX de placement (UX-DR25) requises avant 10.1
  10-1-agenda-du-jour-accueil: backlog
  10-2-page-detail-agenda-semaine-mois: backlog
  10-3-filtre-par-calendrier: backlog
  epic-10-retrospective: optional
```

Ligne de version en en-tête (convention `v2a…v2f`) :

```yaml
# v2g (2026-07-27): epic-10 (Agenda — Google Calendar via HA) ajouté au backlog via
# correct-course. Aucun fichier story créé. Task 0 HA + décision UX de placement requises
# avant 10.1. epic-10 reste backlog : 3 epics sont déjà in-progress (2, 8, 9).
```

## Section 5 — Handoff & implémentation

**Classification : Moderate** — réorganisation de backlog, pas une replanification de fond.
Aucun objectif produit ni décision d'architecture existante n'est remis en cause.

### Ordre de traitement

| # | Action | Porteur | Bloquant pour |
|---|---|---|---|
| 1 | **Décision UX de placement** (3 options bornées, UX-DR25) | Florian / UX | Story 10.1 |
| 2 | **Task 0 HA** — intégration Google Calendar, relevé des `entity_id` + libellés | Florian | Story 10.1 (device-proof) |
| 3 | Maquette **vue mois sans scroll** | Florian / UX | Story 10.2 |
| 4 | Appliquer les éditions 4.2 → 4.8 aux artefacts | Liza | `create-story` 10.1 |
| 5 | `create-story` sur 10.1, puis `dev-story`, puis `code-review` | Liza | — |

### Critères de succès

- Les 4 FR-A sont couverts par les 3 stories, sans reliquat.
- Aucune story ne démarre avant que **son** préalable soit levé (placement pour 10.1,
  maquette mois pour 10.2).
- Le kiosque **ne scrolle jamais** et le contenu reste dans les **748px** — vérifié **sur
  l'iPad**, pas seulement dans Chrome.

### Risques ouverts, assumés

1. **Vue mois sans scroll** — le risque de conception dominant. 1024×748, un mois chargé :
   c'est une grille dense, pas une liste. À maquetter avant le dev.
2. **Budget vertical** — l'agenda consommera une part d'une ressource que les epics 3, 4 et
   5 convoitent aussi. Premier servi, premier logé.
3. **Fraîcheur de la lecture par requête** — la classe d'erreur la plus probable est qu'un
   dev suppose qu'AD-6 s'applique et affiche des événements périmés sans le signaler.
   AD-17 existe pour l'empêcher ; c'est à vérifier explicitement en revue.
