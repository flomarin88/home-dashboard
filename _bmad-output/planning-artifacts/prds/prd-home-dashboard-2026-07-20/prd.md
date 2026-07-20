---
title: Home Dashboard v2 — PRD
status: final
created: 2026-07-20
updated: 2026-07-20
---

# PRD : Home Dashboard v2 — Coordination familiale au kiosque
*Titre de travail — à confirmer.*

## 0. But du document

Ce PRD définit le périmètre **v2** du Home Dashboard, au niveau **capacités**. Destiné à Florian (PM + dev) et aux étapes aval BMAD (architecture, UX, epics/stories). Il **s'appuie sur les artefacts existants** et ne les duplique pas :
- **Architecture v1** : `../../architecture/architecture-home-dashboard-2026-07-12/ARCHITECTURE-SPINE.md` (AD-1…AD-11). v2 hérite des invariants, avec **une exception cadrée** (§4.2).
- **Design system** : Glass Gradient (Story 1.2) · **Infra réutilisée** : optimiste + convergence + couche pending (Epic 2), pattern d'obsolescence (Story 1.6), `TopBarSlots` (Story 6.4).
- **Amorce prouvée** : pattern « rituel partagé reflété depuis HA » (Epic 6 — poubelles 6.1, tortues 6.3).
- **NutriClaude** : `/Users/florianmarin/Documents/Claude/Projects/Le Cadre - Nutrition/architecture-nutriclaude.html` — app séparée (Next.js + Supabase) qui **possède la Liste de courses**. La feature Courses du dashboard est une **surface** sur cette app (§4.2).

Décisions de cadrage (voir `.memlog.md`) : périmètre = **Pilier A** (coordination familiale) ; **2 rituels** — Arrosage (HA-natif) + Courses (surface NutriClaude) ; piliers B (UI règles) et C (voix) exclus.

## 1. Vision

Le dashboard v1 rend la maison *pilotable et lisible d'un coup d'œil*. La v2 fait du kiosque le **point de coup d'œil et d'action de la coordination familiale** : « ce qui reste à faire » à la maison, visible et actionnable d'un doigt depuis la cuisine.

v2 livre **deux rituels** — mais de **deux natures** :
- **Arrosage des plantes** — coordination « maison », pur **HA-natif**, dans la lignée directe de tortues/poubelles (Epic 6) : l'app reflète HA et écrit via service HA (AD-4), état dans une primitive HA (`counter`/`input_boolean`).
- **Liste de courses** — coordination « nutrition », qui vit dans un **contexte borné distinct** : l'app **NutriClaude** (Supabase). Le dashboard en devient une **surface kiosque read-write** — il affiche la liste et la fait avancer (pointer, vider le panier) — en consommant **directement** NutriClaude, **isolément** de la couche HA.

Le fil commun n'est plus « tout vit dans HA », mais « le kiosque est la vitre unique de la coordination familiale, que l'état vive dans HA ou dans NutriClaude ». Ambition modeste et nette : ne plus oublier **le lait ni les plantes**, geste d'enfant de 5 ans, sans quitter l'écran de la cuisine.

## 2. Utilisateur cible

### 2.1 Jobs To Be Done
- **Fonctionnel** — Voir d'un coup d'œil ce qu'il reste à acheter et pointer ce qui est pris ; ne pas oublier d'arroser.
- **Social / familial** — Une liste de courses **commune** au foyer (déjà partagée dans NutriClaude), consultable/actionnable aussi depuis le kiosque de la cuisine.
- **Émotionnel** — Décharge mentale ; geste trivial et réversible (undo, fausse manip enfant sans conséquence).
- **Contextuel** — Le kiosque complète les surfaces NutriClaude existantes (Shortcuts iOS au magasin, Claude/MCP en conversation) par un **point fixe glanceable à la maison**.

### 2.2 Non-utilisateurs (v2)
- Personne hors du foyer. La feature Courses **n'apporte pas** la gestion des recettes, profils nutritionnels, catalogue produits ou menus — tout ça reste dans NutriClaude.

### 2.3 Parcours clés

- **UJ-1. Un article s'ajoute ailleurs, le kiosque le montre.** En semaine, quelqu'un ajoute « lait » via **Siri, Google Home ou iOS** (ou Claude, ou l'app web NutriClaude). Quelques instants plus tard, la **tuile Courses** du kiosque affiche le compteur incrémenté et le lait dans les *derniers ajouts*, avec **qui l'a ajouté**. Personne n'a touché le kiosque. Réalise FR-1, FR-5.

- **UJ-2. Florian pointe et remet à zéro depuis le kiosque.** De retour des courses (ou en rangeant), il ouvre la page détail sur le kiosque, **coche** au doigt les Articles pris (par Rayon), puis tape **« Vider le panier »** ; un **toast Undo (6-8 s)** le couvre. Les écritures partent dans NutriClaude, partagées avec le reste du foyer. Réalise FR-2, FR-3, FR-4.

- **UJ-3. L'arrosage quotidien, un geste en passant.** Chaque jour, en passant, Florian tape la **tuile plante** de la barre supérieure : elle **se remplit** et se **désactive**. Le lendemain à minuit, une automation HA la réinitialise. Réalise FR-6, FR-7, FR-8.

## 3. Glossaire

- **Rituel partagé** — Tâche domestique récurrente dont l'état vit dans un système de vérité et que le dashboard reflète + fait avancer. v2 en livre deux : **Arrosage** (état dans HA), **Courses** (état dans NutriClaude).
- **NutriClaude** — App séparée (Next.js + Supabase, écosystème « Le Cadre ») qui possède la nutrition du foyer : profils, recettes, catalogue produits, et la **Liste de courses**. **Source de vérité** de la liste. Le dashboard en est une **surface cliente**, isolée de la couche HA/@hakit.
- **Foyer** — Unité de partage NutriClaude (household, RLS). Florian + sa compagne = un foyer ; la Liste de courses est partagée au niveau foyer.
- **Liste de courses** — La table Supabase `grocery_list_items` de NutriClaude (portée foyer), contenant les **Articles**. Une liste canonique par foyer (AD-7 conservé, hors HA).
- **Article** — Ligne de la Liste : `name`, `quantity`/`unit` optionnels, **Rayon** (`aisle_id`), `status` (**à acheter** `pending` / **pris** `bought`), **`added_by`** (personne), `recipe_id` (recette d'origine, optionnel).
- **Rayon** — Catégorie de regroupement (Fruits & légumes, Frais, Épicerie…), définie **côté NutriClaude** (`aisles` + mapping keyword), ordonnée selon le parcours magasin. La vue `grocery_list_by_aisle` fournit la liste déjà triée.
- **Provenance** — Comment un Article est arrivé : **qui** l'a ajouté (`added_by`) et éventuellement de **quelle recette** (`recipe_id`). (Remplace le badge « canal » voix/note du mock — non porté par le modèle NutriClaude.)
- **Pris / Panier** — Article `bought`. « Vider le panier » **supprime** les Articles pris (delete direct sous RLS).
- **État partagé** — L'état d'un rituel, persisté soit dans une **primitive HA native** (Arrosage), soit dans **NutriClaude/Supabase** (Courses).
- **Tuile** — Composant d'accueil reflétant un rituel (design system v1). **Barre supérieure** — bande `TopBarSlots` (Story 6.4) des tuiles compactes (météo, tortues, v2 : plante).

## 4. Fonctionnalités

### 4.1 Socle « rituel partagé » (transverse)

**Description :** Les deux rituels v2 partagent un même **patron d'UX**, indépendant du système de vérité : l'app **lit** un état partagé, le **rend** en tuile (défaut / actif / **stale**), et le **fait avancer** en **optimiste + convergence** (retour < 200 ms, NFR1) avec **undo** sur les gestes à fort impact (NFR6). Ce qui **diffère**, c'est le **transport** : Arrosage passe par **HA/@hakit + service HA** (AD-4/AD-5, couche pending AD-11) ; Courses passe par **NutriClaude/Supabase** (§4.2), avec un équivalent optimiste/obsolescence à concevoir hors @hakit (→ §8). Aucune logique de planification côté client dans les deux cas (resets/horaires = automations HA ; règles nutrition = NutriClaude).

**NFR spécifiques :** cibles ≥ 48px / 56px enfants (NFR2), jamais de blanc + indicateur d'obsolescence (NFR4 ; AD-6 pour HA, équivalent pour NutriClaude), état jamais porté par la couleur seule (UX-DR14).

### 4.2 Liste de courses — surface kiosque sur NutriClaude

**Description :** La Liste de courses **appartient à NutriClaude** (table Supabase `grocery_list_items`, portée foyer, RLS). Le dashboard est une **surface kiosque read-write** : il l'**affiche** (tuile accueil + page détail par Rayon) et la **fait avancer**. Le kiosque **n'écrit que** le **pointage** (`status` → pris) et le **vidage du panier** ; **l'ajout** d'Article passe par les canaux NutriClaude (Siri, Google Home, iOS) — pas de saisie au kiosque. Contrairement au reste du dashboard, cette feature **ne passe pas par HA/@hakit** : elle consomme **directement** l'API NutriClaude (Supabase REST + Realtime) — **exception explicite à AD-2** (la 2ᵉ, après le helper média caméras), autorisée par le spine pour ce contexte borné, via un **seam isolé** (ex. `src/nutriclaude/`) **jamais fusionné** avec `src/hakit/`. Les Articles arrivant par les canaux NutriClaude sont **reflétés** en quasi-temps réel (Supabase Realtime). Réalise UJ-1, UJ-2. Réf. design : `inputs/mock-courses.html`.
[ASSUMPTION: le dashboard consomme NutriClaude **en direct** (pas via un pont HA) — conforme au choix « surface read-write, 2ᵉ backend ».]
[ASSUMPTION: NutriClaude est/sera déployé et **joignable depuis le kiosque** (aujourd'hui : projet local + Supabase cloud).]

**Functional Requirements :**

#### FR-1 : Tuile Courses (accueil)
Florian consulte l'état de la Liste depuis l'accueil.
**Conséquences (testables) :**
- La tuile affiche le **nombre d'Articles à acheter** (`status = pending`), reflétant NutriClaude en quasi-temps réel (Realtime), tabular-nums.
- Elle montre un **aperçu des derniers Articles ajoutés** + **qui** (provenance `added_by`).
- Si NutriClaude est injoignable (réseau, JWT expiré) : **dernière valeur connue + indicateur « Hors ligne »**, jamais de blanc (équivalent AD-6 pour cette source).
- Un tap ouvre la page détail (route dédiée, AD-10).

#### FR-2 : Page détail — liste par Rayon
Florian voit tous les Articles regroupés par Rayon.
**Conséquences (testables) :**
- Les Articles à acheter sont **groupés par Rayon** (via `grocery_list_by_aisle`), chacun avec **libellé**, **quantité/unité** (si présentes) et **provenance** (personne / recette).
- Les Articles **pris** sont distincts (barrés, section « panier »), triés en fin de groupe ; chaque Rayon affiche restant/total.
- Un Article sans Rayon connu tombe dans **« Autres »** (pas d'erreur, pas de blanc).

#### FR-3 : Pointer un Article (read-write)
Florian (ou un enfant) marque un Article *pris* d'un tap depuis le kiosque.
**Conséquences (testables) :**
- Tap (cible ≥ 48px) → l'Article passe `bought` dans NutriClaude, en **optimiste** (retour < 200 ms) puis **convergence** sur l'écho Realtime ; échec (timeout/erreur écriture) → **rollback** + signalement.
- Le changement est **partagé** : il apparaît sur les autres surfaces NutriClaude du foyer.

#### FR-4 : Vider le panier (action à fort impact)
Florian retire d'un geste tous les Articles pris.
**Conséquences (testables) :**
- « Vider le panier » **supprime** tous les Articles `bought` (delete direct sous RLS via le client Supabase ; **pas d'Edge Function** — inexistante côté NutriClaude).
- Action à fort impact → **toast Undo 6-8 s** (NFR6, UX-DR9, Story 2.2) ; « Annuler » restaure l'état précédent.

#### FR-5 : Refléter les ajouts multi-canaux NutriClaude
Les Articles ajoutés hors du kiosque apparaissent sur le kiosque.
**Conséquences (testables) :**
- Un Article ajouté via l'un des **canaux NutriClaude** (Siri, Google Home, iOS/Shortcut, Claude/MCP, app web) apparaît/se met à jour sur le kiosque en quasi-temps réel, avec sa **provenance** (personne, et recette si applicable).
- **Out of Scope :** l'app **n'implémente aucun de ces canaux** (voix, Shortcuts, génération de recettes) — elle **reflète** l'état NutriClaude. (Cohérent avec l'exclusion du Pilier C.)

### 4.3 Arrosage des plantes

**Description :** Rituel **quotidien (1×/jour)**, **kiosque-only**, **HA-natif**, calqué sur les tortues (Story 6.3) : une **tuile plante dans la barre supérieure** montre un **niveau de remplissage** selon l'état HA ; un tap marque « arrosé » ; au quota atteint le geste est **désactivé** ; le reset vit en **automation HA** à minuit. Réalise UJ-3.
[ASSUMPTION: un **unique rituel d'arrosage global** (pas une entrée par plante) ; état binaire vide → plein.]

**Functional Requirements :**

#### FR-6 : Tuile Arrosage (barre supérieure)
Florian voit si l'arrosage du jour est fait.
**Conséquences (testables) :**
- Une **tuile plante** dans `TopBarSlots` affiche un **niveau de remplissage** reflétant l'état HA (**vide** = à faire, **plein** = fait).
- État jamais porté par la couleur seule (icône de remplissage + libellé) ; obsolescence → AD-6.

#### FR-7 : Marquer « arrosé »
Florian valide l'arrosage d'un tap.
**Conséquences (testables) :**
- Tap (cible ≥ 56px) → **service HA** (`counter.increment` ou bascule `input_boolean`) ; la tuile **reflète** le compteur (pattern *reflect-only* des tortues, écho HA < 1 s — pas d'optimiste local).
- Au **quota atteint (plein)**, le geste est **désactivé** jusqu'au reset.

#### FR-8 : Reset quotidien (dépendance HA)
L'arrosage se réarme chaque jour sans intervention.
**Conséquences (testables) :**
- Le reset à minuit vit dans une **automation HA** (AD-4) ; **l'app ne planifie rien**.
- **Out of Scope (app) :** création de l'automation + de l'entité compteur = **Task 0 HA** (comme 6.1/6.3).

## 5. Non-Goals (explicites)

- **Pas d'UI d'édition des règles d'automatisation** (Pilier B → v2.1/v3) ; **pas d'implémentation vocale** (Pilier C) — v2 *reflète* la voix (Siri/Google Home via NutriClaude).
- **Pas d'ajout d'Article depuis le kiosque** — l'ajout passe par les canaux NutriClaude (Siri, Google Home, iOS). Le kiosque n'écrit que le **pointage** (`status`) et le **vidage du panier**.
- **Le dashboard ne possède pas la nutrition** : recettes, profils, catalogue produits, génération de menus, gestion des Rayons **restent dans NutriClaude** (Shortcuts/Claude/web). Le dashboard n'expose **que** la Liste de courses.
- **Pas d'attribution d'action nominative *pilotée par le dashboard*** : la Provenance (`added_by`) est **lue** depuis NutriClaude et affichée, pas gérée par le dashboard.
- **Arrosage :** pas de fréquence par plante, pas de plantes nommées multiples, pas de rappel programmé — 1×/jour binaire.
- **Pas de fusion des couches** : la surface NutriClaude reste **isolée** de l'état HA/@hakit (jamais mélangées dans un même store).

## 6. Périmètre MVP

### 6.1 Dans le périmètre
- Tuile Courses (accueil) + page détail par Rayon, reflétant NutriClaude en quasi-réel (FR-1, FR-2).
- Pointer un Article + vider le panier (read-write NutriClaude, optimiste + undo) (FR-3, FR-4).
- Reflet des ajouts multi-canaux NutriClaude avec provenance (FR-5).
- Tuile Arrosage barre supérieure, marquage + disable au quota, reset HA (FR-6, FR-7, FR-8).

### 6.2 Hors périmètre MVP
- Piliers B (UI règles) et C (voix implémentée) — v2.1/v3.
- Ajout d'Article au kiosque ; toute la nutrition hors Liste de courses (recettes, profils, menus, scan produit) — reste NutriClaude.
- Rituels supplémentaires (plantes nommées multiples, corvées enfants…) — pattern posé, non livrés.

## 7. Métriques de succès

*(Kiosque perso — métriques d'usage.)*
- **SM-1** — La Liste de courses est **utilisée depuis le kiosque** : on pointe/vide au kiosque plutôt que de rouvrir le téléphone à la maison ; on n'oublie plus d'articles. Valide FR-1…FR-5.
- **SM-2** — Les plantes sont arrosées **1×/jour** sans oubli : la tuile passe « pleine » chaque jour. Valide FR-6, FR-7.
- **Contre-métrique SM-C1** *(ne pas optimiser)* — La **simplicité du geste**. Si pointer au kiosque devient plus lent que le faire sur le téléphone (Shortcut) ou le dire à Siri, le kiosque n'apporte rien — même « avec plus de fonctions ». Contrebalance SM-1 (NFR2).

## 8. Questions ouvertes

1. **Auth NutriClaude au kiosque** — appareil partagé, toujours-allumé : quelle identité/JWT foyer pour satisfaire la RLS (`auth.uid()`) ? Magic-link une fois puis token long-lived ? Secret runtime gitignoré, non bundlé (esprit AD-8). **Risque d'intégration** — à lever tôt en architecture.
2. **Optimiste + convergence hors @hakit** — l'infra optimiste/pending v1 (AD-5/AD-11) est bâtie sur @hakit/HA. Les écritures NutriClaude ont besoin d'un **équivalent** (optimistic UI + réconciliation via Supabase Realtime), réutilisant la **couche state** mais pas le transport HA.
3. **Obsolescence d'une source non-HA** — AD-6 est lié à HA ; définir l'équivalent « hors ligne / stale » pour NutriClaude (Supabase injoignable, JWT expiré, LAN vs cloud).
4. **Joignabilité / déploiement NutriClaude** — Supabase est cloud ; cohérence avec la contrainte LAN/NFR5 du dashboard et le comportement hors-ligne (précédent : Netatmo/Arlo cloud dégradent en obsolescence internet coupé). Où tourne NutriClaude vis-à-vis du kiosque ?
5. **Provenance affichable** — NutriClaude porte `added_by` + `recipe_id`, pas un « canal » (voix/note). Le badge du mock est à **remapper** (par personne / par recette) ou à dégrader.
6. **Accent design Courses** — **pas de vert** (réservé sécurité, design system v1) ; accent distinct à définir à l'étape design system.

## 9. Index des assumptions

- **§4.2** — Le dashboard consomme NutriClaude **en direct** (Supabase REST/Realtime), pas via un pont HA (choix « surface read-write, 2ᵉ backend »).
- **§4.2** — NutriClaude est/sera déployé et joignable depuis le kiosque.
- **§4.3** — Un unique rituel d'arrosage global (pas par plante), état binaire (1×/jour).
