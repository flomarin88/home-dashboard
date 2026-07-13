# Addendum — Home Dashboard

_Profondeur technique et décisions qui appartiennent à l'architecture / au design, pas au corps du PRD (qui reste au niveau capacités)._

## Architecture pressentie

- **Home Assistant (Raspberry Pi)** = hub central de la maison : capteurs, volets, climatisation, lumières. Point d'intégration unique pour la domotique.
- **Le dashboard iPad** = front-end au-dessus de Home Assistant + une **couche de coordination familiale à état partagé** (tâches/rituels : poubelles, tortues, plantes, courses, corvées).
- Conséquence de périmètre : la plupart des flux domotiques (Netatmo, Arlo, volets, clim, lumières) transitent par HA plutôt que par des intégrations API séparées. Réduit fortement le risque d'intégration.

## Automatisation (règles)

- **V1** : les automatisations (si/alors, horaires, scènes) vivent dans **Home Assistant**. Le dashboard **affiche l'état** et permet un **override manuel**.
- **V2** : le dashboard fournit une **UI pour créer/éditer les règles** d'automatisation.

## Voix

- Objectif : la voix (Google Home) **pilote des actions du dashboard** — ex. « ajoute X à la liste de courses », « tortues nourries » → mise à jour de l'état partagé.
- Chemin pressenti : Google Home → Home Assistant (Google Assistant integration / Assist) → état partagé du dashboard (webhooks / scripts HA). À valider en architecture.

## Piste design

- **TailAdmin** (<https://tailadmin.com/>) — référence de template UI envisagée pour le dashboard (pas une fonctionnalité). À évaluer à l'étape UX/design system.

## Risques d'intégration connus

- **Arlo (flux live via HA)** : intégration la plus fragile de la v1 ; repli pressenti sur snapshots rafraîchis si le streaming live n'est pas fiable (cf. FR8 + spike §5 du PRD).

## À trancher plus tard (technique)

- Origine par feature : quelles données viennent de HA nativement vs intégration dédiée (Amazon colis, Jow, Saur, info trafic, calendrier poubelles).
- Persistance de la couche coordination familiale (état partagé) : dans HA (to-do lists natives) ou store propre au dashboard ?
