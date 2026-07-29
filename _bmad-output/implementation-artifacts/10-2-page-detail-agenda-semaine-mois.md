---
baseline_commit: 8188762
---

# Story 10.2: Page détail Agenda — jour / semaine / mois

Status: review

<!-- Contextualisée 2026-07-29 (create-story). 10.1 est done ET validée sur l'appareil : le chemin de lecture par requête (AD-17) est éprouvé en conditions réelles, pas seulement en test. -->
<!-- La vraie réponse `calendar.get_events` a été observée le 2026-07-29 (Task 0 bis de 10.1) et inscrite en fixture. Le format n'est plus une hypothèse : horodatés en ISO 8601 AVEC décalage, journées entières en dates nues, `end` exclusive, champ `description` présent et ignoré. -->
<!-- ⚠️ Cette story CASSE la signature de `useCalendarEvents` : la plage devient un paramètre. C'est le cœur technique, pas un détail. -->
<!-- ⚠️ Elle rend AUSSI la micro-tuile de 10.1 tappable — 10.1 l'avait explicitement laissée non interactive en renvoyant ici. -->

## Story

As a Florian,
I want déplier ma journée, ma semaine ou mon mois depuis la micro-tuile,
so that je situe un rendez-vous dans la durée sans sortir le téléphone.

## Contexte & valeur

**Epic 10, 2ᵉ tranche.** 10.1 a fondé la **lecture par requête** (AD-17) et l'a prouvée sur l'iPad : `calendar.get_events` appelé via `src/hakit/`, parsing défensif, obsolescence gérée à la main puisque le WebSocket ne pousse rien. 10.2 **rejoue exactement ce chemin** — seule la **plage demandée** change. C'est la story qui valide que le seam était bien conçu : si elle demande de le réécrire, c'est qu'il ne l'était pas.

**Ce que la page apporte que la micro-tuile ne peut pas :**

| | micro-tuile (10.1) | page (10.2) |
| --- | --- | --- |
| Portée | **un** événement, le prochain | **tous**, y compris **le passé du jour** |
| Plages | aujourd'hui seulement | **jour / semaine / mois** |
| Question posée | « qu'est-ce qui arrive ensuite ? » | « comment se remplit ma semaine ? » |

**Lecture seule de bout en bout.** Aucune écriture d'événement dans tout l'epic. Pas d'optimiste, pas d'undo, pas de couche pending (AD-5/AD-11 ne s'appliquent pas).

### Ce que les vraies données changent

La réponse réelle de Florian (observée le 2026-07-29, inscrite en fixture dans `src/agenda/select.test.ts`) montre à quoi ressemble une vraie semaine, et ça pèse sur le design :

- **Beaucoup de récurrents courts** : « Enfants - Audrey » / « Enfants - Florian » deux fois par jour, tous les jours ouvrés. Une vue semaine affiche donc **10 à 14 pastilles** rien que pour ça.
- **Des multi-jours qui s'étalent** : « Enfants - Les croûtes » couvre **du 27 juillet au 17 août**, soit toutes les cellules de la vue mois. « Enfants avec Mamie Véro et Papi Alain » couvre 9 jours.
- **Des titres longs** : « Rdv Nathan institut saint st pierre - Dr Dequae » ne tiendra dans aucune pastille de 17px de haut.

⇒ Le « **+N** » de la vue mois et la troncature ne sont pas des cas limites décoratifs : **ils sont le cas nominal**. Une vue mois qui suppose 2 événements par jour sera fausse dès le premier essai.

## Contrat d'interface HA ↔ app

**Inchangé depuis 10.1** — c'est tout l'intérêt. `calendar.get_events`, `returnResponse: true`, réponse keyée par `entity_id`, `end` exclusive, journée entière détectée à la forme. Documenté dans `docs/home-assistant.md` § « Agenda — calendriers Google (Story 10.1) », section désormais marquée **observée** et non supposée.

**La seule chose qui change : `start_date_time` / `end_date_time`.**

| vue | plage demandée |
| --- | --- |
| **Jour** | `[aujourd'hui 00:00 → demain 00:00)` — identique à 10.1 |
| **Semaine** | `[lundi 00:00 → lundi suivant 00:00)`, semaine **courante** |
| **Mois** | `[1er du mois 00:00 → 1er du mois suivant 00:00)` |

⚠️ **La vue mois demande le mois, mais la grille affiche 6 semaines** — elle déborde donc sur la fin du mois précédent et le début du suivant (cellules `out`, atténuées). **Deux options, à trancher en Task 2** : demander la plage **de la grille** (lundi de la 1ʳᵉ semaine → dimanche de la 6ᵉ) plutôt que celle du mois, ou demander le mois et laisser les cellules débordantes vides. La première est plus honnête visuellement ; la seconde fait une requête plus petite. **Recommandation : demander la plage de la grille** — une cellule affichée vide alors qu'elle porte un événement est un mensonge, et c'est exactement la classe de défaut que la revue de 10.1 a trouvée.

## Acceptance Criteria

1. **La micro-tuile devient la porte d'entrée (AD-10).**
   **Given** la micro-tuile Agenda de 10.1, aujourd'hui **non interactive**
   **When** je la tape
   **Then** une page **`/agenda`** s'ouvre (**un seul niveau**, AD-10), **sur la vue Jour**.
   **And** la tuile devient un `<button>` avec un `aria-label` qui annonce l'action (« … — ouvrir l'agenda »), cible **≥ 48px** (NFR2 — la hauteur est déjà `min-h-[56px]`), sur le moule de `ElectricityTile` et `TopBarWeather`.
   **And** **l'empreinte de la tuile ne change pas** : la barre supérieure porte six chips plus la pill HC/HP de 9.2, et son absence de collision **vient d'être validée sur l'appareil** — cette story ne doit pas la reprendre.

2. **Vue Jour — la journée complète, passé compris.**
   **Given** la page ouverte sur Jour
   **When** elle se rend
   **Then** elle liste **tous** les événements du jour, **y compris ceux déjà terminés** (ce que la micro-tuile ne montre pas), triés chronologiquement, journées entières en tête.
   **And** chaque entrée porte **heure** (`tabular-nums`) ou la mention journée entière, **titre**, et le **calendrier d'origine par son nom** (UX-DR26 — jamais une pastille de couleur seule).

3. **Bascule Jour / Semaine / Mois sur une seule rangée (UX-DR29).**
   **Given** l'en-tête = fil d'Ariane « ‹ Accueil · Agenda » (**34px**) puis la rangée de contrôle (**52px**)
   **When** je choisis une plage
   **Then** `calendar.get_events` est **rejoué** sur cette plage et les événements sont **groupés par jour**.
   **And** la bascule et (en 10.3) les filtres **partagent cette unique rangée de 52px** — deux rangées ne laisseraient pas respirer le mois.
   **And** chaque segment est une cible **≥ 44px** de haut, `min-width` 96px (mesuré sur maquette).

4. **Vue Semaine — 7 rangées, pas 7 colonnes (UX-DR29).**
   **Given** la semaine courante lundi → dimanche
   **When** elle se rend
   **Then** elle produit **7 rangées** ; chaque rangée porte le **nom du jour**, sa **date**, et ses événements en pastilles lisibles.
   **And** à 134px de large une colonne-jour tronquerait tout : **la disposition en colonnes est explicitement écartée**.
   **And** un jour sans événement affiche un **état dit** (« rien »), jamais une rangée vide muette.

5. **Vue Mois — grille 7×6, « +N » au-delà de 2 (UX-DR29).**
   **Given** le mois courant
   **When** la vue se rend
   **Then** elle tient dans une grille **7 colonnes × 6 rangées** de cellules **134×78px** (mesuré sur maquette ; l'epic arrondit à 79) ; chaque cellule porte le **numéro du jour**, jusqu'à **2 pastilles**, et « **+N** » au-delà.
   **And** les cellules hors du mois courant sont **atténuées** (`out`), pas masquées.
   **And** **aucun scroll**, ni dans une cellule, ni dans la grille, ni dans la page.

6. **Aujourd'hui distingué autrement que par la couleur (UX-DR14).**
   **Given** la vue semaine ou mois
   **When** le jour courant s'y trouve
   **Then** il est marqué par **au moins un repère non coloré** — la maquette utilise le mot « **auj.** » en vue mois et « **· aujourd'hui** » en vue semaine, en plus de la bordure et du fond.
   **And** ⚠️ **la teinte de la maquette pour ce repère est `--a-climate` (#35e0d8), qui est l'accent du domaine Climatisation** — voir Décisions ouvertes.

7. **Vide, échec, obsolescence — jamais de blanc.**
   **Given** une plage sans événement, ou la requête en échec, ou HA injoignable
   **When** la vue se rend
   **Then** un **état affiché** (UX-DR27) ou la **dernière réponse connue + obsolescence** (AD-17), **jamais** un écran blanc ni un spinner.
   **And** la garde **« réponse reçue, 0 événement lisible »** de 10.1 est **conservée** : une dérive de format ne doit jamais se déguiser en agenda vide.

8. **Kiosque et gates.**
   **Given** la page, la tuile et le hook
   **When** je termine
   **Then** **1024×748 sans scroll** sur les trois vues ; tous les nombres en `tabular-nums` ; **aucun `entity_id` en dur** hors `src/entities/` ; **aucun calcul de fuseau ni déploiement de récurrence** (AD-4) ; `build` + `typecheck` + `lint` + `test` **verts** ; **0 token dans `dist/`**.
   **And** **`AgendaTile` et sa suite de tests passent la migration de signature** — la revue de 10.1 a montré qu'un test qui ne mord pas est pire que pas de test.

## Tasks / Subtasks

- [x] **Task 9 — Navigation temporelle + rappel de période** (demande Florian 2026-07-29, après coup) — **TDD**
  - [x] `src/agenda/select.ts` — `shiftAnchor(anchor, unit, delta)` **pur**. ⚠️ **Le pas mensuel doit s'ancrer au 1er** : `31 janvier + 1 mois` en arithmétique naïve donne le 3 mars. Tests : bascule d'année, 31→30, février bissextile, pas hebdomadaire à cheval sur deux mois.
  - [x] `src/agenda/select.ts` — `rangeLabel(anchor, unit)` : « mercredi 29 juillet » / « 27 juil. – 2 août » / « juillet 2026 ». ⚠️ Ne pas confondre avec `periodLabel` de `consumption-format` (tarifs HC/HP) — **nom différent exigé**.
  - [x] `src/pages/AgendaDetail.tsx` — la plage dérive d'une **date d'ancrage** en état, plus de `new Date()` au rendu. L'ancrage est **conservé** à la bascule de vue (on est sur la semaine du 27, on passe en mois → juillet) et **remis à aujourd'hui au montage** (état non persisté, AD-1/AD-3).
  - [x] Flèches `‹` `›` dans la rangée de contrôle, cibles **≥ 44px**, `aria-label` explicites (« période précédente / suivante »), encadrant le rappel de période.
  - [x] ⚠️ **Le repère « aujourd'hui » reste calé sur la vraie date**, pas sur l'ancrage — sinon chaque page naviguée aurait son « aujourd'hui ».
  - [x] Tests : les flèches redemandent la bonne plage ; l'ancrage survit à la bascule de vue ; le rappel suit ; « aujourd'hui » ne se déplace pas.

- [x] **Task 1 — Paramétrer la plage dans le seam** (AC: 3, 7) — **TDD, à faire en premier : tout le reste en dépend**
  - [x] `src/agenda/select.ts` — ajouter `weekRange(now)` (lundi 00:00 → lundi suivant, **semaine ISO**, `getDay()` renvoie 0 pour dimanche : le piège classique) et `monthRange(now)` (1er 00:00 → 1er du mois suivant). Sur le moule exact de `dayRange` : composants **locaux**, jamais `toISOString()`.
  - [x] Décider et implémenter la plage de la **grille mois** (cf. « Contrat d'interface » — recommandation : plage de la grille, pas du mois).
  - [x] Tests : bascule de mois, année bissextile, semaine à cheval sur deux mois, **dimanche** (le jour où une semaine ISO naïve part en vrille), passage à l'heure d'été.
  - [x] `src/hakit/useCalendarEvents.ts` — **⚠️ SIGNATURE CASSANTE** : la plage devient un paramètre. Proposition : `useCalendarEvents(range: {start: Date; end: Date} | undefined, refreshMs?)` où `undefined` = aujourd'hui (rétrocompatible pour la tuile). **Les deux appelants migrent dans la même passe**, `tsc` les nommera.
  - [x] **Le déclencheur de rafraîchissement doit suivre** : `windowDay` compare aujourd'hui `dayKey(now)`. Avec une semaine ou un mois, le bon déclencheur n'est plus « la date a changé » mais « **la plage demandée a changé** » (nouvelle vue) **ou** « la date locale est sortie de la plage courante ». Ne pas laisser ce ref mentir — c'est lui qui décide si une requête part.
  - [x] **Ne PAS toucher** : le garde de séquence, le journal d'erreur, la garde `unreadable`, la politique de 15 min. Ils viennent d'être corrigés en revue.

- [x] **Task 2 — Groupement par jour (pur)** (AC: 2, 4, 5) — **TDD**
  - [x] `src/agenda/group.ts` (NOUVEAU, à côté de `select.ts`) — `groupByDay(events, range): DayBucket[]` où `DayBucket = { date: Date; events: AgendaEvent[] }`, **une entrée par jour de la plage même vide** (les vues ont besoin des trous).
  - [x] **Un multi-jours apparaît dans CHAQUE jour qu'il couvre** — « Enfants - Les croûtes » (27/07 → 17/08) doit être visible tous les jours, pas seulement le 27. C'est le piège central de cette task : un groupement naïf par `start` le fait disparaître.
  - [x] Ordre intra-jour : **journées entières d'abord**, puis horodatés par heure croissante.
  - [x] `capEvents(bucket, max)` → `{ shown, overflow }` pour le « +N » de la vue mois.
  - [x] Tests : multi-jours étalé, journée vide, ordre intra-jour, cap à 2 avec `overflow`, événement à cheval sur la borne de plage.

- [x] **Task 3 — Route et coquille de page** (AC: 1, 3)
  - [x] `src/App.tsx` — `<Route path="/agenda" element={<AgendaDetail />} />`, à côté des six existantes.
  - [x] `src/pages/AgendaDetail.tsx` (NOUVEAU) — moule de `ElectricityDetail` / `WeatherDetail` : contenu seul, le sol et la barre appartiennent à `KioskShell` (TD-1). Fil d'Ariane + rangée de contrôle + zone de vue.
  - [x] `src/widgets/AgendaTile.tsx` — devient un `<button>` qui navigue vers `/agenda`, `aria-label` étendu. **Vérifier que la pill et l'empreinte ne bougent pas.**
  - [x] Bascule segmentée : état **local à la page**, **non persisté** (AD-1/AD-3), défaut = Jour.

- [x] **Task 4 — Vue Jour** (AC: 2, 7) — **TDD**
- [x] **Task 5 — Vue Semaine (7 rangées)** (AC: 4, 6, 7) — **TDD**
- [x] **Task 6 — Vue Mois (grille 7×6)** (AC: 5, 6, 7) — **TDD**
  - [x] Cellule = numéro du jour + ≤2 pastilles + « +N ». `overflow-hidden` sur la cellule ET sur la grille.
  - [x] **Le no-scroll est l'invariant fragile ici** : 6 rangées × 79px + gaps doivent tenir dans le résidu après le chrome. Vérifier au device, aucun test ne le garde (TD-9).

- [x] **Task 7 — Doc** (Doc Impact)
  - [x] `docs/home-assistant.md` § Agenda — noter que la **même action** sert les trois plages, seuls `start_date_time`/`end_date_time` changent. Rien de neuf côté HA : **aucune entité à créer**.

- [x] **Task 8 — Validation (gates)** (AC: 8)
  - [x] `build` (sans token, garde AD-8 — déplacer `.env.local`, **le restaurer**, vérifier l'empreinte) + `typecheck` + `lint` + `test` verts ; **0 token dans `dist/`**.
  - [x] **Gate AD-17** : `rg -n 'useEntity\(' src/pages/AgendaDetail.tsx src/agenda/` ⇒ aucun résultat.
  - [ ] **Preuve device (Florian)** : les trois vues à 1024×748 **sans scroll**, un jour chargé (récurrents « Enfants ») **et** pendant un multi-jours en cours ; retour à l'accueil ; HA coupé ⇒ dernière réponse + atténuation. — _en attente Florian_

## Dev Notes

**Portée stricte. Hors scope — NE PAS construire :**

- **Le filtre par calendrier** → **10.3**. Mais la rangée de contrôle doit **prévoir la place** (elle est partagée, UX-DR29).
- **Toute écriture d'événement**, création, édition, suppression → hors epic 10 entier.
- ~~**Navigation temporelle** → non demandé~~ → **DEMANDÉE PAR FLORIAN le 2026-07-29, après implémentation.** Deux flèches `‹` `›` sur **chacune** des trois vues, plus un **rappel de la période affichée**. Voir Task 9.
- **Vue agenda continue, vue liste infinie, drag & drop** → non.
- **Persistance de la vue choisie** → non (AD-1/AD-3 : état local à la page, perdu au retour).
- **Toucher à la barre supérieure au-delà de rendre la tuile tappable** — son absence de collision vient d'être validée sur l'appareil, ne pas la remettre en jeu.

**Réutilisation maximale — presque tout est déjà là :**

| Existant | Rôle en 10.2 |
| --- | --- |
| `src/agenda/select.ts` — `parseEvents`, `countRawEntries`, `dayRange`, `haDateTimeString`, `formatEventTime`, `AgendaEvent` | **Le socle.** Ne rien réécrire ; ajouter `weekRange`/`monthRange` à côté |
| `src/hakit/useCalendarEvents.ts` | Le chemin de requête, sa politique de fraîcheur, son garde de séquence, sa garde `unreadable`. **Paramétrer, pas refaire** |
| `src/entities/mapping.ts` — `calendarsConfig()` | Les 4 calendriers **réels** et leur `label` humain — c'est ce `label` que UX-DR26 impose d'afficher |
| `src/pages/ElectricityDetail.tsx` | Le moule de coquille : `BackLink`, `Tile`, grille, `min-h-0 flex-1`, `overflow-hidden` |
| `src/hakit/stale.ts` — `formatSince` | La pill « Hors ligne · HH:MM » |
| `src/widgets/AgendaIcons.tsx` — `CalendarIcon` | Déjà là |

**`selectNext` NE SERT PAS ici.** C'est la règle à 3 rangs de la micro-tuile — « quel **unique** événement montrer ». La page montre **tout**. Ne pas essayer de la réutiliser ; ne pas la modifier non plus, elle est validée sur l'appareil.

**Ce que la revue de 10.1 a coûté, et qu'il ne faut pas repayer :**

- **Un libellé qui applique la mauvaise convention.** `untilLabel` traitait une fin horaire avec l'arithmétique de fin exclusive des journées entières et affichait une date d'hier. En 10.2, la même classe de piège guette le groupement : **`end` est exclusive**, donc un événement `27/07 → 17/08` couvre jusqu'au **16** inclus. Se tromper d'un jour ici étale un événement sur une cellule de trop, tous les mois.
- **Un test tautologique.** Le garde d'« empreinte constante » comparait un littéral statique du JSX : il ne pouvait pas échouer. **Écrire des tests qui mordent** — les vérifier en cassant volontairement le code.
- **Un `className` asserté ne prouve pas que Tailwind l'émet.** Si 10.2 introduit des classes générées dynamiquement, vérifier sur le **CSS compilé**.
- **Une hypothèse de format publiée comme un fait.** La doc annonçait une forme de payload jamais observée. Elle est désormais **observée** — s'y fier, et ne pas réintroduire d'hypothèse.

**Le no-scroll de la vue mois : ça tient, mais de justesse.** La maquette porte son propre calcul, mesuré au navigateur et pas estimé : sur 748px, `24 (padding) + 52 (barre) + 34 (fil d'Ariane) + 52 (rangée de contrôle) + 24 (padding bas) + gaps ≈ 224px` de chrome ⇒ **~524px pour la grille**, soit 6 rangées de **134×78px**, en-tête des jours inclus. _(L'epic dit 79px, la maquette 78 — c'est la maquette qui a été mesurée.)_

**La marge résiduelle se compte donc en poignée de pixels.** Ce n'est pas une alarme, c'est une contrainte : toute addition la mange. Une rangée de contrôle qui passe à 60px, une police d'en-tête plus grosse, un gap à 8px au lieu de 6, une bordure de plus — et le mois scrolle. **Aucun test automatisé ne garde cet invariant (TD-9)** : il se vérifie sur l'appareil, et nulle part ailleurs. Si un ajustement devient nécessaire, les leviers dans l'ordre : gaps 6→4px, cellules 78→76px, en-tête des jours plus compact.

### Project Structure Notes

- **NEW** : `src/pages/AgendaDetail.tsx` (+ `.test.tsx`) ; `src/agenda/group.ts` (+ `.test.ts`).
- **UPDATE** : `src/agenda/select.ts` (+ test) ; `src/hakit/useCalendarEvents.ts` (+ test) ; `src/widgets/AgendaTile.tsx` (+ test) ; `src/App.tsx` ; `docs/home-assistant.md` ; `sprint-status.yaml`.
- **Direction de dépendance** : `pages`/`widgets` → `hakit`/`agenda`/`entities`. `src/agenda/` reste **pur** — aucun import `@hakit`, aucune horloge. C'est ce que la revue de 10.1 a rétabli en sortant le module de `widgets/` ; ne pas l'annuler.
- **Aucune dépendance nouvelle.** Pas de bibliothèque de calendrier : la grille est du CSS grid, le groupement est une fonction pure. Une lib de calendrier apporterait un moteur de récurrence dont AD-4 ne veut pas.
- **Style** : Tailwind ; `tabular-nums` ; cibles ≥48px ; kiosque sans scroll. Prettier + pre-commit (lint-staged → typecheck → test).

### Décisions tranchées

- **Un seul niveau de profondeur** (AD-10) : `/agenda` est une page, pas un routeur imbriqué. La bascule est un état local.
- **Semaine en 7 rangées**, pas 7 colonnes (UX-DR29, mesuré : à 134px une colonne tronque tout).
- **Bascule et filtres sur une rangée** de 52px — c'est ce qui rend le mois respirable.
- **Vue par défaut = Jour**, et elle montre **le passé du jour** — c'est sa raison d'être face à la micro-tuile.
- **État du filtre et de la vue non persisté** (AD-1/AD-3).
- **Aucune navigation temporelle** : semaine et mois **courants** uniquement.

### Arbitrages Florian (2026-07-29, avant implémentation)

- **🎨 Couleur par calendrier → AUCUNE.** Le **nom** porte l'identité en vues Jour et Semaine (UX-DR26 l'impose déjà). En vue Mois, où une pastille de 17px ne peut pas porter un nom, les pastilles affichent **heure + titre tronqué** et **aucune identité de calendrier** — assumé : la vue mois est une carte de densité, pas un index. Palette intacte, zéro token neuf.
- **🎨 Repère « aujourd'hui » → mot + bordure neutre appuyée.** « auj. » en mois, « · aujourd'hui » en semaine ; bordure en blanc à forte opacité plutôt que le turquoise de la maquette, qui est l'accent du domaine Climatisation.
- **📐 Plage de la vue mois → LE MOIS STRICT** (contre la recommandation de la story, choix assumé de Florian). `[1er 00:00 → 1er du mois suivant 00:00)`. **Conséquence à connaître** : les cellules débordantes de la grille 7×6 n'ont aucune donnée, donc un rendez-vous du 31 août n'apparaît pas sur la grille de septembre. **Atténuation retenue** : ces cellules ne rendent **que leur numéro de jour**, fortement estompées (`out`), et **ne montrent jamais un état « rien »** — elles ne prétendent rien sur leur contenu plutôt que de mentir par omission. Rebasculer sur la plage de la grille reste un changement d'une fonction (`monthRange` → `monthGridRange`).

### Décisions ouvertes / dépendances

- **🎨 Couleur par calendrier — à trancher AVANT la Task 4.** La maquette colore les pastilles par calendrier (3 calendriers inventés : famille / florian / école). La réalité en a **4** (`chats`, `anniversaires`, `calendrier_scolaire_zone_c`, `jours_feries_…`) et le système de couleurs **n'a aucun token de calendrier**. Ajouter 4 teintes entrerait en collision avec la palette d'accents de domaine — la story 9.2 vient déjà d'en consommer deux pour les tarifs, dont une **identique** à `--color-accent-lights`. **Options** : (a) pas de couleur par calendrier, le **nom** suffit (UX-DR26 l'impose déjà, la couleur n'est qu'un renfort) ; (b) 4 tokens neufs `--color-cal-*`, en assumant la dilution de la palette. **Recommandation : (a)** — la couleur ne porte aucune information que le nom ne porte déjà, et la contrainte du kiosque est la lisibilité à trois mètres, pas la richesse chromatique.
- **🎨 Repère « aujourd'hui » — même problème, plus petit.** La maquette utilise `--a-climate` (#35e0d8), **l'accent du domaine Climatisation**. Le mot « auj. » / « · aujourd'hui » porte déjà l'information (UX-DR14 satisfait). **Recommandation** : garder le mot, et prendre pour la bordure une couleur **neutre appuyée** (`--color-text` à faible opacité) plutôt qu'un accent de domaine.
- **📐 Plage de la vue mois** : grille complète (6 semaines) ou mois strict ? Cf. « Contrat d'interface ». **Recommandation : grille complète.**
- **🧱 Coquille de page partagée.** `deferred-work.md` note depuis 6.2 la duplication de `BackLink` + `Tile` entre `WeatherDetail` et `VacuumDetail`. `AgendaDetail` sera la **cinquième** page à la recopier. Le déclencheur d'extraction est franchement atteint — **mais c'est une tâche distincte** (Rule 6) : la signaler, ne pas la faire ici.
- **⏱️ Période de rafraîchissement** : 15 min hérités de 10.1. Pertinent pour un mois ? Probablement oui (ces calendriers bougent peu), mais à confirmer à l'usage.

### References

- [Source: epics.md#Epic 10 · #Story 10.2 · **UX-DR29** (cotes mesurées au navigateur : chrome 52+34+52, résidu ~524px, mois 7×6 en 134×78px, semaine en 7 rangées) · UX-DR14/UX-DR26/UX-DR27 · AD-10/AD-17/AD-4/AD-1]
- [Source: `ux-designs/ux-home-dashboard-2026-07-27/inputs/mock-agenda-detail.html` — **la maquette de référence** : structure des trois vues, `.wrow` (semaine), `.mgrid`/`.cell`/`.mchip`/`.mmore` (mois), `.seg` (bascule), `.fchip` (filtres 10.3), et les états vide/hors-ligne]
- [Source: `10-1-agenda-du-jour-accueil.md` — **le socle** : contrat HA observé, chemin de lecture par requête, 20 constats de revue dont 16 patchés, et la preuve device validée le 2026-07-29]
- [Source: `src/agenda/select.test.ts` — **la vraie charge utile de Florian** est en fixture : récurrents « Enfants » biquotidiens, multi-jours de 3 semaines, titres longs, champ `description`. S'en servir pour éprouver les vues, pas de données inventées]
- [Source: `deferred-work.md` — duplication de coquille de page (ouverte depuis 6.2) ; dette collision top-bar **soldée** le 2026-07-29]

## Dev Agent Record

### Agent Model Used

### Debug Log References

- **`tsc` ne couvre PAS les fichiers de test.** La story pariait que « les deux appelants migrent, `tsc` les nommera » : faux pour les tests, qui sont hors du projet de typecheck. Cinq tests du hook passaient `60_000` en **premier** argument — devenu la plage — et ne l'ont dit qu'à l'exécution, dont un par un `TypeError` sur `range?.start.getTime()`. Le filet de types s'arrête à `src/**` hors tests.
- **Dépendances React : primitives plutôt que chaîne dérivée.** Première tentative avec un `rangeKey` string : la callback ne le lisait pas, donc la dépendance était décorative — exactement le défaut P10 relevé en revue de 10.1. Remplacé par `startMs`/`endMs`, réellement lus dans le corps.
- **Vérification que les tests mordent** : régression volontaire de `groupByDay` (groupement par `start` au lieu du recouvrement) ⇒ **4 tests tombent**, dont celui de bout en bout sur la page. Restauré et revérifié.
- **Budget vertical du mois recalculé** avec les valeurs réellement écrites : chrome 222px ⇒ **526px de grille**, cellules **78,8px**. À deux pixels de la maquette (524 / 78). Cohérent, mais **aucun test ne garde ça** (TD-9).
- **Navigation (Task 9) — un défaut introduit puis corrigé.** L'état vide de la vue Jour disait « Rien **aujourd'hui** » ; écrit quand la page ne pouvait montrer que le jour courant, il devient un mensonge dès qu'on navigue à demain. Devenu « Rien ce jour-là » hors du jour même, avec un test dédié. C'est le genre de régression qu'un ajout de portée introduit silencieusement : le texte n'a pas changé, c'est son contexte qui a changé sous lui.
- **Deux régressions volontaires pour vérifier que les tests mordent (Task 9)** : « aujourd'hui » recalé sur l'ancrage ⇒ 1 test tombe ; pas mensuel naïf (`setMonth`) ⇒ 4 tests tombent, dont l'enchaînement qui saute février. Restaurés et revérifiés.
- **Le budget vertical du mois n'a pas bougé** : la rangée de contrôle reste à `h-[52px]`, les flèches font 44px et tiennent dedans. Aucun pixel repris à la grille.
- **Gates** : `rg 'useEntity\(' src/pages/AgendaDetail.tsx src/agenda/` ⇒ vide ; aucun `entity_id` en dur hors `entities/` ; build sans token RC=0, **0 token dans `dist/`**, `.env.local` restauré à empreinte identique.

### Completion Notes List

- **AC1–AC8 satisfaits côté app ; la preuve device reste due** (les trois vues sans scroll à 1024×748).
- **Navigation temporelle ajoutée après coup** (demande de Florian, la story l'avait explicitement exclue) : `‹` `›` sur les trois vues, pas d'un jour / une semaine / un mois, plus le rappel de la période entre les deux flèches. L'ancrage **survit à la bascule de vue** et **repart à aujourd'hui au montage** — ce qui évite qu'un kiosque mural reste bloqué trois mois dans le futur parce que quelqu'un a tapé deux fois.
- **+70 tests → 476 verts** ; avant la Task 9 : **+50 tests → 456 verts** (54 fichiers), typecheck, oxlint et Prettier propres. Répartition : plages `weekRange`/`monthRange` +10, `group` +12, page `AgendaDetail` +21, hook +4, tuile +3.
- **Le seam de 10.1 a tenu.** La story disait : « si elle demande de le réécrire, c'est qu'il ne l'était pas ». Il n'a pas fallu le réécrire — la plage est devenue un paramètre, le déclencheur de rafraîchissement a suivi, et **rien d'autre n'a bougé** : garde de séquence, journal d'erreur, garde `unreadable`, politique de 15 min sont intacts.
- **Le piège du multi-jours est verrouillé à deux niveaux** : fonction pure et rendu de page. Un recouvrement, pas un groupement par `start` — et la fin exclusive tombe naturellement de l'écriture semi-ouverte, sans `−1` à oublier. **Vérifié mordant** : la régression volontaire fait tomber 4 tests.
- **Le déclencheur de rafraîchissement a été repensé, pas rafistolé.** `windowDay` comparait une date du jour, ce qui ment dès qu'on demande une semaine. Remplacé par `windowKey`, qui vaut la plage sous plage explicite et `today:<date>` sous plage par défaut — une seule expression couvre la bascule de vue **et** le passage de minuit.
- **Effet de bord heureux : le point a11y différé en revue de 10.1 (W1) est soldé.** La tuile portait `role="status"` sur un contenu entièrement `aria-hidden` — une région live incapable d'annoncer quoi que ce soit. Devenue `<button>`, elle a simplement le bon rôle. Le point sort de `deferred-work.md`.
- **Deux tests réécrits, pas supprimés** : « non interactive en 10.1 » (la spec a changé, l'invariant « une seule cible » reste asserté) et les six `getByRole("status")` migrés vers `button`.
- **Arbitrages de Florian appliqués tels quels** : aucune couleur par calendrier (le nom porte l'identité là où il rentre, la vue mois n'en affiche aucune), repère « aujourd'hui » en mot + bordure neutre, et **mois strict**. Sur ce dernier, contre ma recommandation — atténué en ne faisant **rien prétendre** aux cellules hors mois plutôt qu'en leur faisant afficher « rien ».
- **Ce qui reste (Florian)** : la **preuve device** — trois vues à 1024×748 sans scroll, un jour chargé et pendant un multi-jours en cours, retour à l'accueil, HA coupé.

### File List

**Créés :**

- `src/pages/AgendaDetail.tsx` + `.test.tsx` — la page, ses trois vues, ses états, puis la navigation et le rappel de période (Task 9)
- `src/agenda/group.ts` + `.test.ts` — `groupByDay`, `capEvents`

**Modifiés :**

- `src/agenda/select.ts` + `.test.ts` — `weekRange`, `monthRange`, puis `shiftAnchor` et `rangeLabel` (Task 9)
- `src/hakit/useCalendarEvents.ts` + `.test.ts` — plage paramétrée (`CalendarRange`), `windowKey` remplace `windowDay`
- `src/widgets/AgendaTile.tsx` + `.test.tsx` — devient un `<button>` vers `/agenda`, sort de `role="status"`
- `src/App.tsx` — route `/agenda`
- `docs/home-assistant.md` — les trois plages sur la même action, aucune entité à créer
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-29 | 0.3 | **Navigation temporelle (Task 9), demandée par Florian après implémentation** — la story l'avait explicitement écartée (« ne pas ajouter de flèches pour bien faire »). Deux flèches par vue, pas d'un jour / une semaine / un mois, et le rappel de la période affichée entre elles. La plage dérive désormais d'une **date d'ancrage** en état, conservée à la bascule de vue et remise à aujourd'hui au montage. **Deux pièges traités** : le pas mensuel s'ancre au 1er (`setMonth` sur un 31 donne le 3 mars, et trois clics sautent février — 4 tests le prouvent), et le repère « aujourd'hui » reste calé sur la **vraie** date, sinon chaque page naviguée aurait le sien. **Un défaut introduit puis corrigé** : « Rien aujourd'hui » devenait faux dès qu'on naviguait — l'état vide sait maintenant de quel jour il parle. **Le budget vertical du mois est intact** : la rangée de contrôle reste à 52px, les flèches de 44px tiennent dedans. **476 tests verts** (+20). |
| 2026-07-29 | 0.2 | **Implémentée (dev-story, TDD).** Le seam de 10.1 a tenu : la plage devient un paramètre (`CalendarRange`), le reste du hook est intact. **Le déclencheur de rafraîchissement a été repensé** — `windowDay` comparait une date du jour et mentait dès qu'on demandait une semaine ; `windowKey` vaut désormais la plage, ou `today:<date>` sous plage par défaut, couvrant d'une seule expression la bascule de vue et le passage de minuit. **Groupement par recouvrement, pas par `start`** : un multi-jours apparaît sur chaque jour couvert et la fin exclusive tombe naturellement de l'écriture semi-ouverte. Vérifié mordant — la régression volontaire fait tomber 4 tests. **La tuile devient un `<button>`**, ce qui solde au passage le point a11y différé en revue de 10.1 (région live sur contenu masqué). **Arbitrages de Florian appliqués** : aucune couleur par calendrier, repère « aujourd'hui » en mot + bordure neutre, mois strict — ce dernier contre ma recommandation, atténué en ne faisant rien prétendre aux cellules hors mois. **Deux tests réécrits plutôt que supprimés** (spec légitimement changée). **`tsc` ne couvre pas les tests** : cinq appels au hook passaient le délai en premier argument et ne l'ont dit qu'à l'exécution. **456 tests verts** (+50), build sans token RC=0, 0 token dans `dist/`, budget du mois recalculé à 526px/78,8px — à deux pixels de la maquette. → review. |
| 2026-07-29 | 0.1 | Story 10.2 contextualisée (create-story), baseline `9151398`. **Le cœur technique est identifié** : la plage doit devenir un paramètre de `useCalendarEvents`, et le déclencheur de rafraîchissement (`windowDay`, qui compare une date du jour) doit suivre — sinon il ment dès qu'on demande une semaine. **Le piège central du groupement est nommé** : un multi-jours doit apparaître dans chaque jour qu'il couvre, et `end` étant exclusive, `27/07 → 17/08` s'arrête le 16 — se tromper d'un jour étale l'événement sur une cellule de trop tous les mois. **Le budget vertical du mois est repris de la maquette, pas réestimé** : 224px de chrome sur 748 laissent ~524px, soit 6 rangées de 134×78px — ça tient, mais la marge résiduelle se compte en pixels, aucun test ne la garde (TD-9), et les leviers d'ajustement sont listés dans l'ordre. **Trois décisions ouvertes** remontées avant implémentation, toutes chromatiques ou de plage : couleur par calendrier (recommandation : aucune, le nom suffit), repère « aujourd'hui » (la maquette emprunte l'accent Climatisation), et plage de la grille mois. **Les leçons de la revue de 10.1 sont inscrites** : tests qui mordent, `className` ≠ CSS émis, et ne jamais republier une hypothèse en fait. → ready-for-dev. |
