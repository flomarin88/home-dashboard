---
title: Spike — Rail de navigation à gauche (Accueil / Actions / Pièces / Trajets)
status: partial
created: 2026-07-30
feeds: Story 11.1 AC9 (placement non tranché) · dette « collision top-bar » (6.4, D3 en 10.1)
source: arithmétique de mise en page dérivée du code au 2026-07-30 — AUCUNE mesure navigateur, AUCUNE preuve device
---

# Spike — le kiosque peut-il porter un rail de navigation permanent ?

**Origine.** La question « où placer la tuile Temps de trajet ? » (Story 11.1, AC9)
a reçu une réponse structurelle plutôt qu'un emplacement : **un rail à gauche**
— Accueil, Actions, Pièces, Trajets. Cette réponse attaque la cause (la barre
supérieure est pleine) au lieu d'y ajouter une 7ᵉ puce.

**Verdict global : GÉOMÉTRIQUEMENT FAISABLE, mais ce n'est pas gratuit et ce
n'est pas une tâche de la 11.1.** Les mises en page du kiosque sont **fluides**,
pas figées : un rail ne fait rien déborder, il resserre. Le coût se paie en
**marge de respiration de la vue mois** (UX-DR29) et en **trois doctrines à
amender**. C'est un chantier de navigation, à traiter comme tel.

> ⚠️ **Erreur corrigée en cours de spike.** J'ai d'abord annoncé que « la largeur
> ne passe pas », en lisant la cote « cellules ~134px » d'UX-DR29 comme une
> contrainte. C'est un **résultat**, pas une largeur figée : la grille mois est
> `grid-cols-7`, donc fluide. Rien ne déborde. La vraie question n'est pas un
> débordement, c'est un **seuil de lisibilité**.

## Le budget horizontal, dérivé du code

| Élément | Valeur | Source |
| --- | --- | --- |
| Scène | `max-w-[1024px]` | `src/App.tsx` (KioskShell) |
| Marge de scène | `p-6` = 24px de chaque côté | idem |
| **Largeur utile** | **976px** | 1024 − 48 |
| Grille mois | `grid-cols-7 gap-1.5` (6px) | `src/pages/AgendaDetail.tsx:396` |
| Cellule mois aujourd'hui | (976 − 36) / 7 = **134,3px** | calcul |

Ce calcul **reproduit la cote de 134px mesurée au navigateur** pour UX-DR29. Le
modèle est donc validé par recoupement, et les projections ci-dessous ne sont pas
des estimations à vue de nez.

### Effet d'un rail (largeur R + 12px de gouttière)

| R | Largeur utile | Cellule mois | Écart vs aujourd'hui |
| --- | --- | --- | --- |
| — | 976px | 134,3px | référence |
| 48px | 916px | **125,7px** | −6,4 % |
| 64px | 900px | **123,4px** | −8,1 % |
| 88px | 876px | **120,0px** | −10,6 % |

La **hauteur** des cellules est intacte (`grid-rows-6`, fluide verticalement), donc
la règle « numéro + 2 puces + +N » n'est pas menacée en nombre d'éléments. Ce qui
se dégrade, c'est la **troncature des titres** dans les puces
(`text-[10px]`, `whitespace-nowrap`, `overflow-hidden`) — de l'ordre d'un caractère
perdu par puce à −10 %. **Estimation, non mesurée.**

Même mécanique sur l'accueil : une rangée de 6 tuiles passe de 154,3px à 144,3px
par tuile avec un rail de 48px. Les cartes de pièce encaissent sans réécriture.

## Ce qui n'est pas une question de géométrie

**1. Icônes seules = mystery meat.** UX-DR28 emploie le terme pour justifier le
libellé obligatoire de la micro-tuile. Un rail de 48px ne porte pas de libellé
lisible ; en porter un demande ~72-88px, soit le haut de la fourchette de coût.
La doctrine existante **interdit** la version la moins chère. À amender
explicitement ou à respecter — pas à contourner en silence.

**2. Le menu déroulant « Pièces » est un pattern net-neuf, et il est obligatoire.**
Il y a **quatre pièces** (`salon`, `chambre_parents`, `gaspard`, `nathan` —
`src/entities/rooms.ts`). Les mettre à plat supprimerait le déroulant, mais
consommerait 4 des 5 places : **le plafond décidé le 2026-07-30 l'interdit** (voir
§ Budget d'entrées). Le déroulant est donc requis dès le premier jour, sur une
surface **tap-only sans survol** et **sans aucun précédent de popover** dans la
base — la 9.1 l'avait déjà signalé net-neuf. C'est le risque le plus mal cerné du
chantier, et il n'est plus contournable : il doit être instruit.

**3. Deux modèles de navigation cohabiteraient.** Aujourd'hui : tuile → page,
`BackLink` → accueil. Le rail ajoute une navigation permanente et transverse. Il
faut trancher : `BackLink` disparaît, ou reste comme redondance ? Les tuiles
restent-elles tappables vers leur page ? Sans décision, on obtient deux façons de
faire la même chose — le symptôme exact que la 10.1 a refusé sur les imports de
seam.

## Ce que le rail rendrait caduc

- La **dette « collision top-bar »** ouverte en 6.4, durcie en 10.1 (D3, `right-6`
  + `overflow-hidden`), dont le mode d'échec assumé est **une puce coupée**. Un
  rail déplace les destinations hors de la barre : la barre redevient un lieu
  d'**état**, pas de navigation.
- **AC9 de la Story 11.1** : « Trajets » devient une entrée de rail, et la tuile
  Temps de trajet trouve enfin un point d'entrée.
- La question « où mettre la prochaine tuile ? », qui revient à chaque epic depuis
  la 9.1, cesse d'être un arbitrage au cas par cas.

## Budget d'entrées — décision du 2026-07-30

**Plafond : 5 entrées de premier niveau.** Au-delà, regroupement en menus déroulants.

| Entrée | Statut | Réserve |
| --- | --- | --- |
| Accueil | acquise | — |
| Actions | acquise | ne correspond à **aucune surface existante** ; les scènes sont l'Epic 3, en backlog |
| Pièces | acquise | **déroulant** — 4 pièces |
| Trajets | acquise | origine du chantier (Story 11.1, AC9) |
| _libre_ | 1 place | l'Epic 4 (Sécurité/caméras) la prend |

**Le plafond est atteint par les epics déjà planifiés.** Le déroulant n'est pas un
filet pour une croissance lointaine : il sert dès « Pièces », et le dépassement
arrive à l'Epic 4. Contrairement à la barre supérieure, dont le plafond n'a jamais
été posé et qui a produit la dette de collision, celui-ci est écrit avant le
premier trait — mais il est **déjà consommé**.

## Recommandation

1. **Ne pas greffer ce chantier sur la Story 11.1.** Elle reste PARTIAL, sa tuile
   construite et non montée. Mélanger une refonte de navigation à une story de
   feature, c'est deux intentions dans un commit.
2. **Rail à 72px, icône + libellé court**, plutôt que 48px icône seule : la
   doctrine anti-mystery-meat existe déjà et coûte 24px, soit 2 % de cellule mois.
   Payer 2 % pour ne pas amender une règle d'accessibilité est le bon change.
3. **~~Quatre pièces à plat~~ — CADUC.** Proposé avant la décision de plafond, et
   incompatible avec elle : à plat, les pièces consomment 4 des 5 places.
   **Décision du 2026-07-30 : plafond de 5 entrées, dépassement par menus
   déroulants.** « Pièces » devient donc un déroulant **dès le premier jour**. Le
   pattern net-neuf n'est plus évitable — il doit être instruit : tap-only, pas de
   survol, aucun précédent de popover dans la base (signalé net-neuf dès la 9.1).
   C'est désormais le risque principal du chantier.
4. **Trancher `BackLink` avant de coder**, pas pendant.
5. **Preuve device obligatoire sur la vue mois** avant de considérer l'affaire
   close : aucun test automatisé ne garde l'invariant no-scroll (TD-9), et le seul
   juge de « une cellule de 123px reste lisible » est l'iPad.

## Incertitudes ouvertes

- **Aucune mesure navigateur, aucune preuve device.** Tout ce document est de
  l'arithmétique dérivée du code. Le recoupement à 134,3px vs 134px mesurés donne
  confiance dans le modèle, **pas** dans les seuils de lisibilité.
- **Le seuil de lisibilité d'une cellule mois est inconnu.** 134px marchent, on
  ignore où ça casse. C'est la première chose à mesurer.
- **La perte de caractères par puce est une estimation**, pas un comptage.
- **Interaction avec l'horloge non instruite** : `TopBarSlots` est positionné
  `left-44` (176px) pour lui laisser la place. Un rail à gauche croise cette zone
  — superposition, décalage ou refonte de la barre : non tranché.
- **Contenu exact du rail non arrêté** : « Actions » ne correspond à aucune
  surface existante (scènes ? Epic 3, en backlog).
- **Comportement du rail sur les pages profondes** : permanent partout, ou masqué
  sur les pages qui ont besoin de toute la largeur ?
- **Nombre d'entrées : TRANCHÉ** (plafond 5, dépassement par déroulants — voir
  § Budget d'entrées). Ce qui reste ouvert, c'est le **comportement du déroulant** :
  ce qui l'ouvre, ce qui le ferme, et son encombrement vertical dans un rail de
  72px. Aucun précédent dans la base, surface tap-only sans survol.
- **Contenu réel d'« Actions »** : non défini. Si ce sont les scènes, la surface
  n'existe pas encore (Epic 3, backlog) — le rail pointerait vers du vide.

## Sources

`src/App.tsx` (KioskShell, scène `max-w-[1024px]` + `p-6`) ·
`src/pages/AgendaDetail.tsx:361,386,396,435` (grille mois, puces) ·
`src/pages/Home.tsx:126-142` + `src/pages/home-grid.ts` (rangées, plafond 6) ·
`src/ui/TopBarSlots.tsx:24-41` (bornage, `left-44`, mode d'échec) ·
`src/entities/rooms.ts` (quatre pièces) ·
`_bmad-output/planning-artifacts/epics.md` (UX-DR25, UX-DR28, UX-DR29, TD-9) ·
`_bmad-output/implementation-artifacts/deferred-work.md:21` (dette collision)
