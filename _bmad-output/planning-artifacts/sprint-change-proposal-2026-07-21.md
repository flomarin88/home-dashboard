---
title: Sprint Change Proposal — Epic 9 « Consommation élec & eau »
status: proposed
created: 2026-07-21
mode: correct-course (incrémental)
scope_classification: Modéré (réorg backlog + amendements planning)
---

# Sprint Change Proposal — Epic 9 : Consommation élec & eau (flux d'affichage)

## Section 1 — Résumé du déclencheur

**Problème / opportunité.** Tirer en avant, depuis le backlog planifié, une capacité déjà
prévue mais jamais élaborée : afficher au kiosque la **consommation électrique** (Linky /
TotalÉnergies) et **d'eau** (SAUR), avec **heures creuses/pleines** et **prix kWh & m³**.

**Nature.** *New requirement / élaboration d'un item backlog* — pas une découverte en cours
d'implémentation.

**Évidence.**
- PRD v1 `prd-home-dashboard-2026-07-12` (l.52) — *« Backlog flux d'affichage : météo, Google
  Calendar, jour des poubelles, heures pleines/creuses, conso eau (Saur), conso élec
  (Linky/TotalÉnergies), colis Amazon, info trafic. »*
- Demande utilisateur explicite (2026-07-21).
- Constat : aucun epic, FR détaillée, exigence UX ni story n'existait pour ce sujet.

## Section 2 — Analyse d'impact

**Impact epics.** Purement **additif** : création d'un **Epic 9**. **Aucun impact** sur les
epics 1–8 (indépendant des rituels de coordination 7/8). Séquençable librement — proposé après
l'en-cours (epics 2/6/8).

**Impact stories.** Aucune story existante modifiée. 3 stories neuves (9.1–9.3).

**Impact artefacts.**
- **PRD** — pas de conflit ; capacité + FRs ajoutés **dans `epics.md`** (décision : pas de
  PRD addendum séparé, tout centralisé dans epics.md, cohérent avec l'inventaire v2 qui héberge
  déjà FRs/AD/UX-DR).
- **Architecture** — **AD-16 (nouveau)** défini dans l'inventaire epics.md : flux de consommation
  = lecture HA read-only + coût dérivé. **Aucun** amendement destructif du spine ; conforme
  AD-1/AD-2/AD-3/AD-6/AD-7 si les données viennent de capteurs HA.
- **UX** — **UX-DR23 / UX-DR24** (micro-tuiles Consommation + indicateur HC/HP). **Pas de nouvel
  accent** (état porté par valeur + icône, comme la tuile plante).
- **Autres** — ajout de mappings `entity_id` (AD-7) côté build ; helpers prix. **Aucun** impact
  CI/deploy.

**Impact technique — finding clé.** Cette feature colle au socle **HA-centric read-only** :
c'est le patron de la **Story 1.5 (Ambiance Netatmo)** — capteurs HA reflétés, gouvernés tel quel
par AD-1/AD-3/AD-6/AD-7, **sans nouveau backend ni exception AD-2** si les capteurs HA existent.
Le seul point ouvert est la **source par fournisseur** (Task 0), avec repli documenté (seam
read-only isolé, exception AD-2 conditionnelle — précédent NutriClaude, anticipé par le spine l.170).

## Section 3 — Approche recommandée

**Option 1 — Direct Adjustment (Hybride).** Ajouter Epic 9 + amendements légers (FRs, AD-16,
UX-DRs) centralisés dans `epics.md` + mise à jour `sprint-status.yaml`.

- **Effort :** Moyen · **Risque :** Faible (additif, read-only, zéro impact existant).
- **Rejeté :** Option 2 (rollback) — rien à annuler. Option 3 (réduction MVP) — sans objet, la
  capacité MVP v2 (coordination) reste intacte ; ce flux est orthogonal.

## Section 4 — Propositions de changement détaillées

### 4.1 Décisions produit/UX actées (2026-07-21)
1. **Surface = micro-tuiles `TopBarSlots`** (moule météo/tortue/plante). Pas de page détail.
2. **Prix affichés + coût calculé** : valeur glanceable = **coût du jour (€)** ; **prix unitaire**
   en ligne secondaire / révélé au tap (résolution de la tension micro-format ↔ prix). Confirmé.
3. **Découpage = 3 stories** (élec / heures creuses-pleines / eau).
4. **Pas de nouvel accent** de domaine.

### 4.2 `epics.md` — nouveaux Functional Requirements (inventaire v2)

```
FR-E1: Micro-tuile Électricité — conso (capteur HA Linky/TotalÉnergies) + coût du jour dérivé
       (conso × prix), HC/HP-aware ; reflect-only ; obsolescence AD-6 ; jamais de blanc.
FR-E2: Heures creuses/pleines — indicateur de période courante (depuis HA ; l'app ne calcule
       pas le planning tarifaire — AD-4) ; le tarif appliqué au coût suit la période.
FR-E3: Micro-tuile Eau (SAUR) — conso (capteur HA) + coût du jour dérivé (conso × prix/m³) ;
       clone du patron FR-E1 ; reflect-only ; obsolescence AD-6.
FR-E4 (transverse): Source & prix — conso = capteurs HA read-only (Task 0 : vérifier/activer
       les intégrations par fournisseur) ; prix = helpers HA `input_number` ou config runtime ;
       coût = dérivation d'affichage (pas d'état persisté, AD-1) ; repli = seam read-only isolé
       (exception AD-2 conditionnelle, précédent NutriClaude) si un fournisseur n'a pas
       d'intégration HA.
```

### 4.3 `epics.md` — nouvel Additional Requirement (AD-16)

```
- [AD-16] Flux de consommation = lecture HA read-only + coût dérivé. Conso élec/eau vient de
  capteurs HA (reflet AD-3, obsolescence AD-6, mapping AD-7), read-only. Le coût est une
  DÉRIVATION D'AFFICHAGE (conso × prix), pas un état persisté (AD-1). Les prix vivent en helpers
  HA `input_number` ou config runtime. La période HC/HP courante vient de HA — l'app ne calcule
  pas le planning tarifaire (AD-4). Source par fournisseur vérifiée/activée en Task 0 ; repli =
  seam read-only isolé (exception AD-2 conditionnelle, précédent `src/nutriclaude/`) si un
  fournisseur n'a pas d'intégration HA.
```

### 4.4 `epics.md` — nouveaux UX Design Requirements

```
UX-DR23: Micro-tuiles Consommation (TopBarSlots) — moule météo/tortue/plante ; valeur glanceable
         = COÛT DU JOUR (€, tabular-nums) ; PRIX UNITAIRE en ligne secondaire compacte / au tap
         (pas de page détail) ; état HC/HP porté par icône (jamais couleur seule, UX-DR14) ;
         obsolescence = dernière valeur connue + indicateur (AD-6), jamais de blanc ni spinner.
UX-DR24: Indicateur Heures Creuses/Pleines — pictogramme + libellé de période courante
         (« Creuses » / « Pleines »), jamais porté par la couleur seule ; le tarif appliqué au
         coût reflète la période courante. Pas de nouvel accent de domaine.
```

### 4.5 `epics.md` — FR Coverage Map (ajouts)

```
FR-E1: Epic 9 — Micro-tuile Électricité (conso + prix + coût, reflect-only)
FR-E2: Epic 9 — Heures creuses/pleines (période courante HA + tarif appliqué)
FR-E3: Epic 9 — Micro-tuile Eau (SAUR, conso + prix + coût)
FR-E4: Epic 9 — Source HA read-only + prix config + repli seam (transverse)
```

### 4.6 `epics.md` — Epic List (ajout) + section complète Epic 9

**Entrée Epic List :**

```
### Epic 9: Consommation — flux élec & eau (coup d'œil coûts)
Des micro-tuiles dans la barre supérieure (moule météo/tortue/plante, Story 6.4) qui reflètent
en lecture seule la conso élec & eau depuis HA et en dérivent le coût du jour, avec l'état heures
creuses/pleines. Purement HA-natif read-only (Story 1.5 comme précédent), reflect-only, zéro
nouveau backend si les capteurs HA existent.
FRs covered: FR-E1, FR-E2, FR-E3, FR-E4
```

**Section complète :**

```
## Epic 9: Consommation — flux élec & eau (coup d'œil coûts)

Des micro-tuiles dans la barre supérieure reflètent en lecture seule la conso élec & eau depuis
HA et en dérivent le coût du jour, avec l'état heures creuses/pleines. Purement HA-natif
read-only (Story 1.5 comme précédent), reflect-only, zéro nouveau backend si les capteurs HA
existent. Les stories procèdent par tranches : fonder le patron « flux de consommation » (élec),
ajouter la conscience tarifaire (HC/HP), puis cloner pour l'eau.

> Task 0 (hors-repo, préalable) : exposer côté HA les capteurs de conso élec (Enedis /
> TotalÉnergies) + eau (SAUR / HACS) + la période HC/HP courante ; définir les prix (helpers HA
> `input_number` ou config runtime). Repli seam read-only si une intégration est absente.

### Story 9.1: Micro-tuile Électricité (conso + prix + coût)

_Tracer bullet : fonde le patron « flux de consommation » (lecture HA read-only + coût dérivé +
prix config). Reflect-only, AD-16._

As a Florian,
I want une micro-tuile Électricité qui affiche le coût du jour et la conso reflétés depuis HA,
So that je vois d'un coup d'œil ce que l'électricité me coûte sans ouvrir d'app.

**Acceptance Criteria:**

**Given** un capteur HA de conso élec (Task 0)
**When** l'accueil s'affiche
**Then** une **micro-tuile Électricité** s'insère dans `TopBarSlots` (moule météo/tortue/plante,
Story 6.4), **reflect-only** (AD-3), affichant la conso reflétée depuis HA — pas d'optimiste local

**Given** les prix définis (helper HA `input_number` ou config runtime)
**When** la tuile se rend
**Then** elle affiche le **coût du jour** (`conso × prix`, €, `{typography.numeric}` tabular-nums)
comme **valeur glanceable**, et le **prix unitaire** en **ligne secondaire compacte / au tap**
**And** le coût est une **dérivation d'affichage**, jamais un état persisté (AD-1/AD-16)

**Given** le capteur `unavailable`/`unknown` ou le WebSocket perdu
**When** la tuile se rend
**Then** elle rend la **dernière valeur connue + indicateur d'obsolescence** (AD-6),
**jamais de blanc ni de spinner**

### Story 9.2: Heures creuses / pleines

_Ajoute la conscience tarifaire au patron 9.1 : période courante depuis HA + tarif appliqué._

As a Florian,
I want voir si je suis en heures creuses ou pleines et que le coût suive le bon tarif,
So that je sais quand l'électricité est la moins chère et le coût affiché est juste.

**Acceptance Criteria:**

**Given** la période HC/HP courante exposée par HA (Task 0 — l'app **ne calcule pas** le planning
tarifaire, AD-4)
**When** la micro-tuile Électricité se rend
**Then** un **indicateur de période** (pictogramme + libellé « Creuses » / « Pleines »,
**jamais la couleur seule**, UX-DR14/UX-DR24) montre l'état courant

**Given** deux prix (€/kWh Heures Creuses & Heures Pleines)
**When** le coût du jour se calcule
**Then** le **tarif appliqué suit la période courante** ; les deux prix restent consultables
(ligne secondaire / au tap)

**Given** la période HC/HP indisponible côté HA
**When** la tuile se rend
**Then** dégradation en obsolescence (AD-6) ; le coût est calculé sur le **dernier tarif connu**,
jamais de blanc

### Story 9.3: Micro-tuile Eau (SAUR)

_Clone du patron 9.1, transport HA/SAUR. Reflect-only, AD-16._

As a Florian,
I want une micro-tuile Eau qui affiche le coût du jour et la conso SAUR reflétés depuis HA,
So that je suis ma consommation d'eau d'un coup d'œil.

**Acceptance Criteria:**

**Given** un capteur HA de conso eau SAUR (Task 0)
**When** l'accueil s'affiche
**Then** une **micro-tuile Eau** s'insère dans `TopBarSlots`, **reflect-only** (AD-3),
réutilisant le patron de la Story 9.1

**Given** le prix/m³ (helper HA `input_number` ou config runtime)
**When** la tuile se rend
**Then** elle affiche le **coût du jour** (`conso × prix/m³`, €, tabular-nums) comme valeur
glanceable + le **prix unitaire** en ligne secondaire / au tap (dérivation d'affichage, AD-16)

**Given** le capteur `unavailable`/`unknown` ou WebSocket perdu
**When** la tuile se rend
**Then** dernière valeur connue + indicateur d'obsolescence (AD-6), **jamais de blanc**
```

### 4.7 `sprint-status.yaml` — ajouts (bloc Epic 9)

```yaml
  # Epic 9 — Consommation : flux élec & eau (v2)
  epic-9: backlog
  9-1-micro-tuile-electricite-conso-cout: backlog
  9-2-heures-creuses-pleines: backlog
  9-3-micro-tuile-eau-saur: backlog
  epic-9-retrospective: optional
```

## Section 5 — Handoff & implémentation

- **Classification :** **Modéré** (réorg backlog + amendements planning) → PO/DEV = **Florian**.
- **Séquence :** `create-story 9-1` → `dev-story` → `code-review` (puis 9.2, 9.3). Task 0 HA à
  lever avant le device-proof (comme 6.1/6.3/8.x) ; les stories restent codables/testables avec
  des mocks de capteurs.
- **Point ouvert transverse (à lever tôt en implémentation) :** confirmer, par fournisseur,
  l'existence des intégrations HA (Enedis/TotalÉnergies élec, SAUR eau, période HC/HP) ; sinon
  bascule sur le repli seam read-only (exception AD-2).
- **Critères de succès :** au terme de l'Epic 9, la barre supérieure montre d'un coup d'œil le
  coût du jour élec & eau, le tarif HC/HP courant, en reflétant HA et sans jamais d'écran blanc.
