---
title: Home Dashboard — PRD
status: final
created: 2026-07-12
updated: 2026-07-12
---

# Home Dashboard — PRD

## 1. Vision

**Problème.** La gestion de la maison est aujourd'hui éclatée entre plusieurs applications (iOS Home, Google Home) et canaux (voix). Aucune vue unique. Les rituels domestiques (sortir les poubelles, nourrir les tortues, tenir la liste de courses) reposent sur la mémoire, et la coordination entre les membres de la famille est informelle.

**Produit.** Un dashboard sur **iPad**, écran unique posé dans un lieu de passage et **toujours allumé** — à la fois *consultable d'un coup d'œil* et *tactile pour piloter la maison*. Il s'appuie sur **Home Assistant** comme hub domotique central et ajoute une **couche de coordination familiale à état partagé** (qui a fait quoi, ce qui reste à faire).

**Utilisateurs.**
- **Florian & sa femme** — usage quotidien : pilotage, visibilité, répartition des tâches.
- **Enfants (5 et 3 ans)** — consultation et petites corvées ; imposent une **simplicité radicale**.

**À quoi ressemble la réussite (3 mois).**
- Ma femme et moi utilisons le dashboard **quotidiennement**.
- Meilleure communication sur ce qui est **fait / à faire** ; tâches réparties (y compris avec les enfants).
- La maison **réagit** (climatisation, volets) via Home Assistant.

**Anti-objectifs (ce qui tue le produit).**
- **Surcharge d'information** → écran illisible.
- **Inutilisable** avec / par les enfants.
- **Temps de chargement longs**.

**Principes directeurs** (dérivés des anti-objectifs) : glanceable avant tout · simplicité radicale · rapidité perçue.

## 2. Périmètre & Roadmap

### v1 — Socle domotique (piloté par Home Assistant)

Objectif : valider le **kiosque iPad** et le **front-end au-dessus de Home Assistant**, avec des intégrations HA natives (faible risque, pas d'API externe bancale, pas de couche état-partagé à construire).

| Feature | Nature |
|---|---|
| **Ambiance & capteurs** (Netatmo, 4 pièces) | Affichage |
| **Éclairage** | Contrôle |
| **Volets** | Contrôle |
| **Climatisation** (unité étage) | Contrôle |
| **Caméras / sécurité** (Arlo) | Contrôle + page dédiée |
| **Robot aspirateur** (Roborock) | Contrôle + état |

**Principe d'écran (raffiné).** Le produit n'est pas strictement mono-écran : un **écran d'accueil glanceable** (capteurs + contrôles primaires) + des **pages d'approfondissement** — **Caméras** (live + historique) et **Détail de pièce** (tous les appareils + historique capteurs de la pièce, ouvert en tapant une carte de pièce).

### Suite (non priorisée — à ordonner plus tard)

- **v2 pressenti — cœur « coordination familiale »** (aligné sur la vision) : socle état partagé + rituels (liste de courses, arrosage plantes, tortues, corvées enfants), UI d'édition des règles d'automatisation, contrôle vocal (voix → actions).
- **Backlog flux d'affichage** : météo, Google Calendar, jour des poubelles, heures pleines/creuses, conso eau (Saur), conso élec (Linky/TotalÉnergies), colis Amazon, info trafic.
- **Recettes / meal-planning** : hors dashboard — **app dédiée séparée** (contexte borné, son propre backend/données). Le dashboard n'en montrera qu'une **vue simplifiée en lecture seule**. _(cf. spine d'architecture 2026-07-12)_

> Note : plusieurs items du backlog (météo, calendrier, poubelles) sont peu coûteux et à forte valeur ; à considérer en priorité quand tu ordonneras la suite.

## 3. Exigences fonctionnelles (v1)

**Ambiance & capteurs (Netatmo)**
- **FR1.** Le dashboard affiche, pour 4 pièces (Salon, Chambre Parents, Chambre Nathan, Chambre Gaspard), la **température**, le **CO₂** et l'**humidité**, rafraîchis automatiquement.

**Éclairage**
- **FR2.** Allumer / éteindre l'éclairage **par pièce** et **par groupe**.
- **FR3.** Régler l'**intensité** et la **couleur** d'un éclairage.

**Volets**
- **FR4.** Ouvrir / fermer les volets et régler leur **position (%)**, **par pièce** et **par groupe**.

**Scènes**
- **FR5.** Déclencher des **scènes mixtes** prédéfinies (combinant **éclairage + volets + climatisation**), définies dans Home Assistant. _(ex. « Petit déjeuner » : lumières + volets ; « Bonne nuit les petits » : lumières + volets enfants + clim)_

**Climatisation**
- **FR6.** Piloter l'unité de l'étage : **on/off**, **consigne de température**, **mode** (chaud / froid / auto).

**Caméras / sécurité (Arlo)**
- **FR7.** **Armer / désarmer** la surveillance depuis l'écran d'accueil.
- **FR8.** Page dédiée caméras : **vue live** et **historique** des événements. _**[À RISQUE]** Le streaming live Arlo via Home Assistant est réputé fragile ; repli acceptable en v1 : snapshots rafraîchis à la place du flux live (voir spike en §5)._

**Robot aspirateur (Roborock)**
- **FR10.** Lancer / arrêter le ménage, **retour à la base**, et afficher l'**état** (batterie, en charge / en ménage). Via l'intégration Home Assistant `vacuum`.

**Kiosque**
- **FR9.** Écran d'accueil unique regroupant capteurs et contrôles primaires, consultable d'un coup d'œil ; navigation vers les pages d'approfondissement.

## 4. Exigences non-fonctionnelles (transverses)

- **NFR1 — Rapidité.** En état chaud (kiosque déjà lancé), l'écran d'accueil est **interactif en moins d'1 seconde** ; toute action de pilotage donne un **retour visuel immédiat** (< ~200 ms). _(anti-objectif : temps de chargement longs)_
- **NFR2 — Simplicité / enfants.** Les contrôles principaux sont utilisables par un enfant de 5 ans : cibles tactiles larges, pas de menus profonds, densité d'information maîtrisée. _(anti-objectif : illisible / inutilisable avec les enfants)_
- **NFR3 — Toujours allumé.** Fonctionnement en kiosque continu sur l'iPad : réveil instantané, pas de déconnexion ni de ré-authentification manuelle.
- **NFR4 — Robustesse HA.** Si Home Assistant ou le réseau est indisponible, afficher le dernier état connu + un indicateur d'obsolescence — jamais d'écran blanc.
- **NFR5 — Réseau local.** Le pilotage (éclairage, volets, clim, scènes) et l'affichage fonctionnent sur le **réseau local** (iPad et HA au même endroit), à faible latence. _Réserve : Netatmo et Arlo sont des sources **cloud** relayées par HA ; en cas de coupure internet, leurs données relèvent de l'indicateur d'obsolescence de NFR4._
- **NFR6 — Réversibilité.** Les actions à fort impact (`Tout fermer`, `Désarmer`, application d'une scène) offrent un **« Annuler » de quelques secondes** (toast, ~6-8 s) qui revient à l'état confirmé précédent. Filet de sécurité universel — utile puisque les enfants agissent sans restriction.

## 5. Questions ouvertes

Aucune question bloquante — points clés tranchés le 2026-07-12 (qualité de l'air = CO₂ + humidité, scènes mixtes définies dans HA, rapidité < 1 s, document en français).

- **[SPIKE ARCHI]** **Faisabilité du flux live Arlo via Home Assistant** — c'est l'intégration v1 la plus susceptible de casser la démo. Statuer tôt : flux live viable, ou repli sur snapshots (cf. FR8) ?
- **[NOTE PM]** À valider en architecture : origine exacte des données par feature via Home Assistant, et persistance de la future couche coordination familiale (v2).
