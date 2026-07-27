---
baseline_commit: ec097b5b93c2493e844b6c005da5518efb455e9b
---

# Story 10.1: Prochain rendez-vous (micro-tuile accueil)

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Task 0 HA LEVÉE (Florian, 2026-07-27) : intégration Google Calendar active, 4 entity_id RÉELS fournis. Ce ne sont PAS des placeholders — contrairement à 9.1/9.2. -->
<!-- Découverte de contexte : 3 des 4 calendriers ne produisent QUE des événements journée entière, dont des multi-jours (vacances scolaires). La maquette UX-DR28 montre un rendez-vous horodaté. Décision Florian : horodaté d'abord, journée entière en repli, multi-jours en cours en dernier recours. -->
<!-- Décision Florian 2026-07-27 : calendar.chats porte les événements horodatés ; les 3 autres sont en journée entière. Le chemin horodaté est donc réellement exercé. -->

## Story

As a Florian,
I want voir sur l'accueil **ce qui arrive ensuite aujourd'hui** — un rendez-vous à l'heure quand il y en a un, sinon ce qui marque la journée (anniversaire, jour férié, vacances en cours) —,
so that je sais ce qui m'attend en passant dans la cuisine, sans ouvrir mon téléphone.

## Contexte & valeur

**Epic 10 (v2) — tracer bullet.** 10.1 fonde **un mode de lecture neuf** dans le projet : la **lecture par requête** (AD-17). Jusqu'ici tout l'état venait d'entités poussées par le WebSocket ; ici la donnée s'obtient en **appelant un service HA qui retourne des données** (`calendar.get_events`). 10.2 rejouera ce même chemin sur d'autres plages (jour/semaine/mois), 10.3 filtrera. **Lecture seule de bout en bout** — aucune écriture d'événement dans tout l'epic.

**Task 0 HA : LEVÉE.** L'intégration Google Calendar est active et Florian a fourni les **4 `entity_id` réels** :

| `entity_id` | libellé proposé (AD-7) | nature des événements |
| --- | --- | --- |
| `calendar.chats` | Chats | **horodatés** (heure de début/fin) |
| `calendar.anniversaires` | Anniversaires | **journée entière**, récurrents annuels |
| `calendar.calendrier_scolaire_zone_c` | Vacances scolaires | **journée entière, MULTI-JOURS** (2 semaines) |
| `calendar.jours_feries_et_autres_fetes_en_france` | Jours fériés | **journée entière** |

C'est la première story de l'epic **sans placeholder** : le mapping part directement avec les vrais ids.

### ⚠️ Ce que les vrais calendriers changent par rapport à la maquette

La maquette qui a fait trancher UX-DR28 (`mock-agenda-approches.html:167-168`) montre **« 17:00 · dans 4h · Piscine — Gaspard »** — un rendez-vous **horodaté**. Or **3 des 4 calendriers réels ne produisent que des événements journée entière**, et le calendrier scolaire produit des **multi-jours** : « Vacances de la Toussaint » est **un seul événement qui couvre aujourd'hui pendant 14 jours**.

Un tri chronologique naïf (journée entière = début à 00:00) afficherait donc **« Vacances de la Toussaint » tous les matins pendant deux semaines**, en masquant le rendez-vous de 17h. Ça ne répond plus à la question que l'accueil est censé poser — *qu'est-ce qui arrive ensuite ?*

**Règle de sélection tranchée (Florian, 2026-07-27) — trois rangs, dans cet ordre :**

| rang | condition | rendu de la tuile |
| --- | --- | --- |
| **1. Horodaté** | il reste un événement **avec heure** dont le début est **≥ maintenant** | `PROCHAIN` · **17:00** · *dans 4h* · titre |
| **2. Journée entière du jour** | sinon, un événement **journée entière commençant aujourd'hui** | `PROCHAIN` · **Aujourd'hui** · titre — **ni heure, ni délai** |
| **3. Multi-jours en cours** | sinon, un événement **commencé avant aujourd'hui** et pas encore fini | `PROCHAIN` · **Jusqu'au 3 nov.** · titre |
| **4. Rien** | aucun des trois | `PROCHAIN` · **Rien aujourd'hui** — **même empreinte** (UX-DR27) |

À rang égal, **le début le plus proche gagne** ; à début égal, l'ordre des calendriers dans le mapping départage (déterminisme requis pour les tests).

## Contrat d'interface HA ↔ app

**Aucune entité lue en état.** La donnée vient d'un **appel de service à réponse** — c'est le cœur d'AD-17 et la principale source d'erreur de cette story.

**Appel** (vérifié dans `@hakit/core` 6.0.2 installé, `HassContext.d.ts:113-119`) :

```ts
const { callService } = useHass();
const res = await callService({
  domain: "calendar",
  service: "get_events",
  target: { entity_id: [...les 4 ids du mapping] },   // un SEUL appel pour les 4
  serviceData: { start_date_time: "...", end_date_time: "..." },
  returnResponse: true,                                // ⚠️ sans ça, le retour est `void`
});
// res: { context, response }
```

**Réponse** — `res.response` est **keyée par `entity_id`**, chaque clé portant `{ events: [...] }` (doc HA `calendar.get_events`) :

```yaml
calendar.chats:
  events:
    - summary: "Vétérinaire"
      start: "2026-07-28 17:00:00"
      end: "2026-07-28 17:30:00"
calendar.anniversaires:
  events:
    - summary: "Anniversaire de Nathan"
      start: "2026-07-28"        # ← date SEULE = journée entière
      end: "2026-07-29"
```

**Invariants du contrat :**

- **La clé de réponse porte le calendrier d'origine.** La conserver en parsant : 10.3 (filtre) et UX-DR26 (nom du calendrier) en dépendent. Ne pas aplatir la réponse en perdant la provenance.
- ⚠️ **Journée entière = `start`/`end` sans partie horaire.** La doc HA **ne le formalise pas explicitement** — c'est **à vérifier sur la vraie réponse** (Task 0 bis ci-dessous) et **à détecter par la forme de la chaîne**, jamais à supposer. Le parseur teste la présence d'une heure (`/^\d{4}-\d{2}-\d{2}$/` ⇒ journée entière) et **tout ce qui ne parse pas est ignoré**, jamais rendu en « Invalid Date ».
- **`end` est exclusive** (doc HA). Un événement journée entière du 28 a `end: "2026-07-29"`. Ne pas l'afficher comme durant jusqu'au 29.
- **Plage demandée** : `[aujourd'hui 00:00 → demain 00:00)`, **locale**, recalculée à chaque requête (pas figée au montage — sinon la plage devient fausse après minuit).
- **Aucun déploiement de récurrence, aucun calcul de fuseau côté app** (AD-4) : `get_events` renvoie les occurrences déjà déployées.

## Acceptance Criteria

1. **Lecture par requête, jamais par attribut d'entité (AD-17, FR-A4).**
   **Given** les 4 calendriers inscrits dans le **mapping central** (AD-7, jamais en dur dans un composant)
   **When** la surface se monte
   **Then** les événements viennent de **`calendar.get_events`** appelé via **`src/hakit/`** avec `returnResponse: true`, sur la plage `[aujourd'hui 00:00 → demain 00:00)`, en **un seul appel** ciblant les 4 entités.
   **And** **aucun** `useEntity` sur un `calendar.*` n'est utilisé pour lire des événements (les attributs n'exposent que l'événement courant/suivant — c'est le piège qu'AD-17 existe pour empêcher).
   **And** l'app **ne déploie ni récurrences ni fuseaux** (AD-4).

2. **La micro-tuile choisit selon la règle des 3 rangs.**
   **Given** une réponse contenant un mélange d'événements horodatés, journée entière et multi-jours
   **When** la tuile se rend
   **Then** elle applique **rang 1 → 2 → 3 → « Rien aujourd'hui »** (tableau ci-dessus), à rang égal le début le plus proche, à début égal l'ordre du mapping.
   **And** le rendu suit le rang : **heure + délai relatif** au rang 1 ; **« Aujourd'hui »** sans heure ni délai au rang 2 ; **« Jusqu'au J mois »** au rang 3.
   **And** le libellé **PROCHAIN** est **toujours présent** — une icône calendrier seule serait du *mystery meat* (UX-DR28).

3. **Fraîcheur explicite — AD-6 ne couvre PAS cette donnée (AD-17).**
   **Given** une réponse obtenue
   **When** l'app revient au premier plan, que la période de rafraîchissement s'écoule, **ou que la date locale change**
   **Then** la requête est **rejouée** sur une plage **recalculée**.
   **And** la fraîcheur **n'est jamais** déduite du WebSocket : une socket vivante ne prouve rien sur l'âge de la réponse.

4. **Échec = dernière réponse connue + obsolescence, jamais de blanc (AD-17/NFR4).**
   **Given** la requête en échec, HA injoignable, ou une réponse illisible
   **When** la tuile se rend
   **Then** elle affiche la **dernière réponse connue** + un **indicateur d'obsolescence** (atténuation + horodatage « HH:MM » du dernier succès), **jamais** de blanc ni de spinner.
   **And** si **aucune** réponse n'a jamais abouti, elle affiche un état lisible (« Agenda indisponible »), **jamais** un vide.

5. **État vide = un rendu, à empreinte constante (UX-DR27).**
   **Given** plus aucun événement retenu pour aujourd'hui
   **When** la tuile se rend
   **Then** « Rien aujourd'hui » s'affiche **dans la même empreinte** que la version peuplée — **aucun saut de mise en page** entre le montage, le chargement, le peuplé et le vide.

6. **La grille de l'accueil ne bouge pas + gates (UX-DR25/UX-DR28).**
   **Given** l'approche A actée
   **When** la tuile est intégrée dans `TopBarSlots`
   **Then** **les 179px de mou vertical restent libres** et la barre supérieure garde sa hauteur — la tuile a **exactement la même hauteur que ses voisines** (voir ⚠️ Conflit de source).
   **And** titre **tronqué sur une ligne** (jamais de retour à la ligne qui pousserait la barre).
   **And** tous les `entity_id` dans `src/entities/` (AD-7) ; `build`+`typecheck`+`lint`+`test` **verts** ; **0 token** dans `dist/` ; **kiosque 1024×748 sans scroll** — vérifié **sur l'iPad**, aucun test automatisé ne garde cet invariant (TD-9).

## ⚠️ Conflit de source à trancher au build

| source | dit |
| --- | --- |
| **UX-DR28** | micro-tuile de **hauteur 52px**, « identique aux 4 micro-tuiles existantes » (mesuré sur maquette) |
| **le code livré** | les 5 chips de `TopBarSlots` sont toutes en **`min-h-[56px]`** (`TopBarWeather:59`, `ElectricityTile:42`, `TurtleTile:81`, `PlantTile:79`, `BinTile:106`) |

**Résolution : suivre le code (`min-h-[56px]`).** L'invariant que UX-DR28 protège est « **même hauteur que les voisines, coût nul sur la grille** » ; le 52 est une cote relevée sur une maquette HTML, pas sur l'app. Coder 52 **casserait** l'alignement de la barre — exactement ce que la règle veut éviter. **Ne pas toucher aux 5 tuiles existantes.**

## 🚨 Risque dominant : la barre supérieure est saturée

**Ce n'est pas la 5ᵉ tuile, c'est la 6ᵉ.** L'AC de l'epic dit « 5ᵉ élément » — elle a été écrite quand la barre en portait 4. Depuis, **9.1 a livré `ElectricityTile`** (5ᵉ). L'agenda est donc le **6ᵉ**.

**Et la maquette ne l'a pas mesuré :** `mock-agenda-approches.html:157-171` rend **5 chips** (météo, élec, tortue, plante, agenda) — **sans `BinTile`** (conditionnelle, rendue seulement quand une poubelle est due) **et sans la pill HC/HP** que la **Story 9.2** ajoute à la chip électricité. Les deux arrivent en plus.

| ce qui pèse sur les ~280px | statut |
| --- | --- |
| 5 chips actuelles + horloge | livré |
| pill « 🌙 Creuses » sur la chip élec | **Story 9.2, ready-for-dev** |
| micro-tuile Agenda (la plus large : 3 lignes de texte) | **cette story** |
| `BinTile` quand une poubelle est due | conditionnelle, **non mesurée dans la maquette** |
| 6ᵉ chip Eau | **Story 9.3** |

`TopBarSlots` est un `absolute left-44` **sans aucune barrière code** contre le chevauchement (`deferred-work.md:21`, dette explicitement déclenchée depuis 9.1).

**Conséquences pour cette story :**
- **Device-proof 1024×748 obligatoire, un jour où une poubelle est due** (sinon le pire cas n'est pas testé). Le forcer si besoin en avançant l'`input_datetime` de sortie.
- **NE PAS solder la dette ici** (borne `max-w` / couche grid = tâche distincte contrainte par TD-1, Rule 6). Si le device-proof révèle une collision ⇒ **escalader**, ne pas corriger dans cette story.
- **Escalader aussi si 9.2 et 10.1 se marchent dessus** : ce sont deux stories indépendantes qui consomment le même budget. La première mergée le consomme.

## Tasks / Subtasks

- [ ] **Task 0 bis — Vérifier la forme réelle de la réponse (Florian ou dev, 5 min, AVANT la Task 2)**
  - [ ] HA → **Outils de développement → Actions** → `calendar.get_events`, cibler les **4** entités, plage = aujourd'hui → demain, **exécuter** et **coller la réponse YAML brute** dans le Dev Agent Record.
  - [ ] **Confirmer** : (a) un événement journée entière a-t-il bien `start`/`end` **sans heure** ? (b) la réponse est-elle bien **keyée par `entity_id`** ? (c) un multi-jours en cours apparaît-il dans une plage « aujourd'hui » avec un `start` **antérieur** ?
  - [ ] **Le parseur doit se caler sur cette réponse observée**, pas sur la doc — elle ne formalise pas la distinction journée entière / horodaté.

- [x] **Task 1 — Mapping des calendriers** (AC: 1, 6)
  - [x] `src/entities/mapping.ts` — `CalendarRef { entityId: string; label: string }` + `const CALENDARS: readonly CalendarRef[]` avec **les 4 ids réels et leurs libellés** (tableau du Contexte) + accesseur `calendarsConfig()`. Moule = `WeatherConfig`/`weatherConfig()` (`:420-451`), objet dédié **hors `ENTITIES`**.
  - [x] **L'ordre du tableau est signifiant** : il départage deux événements de même début (déterminisme des tests). Le commenter.
  - [x] `AUX_ENTITY_IDS` (`:554`) — ajouter les **4** ids (`ENTITY_ID_RE` = `^[a-z_]+\.[a-z0-9_]+$`, `calendar.*` passe). Leçon **7.1 D4** : sans ça, une typo ship en tuile silencieusement vide.
  - [x] `src/entities/mapping.test.ts` (suite « auxiliary entity_ids », `:164`) — couvrir les 4 ids **et** le fait que `label` est non vide (il sert à 10.3/UX-DR26).

- [x] **Task 2 — Parsing + sélection (PUR)** (AC: 2, 5) — **TDD, à écrire en premier**
  - [x] `src/widgets/agenda-select.ts` — **aucun import `@hakit`, aucun `Date.now()`** : `now` est **toujours un paramètre** (leçon 9.2 : une fonction pure sans horloge se teste sans faux timers).
    - `parseEvents(response, calendars)` : réponse brute → `AgendaEvent[] { summary, start: Date, end: Date, allDay: boolean, calendarId }`. **`allDay` détecté par la forme** de `start` (date seule vs date+heure), **pas par une convention supposée**. Toute entrée non parsable est **ignorée silencieusement** (jamais « Invalid Date »). Provenance (`calendarId`) **conservée**.
    - `selectNext(events, now)` : applique **rang 1 → 2 → 3** puis `null`. Retourne `{ event, rank } | null` — le rang pilote le rendu.
    - `relativeDelay(start, now)` : « dans 25 min », « dans 4h », « maintenant » ; `null` si non applicable (rangs 2 et 3).
    - `untilLabel(end, now)` : « Jusqu'au 3 nov. » (rang 3), fr-FR.
  - [x] Tests — **c'est ici que se joue la story** : horodaté à venir gagne sur un journée-entière ; un horodaté **déjà passé** est ignoré ; **multi-jours en cours perd** contre un journée-entière commençant aujourd'hui ; multi-jours seul ⇒ rang 3 ; rien ⇒ `null` ; deux événements même début ⇒ **ordre du mapping** ; `end` **exclusive** (un journée-entière du 28 finit le 28, pas le 29) ; entrée corrompue ⇒ ignorée, les autres survivent ; bascule de minuit (`now` = 23h59 puis 00h01).

- [x] **Task 3 — Le chemin de lecture par requête** (AC: 1, 3, 4) — **le morceau net-new**
  - [x] `src/hakit/useCalendarEvents.ts` — **reste dans le seam `src/hakit/`** (AD-17 : aucune exception AD-2, aucun secret client, contrairement au seam NutriClaude).
    - `useHass()` → `callService({ domain: "calendar", service: "get_events", target: { entity_id: [...] }, serviceData: { start_date_time, end_date_time }, returnResponse: true })`. **⚠️ `returnResponse: true` est obligatoire** : sans lui la surcharge TypeScript retourne `void` et la réponse est perdue silencieusement.
    - Retourne `{ events, isStale, since, loading }` — **même vocabulaire que `useEntityValue`** (`{value, unit, isStale, loading, since}`) pour que les widgets lisent pareil, **sans réutiliser le hook** (donnée de nature différente).
    - **Politique de fraîcheur (AD-17), explicite** : requête au montage ; **intervalle 15 min** ; **`visibilitychange` → visible** ; **changement de date locale** (le tick d'intervalle compare la date courante à celle de la plage en cours et rejoue si elle a changé — sinon la plage reste sur hier après minuit). Intervalle et écouteur **nettoyés au démontage** (leçon timers 2.1).
    - **Dernière réponse en `useRef` éphémère** — **pas de cache persistant** (AD-3) ; même carve-out qu'`useEntityValue`. `since` = horodatage du dernier succès, formaté par **`formatSince`** (`stale.ts:25`, réutiliser).
    - `isStale` = le dernier appel a échoué **ou** l'app est déconnectée. **Ne PAS dériver la fraîcheur du WebSocket seul** — c'est l'erreur qu'AD-17 nomme comme la plus probable.
    - **Aucune écriture, aucun optimiste, aucune couche pending** (AD-5/AD-11 ne s'appliquent pas : c'est de la lecture).
  - [ ] `src/hakit/index.ts` — exporter le hook depuis le barrel (les widgets importent depuis `../hakit`).
  - [x] Tests (`useCalendarEvents.test.ts`, mock `useHass` → `callService` mocké) : `returnResponse: true` **et** les 4 `entity_id` passés dans `target` ; plage `[00:00 → 00:00)` du bon jour ; **un seul appel** pour les 4 ; rejeu sur `visibilitychange` ; rejeu au changement de date ; échec ⇒ `isStale` + **dernière réponse conservée** ; premier échec sans réponse antérieure ⇒ `events: []` + `isStale`.

- [x] **Task 4 — `AgendaTile`** (AC: 2, 5, 6) — **TDD (composant)**
  - [x] `src/widgets/AgendaTile.tsx` — moule visuel des chips : `inline-flex **min-h-[56px]** items-center gap-2 rounded-lg border border-card-border bg-card-fill px-4 backdrop-blur-glass` (voir Conflit de source). Contenu (UX-DR28) : icône calendrier + colonne `PROCHAIN` (label, `text-caption text-text-muted`) / ligne quand (heure `tabular-nums` + délai, ou « Aujourd'hui », ou « Jusqu'au … », ou « Rien aujourd'hui ») / titre **tronqué une ligne** (`truncate max-w-[…]`).
  - [x] **`CalendarIcon`** — SVG local 24×24 `stroke="currentColor"` (gabarit `BoltIcon`/`WeatherIcon`), tracé repris de la maquette (`mock-agenda-approches.html:164`). **Pas de dépendance d'icônes externe.**
  - [x] **Tick local 30 s** pour rafraîchir le délai relatif (« dans 4h » doit vieillir) : même patron que `Clock.tsx:12-15` (`useState(new Date())` + `setInterval` nettoyé). **Ne pas** toucher à `Clock` ni extraire un hook partagé — 3 lignes, hors scope (Rule 6) ; le noter comme candidat d'extraction si un 3ᵉ consommateur arrive.
  - [x] **Empreinte constante** (AC5) : la tuile a la **même largeur et hauteur** en chargement, peuplée, vide et obsolète. Fixer une largeur (`w-[…]`/`min-w-[…]`) plutôt que laisser le contenu la dicter — sinon la barre danse à chaque rafraîchissement.
  - [x] **Obsolescence** : `isStale` ⇒ `opacity-60` (règle unique de la famille top-bar) + `aria-label` mentionnant « hors ligne · HH:MM ». **Dernière réponse conservée**, jamais cachée.
  - [x] `aria-label` complet : « Prochain : 17:00, dans 4 heures, Vétérinaire » / « Prochain : aujourd'hui, Anniversaire de Nathan » / « Rien d'ici la fin de la journée ».
  - [x] **Élément NON interactif** en 10.1 (`<div>`, pas `<button>`) — la navigation vers `/agenda` est **la Story 10.2**. Ne pas créer de route ni de page ici.
  - [x] Tests (mock `useCalendarEvents`) : les 4 rangs rendus correctement ; titre long tronqué ; état vide **même empreinte** ; `isStale` ⇒ atténué + dernière valeur ; **`PROCHAIN` toujours présent**.

- [x] **Task 5 — Montage dans `TopBarSlots`** (AC: 6)
  - [x] `src/App.tsx` (`:93-99`) — `<AgendaTile />` en **dernier enfant** de `<TopBarSlots>` (ordre confirmable au device-proof ; la maquette la place en dernier). **Pas de nouveau `fixed`/`absolute`** — la couche existe (6.4).
  - [x] **Aucune modification** des 5 tuiles existantes, ni de `TopBarSlots`, ni de la grille de l'accueil (AC6 : les 179px restent libres).

- [x] **Task 6 — Doc** (Doc Impact) (AC: 1)
  - [x] `docs/home-assistant.md` — section **« ## Agenda — calendriers Google (Story 10.1) »** sur le moule des sections existantes : les 4 calendriers et leurs libellés, **### Contrat d'interface (⚠️ le code du dashboard en dépend)** (lecture par `calendar.get_events`, réponse keyée par entity_id, journée entière vs horodaté, `end` exclusive), **### Appliquer & tester** (rejouer l'action dans Outils de dév).
  - [x] **Noter que ce chemin est une lecture par requête** : ajouter un calendrier = l'ajouter au mapping ; l'app ne le découvre pas toute seule.

- [x] **Task 7 — Validation (gates)** (AC: 6)
  - [x] `build` (sans token, garde AD-8 — cf. note 9.1 : déplacer temporairement `.env.local`, **le restaurer**) + `typecheck` + `lint` (oxlint) + `test` verts ; **0 `entity_id` en dur** hors `entities/` ; **0 token dans `dist/`** ; Prettier OK.
  - [x] **Gate AD-17** : `rg -n 'useEntity\(' src/widgets/AgendaTile.tsx src/hakit/useCalendarEvents.ts` ⇒ **aucun résultat** (aucune lecture d'événement par attribut d'entité).
  - [ ] **Preuve device (Florian)** : tuile visible et juste à l'instant T ; un jour avec un rendez-vous `chats` **et** un jour sans (repli journée entière) ; **pendant les vacances scolaires** (rang 3) ; état vide en fin de journée ; HA coupé ⇒ dernière réponse + atténuation, **jamais de blanc** ; **grille inchangée (179px)** et **pas de collision top-bar** à **1024×748**, **y compris un jour où `BinTile` est affichée**. — _en attente Florian_

## Dev Notes

**Portée stricte.** Le chemin de lecture par requête + la micro-tuile d'accueil. **Hors scope — NE PAS construire :**
- **La page `/agenda`, la route, la bascule jour/semaine/mois** → **10.2**. La tuile de 10.1 n'est **pas** cliquable.
- **Le filtre par calendrier** → **10.3**. Mais **conserver la provenance** (`calendarId`) dès le parsing : sans elle, 10.3 devra tout refaire.
- **Toute écriture d'événement** → hors epic entier.
- **Déploiement de récurrences, calculs de fuseau, arithmétique de calendrier maison** → **interdit (AD-4)**. `get_events` renvoie les occurrences déployées.
- **Cache persistant de la réponse** (localStorage, IndexedDB, store) → **interdit (AD-3)**. Dernière réponse en `useRef` éphémère uniquement, comme `useEntityValue`.
- **Couche pending / optimiste / undo** → **sans objet** : c'est de la lecture (AD-17 le dit explicitement).
- **Solder la dette collision top-bar** → tâche distincte (Rule 6). La signaler, pas la corriger.
- **Modifier `Clock`, `TopBarSlots` ou les 5 tuiles existantes** → hors scope.

**Le piège n°1 de cette story, nommé dans le change-proposal (`:359-361`) :** *« la classe d'erreur la plus probable est qu'un dev suppose qu'AD-6 s'applique et affiche des événements périmés sans le signaler »*. **AD-6 est fondée sur l'état d'entité et ne couvre PAS cette donnée.** Une socket WebSocket parfaitement vivante ne dit **rien** sur l'âge d'une réponse `get_events` obtenue il y a 3 heures. D'où la politique de fraîcheur explicite de la Task 3. **À vérifier explicitement en revue.**

**Le piège n°2 : `returnResponse`.** `@hakit/core` 6.0.2 a **trois surcharges** de `callService` (`HassContext.d.ts:113-119`) : avec `returnResponse: true` ⇒ `Promise<ServiceResponse<T>>` ; avec `false` ou **omis** ⇒ **`void`**. Oublier le flag ne provoque **aucune erreur de compilation visible** au premier abord — juste une réponse qui n'arrive jamais. **Vérifié dans le paquet installé**, pas supposé.

**Le piège n°3 : la plage figée au montage.** Le kiosque tourne **en permanence** (iPad mural, jamais fermé). Une plage calculée une fois au montage est fausse dès le lendemain 00:00 — la tuile afficherait indéfiniment « la journée d'avant-hier ». La date doit être **recalculée à chaque requête** et le passage de minuit doit **déclencher** une requête.

**Réutilisation — ce qui existe déjà :**
- `src/hakit/stale.ts` — **`formatSince`** (« HH:MM ») pour l'horodatage du dernier succès. Ne pas réécrire un formatteur d'heure.
- `src/hakit/useEntityValue.ts` — **le patron à imiter, pas à réutiliser** : forme du retour (`{value, isStale, loading, since}`), dernière valeur en `useRef` éphémère avec capture **après commit** (`useEffect`, jamais pendant le rendu — concurrence React).
- `src/ui/Clock.tsx:12-15` — patron du tick d'intervalle nettoyé au démontage.
- `src/widgets/TopBarWeather.tsx` / `ElectricityTile.tsx` — moule visuel exact de la chip (classes, `min-h-[56px]`, `opacity-60` si stale, `aria-label` narratif).
- `src/widgets/ConsumptionIcons.tsx` / `WeatherIcon.tsx` — gabarit des icônes SVG locales.
- `src/entities/mapping.ts` — `WeatherConfig` (`:420-451`) comme moule de config hors `ENTITIES` ; `AUX_ENTITY_IDS` (`:554`) + `assertWellFormedAuxIds` (leçon 7.1 D4).
- `src/ui/TopBarSlots.tsx` — couche de composition ; **layout-only**, ne pas la modifier.

**Nature du seam — à ne pas confondre avec NutriClaude.** AD-17 est explicite : la lecture par requête **reste dans `src/hakit/`**, **aucune exception AD-2, aucun secret client**. Ce n'est **pas** un 2ᵉ système de vérité comme `src/nutriclaude/` (AD-12) : c'est le même HA, lu autrement. Ne pas créer `src/agenda/` ni de client dédié.

**Précédent le plus proche dans le code :** `useHistory` (sparklines, Story 1.5 / `WeatherDetail.tsx:57-59`) fait déjà cohabiter **donnée récupérée** et **état reflété** dans la même page. Le lire avant d'écrire `useCalendarEvents` — mais noter qu'`useHistory` vient de `@hakit` et gère sa propre fraîcheur, alors qu'ici **c'est nous** qui la gérons.

**A11y (UX-DR14/UX-DR26/UX-DR27).** Le libellé **PROCHAIN** est obligatoire (UX-DR28). L'obsolescence est portée par **atténuation + horodatage**, pas par une couleur. L'`aria-label` raconte l'événement en clair. `tabular-nums` sur l'heure. L'état vide est **un rendu**, pas une absence.

**Rendu déterministe pour les tests.** `selectNext` prend `now` en paramètre et le départage final vient de l'ordre du mapping : deux exécutions sur les mêmes données donnent **toujours** le même résultat. Aucun `Math.random`, aucun `Date.now()` dans le pur.

### Project Structure Notes

- **NEW** : `src/hakit/useCalendarEvents.ts` (+ `.test.ts`) ; `src/widgets/agenda-select.ts` (+ `.test.ts`) ; `src/widgets/AgendaTile.tsx` (+ `.test.tsx`) ; `CalendarIcon` (SVG local — soit un `AgendaIcons.tsx`, soit ajouté à un fichier d'icônes existant selon la convention retenue au build).
- **UPDATE** : `src/entities/mapping.ts` (+ `.test.ts`) ; `src/hakit/index.ts` (export du hook) ; `src/App.tsx` (montage de la tuile) ; `docs/home-assistant.md` ; `sprint-status.yaml`.
- **Pas de route neuve, pas de page, pas de dépendance neuve.**
- **Direction de dépendance** : `widgets/AgendaTile` → `hakit/useCalendarEvents` + `entities` + `widgets/agenda-select` (pur). `agenda-select.ts` **n'importe rien de `@hakit`**.
- **Style** : Tailwind ; `tabular-nums` sur l'heure ; kiosque **1024×748 sans scroll** ; Prettier + pre-commit Husky (commit → lint-staged → typecheck → test).

### Décisions tranchées

- **Règle de sélection à 3 rangs** (Florian, 2026-07-27) : horodaté à venir → journée entière commençant aujourd'hui → multi-jours en cours → « Rien aujourd'hui ». Départage : début le plus proche, puis ordre du mapping.
- **`calendar.chats` porte les événements horodatés** (Florian) ; les 3 autres sont en journée entière. Le rang 1 est donc réellement exercé.
- **4 `entity_id` réels dès maintenant** — pas de placeholder, Task 0 HA levée.
- **Hauteur = `min-h-[56px]`** (celle des voisines), pas les 52px de UX-DR28 — l'invariant protégé est l'alignement, pas la cote.
- **La tuile est le 6ᵉ élément de la barre, pas le 5ᵉ** — l'AC de l'epic date d'avant 9.1.
- **Tuile non interactive en 10.1** ; la navigation vers `/agenda` arrive en 10.2.
- **`useCalendarEvents` vit dans `src/hakit/`** (AD-17), pas dans un seam dédié.
- **Fraîcheur = montage + 15 min + retour au premier plan + changement de date** ; jamais déduite du WebSocket.
- **`now` toujours injecté** dans le code pur (leçon 9.2).

### Décisions ouvertes / dépendances

- **Task 0 bis** (5 min) : coller la réponse réelle de `calendar.get_events` avant d'écrire le parseur. La doc HA ne formalise pas la forme des événements journée entière — **observer plutôt que supposer**.
- **Libellés des calendriers** : « Chats », « Anniversaires », « Vacances scolaires », « Jours fériés » **proposés**. Ils deviennent visibles en 10.3 (filtre, UX-DR26) — à valider avant, changer plus tard est trivial.
- **Intervalle de rafraîchissement** : **15 min** proposé (ces calendriers bougent peu ; le rang 1 vient de `chats`, où un ajout de dernière minute est rare). Réglable d'une constante ; à confirmer à l'usage.
- **Fenêtre de la tuile = aujourd'hui seulement** (plage de l'AC). Conséquence assumée : à 21h, plus rien ⇒ « Rien aujourd'hui », alors que « demain : anniversaire de X » serait peut-être plus utile. **Élargir la plage est une autre story** — ne pas le faire ici.
- **Ordre dans `TopBarSlots`** — dernier enfant proposé (comme la maquette) ; à confirmer au device-proof.
- **Collision top-bar** : si 9.2 (pill HC/HP) et 10.1 se marchent dessus, **escalader** — la première story mergée consomme le budget. Voir le risque dominant ci-dessus.
- **Tuile non cliquable en attendant 10.2** : état intermédiaire assumé. Si ça gêne, enchaîner 10.2 dans la foulée plutôt que d'ajouter une navigation ici.

### References

- [Source: epics.md#Epic 10 · #Story 10.1 · #FR-A1/FR-A4 · #AD-17 · #UX-DR25/UX-DR26/UX-DR27/UX-DR28] — _NB : l'AC « 5ᵉ élément » est **corrigée en 6ᵉ** (9.1 a livré la 5ᵉ chip) ; la cote « 52px » est **corrigée en `min-h-[56px]`** (alignement sur les voisines)._
- [Source: sprint-change-proposal-2026-07-27.md — origine Epic 10 (correct-course) : AD-17, UX-DR25-28, Task 0, séquence 10.1→10.2→10.3 ; **`:359-361` = le risque « un dev suppose qu'AD-6 s'applique »**, à vérifier en revue]
- [Source: ux-designs/ux-home-dashboard-2026-07-27/inputs/mock-agenda-approches.html `:154-171` — approche A rendue à 1024×748 ; **tracé SVG de l'icône calendrier `:164`** ; **⚠️ la maquette rend 5 chips SANS `BinTile` ni la pill HC/HP de 9.2**]
- [Source: ux-designs/ux-home-dashboard-2026-07-27/inputs/mock-agenda-detail.html — page `/agenda`, **matière de la Story 10.2**, pas de celle-ci]
- [Source: **vérifié** dans le paquet installé — `node_modules/@hakit/core/dist/types/HassConnect/HassContext.d.ts:113-119` : `callService` a 3 surcharges, **seule celle avec `returnResponse: true` renvoie `Promise<ServiceResponse<T>>`**, les deux autres renvoient `void` ; `types/types/index.d.ts:41-44` : `ServiceResponse = { context, response }`]
- [Source: **vérifié** 2026-07-27 sur https://www.home-assistant.io/actions/calendar.get_events/ — paramètres `start_date_time` / `end_date_time` / `duration` (exclusifs), cible multi-entités, **réponse keyée par calendrier avec une liste `events`**, champs `summary`/`start`/`end`/`description`/`location`, **`end` exclusive**. ⚠️ **La doc ne formalise PAS** la forme des événements journée entière ⇒ Task 0 bis.]
- [Source: src/hakit/useEntityValue.ts — **patron à imiter** : forme du retour, dernière valeur en `useRef` capturée **après commit** (`useEffect`), carve-out AD-6 sur AD-3 · src/hakit/stale.ts `:25` (`formatSince`)]
- [Source: src/pages/WeatherDetail.tsx `:57-59` (`useHistory`) — précédent « donnée récupérée + état reflété » cohabitant dans une page]
- [Source: src/widgets/TopBarWeather.tsx `:59` · ElectricityTile.tsx `:42` · TurtleTile.tsx `:81` · PlantTile.tsx `:79` · BinTile.tsx `:106` — **les 5 chips en `min-h-[56px]`**, base du Conflit de source]
- [Source: src/ui/Clock.tsx `:12-15` — patron du tick 30 s nettoyé au démontage]
- [Source: src/entities/mapping.ts `:420-451` (`WeatherConfig`, moule de config hors `ENTITIES`), `:554` (`AUX_ENTITY_IDS`), `:46` (`ENTITY_ID_RE`) · mapping.test.ts `:164`]
- [Source: src/ui/TopBarSlots.tsx (`absolute left-44`, layout-only) · src/App.tsx `:93-99` (montage des chips)]
- [Source: ARCHITECTURE-SPINE.md#AD-1 (HA vérité, app sans persistance) · #AD-2 `src/hakit/` seul seam HA · #AD-3 (reflet, pas de cache) · **#AD-4 `:70-73` (aucune logique horaire/récurrence côté client)** · #AD-6 `:80-83` (obsolescence par entité — **ne couvre pas cette donnée**) · #AD-7 `:85-88` (mapping) · #AD-8 (build sans secret) · #AD-10 (pages détail — matière de 10.2)]
- [Source: deferred-work.md `:21` — dette collision top-bar, déclencheur « 5ᵉ élément » **déjà franchi par 9.1** ; cette story ajoute la 6ᵉ]
- [Source: 9-2-heures-creuses-pleines.md — **story concurrente sur le même budget de barre supérieure** (pill HC/HP sur la chip élec) ; les deux sont `ready-for-dev`]
- [Source: 9-1-micro-tuile-electricite-conso-cout.md — moule de story ; la 5ᵉ chip et la dette collision qu'elle a déclenchée]
- [Source: memory `target-device-and-layout` (iPad 1024×768, jamais de scroll, PWA plein écran) · `name-the-instrument-before-claiming-verified` (le device-proof WebKit est l'instrument) · @hakit/core 6.0.2]

## Dev Agent Record

### Agent Model Used

claude-opus-5 (Liza Pairing, Autonomous — bmad dev-story).

### Debug Log References

_(⚠️ Task 0 bis NON FAITE : elle exige les Outils de dév HA, hors de portée de l'agent. Coller ici la réponse YAML brute de `calendar.get_events` — voir « Ce qui reste ».)_

- **Le parseur ne suppose rien** en attendant : `parseHaDate` décide « journée entière » sur la **forme** de la chaîne (`/^\d{4}-\d{2}-\d{2}$/`), accepte le séparateur espace **et** `T`, avec ou sans offset, et **rejette silencieusement** tout le reste. Si la vraie réponse a une autre forme, elle sera ignorée (tuile vide) plutôt que rendue en « Invalid Date » — le symptôme sera visible, pas trompeur.
- **Deux pièges de date traités explicitement** (aucun n'est théorique) :
  - `new Date("2026-07-28")` est lu comme **minuit UTC**, ce qui bascule sur la veille à l'ouest de Greenwich → les dates seules sont construites à partir des composants **locaux** (`new Date(y, m-1, d)`).
  - **WebKit (Safari 16.6, la cible du kiosque) rejette la forme à espace** `"2026-07-28 17:00:00"` → le séparateur est normalisé en `T` avant parsing. C'est exactement la forme que la doc HA donne en exemple, donc le bug se serait déclenché **sur l'iPad et nulle part ailleurs**.
- **`callService` typé** : la signature générique attend **3 paramètres de type**, pas 1 (`TS2558` au premier essai). Résolu par un appel sans générique + **un seul cast documenté** à la frontière ; `parseEvents` revalide tout derrière, donc rien n'est cru sur parole. `useHass((s) => s.helpers.callService)` est **confirmé par `tsc`**, pas supposé.
- **Une seule minuterie pour deux raisons** : un tick de 60 s décide s'il faut rejouer (date locale changée **ou** période écoulée). Une minuterie à 15 min aurait laissé la fenêtre décrire la veille pendant un quart d'heure après minuit.
- **Déviation assumée (Task 3)** : le hook **n'est pas exporté depuis `src/hakit/index.ts`**. Le barrel n'expose que `HakitProvider` + la config ; `useEntityValue`, `useOptimisticControl` et `stale` sont tous importés par chemin direct (`../hakit/useEntityValue`). Suivre la convention du code plutôt que la lettre de la story évite d'introduire une deuxième façon d'importer le seam. Sous-tâche laissée décochée pour que l'écart soit visible en revue.
- **Gate AD-17 vérifié** : `rg 'useEntity\(' ` sur les trois fichiers neufs ⇒ aucun résultat. Aucun événement n'est lu depuis un attribut d'entité.
- **Build AD-8** : la garde `vite.config.ts:97` fait échouer le build si `VITE_HA_TOKEN` est présent → build vérifié en déplaçant temporairement `.env.local`, **restauré et vérifié par empreinte SHA identique** (`b309fdf…`), aucun fichier de sauvegarde résiduel. `dist/` scanné : **0 JWT, 0 token, 0 mot de passe**.

### Completion Notes List

- **AC1–AC6 satisfaits côté app.** Lecture par requête (`calendar.get_events`, `returnResponse: true`, 4 entités en un appel, fenêtre locale recalculée), règle de sélection à 3 rangs, fraîcheur explicite (montage + 15 min + premier plan + bascule de date), échec ⇒ dernière réponse + atténuation, état vide rendu, empreinte constante, grille de l'accueil intacte.
- **+49 tests → 348 verts** (52 fichiers), 0 régression. Répartition : `agenda-select` 24, `useCalendarEvents` 11, `AgendaTile` 10, `mapping` 4.
- **Trois tests portent les invariants les plus fragiles**, ceux qu'une refonte casserait sans le vouloir : `returnResponse: true` est passé ; la fenêtre est **rejouée au passage de minuit** avec la **nouvelle** date ; un échec **conserve** la dernière réponse au lieu de vider la tuile.
- **Aucune modification** des 5 tuiles existantes, de `TopBarSlots`, de `Clock` ni de la grille de l'accueil. La dette collision top-bar n'a **pas** été soldée (hors scope, Rule 6) — elle est signalée.
- **Vérifié par Florian sur son Mac (2026-07-27)** : l'app tourne, la tuile s'affiche. ⚠️ **Ce n'est pas la preuve device** : un navigateur de bureau ne dit rien du kiosque (WebKit 16.6, viewport 1024×748, `BinTile` affichée). Les deux points qui ne peuvent se vérifier que sur l'iPad — **parsing des dates sous WebKit** et **collision de barre supérieure** — restent ouverts.
- **Ce qui reste (non-agent, Florian)** :
  1. **Task 0 bis** — exécuter `calendar.get_events` dans Outils de dév → Actions et coller la réponse brute ici. C'est la seule chose qui peut infirmer l'hypothèse de forme du parseur.
  2. **Preuve device** — un jour avec un rendez-vous `chats`, un jour sans, pendant les vacances scolaires, en fin de journée ; HA coupé ; **et surtout : pas de collision top-bar à 1024×748 un jour où `BinTile` est affichée** (le cas que la maquette n'a jamais mesuré).
- **⚠️ Point de coordination** : la story **9.2** est `ready-for-dev` et ajoute une pill à la chip électricité — elle consomme le **même budget de barre supérieure** que cette tuile. La première mergée le consomme ; le device-proof de la seconde doit être refait après.

### File List

**Créés :**

- `src/widgets/agenda-select.ts`, `src/widgets/agenda-select.test.ts`
- `src/widgets/AgendaTile.tsx`, `src/widgets/AgendaTile.test.tsx`
- `src/widgets/AgendaIcons.tsx` (`CalendarIcon`)
- `src/hakit/useCalendarEvents.ts`, `src/hakit/useCalendarEvents.test.ts`

**Modifiés :**

- `src/entities/mapping.ts` (`CalendarRef` + `CALENDARS` + `calendarsConfig()` + `AUX_ENTITY_IDS`) + `src/entities/mapping.test.ts`
- `src/App.tsx` (`<AgendaTile />` en dernier enfant de `TopBarSlots`)
- `docs/home-assistant.md` (§ « Agenda — calendriers Google (Story 10.1) »)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (10-1 → in-progress → review)

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-27 | 0.2 | **Implémentée (dev-story).** Fonde la **lecture par requête** (AD-17) : `useCalendarEvents` dans `src/hakit/` appelle `calendar.get_events` avec **`returnResponse: true`** (les deux autres surcharges de `@hakit` résolvent en `void` — panne silencieuse), en **un appel** ciblant les 4 entités, sur une fenêtre locale `[00:00 → 00:00)` **recalculée à chaque requête**. Fraîcheur explicite (montage + 15 min + retour au premier plan + **bascule de date locale**, une seule minuterie de 60 s décidant des deux) ; échec ⇒ **dernière réponse conservée** + atténuation, jamais de blanc. Logique pure `agenda-select.ts` (`now` toujours injecté, aucun `Date.now()`) : parsing défensif + **règle à 3 rangs**. `AgendaTile` monté **en dernier** dans `TopBarSlots` (6ᵉ élément), `min-h-[56px]` comme ses voisines, **empreinte fixe** entre chargement / peuplé / vide / hors ligne, **non interactif** (la navigation est 10.2). Mapping des 4 **ids réels** + `AUX_ENTITY_IDS`. **Deux pièges de date traités** : date seule construite en **local** (sinon bascule de jour à l'ouest de Greenwich) et séparateur normalisé en `T` (**WebKit 16.6 rejette la forme à espace** — le bug ne serait apparu que sur l'iPad). **Déviation assumée** : hook non exporté du barrel, par cohérence avec `useEntityValue`/`useOptimisticControl` (import direct) — sous-tâche laissée décochée. **+49 tests → 348 verts**, tsc/oxlint/Prettier verts, **build sans token RC=0, `dist/` sans secret**, `.env.local` restauré par empreinte, 0 régression. Reste : **Task 0 bis** (coller une vraie réponse `get_events`) + **preuve device** dont l'absence de collision top-bar **avec `BinTile` affichée**. → review. |
| 2026-07-27 | 0.1 | Story 10.1 créée (create-story). **Task 0 HA levée** : les 4 `entity_id` réels sont fournis (`chats`, `anniversaires`, `calendrier_scolaire_zone_c`, `jours_feries_et_autres_fetes_en_france`) — première story de l'epic sans placeholder. **Découverte structurante** : 3 des 4 calendriers ne produisent que des événements **journée entière**, dont des **multi-jours** (vacances scolaires couvrant 14 jours), alors que la maquette ayant fait trancher UX-DR28 montre un rendez-vous **horodaté** ; un tri chronologique naïf afficherait « Vacances » tous les matins pendant deux semaines. **Tranché avec Florian** : règle de sélection à **3 rangs** (horodaté à venir → journée entière du jour → multi-jours en cours → « Rien aujourd'hui »), `calendar.chats` portant les horodatés. **Deux corrections d'AC** consignées : la tuile est le **6ᵉ** élément de la barre (l'AC disait 5ᵉ, écrite avant 9.1) et sa hauteur suit les voisines (**`min-h-[56px]`**, pas les 52px relevés sur maquette — l'invariant protégé est l'alignement). **Risque dominant réévalué** : la barre est saturée et la maquette a mesuré 5 chips **sans `BinTile` ni la pill HC/HP de 9.2** ⇒ device-proof exigé un jour où une poubelle est due, et escalade si 9.2 et 10.1 se marchent dessus. **Vérifié dans le paquet installé** que `callService` n'expose la réponse qu'avec `returnResponse: true` (les autres surcharges renvoient `void` — panne silencieuse). **Task 0 bis ajoutée** : la doc HA ne formalise pas la forme des événements journée entière ⇒ observer une vraie réponse avant d'écrire le parseur. → ready-for-dev. |
