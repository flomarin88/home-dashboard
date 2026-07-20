---
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories]
inputDocuments:
  - prds/prd-home-dashboard-2026-07-12/prd.md
  - architecture/architecture-home-dashboard-2026-07-12/ARCHITECTURE-SPINE.md
  - ux-designs/ux-home-dashboard-2026-07-12/DESIGN.md
  - ux-designs/ux-home-dashboard-2026-07-12/EXPERIENCE.md
v2StepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
v2InputDocuments:
  - prds/prd-home-dashboard-2026-07-20/prd.md
  - architecture/architecture-home-dashboard-2026-07-20/ARCHITECTURE-DELTA-V2.md
  - ux-designs/ux-home-dashboard-2026-07-20/UX-DELTA-V2.md
  - spikes/spike-nutricloud-kiosk-2026-07-20.md
---

# Home Dashboard - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for **Home Dashboard v1**, decomposing the requirements from the PRD, UX Design (DESIGN.md + EXPERIENCE.md), and Architecture Spine into implementable stories. v1 = a landscape iPad kitchen kiosk, a React SPA front-end over Home Assistant (no custom backend), covering sensors + lighting/shutters/AC/cameras/vacuum + scenes.

## Requirements Inventory

### Functional Requirements

FR1: Afficher, pour 4 pièces (Salon, Chambre Parents, Nathan, Gaspard), la **température + CO₂ + humidité** (Netatmo), rafraîchis automatiquement.
FR2: **Allumer / éteindre** l'éclairage **par pièce** et **par groupe**.
FR3: Régler l'**intensité** et la **couleur** d'un éclairage.
FR4: **Ouvrir / fermer** les volets et régler la **position (%)**, **par pièce** et **par groupe**.
FR5: Déclencher des **scènes mixtes** prédéfinies (**éclairage + volets + climatisation**), définies dans Home Assistant (ex. « Petit déjeuner », « Bonne nuit les petits »).
FR6: Piloter la **climatisation de l'étage** : on/off, consigne de température, mode (chaud / froid / auto).
FR7: **Armer / désarmer** la surveillance depuis l'écran d'accueil.
FR8: **Page Caméras** : vue **live** + **historique** des événements. _[À RISQUE — repli snapshots si le live Arlo via HA n'est pas fiable]_
FR9: **Écran d'accueil kiosque** glanceable regroupant capteurs + contrôles primaires + scènes, avec navigation vers les pages d'approfondissement.
FR10: **Robot aspirateur (Roborock)** — lancer / arrêter le ménage, **retour à la base**, et afficher l'**état** (batterie, en charge / en ménage). Via l'intégration HA `vacuum`.

### NonFunctional Requirements

NFR1: **Rapidité** — accueil interactif **< 1 s** (état chaud) ; retour visuel de pilotage **< 200 ms**.
NFR2: **Simplicité / enfants** — utilisable par un enfant de 5 ans : cibles tactiles **≥ 48px** (**56px** chambres enfants), densité faible, navigation peu profonde.
NFR3: **Toujours allumé** — kiosque continu, réveil instantané, pas de ré-authentification.
NFR4: **Robustesse HA** — si HA/réseau indisponible : dernier état connu + indicateur d'obsolescence, **jamais de blanc**.
NFR5: **Réseau local** — pilotage/affichage en LAN, faible latence (Netatmo/Arlo = sources cloud ⇒ obsolescence NFR4 si internet tombe).
NFR6: **Réversibilité** — **undo** de quelques secondes (~6-8 s) sur les actions à fort impact (Tout fermer, Désarmer, application de scène).

### Additional Requirements

_(from Architecture Spine — AD-1 … AD-11)_

- **[SCAFFOLD — Epic 1]** Stack imposé : **Vite + React 19** (contrainte liée : peerDep requis de @hakit), **TypeScript**, **Tailwind / TailAdmin** (variante React/Vite), **@hakit/core + @hakit/components 6.0.2**. Build **statique**, pas de serveur applicatif.
- **HA = système de vérité unique** ; **aucun backend ni base de données propre** en v1 (AD-1).
- **Connectivité HA exclusivement via @hakit** derrière un seam `src/hakit/` ; **exception unique** = helper média caméras (`camera_proxy`/HLS) (AD-2).
- **Autorité d'état** via l'abonnement temps réel @hakit ; **aucun cache persistant** de l'état d'entité (AD-3).
- **Couche « pending »** unique par `entity_id`, last-command-wins, bornée/expirante (AD-11).
- **Actions optimistes + convergence vers la cible** ; états transitionnels (volet opening/closing, clim target≠current) ≠ échec ; modèle par domaine + timeout (AD-5).
- **Dégradation par entité, indépendante du socket** (`unavailable`/`unknown`) (AD-6).
- **Mapping `entity_id` ↔ pièce/widget = source unique** ; une entité canonique par concept ; le mapping déclare domaine + service (AD-7).
- **Zéro logique d'automatisation côté client** : appels services/scènes HA uniquement (AD-4).
- **Auth** = long-lived token gitignoré injecté au runtime (jamais bundlé) / session HA si servi depuis HA (AD-8).
- **Déploiement** statique servi **depuis HA** (add-on/ingress ou `www`), même origine ; **PWA** cache l'app-shell (NFR1), données toujours live (AD-9).
- **Kiosque** = PWA (ajout écran d'accueil) + **Guided Access** iOS (setup iPad manuel).
- **Modèle d'écran** : accueil composé + pages profondes **Caméras** et **Détail de pièce** (AD-10).

### UX Design Requirements

_(from DESIGN.md + EXPERIENCE.md)_

UX-DR1: **Système de tokens « Glass Gradient »** — fond dégradé indigo→teal→magenta, cartes givrées translucides, **accent par type d'appareil** (lumières ambre / volets bleu / clim cyan / sécurité vert-rouge / stale), rayons (sm/md/lg), spacing, **target-min 48px / 56px enfants**.
UX-DR2: Composant **Tuile appareil** — états défaut / on (accent+glow) / **stale** / **kid** (plus grande).
UX-DR3: Composant **Tuile master** (groupe : Toutes les lumières / Tous les volets), accent domaine.
UX-DR4: Composant **Carte capteur de pièce** — température en valeur de coup d'œil (grande), CO₂ + humidité secondaires ; tap → Détail de pièce.
UX-DR5: Composant **Contrôle volet** — boutons bas/pause/haut (≥48px, 56 enfants) + barre de position %.
UX-DR6: Composant **Stepper climatisation** — −/+ (≥48px) + consigne + chip de mode.
UX-DR7: Composant **Bouton scène** — héros (proéminence IA sur l'accueil).
UX-DR8: Composant **Barre supérieure** — heure + **Armer/Désarmer** (état par **texte + icône cadenas**, pas couleur seule) + entrée **Caméras**.
UX-DR9: Composant **Toast Undo** — 6-8 s, « Annuler » ≥52px, compte à rebours visible (NFR6).
UX-DR10: **Pattern d'état obsolescence** — pill « Hors ligne » **primaire** + valeur lisible (`stale-text`), jamais de blanc (NFR4/AD-6).
UX-DR11: **Écran d'accueil** (paysage) — zones : barre · **Scènes (proéminence)** · Ambiance · Éclairage · Volets · Climatisation.
UX-DR12: **Page Caméras** (live + historique).
UX-DR13: **Page Détail de pièce** (tous les appareils + historique capteurs, ouverte depuis une carte de pièce).
UX-DR14: **Plancher d'accessibilité (NFR2)** — cibles minimales, **état jamais porté par la couleur seule**, tabular-nums, contraste sur fond sombre.
UX-DR15: **Voix & ton FR** — labels d'action disent ce qui se passe ; noms de scènes en langage naturel.
UX-DR16: **Configuration kiosque PWA** — manifest, service worker (cache app-shell), ajout à l'écran d'accueil + Guided Access.
UX-DR17: Composant **Tuile aspirateur** (Roborock) — état (batterie, en charge / en ménage), actions lancer/arrêter + retour base ; **nouvel accent d'appareil** à ajouter au système de tokens (ex. violet, distinct des accents existants).

### FR Coverage Map

FR1: Epic 1 — Capteurs Netatmo (temp/CO₂/humidité, 4 pièces) en lecture
FR2: Epic 2 — Éclairage on/off (pièce + groupe)
FR3: Epic 2 — Éclairage intensité + couleur
FR4: Epic 2 — Volets ouvrir/fermer + position %
FR5: Epic 3 — Scènes mixtes (lumières + volets + clim)
FR6: Epic 2 — Climatisation étage (on/off, consigne, mode)
FR7: Epic 4 — Armer/désarmer depuis l'accueil
FR8: Epic 4 — Page Caméras (live + historique, repli snapshots)
FR9: Epic 1 — Écran d'accueil kiosque (shell ; peuplé au fil des epics)
FR10: Epic 2 — Robot aspirateur Roborock (contrôle + état)

## Epic List

### Epic 1: Fondation & coup d'œil
Le kiosque prend vie : scaffold Vite+React+@hakit, connexion HA, design system Glass Gradient, shell kiosque (accueil + PWA + Guided Access), mapping entity_id, et les capteurs Netatmo (4 pièces) visibles en lecture avec le pattern d'obsolescence. Après cet epic, Florian voit d'un coup d'œil temp/CO₂/humidité de ses 4 pièces sur un iPad toujours allumé.
**FRs covered:** FR1, FR9 (shell)

### Epic 2: Pilotage des appareils
Infra de contrôle (couche pending, optimiste+convergence, undo) puis les tuiles de pilotage : éclairage (on/off, intensité, couleur), volets (%), climatisation (étage), et robot aspirateur (Roborock). Après cet epic, tous les appareils se pilotent depuis la cuisine.
**FRs covered:** FR2, FR3, FR4, FR6, FR10

### Epic 3: Scènes
L'action-héros : boutons de scène en proéminence sur l'accueil, application en un tap de scènes mixtes (lumières + volets + climatisation) définies dans HA, avec undo. Après cet epic, « Petit déjeuner » et « Bonne nuit les petits » se déclenchent d'un doigt.
**FRs covered:** FR5

### Epic 4: Sécurité & caméras
Armer/désarmer la surveillance depuis l'accueil (état par texte+icône) et page Caméras dédiée (vue live + historique, repli snapshots si le live Arlo via HA n'est pas fiable). Après cet epic, la maison s'arme et les caméras se consultent.
**FRs covered:** FR7, FR8

### Epic 5: Détail de pièce
Page d'approfondissement par pièce : tous les appareils de la pièce + historique des capteurs, ouverte en tapant une carte de pièce. Après cet epic, chaque pièce a sa vue complète.
**FRs covered:** FR1–FR6, FR10 (en contexte pièce)

> **Note transverse :** la voix & le ton FR (UX-DR15 — labels d'action disant ce qui se passe) et le plancher d'accessibilité (NFR2/UX-DR14 — cibles ≥48px/56px, état jamais par la couleur seule, tabular-nums) s'appliquent à **toutes** les stories ; ils sont posés en Epic 1 (design system) et rappelés en AC là où ils comptent.

## Epic 1: Fondation & coup d'œil

Le kiosque prend vie : socle technique connecté à Home Assistant, design system, shell kiosque, et les capteurs visibles.

### Story 1.1: Scaffold & connexion Home Assistant

As a développeur du Home Dashboard,
I want un projet Vite + React + @hakit qui se connecte à Home Assistant,
So that toutes les features suivantes disposent d'un socle connecté à la source de vérité.

**Acceptance Criteria:**

**Given** un dépôt vide
**When** je scaffolde le projet
**Then** il utilise Vite + React 19 + TypeScript + Tailwind (base TailAdmin React/Vite) et produit un **build statique** (aucun serveur applicatif)
**And** `@hakit/core` + `@hakit/components` 6.0.2 sont installés, l'accès HA passe par un seam unique `src/hakit/` (AD-2)

**Given** un long-lived token HA en **config locale gitignorée** (jamais bundlée) ou la session HA (AD-8)
**When** l'app démarre
**Then** le provider @hakit se connecte à HA en WebSocket et une vue de contrôle affiche le nombre d'entités et un état live
**And** aucun secret n'apparaît dans le bundle ni dans le dépôt

### Story 1.2: Design system « Glass Gradient »

As a développeur,
I want les tokens et composants de base du design system,
So that tous les écrans partagent une identité visuelle cohérente et accessible.

**Acceptance Criteria:**

**Given** DESIGN.md
**When** j'implémente les tokens
**Then** le fond dégradé, les cartes givrées, les rayons, le spacing, la typo (tabular-nums) et les **accents par appareil** (lumières ambre, volets bleu, clim cyan, aspirateur violet, sécurité vert/rouge, stale) sont disponibles (UX-DR1)

**Given** les tokens
**When** je crée les primitives
**Then** j'ai les composants Tuile appareil (défaut / on+glow / **stale** / **kid**) et Carte section (UX-DR2)
**And** le plancher a11y est ancré : **cible tactile min 48px (56px chambres enfants)**, contraste sur fond sombre, état jamais porté par la couleur seule (NFR2/UX-DR14)

### Story 1.3: Shell kiosque & PWA

As a Florian,
I want un écran d'accueil paysage toujours allumé et verrouillable,
So that l'iPad de la cuisine reste un dashboard dédié, rapide et sans ré-auth.

**Acceptance Criteria:**

**Given** le design system
**When** j'assemble l'accueil
**Then** le layout paysage présente les zones dans l'ordre : barre supérieure (heure + Armer/Désarmer + entrée Caméras) · **Scènes (proéminence)** · Ambiance · Éclairage · Volets · Climatisation (UX-DR11) — zones vides tant que non implémentées

**Given** l'app
**When** je l'installe en PWA
**Then** un manifest + service worker mettent en cache l'**app-shell** (démarrage à chaud **< 1 s**, NFR1) tandis que les données restent live (AD-9)
**And** une procédure documentée active l'ajout à l'écran d'accueil + **Guided Access** (NFR3, UX-DR16)

### Story 1.4: Mapping entity_id centralisé

As a développeur,
I want une config unique qui mappe les `entity_id` HA aux pièces et widgets,
So that aucun composant ne code d'`entity_id` en dur et un concept = une entité canonique.

**Acceptance Criteria:**

**Given** les entités HA (4 pièces : Salon, Chambre Parents, Nathan, Gaspard)
**When** je définis le mapping
**Then** une seule source déclare `entity_id` ↔ pièce/widget + **domaine + service** (AD-7)
**And** un même concept réel (ex. « alarme armée ») n'est mappé qu'à **une** entité canonique

### Story 1.5: Ambiance — capteurs Netatmo (4 pièces)

As a Florian,
I want voir la température, le CO₂ et l'humidité de mes 4 pièces,
So that je connais l'ambiance de la maison d'un coup d'œil.

**Acceptance Criteria:**

**Given** les capteurs Netatmo mappés
**When** j'ouvre l'accueil
**Then** 4 cartes (Salon, Chambre Parents, Nathan, Gaspard) affichent **température (valeur de coup d'œil, grande), CO₂ et humidité (secondaires)** (FR1, UX-DR4)

**Given** un changement d'état d'une entité
**When** HA pousse la mise à jour
**Then** la carte se rafraîchit automatiquement via l'abonnement @hakit, sans cache persistant (AD-3)
**And** taper une carte ouvrira le Détail de pièce (route posée, page en Epic 5)

### Story 1.6: Pattern d'obsolescence (hors ligne)

As a Florian,
I want que les données jamais fiables soient signalées plutôt que masquées,
So that je sais quand une valeur affichée n'est plus à jour.

**Acceptance Criteria:**

**Given** une entité qui passe `unavailable`/`unknown` ou une perte WebSocket
**When** l'app le détecte (par entité, indépendamment du socket)
**Then** la carte garde la **dernière valeur connue** + une **pill « Hors ligne » (indice primaire)** + horodatage, **jamais de blanc** (NFR4, AD-6, UX-DR10)
**And** les sources cloud (Netatmo/Arlo) tombées internet-coupé relèvent du même indicateur (NFR5)

## Epic 2: Pilotage des appareils

Infra de contrôle réutilisable, puis les tuiles de pilotage (lumières, volets, clim, aspirateur).

### Story 2.1: Infra de contrôle (optimiste + convergence)

As a développeur,
I want une couche de pilotage optimiste par entité,
So that chaque contrôle réagit instantanément puis se réconcilie avec HA de façon cohérente.

**Acceptance Criteria:**

**Given** une action de pilotage
**When** l'utilisateur appuie
**Then** l'intention entre dans **une couche pending unique par `entity_id`, last-command-wins, bornée** (AD-11) et un **retour visuel < 200 ms** est appliqué (NFR1, AD-5)

**Given** l'écho d'état HA
**When** il arrive
**Then** l'UI **converge vers la cible** ; les états transitionnels (volet `opening`/`closing`, clim `target ≠ current`) ne sont **pas** des échecs ; l'échec = timeout sans convergence → retour à l'état confirmé + signalement (AD-5)
**And** aucune logique d'automatisation n'est exécutée côté client — seuls des services HA sont appelés (AD-4)

### Story 2.2: Undo des actions à fort impact

As a Florian,
I want annuler une action à fort impact pendant quelques secondes,
So that une fausse manip (y compris un appui d'enfant) ne coûte rien.

**Acceptance Criteria:**

**Given** une action à fort impact (ex. « Tout éteindre », « Tout fermer »)
**When** elle est déclenchée
**Then** un **toast « Annuler »** apparaît **6-8 s** avec bouton ≥52px et **compte à rebours visible** (NFR6, UX-DR9)

**Given** le toast affiché
**When** j'appuie sur « Annuler »
**Then** l'état revient à l'état confirmé précédent

### Story 2.3: Éclairage — allumer/éteindre (pièce + groupe)

As a Florian ou un enfant,
I want allumer/éteindre les lumières par pièce et par groupe,
So that je gère l'éclairage de la maison depuis la cuisine.

**Acceptance Criteria:**

**Given** les lumières mappées
**When** j'appuie sur une tuile pièce ou la tuile master « Toutes les lumières »
**Then** la lumière (ou le groupe) bascule on/off, en optimiste + convergence (FR2, AD-5, UX-DR2/3)
**And** les tuiles des chambres enfants (Nathan, Gaspard) respectent la cible **56px** (NFR2)
**And** l'action master déclenche le pattern undo (Story 2.2)

### Story 2.4: Éclairage — intensité & couleur

As a Florian,
I want régler l'intensité et la couleur d'une lumière,
So that j'ajuste l'ambiance lumineuse.

**Acceptance Criteria:**

**Given** une lumière allumée compatible
**When** j'ajuste le slider d'intensité ou choisis une couleur
**Then** la valeur s'applique en optimiste puis converge (FR3, AD-5)
**And** le slider et les échantillons de couleur respectent la cible tactile min

### Story 2.5: Volets — ouvrir/fermer & position

As a Florian,
I want ouvrir/fermer et positionner les volets par pièce et par groupe,
So that je gère la lumière et l'intimité.

**Acceptance Criteria:**

**Given** les volets mappés
**When** j'utilise les boutons **bas/pause/haut** (≥48px) ou la position %
**Then** le volet réagit ; l'état transitionnel `opening`/`closing` + position est affiché comme légitime, pas comme une erreur (FR4, AD-5, UX-DR5)
**And** la tuile master « Tous les volets » + l'action « Tout fermer » déclenchent l'undo (Story 2.2)

### Story 2.6: Climatisation — étage

As a Florian,
I want piloter la climatisation de l'étage,
So that je règle le confort thermique.

**Acceptance Criteria:**

**Given** l'unité clim de l'étage
**When** j'utilise on/off, le stepper −/+ (≥48px) de consigne, ou le mode (chaud/froid/auto)
**Then** la commande s'applique en optimiste puis converge ; `target ≠ current` est transitionnel, pas un échec (FR6, AD-5, UX-DR6)

### Story 2.7: Robot aspirateur (Roborock)

As a Florian,
I want lancer/arrêter le ménage et voir l'état de l'aspirateur,
So that je pilote le Roborock sans ouvrir son app.

**Acceptance Criteria:**

**Given** l'entité `vacuum` Roborock mappée
**When** j'ouvre l'accueil
**Then** une tuile affiche l'**état** (batterie, en charge / en ménage) avec l'accent violet (FR10, UX-DR17)

**Given** la tuile aspirateur
**When** j'appuie sur lancer/arrêter ou retour à la base
**Then** la commande HA correspondante s'exécute, en optimiste + convergence (AD-5)

## Epic 3: Scènes

L'action-héros : déclencher des routines mixtes d'un doigt.

### Story 3.1: Rangée de scènes & déclenchement

As a Florian,
I want déclencher une scène mixte d'un seul tap,
So that « Petit déjeuner » ou « Bonne nuit les petits » prépare la maison en un geste.

**Acceptance Criteria:**

**Given** des scènes définies dans HA (lumières + volets + climatisation)
**When** j'ouvre l'accueil
**Then** les **boutons de scène** sont en **proéminence** (héros), pas relégués en bas (FR5, UX-DR7)

**Given** un bouton de scène
**When** j'appuie
**Then** l'app **invoque la scène HA** (aucune logique de scène côté client, AD-4), les appareils bougent avec retours transitionnels, et un **undo** est offert (NFR6)
**And** les noms sont en langage naturel (« Petit déjeuner », « Bonne nuit les petits ») (UX-DR15)

## Epic 4: Sécurité & caméras

Armer la maison et consulter les caméras.

### Story 4.1: Armer / désarmer

As a Florian,
I want armer et désarmer la surveillance depuis l'accueil,
So that je sécurise la maison en un geste.

**Acceptance Criteria:**

**Given** la tuile de sécurité dans la barre supérieure
**When** je bascule armer/désarmer
**Then** l'état courant est porté par **texte + icône cadenas** (« Armé »/« Désarmé »), pas par la couleur seule ; vert = sûr, rouge = alerte (FR7, UX-DR8)
**And** l'action « Désarmer » déclenche l'undo (Story 2.2)

### Story 4.2: Page Caméras — vue live

As a Florian,
I want une page dédiée avec le flux live de mes caméras,
So that je vois ce qui se passe chez moi.

**Acceptance Criteria:**

**Given** l'entrée « Caméras » de la barre supérieure
**When** je l'ouvre
**Then** une page dédiée affiche les flux **live** Arlo, routés par le **helper média unique** (seule exception à AD-2) (FR8, UX-DR12)

**Given** un flux live indisponible/instable [À RISQUE]
**When** le live échoue
**Then** l'app bascule sur des **snapshots rafraîchis** (repli documenté), sans écran blanc (AD-6)

### Story 4.3: Page Caméras — historique

As a Florian,
I want l'historique des événements caméra,
So that je consulte ce qui s'est passé.

**Acceptance Criteria:**

**Given** la page Caméras
**When** je consulte l'historique
**Then** les événements récents sont listés/consultables (FR8)
**And** un événement/flux obsolète relève du pattern d'obsolescence (AD-6)

## Epic 5: Détail de pièce

Vue complète par pièce.

### Story 5.1: Page Détail de pièce — appareils

As a Florian,
I want ouvrir une pièce pour voir et piloter tous ses appareils,
So that je gère une pièce sans chercher ses tuiles sur l'accueil.

**Acceptance Criteria:**

**Given** une carte de pièce sur l'accueil
**When** je la tape
**Then** une page dédiée s'ouvre (navigation peu profonde, un niveau) avec **tous les appareils de la pièce** (lumière, volet, capteurs…) réutilisant les widgets existants (UX-DR13, AD-10)
**And** un retour « ‹ Accueil » ramène à l'écran d'accueil

### Story 5.2: Détail de pièce — historique capteurs

As a Florian,
I want l'historique des capteurs d'une pièce,
So that je vois l'évolution de la température/CO₂/humidité.

**Acceptance Criteria:**

**Given** la page Détail de pièce
**When** je la consulte
**Then** l'historique (température, CO₂, humidité) de la pièce est affiché (courbes)
**And** une série indisponible relève du pattern d'obsolescence (AD-6)

## Epic 6: Maison & coordination

_Ajouté en cours de sprint (2026-07-16, correct-course) — amorce de la **couche coordination familiale** (spine Deferred v2), tirée en avant. Persistée dans les **primitives HA natives** (sensors/calendar + `input_boolean`) ; le dashboard **reflète** (AD-1/AD-3) et **écrit via services HA** (AD-4), aucune logique d'échéancier côté client._

### Story 6.1: Sortie des poubelles (jaune / noire)

As a Florian,
I want une tuile poubelle (grosse icône jaune/noire selon le jour, rouge si oubli) à marquer « sortie » pendant le créneau,
So that on n'oublie pas de sortir la bonne poubelle, avec historique.

**Acceptance Criteria:**

**Given** un **capteur template HA** `sensor.poubelle_a_sortir` (état `jaune`/`noire`/`oubli_*`/`aucune`, **schéma horaire côté HA** — AD-4) et un `input_datetime` « sortie » par poubelle
**When** l'accueil s'affiche
**Then** une **tuile** montre une **grosse icône poubelle colorée** selon l'état (jaune/noire, **rouge si oubli**, atténuée si repos), reflétant HA (AD-1/AD-3) ; obsolescence → AD-6

**Given** un créneau actif
**When** j'appuie sur la tuile (≥56px)
**Then** l'app **écrit `now`** dans l'`input_datetime` (`set_datetime`, service HA uniquement — AD-4), en **optimiste** ; une fois sortie, le geste est désactivé (le capteur repasse `aucune`) ; **l'historique HA de l'`input_datetime` = le journal**

### Story 6.2: Météo — widget barre supérieure + détail

_Ajoutée en cours de sprint (2026-07-16). Coup d'œil météo extérieur, tout **via HA** (AD-1/AD-2)._

As a Florian,
I want un widget météo dans la barre supérieure (icône temps + température extérieure, humidité, tendance, batterie) qui ouvre une page détail (historique, prévisions 7 j, pluie dans 1 h),
So that j'ai la météo d'un coup d'œil sans quitter le dashboard.

**Acceptance Criteria:**

**Given** les capteurs Netatmo extérieurs mappés (`sensor.interieur_exterieur_temperature`/`_humidite`/`_batterie`/`_temperature_trend`)
**When** l'accueil s'affiche
**Then** un **widget compact** apparaît dans la barre supérieure (près de l'heure) : icône + **température extérieure**, **tendance** (↑/↓/→), **humidité**, **batterie** (colorée) ; obsolescence → AD-6

**Given** le widget météo
**When** je le tape
**Then** une **page `/meteo`** (AD-10) s'ouvre : **actuel** + **historique** de la température (courbe, réutilise 1.5) + **prévisions 7 jours** + **pluie dans 1 h** — ces deux dernières + l'**icône de condition** venant d'une **intégration météo HA** (`weather.*` + capteur pluie ; **à ajouter** — Task 0), affichées « à venir » tant qu'absentes ; retour « ‹ Accueil »

### Story 6.3: Nourrir les tortues (2×/jour)

_Ajoutée en cours de sprint (2026-07-17, correct-course) — rituel « tortues » (renvoyé à v2 dans 6.1) tiré en avant, même archi que 6.1 : **compteur + reset côté HA** (AD-4), l'app reflète + incrémente._

As a Florian,
I want une tuile tortue dans la barre supérieure qui se remplit à chaque repas (vide → moitié → pleine, 2 taps) et se désactive une fois les 2 repas donnés,
So that on n'oublie pas de nourrir les tortues 2×/jour, avec remise à zéro automatique chaque nuit.

**Acceptance Criteria:**

**Given** un **compteur HA** `counter.tortues_repas` (`0`..`2`, reset minuit par **automation HA** — AD-4)
**When** l'accueil s'affiche
**Then** une **tuile tortue** dans la barre supérieure montre un **niveau de remplissage** selon l'état (vide/moitié/plein), reflétant HA (AD-1/AD-3) ; obsolescence → AD-6

**Given** l'état `0` ou `1`
**When** j'appuie sur la tuile (≥56px)
**Then** l'app appelle **`counter.increment`** (service HA uniquement — AD-4) ; l'état reflète HA (`0`→`1`→`2`) ; à `2` le geste est **désactivé** ; le reset quotidien vit dans une **automation HA**, pas l'app

### Story 6.4: Composition barre supérieure — `TopBarSlots` (TD-4)

_Ajoutée en cours de sprint (2026-07-17) — **refactor / remboursement TD-4**, préalable à 6.3. La tortue (6.3) est le 4ᵉ élément top-bar → trigger TD-4._

As a Florian,
I want les tuiles HA de la barre supérieure disposées par une couche de composition (`TopBarSlots`) plutôt que par des coordonnées `fixed` posées à la main,
So that ajouter une tuile ne provoque plus de chevauchement et les positions ne sont plus fragiles.

**Acceptance Criteria:**

**Given** `TopBarWeather` (6.2) et `BinTile` (6.1), aujourd'hui frères `fixed` sous le provider (contrainte TD-1)
**When** l'accueil s'affiche
**Then** une **région `fixed` unique** (flex/grid) sous le provider dispose ces tuiles qui **s'écoulent** (aucune coordonnée par-tuile), **sans chevaucher** l'heure ni les contrôles de droite ; **comportement 6.1/6.2 inchangé** (tests verts) ; extensible (la tortue 6.3 s'y insère) ; TD-4 marqué payé

### Story 5.3: Page détail « Aspirateur » (Roborock)

_Ajoutée en cours de sprint (2026-07-16, correct-course) — page profonde **par appareil** (extension du thème « pages de détail » d'Epic 5 / AD-10), pour les infos riches gardées **hors** de la tuile glanceable (Story 2.7)._

As a Florian,
I want une page dédiée à l'aspirateur (état, batterie, nettoyage en cours, consommables, alertes) que j'ouvre depuis sa tuile,
So that j'ai le suivi complet du Roborock sans ouvrir son app.

**Acceptance Criteria:**

**Given** la tuile « Aspirateur » sur l'accueil (Story 2.7)
**When** je la tape (hors boutons d'action)
**Then** une **page dédiée** `/aspirateur` s'ouvre (navigation peu profonde, un niveau — AD-10) avec les **contrôles** (Lancer/Arrêter/Retour base) + un **jeu curé d'infos** : État & batterie · Nettoyage en cours (progression %, surface, durée, pièce) · Consommables (temps restant brosses/filtre/capteurs) · Alertes (erreur, eau, réservoir/serpillière)
**And** un retour « ‹ Accueil » ramène à l'écran d'accueil

**Given** les capteurs Roborock mappés
**When** une valeur est indisponible/obsolète
**Then** elle relève du **pattern d'obsolescence** (AD-6) — jamais de blanc

---

# Home Dashboard v2 — Epic Breakdown

## Overview

Cette section décompose le périmètre **Home Dashboard v2** — la **couche coordination familiale** — en epics et stories implémentables, à partir du PRD v2, de l'Architecture Delta v2 (AD-12…AD-15) et de l'UX Delta v2 (UX-DR18…UX-DR22). v2 **hérite** de tout le socle v1 (Epics 1-6, design system Glass Gradient, infra optimiste/pending Epic 2, pattern d'obsolescence, `TopBarSlots`) et n'ajoute que le neuf.

v2 livre **deux rituels partagés** de natures différentes : **Courses** (surface kiosque read-write sur **NutriClaude/Supabase**, 2ᵉ système de vérité borné, seam isolé `src/nutriclaude/`) et **Arrosage** (pur **HA-natif**, moule tortue de la Story 6.3). Le fil commun : le kiosque est la **vitre unique de la coordination familiale**, que l'état vive dans HA ou dans NutriClaude. Après v2, Florian ne oublie plus **ni le lait ni les plantes**, d'un geste d'enfant depuis la cuisine.

> **Nommage :** l'app nutrition = **NutriClaude** (nom canonique) ; son code interne la nomme **NutriCloud**. Supabase project `ywoubvebmlhtomwgouci`.

## Requirements Inventory (v2)

### Functional Requirements

_(Feature Courses — surface NutriClaude)_

FR-1: **Tuile Courses (accueil)** — afficher le nombre d'Articles **à acheter** (`status = pending`), un aperçu des **derniers ajouts** + **qui** (`added_by`), reflet quasi-temps réel (Realtime) ; fallback « Hors ligne » ; tap → page détail.
FR-2: **Page détail — liste par Rayon** — Articles à acheter **groupés par Rayon** (`grocery_list_by_aisle`) avec libellé, quantité/unité, provenance ; Articles **pris** distincts (section panier) ; fallback « Autres » pour un Rayon inconnu.
FR-3: **Pointer un Article (read-write)** — tap → `status = bought` en **optimiste** (retour < 200 ms) puis **convergence** sur l'écho Realtime ; rollback sur échec ; changement **partagé** au foyer.
FR-4: **Vider le panier (action à fort impact)** — **supprime** tous les Articles `bought` (delete direct sous RLS) ; **toast Undo 6-8 s** restaurant l'état précédent.
FR-5: **Refléter les ajouts multi-canaux NutriClaude** — un Article ajouté hors kiosque (Siri, Google Home, iOS, Claude/MCP, app web) apparaît sur le kiosque en quasi-temps réel avec sa **provenance** ; l'app **n'implémente aucun de ces canaux**.

_(Feature Arrosage — HA-natif)_

FR-6: **Tuile Arrosage (barre supérieure)** — une tuile plante dans `TopBarSlots` affiche un **niveau de remplissage** reflétant l'état HA (**vide** = à faire, **plein** = fait) ; état jamais porté par la couleur seule ; obsolescence → AD-6.
FR-7: **Marquer « arrosé »** — tap (≥ 56px) → **service HA** (`counter.increment` ou bascule `input_boolean`) ; la tuile **reflète** le compteur (pattern **reflect-only** des tortues, pas d'optimiste) ; au **quota atteint** le geste est **désactivé**.
FR-8: **Reset quotidien (dépendance HA)** — le reset à minuit vit dans une **automation HA** ; l'app ne planifie rien ; création compteur + automation = **Task 0 HA** (hors app).

### Non-Functional Requirements

_(Aucun NFR neuf en v2 — les NFR v1 s'appliquent et sont étendus.)_

NFR1: **Rapidité** — retour visuel de pilotage **< 200 ms** (pointer un Article en optimiste).
NFR2: **Simplicité / enfants** — cibles tactiles **≥ 48px** (Courses) / **≥ 56px** (geste Arrosage).
NFR4: **Robustesse** — jamais de blanc + indicateur d'obsolescence ; **étendu à une source non-HA** (NutriClaude injoignable / JWT expiré).
NFR5: **Réseau** — NutriClaude/Supabase = source **cloud** ⇒ Courses en obsolescence si internet coupé (même classe que Netatmo/Arlo).
NFR6: **Réversibilité** — **undo** (~6-8 s) sur « Vider le panier ».

### Additional Requirements

_(from Architecture Delta v2 — AD-12…AD-15, amendements AD-1/AD-2, Task 0, bords durs)_

- **[AD-1 amendé — borné]** HA reste la vérité unique pour **toute la domotique + l'Arrosage** ; la feature **Courses** consomme un **2ᵉ système de vérité** (NutriClaude/Supabase), contexte borné déjà possédé par une app dédiée. **Aucun backend propre au dashboard** n'est créé — on est **client** d'un backend existant.
- **[AD-2 amendé — 2ᵉ exception]** Le seam **`src/nutriclaude/`** (client `@supabase/supabase-js`) accède à NutriClaude. **Jamais fusionné** avec `src/hakit/` ; les deux couches d'état restent séparées (pas de store commun).
- **[AD-12]** Source Courses : `public.grocery_list_items` (RLS foyer). Lecture = vue `grocery_list_by_aisle` (pending, `security_invoker`) + table filtrée `status='bought'`. Écriture = `update status→bought` (pointer) et `delete` des `bought` (vider). **Pas de cache persistant** (miroir AD-3). Seam isolé.
- **[AD-13]** Auth : compte **« cuisine » dédié** membre du foyer ; login **email+password** une fois ; session (**refresh token**) en **secret runtime gitignoré, non bundlé** (extension AD-8) ; **clé `anon` + URL uniquement**, **jamais `service_role`**.
- **[AD-14]** Optimiste + obsolescence **découplés du transport** : Courses = optimistic UI dans la **couche state** (réutilise Epic 2), **convergence via Supabase Realtime** + refetch ; obsolescence = perte Realtime / échec refresh JWT → indicateur **« Hors ligne »**, jamais de blanc.
- **[AD-15]** Pattern **« rituel partagé »** (généralisation Epic 6) : **lire** un état partagé → **rendre** en tuile (défaut / actif / **stale**) → **faire avancer** via un service. **Transport pluggable** : `@hakit`/HA (Arrosage) ou `@supabase`/NutriClaude (Courses). Composants communs : tuile, toast Undo, indicateur d'obsolescence, planchers a11y.
- **[Task 0 — hors-repo, préalables]** HA : entité compteur Arrosage (`counter.plantes_arrosees` 0..1 ou `input_boolean`) + automation reset minuit. NutriClaude : activer Realtime sur `grocery_list_items` ; créer + onboarder le compte « cuisine » dans le foyer ; fournir `SUPABASE_URL` + `anon key` + identifiants cuisine (secret runtime gitignoré).
- **[Bords durs Courses]** La RPC `generate_grocery_list_from_menu` **supprime tout le pending** puis régénère → traiter la liste pending comme **remplaçable en bloc** ; un pointage optimiste peut viser une ligne disparue → **converger vers la vérité serveur**. **Pas d'`updated_at`** ⇒ convergence par refetch/Realtime, pas par timestamp. **Fallback polling 15-30 s** si Realtime pose problème.

### UX Design Requirements

_(from UX Delta v2 — numérotation continue après UX-DR17 de v1)_

UX-DR18: **Token `accent-courses = #ff6faf` (rose)** — accent neuf, **non-vert** (vert réservé sécurité) ; usage identique aux autres accents (teinte de tuile « à acheter », glow léger, icône panier, chrome des contrôles Courses), jamais décoratif. **Arrosage n'a pas d'accent** — son état est porté par le niveau de remplissage.
UX-DR19: **Tuile Courses (accueil)** — tuile givrée `{components.device-tile}`, teintée `accent-courses` si liste non vide ; **grand compteur** N (tabular-nums) + « à acheter » ; **aperçu des derniers Articles** + **provenance** (qui + horodatage relatif) ; chevron → détail. Obsolescence = `{components.device-tile-stale}` (bordure dashed + pill « Hors ligne » + dernier compteur), **jamais de blanc ni de spinner**. Placement = tuile de **coordination** groupée avec l'Ambiance.
UX-DR20: **Page détail Courses (`/courses`)** — en-tête fil d'Ariane + **chip « N à acheter · M pris »** (tabular-nums) + bouton **« Vider le panier »** ; corps **groupé par Rayon** (`{components.section-card}`, en-tête restant/total) ; **scroll vertical toléré** (exception no-scroll pour page profonde) ; **ligne d'Article** = case ≥48px + libellé + quantité/unité + provenance ; Articles **pris** barrés en section « panier » ; **`{components.undo-toast}`** sur vider ; stale → interactions destructives désactivées. **Retrait de la barre « voix » du mock**.
UX-DR21: **Provenance** = **personne** (`added_by`, prénom `display_name`) + **icône recette** si `recipe_id` ; **pas** de badge canal voix/note (correction du mock) ; **pas d'avatar** en v2.
UX-DR22: **Tuile Arrosage (barre supérieure)** — **clone du moule `TurtleTile`** (Story 6.3) avec `maximum: 1`, dans `TopBarSlots` ; état = **niveau de remplissage** bas→haut (vide→plein) + icône plante lisible, **pas de texte de statut**, `aria-label` ; geste **≥56px** si `!done && !stale` → service HA ; **disabled** à plein jusqu'au reset ; **reflect-only** (pas d'optimiste) ; obsolescence → non-interactive.

### FR Coverage Map (v2)

FR-6: Epic 7 — Tuile Arrosage (remplissage, reflet HA)
FR-7: Epic 7 — Marquer « arrosé » (service HA, reflect-only)
FR-8: Epic 7 — Reset quotidien (automation HA, Task 0)
FR-1: Epic 8 — Tuile Courses (accueil) : lecture, compteur pending, Realtime, obsolescence
FR-2: Epic 8 — Page détail par Rayon
FR-3: Epic 8 — Pointer un Article (write optimiste + convergence)
FR-4: Epic 8 — Vider le panier (delete + undo)
FR-5: Epic 8 — Reflet des ajouts multi-canaux (Realtime + provenance)

## Epic List (v2)

### Epic 7: Arrosage des plantes
Une **tuile plante** dans la barre supérieure qui se remplit d'un tap et se réarme chaque jour via automation HA — le rituel d'arrosage quotidien visible et actionnable, sur le **moule prouvé des tortues** (Story 6.3). Pur HA-natif, reflect-only. Après cet epic, Florian voit d'un coup d'œil si l'arrosage du jour est fait et le valide d'un doigt ; le pattern « rituel partagé » (AD-15) est re-validé côté HA.
**FRs covered:** FR-6, FR-7, FR-8

### Epic 8: Courses — coordination au kiosque (surface NutriClaude)
Le kiosque devient la **vitre read-write** de la liste de courses du foyer : voir ce qui reste à acheter, pointer d'un doigt, vider le panier — en consommant **directement** NutriClaude/Supabase, **isolément** de HA (seam isolé `src/nutriclaude/`, auth compte « cuisine », adapter optimiste/stale hors-@hakit). Après cet epic, la liste partagée du foyer se consulte et s'avance depuis la cuisine, sans rouvrir le téléphone.
**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5

## Epic 7: Arrosage des plantes

Le rituel d'arrosage quotidien, pur HA-natif, sur le moule prouvé des tortues (Story 6.3). Une tuile plante dans la barre supérieure reflète l'état HA, se valide d'un tap, se désactive au quota, et se réarme via automation HA.

### Story 7.1: Tuile Arrosage (barre supérieure)

_Rituel HA-natif quotidien, clone du moule `TurtleTile` (Story 6.3) avec `maximum: 1`. Reflect-only._

As a Florian,
I want une tuile plante dans la barre supérieure qui se remplit quand l'arrosage du jour est fait et se réarme chaque jour,
So that je vois d'un coup d'œil si j'ai arrosé et je le valide d'un doigt en passant, sans y penser.

**Acceptance Criteria:**

**Given** l'entité HA compteur (`counter.plantes_arrosees` 0..1, ou `input_boolean`) + l'automation de reset minuit **créées côté HA (Task 0, hors app)**
**When** l'accueil s'affiche
**Then** une **tuile plante** s'insère dans `TopBarSlots` (Story 6.4), aux côtés de météo/tortues, **visible en permanence**, réutilisant la structure `TurtleTile`/`BinTile` (radius, `backdrop-blur`, icône SVG locale)

**Given** l'état HA du compteur
**When** la tuile se rend
**Then** son **fond se remplit de bas en haut** — **vide** (0 = à arroser) → **plein** (1 = arrosé) — avec l'**icône plante** lisible par-dessus ; l'état est **jamais porté par la couleur seule** (UX-DR14/UX-DR22), **pas de texte de statut**, `aria-label` = « Arrosage : à faire / fait »

**Given** l'arrosage du jour **pas encore fait** et l'entité **non obsolète**
**When** je tape la tuile (cible **≥ 56px**, geste enfant NFR2)
**Then** un **service HA** est appelé (`counter.increment` sur `counter.plantes_arrosees`, ou bascule `input_boolean`) et la tuile **reflète** le compteur en **reflect-only** (pattern des tortues — écho HA < 1 s, **pas d'optimiste local**)

**Given** le compteur au **quota (plein, = 1)**
**When** la tuile se rend
**Then** le geste est **désactivé** (`disabled`) et la tuile **reste visible pleine** jusqu'au **reset minuit** (automation HA — l'**app ne planifie rien**, FR-8)

**Given** l'entité `unavailable`/`unknown`/déconnectée
**When** la tuile se rend
**Then** elle passe **non interactive** (via `useEntityValue`/`isStale`) selon le pattern d'obsolescence (AD-6) — jamais de blanc

## Epic 8: Courses — coordination au kiosque (surface NutriClaude)

Le kiosque devient la vitre read-write de la liste de courses du foyer. Ce contexte borné (nutrition) vit dans NutriClaude/Supabase — un 2ᵉ système de vérité, consommé directement via un seam isolé `src/nutriclaude/`, jamais fusionné avec la couche HA. Les stories procèdent en tranches verticales : fonder le seam + auth + lecture (tuile), puis la page détail en lecture, puis l'écriture (pointer), puis l'action destructive (vider le panier).

> **Task 0 (hors-repo, préalable à cet epic) :** activer Realtime sur `grocery_list_items` (publication `supabase_realtime`) ; créer + onboarder le compte « cuisine » dans le foyer ; fournir au kiosque `SUPABASE_URL` + `anon key` + identifiants cuisine (secret runtime gitignoré).

### Story 8.1: Seam NutriClaude & tuile Courses (lecture)

_Tracer bullet : établit le seam isolé, l'auth compte « cuisine », le chemin de lecture Realtime, et la tuile d'accueil. Livre le coup d'œil (FR-1) et le reflet multi-canaux (FR-5) sur la tuile. Fonde AD-12/AD-13/AD-14._

As a Florian,
I want une tuile Courses sur l'accueil qui reflète en quasi-temps réel le nombre d'Articles à acheter du foyer et les derniers ajouts,
So that je vois d'un coup d'œil ce qu'il reste à acheter sans rouvrir mon téléphone.

**Acceptance Criteria:**

**Given** un seam isolé `src/nutriclaude/` (client `@supabase/supabase-js`) **jamais fusionné** avec `src/hakit/` (AD-2, 2ᵉ exception) et le **compte « cuisine »** onboardé dans le foyer (Task 0 NutriClaude)
**When** l'app démarre
**Then** le client Supabase s'authentifie **une fois** (email+password), persiste la **session (refresh token)** depuis un **secret runtime gitignoré, non bundlé** (AD-13/AD-8), en **`anon key` + URL uniquement** (jamais `service_role`)
**And** aucun secret n'apparaît dans le bundle ni dans le dépôt

**Given** la RLS foyer active (`grocery_all`, `household_id = current_household_id()`)
**When** la tuile lit l'état
**Then** elle affiche un **grand compteur N** d'Articles `pending` (`{typography.numeric-lg}`, tabular-nums) + label « à acheter », borné au foyer par la RLS

**Given** des Articles présents
**When** la tuile se rend
**Then** elle est **teintée `accent-courses` (#ff6faf)** si la liste est non vide (neutre si vide), montre l'**icône panier**, un **aperçu des derniers Articles** (ex. « Poivrons, Lait, Café +9 ») et la **provenance de la dernière maj** = *qui* (`added_by`, prénom) + horodatage relatif
**And** un **chevron** ouvre la page détail (AD-10)

**Given** un Article ajouté **hors kiosque** (Siri, Google Home, iOS/Shortcut, Claude/MCP, app web NutriClaude)
**When** l'écho **Realtime** arrive (abonnement sur `grocery_list_items` ; **fallback polling 15-30 s** si Realtime indisponible)
**Then** le compteur et l'aperçu se mettent à jour en **quasi-temps réel** avec la provenance — **sans** que l'app implémente aucun de ces canaux (FR-5)

**Given** NutriClaude **injoignable** (réseau coupé, JWT expiré, perte de l'abonnement Realtime)
**When** la tuile se rend
**Then** elle applique `{components.device-tile-stale}` — **dernier compteur connu** + **pill « Hors ligne »** primaire, **jamais de blanc ni de spinner** (équivalent AD-6 pour source non-HA, AD-14)

### Story 8.2: Page détail « Courses » — liste par Rayon (lecture)

_Page profonde (AD-10) en lecture seule : tous les Articles groupés par Rayon, section panier pour les pris. Reflète les ajouts multi-canaux (FR-5) sur la page._

As a Florian,
I want une page détail qui liste tous les Articles groupés par Rayon,
So that je vois précisément ce qu'il reste à acheter, organisé comme mon parcours en magasin.

**Acceptance Criteria:**

**Given** la tuile Courses (Story 8.1) et le seam NutriClaude
**When** je tape la tuile
**Then** une **page détail `/courses`** s'ouvre (navigation un niveau, AD-10) avec un **en-tête** = fil d'Ariane « ‹ Accueil · Liste de courses » + **chip de progression** « N à acheter · M pris » (tabular-nums)
**And** un retour ramène à l'accueil

**Given** des Articles `pending`
**When** la page se rend
**Then** ils sont **groupés par Rayon** via la vue `grocery_list_by_aisle` (déjà triée), chaque groupe = **carte de rayon** (`{components.section-card}`) avec en-tête (icône + nom + **restant/total**)
**And** chaque **ligne** montre le libellé + **quantité/unité** si présentes (tabular-nums) + **provenance** = prénom (`added_by`, `display_name`) + **icône recette** si `recipe_id` (pas de badge canal, pas d'avatar — UX-DR21)

**Given** des Articles `bought`
**When** la page se rend
**Then** ils apparaissent **barrés**, atténués, regroupés en **section « panier »** en fin de groupe (lus sur `grocery_list_items` filtré `status='bought'`)

**Given** un Article dont le Rayon est inconnu
**When** la page se rend
**Then** il tombe dans un groupe **« Autres »** — pas d'erreur, pas de blanc

**Given** la liste dépasse 1024×768
**When** la page se rend
**Then** un **scroll vertical est toléré** sur cette page profonde (exception au no-scroll, qui reste strict sur l'accueil)

**Given** un ajout hors kiosque (Realtime) ou NutriClaude injoignable
**When** la page est ouverte
**Then** elle **reflète** les nouveaux Articles en quasi-temps réel (FR-5) ; si injoignable → état **stale** (dernier état + pill « Hors ligne »)

### Story 8.3: Pointer un Article (write optimiste + convergence)

_Introduit le chemin d'écriture et l'adapter optimiste hors-@hakit (AD-14). Réutilise la couche state d'Epic 2, transport Supabase._

As a Florian,
I want cocher un Article d'un tap depuis le kiosque pour le marquer pris,
So that je fais avancer la liste partagée du foyer sans rouvrir mon téléphone.

**Acceptance Criteria:**

**Given** la page détail `/courses` (Story 8.2) avec des Articles `pending`
**When** je tape un Article (ligne ou case, cible **≥ 48px**)
**Then** il passe **`bought`** en **optimiste** (retour visuel **< 200 ms**, NFR1) via l'adapter de la **couche state** (réutilise l'infra Epic 2, transport = Supabase, **pas @hakit** — AD-14)
**And** l'état **converge** ensuite sur l'écho **Realtime** / refetch

**Given** l'écriture `update({status:'bought'}).eq('id', …)` sous RLS foyer
**When** elle réussit
**Then** le changement est **partagé** — il apparaît sur les autres surfaces NutriClaude du foyer

**Given** l'écriture échoue (timeout, erreur réseau, ou ligne disparue suite à une régénération `generate_grocery_list_from_menu`)
**When** la convergence détecte l'échec
**Then** l'état optimiste est **rollback vers la vérité serveur** (pas d'assumption destructive) et l'échec est **signalé** ; un pointage visant une ligne supprimée converge sans casser

### Story 8.4: Vider le panier (action à fort impact + undo)

_Action destructive bornée foyer avec fenêtre d'undo, sur le pattern de la Story 2.2. Delete direct sous RLS (pas d'Edge Function côté NutriClaude)._

As a Florian,
I want retirer d'un geste tous les Articles pris,
So that je nettoie la liste après les courses sans cocher-supprimer un par un.

**Acceptance Criteria:**

**Given** la page détail avec des Articles `bought` (section panier)
**When** je tape **« Vider le panier »**
**Then** un **toast Undo 6-8 s** (`{components.undo-toast}`, « Annuler » ≥52px, compte à rebours — NFR6, Story 2.2) s'affiche et **couvre** l'action

**Given** la fenêtre d'undo **écoulée sans annulation**
**When** elle expire
**Then** l'écriture **`delete().eq('status','bought')`** bornée foyer part (delete direct sous RLS ; **pas d'Edge Function**) et supprime tous les Articles `bought`

**Given** je tape **« Annuler »** pendant la fenêtre
**When** l'undo se déclenche
**Then** l'état précédent est **restauré** (compensation côté couche state avant flush, ou snapshot local restauré) — **aucun delete n'est parti**

**Given** NutriClaude injoignable (page en état stale)
**When** la page se rend
**Then** l'action destructive « Vider le panier » est **désactivée** (interactions non destructives seules)
