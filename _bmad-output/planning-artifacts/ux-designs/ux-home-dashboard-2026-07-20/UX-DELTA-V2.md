---
title: Home Dashboard v2 — UX Delta
status: final
created: 2026-07-20
builds_on: ../ux-home-dashboard-2026-07-12/DESIGN.md + EXPERIENCE.md (Glass Gradient, final)
inputs:
  - ../../prds/prd-home-dashboard-2026-07-20/prd.md
  - ../../architecture/architecture-home-dashboard-2026-07-20/ARCHITECTURE-DELTA-V2.md
  - ../../prds/prd-home-dashboard-2026-07-20/inputs/mock-courses.html
---

# Home Dashboard v2 — UX Delta

v2 ajoute **2 rituels** à l'écran. Ce doc **hérite** du design system Glass Gradient (DESIGN.md, tous les tokens) et des patterns d'interaction (EXPERIENCE.md : obsolescence, undo). Il ne formalise que le **neuf** : l'accent Courses, la tuile + page Courses (réconciliées avec les données réelles), et la tuile Arrosage (moule tortue).

## Nouveau token — accent Courses

La règle « **un accent par domaine, jamais réutilisé** » impose un accent **neuf** pour Courses, **non-vert** (le vert est réservé sécurité ; le vert du mock est écarté).

- **`accent-courses` = `#ff6faf` (rose)** — **confirmé** (Florian, 2026-07-20). Distinct de amber/bleu/cyan/violet/vert/rouge et des teintes de fond (indigo/teal/magenta).
- Usage identique aux autres accents : teinte du fond de tuile « à acheter », glow léger, icône panier, chrome des contrôles Courses. Jamais décoratif.
- **Arrosage n'a pas d'accent de domaine** : c'est une tuile rituel (barre supérieure) dont l'état est porté par le **niveau de remplissage** (voir §Arrosage), pas par une couleur.

## Courses — Tuile d'accueil

Réf. mock : `inputs/mock-courses.html` (le mock gagne sur rien — le spine DESIGN.md/données réelles gagnent sur le mock en cas de conflit).

- **Forme** : tuile givrée `{components.device-tile}`, radius `{rounded.md}`, teintée `accent-courses` quand il y a des Articles à acheter (état « actif » = liste non vide), neutre si liste vide.
- **Contenu** : icône panier + titre « Courses » ; **grand compteur** « N » (`{typography.numeric-lg}`, tabular-nums) + label « à acheter » ; **aperçu des derniers Articles** (« Poivrons, Lait, Café +9 ») ; **provenance de la dernière maj** = *qui* (`added_by`) + horodatage relatif ; chevron → page détail.
- **Obsolescence (source non-HA)** : si NutriClaude injoignable → traitement `{components.device-tile-stale}` (bordure `{colors.stale}` dashed + **pill « Hors ligne »** primaire + dernier compteur connu), **jamais de blanc, jamais de spinner**. Réutilise le pattern AD-6, transport NutriClaude.
- **Placement accueil (défaut)** : tuile de **coordination** dans la grille d'accueil, groupée avec l'Ambiance (coup d'œil « maison »), distincte des micro-tuiles de la barre supérieure ; ajustable à l'intégration du layout.

## Courses — Page détail (`/courses`)

- **En-tête** : fil d'Ariane « ‹ Accueil · **Liste de courses** » + **chip de progression** « N à acheter · M pris » (tabular-nums) ; bouton **« Vider le panier »** à droite.
- **Corps** : Articles **groupés par Rayon** (`grocery_list_by_aisle`), un **groupe = carte de rayon** (`{components.section-card}`) avec en-tête (icône rayon + nom + compteur restant/total). **Scroll vertical toléré** sur cette page profonde si la liste dépasse 1024×768 (le no-scroll v1 vise l'accueil glanceable, pas les pages de détail).
- **Ligne d'Article** : **case à cocher (cible ≥48px)** + libellé + **quantité/unité** (si présentes, tabular-nums) + **provenance** = *qui* (`added_by`, initiales/nom) et **icône recette** si `recipe_id`. Tap sur la ligne = marquer **pris**.
- **Provenance (correction du mock)** : le mock montrait des badges **canal** (voix/note) — **remplacés** par **personne** (`added_by`) + **recette** (`recipe_id`). Pas de badge « voix/note ». **Rendu par défaut** : prénom (`display_name`) + icône recette si `recipe_id` (pas d'avatar en v2).
- **Pris / panier** : Articles pris **barrés**, regroupés en fin (section « panier »), atténués.
- **Vider le panier** : action à fort impact → **`{components.undo-toast}`** (6-8 s, « Annuler » ≥52px, compte à rebours). L'écriture (delete des `bought`) part après la fenêtre d'undo (ou est compensée si annulée).
- **Interaction (transport NutriClaude, AD-12/14)** : pointer = optimiste + convergence via Realtime + refetch. **Pas d'ajout au kiosque** (FR-6 retirée) — pas de champ de saisie sur cette page.
- **Obsolescence** : NutriClaude injoignable → page en état stale (dernier état + pill « Hors ligne »), interactions **non destructives** désactivées.
- **Retrait du mock** : la barre « Ok Google… » / « Note iOS synchronisée » du mock (illustration des canaux) **n'est pas** reprise telle quelle — les canaux d'ajout (Siri/Google Home/iOS) sont **hors kiosque** ; la page ne les documente pas.

## Arrosage — Tuile barre supérieure

**Clone du moule tuile tortue** (Story 6.3 / `TurtleTile`), avec `maximum: 1`.

- **Forme** : tuile compacte dans **`TopBarSlots`** (Story 6.4), aux côtés de météo/tortues. Réutilise la structure `BinTile`/`TurtleTile` (radius `{rounded.lg}`/`md`, `backdrop-blur`, icône SVG locale). **Visible en permanence.**
- **État = niveau de remplissage** : **le fond de la tuile se remplit de bas en haut** — `vide` (0, à arroser) → `plein` (1, arrosé). **Icône plante** lisible par-dessus. Le niveau **porte l'état sans couleur seule** (UX-DR14) ; **pas de texte de statut** ; `aria-label` = « Arrosage : à faire / fait ».
- **Geste** : si `!done && !stale` → **bouton ≥56px** (geste enfant, NFR2) → **service HA** (`counter.increment` sur `counter.plantes_arrosees`, ou bascule `input_boolean`). À `1` (plein) → **`disabled`**, tuile **reste visible pleine** jusqu'au reset minuit (automation HA).
- **Reflet HA, PAS d'optimiste** : suivre le pattern **reflect-only** des tortues (la tuile reflète le compteur, le tap appelle le service, HA échoit en < 1 s). *(Note : corrige « optimiste » du PRD FR-7 — on s'aligne sur tortues.)*
- **Obsolescence** : `unavailable`/`unknown`/déconnecté → **non interactive** (via `useEntityValue`/`isStale`).

## A11y & interaction (hérités, rappelés)

- Cibles **≥48px** (Courses lignes) / **≥56px** (geste Arrosage, enfant).
- **État jamais par la couleur seule** : Arrosage = niveau de remplissage ; Courses = compteur + provenance texte + pill « Hors ligne ».
- **tabular-nums** sur les compteurs (Courses N/M, rayon restant/total).
- **Undo** (`{components.undo-toast}`) sur « Vider le panier ».
- **Obsolescence** (`{components.device-tile-stale}`) étendue à la source **non-HA** (NutriClaude) — même repère visuel « Hors ligne ».

## Décisions (tranchées 2026-07-20)

1. **`accent-courses` = `#ff6faf` (rose).** ✅
2. **Page détail Courses : scroll vertical toléré** (exception no-scroll pour les pages profondes ; le no-scroll reste strict sur l'accueil). ✅
3. **Placement tuile Courses (défaut, ajustable au build)** : tuile de coordination dans la grille d'accueil, groupée avec l'Ambiance.
4. **Rendu provenance (défaut)** : `added_by` = prénom (`display_name`) + icône recette si `recipe_id` ; pas d'avatar en v2.
