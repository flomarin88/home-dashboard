---
baseline_commit: d57fd519ff94ab81aaad815a442e21a98f94414a
---

# Story 6.4: Composition barre supérieure — `TopBarSlots` (TD-4)

Status: done

<!-- Done 2026-07-18: device-proof validated by Florian. NB: the "un-fix TopBarSlots (drop fixed)" follow-on is tracked separately (deferred-work / new story). -->

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Florian,
I want les tuiles HA de la barre supérieure disposées par une **couche de composition** plutôt que par des coordonnées `fixed` posées à la main,
so that ajouter une tuile (tortue 6.3, et au-delà) **ne provoque plus de chevauchement** et les positions ne sont plus des devinettes fragiles.

## Contexte & valeur

**Refactor — remboursement de TD-4 (payback trigger atteint).** `TECH_DEBT.md` (TD-4, l.64) fixe le déclencheur : _« a 4th HA top-bar element »_. La **tortue (6.3)** est ce 4ᵉ élément top-bar → on rembourse maintenant (décision Florian, 2026-07-17). C'est un **préalable à 6.3** (Task 4 de 6.3 consomme cette couche).

**Aujourd'hui** (`App.tsx:76-77`) : `TopBarWeather` et `BinTile` sont des **frères `fixed`** montés **sous** `HakitProvider`, chacun avec des coordonnées à la main (météo `left-44`, poubelle centrée `left-1/2`) pour éviter le chevauchement — fragile, et validé « au jugé » tant qu'on n'a pas l'iPad.

**Pourquoi `fixed` et pas dans `TopBar` ?** Contrainte **TD-1** : `TopBar` (+ `Clock`) vit **au-dessus** du gate de connexion (pour ne pas remonter à chaque reconnexion) ; les tuiles HA ont besoin de HA → elles vivent **sous** le provider. La couche de composition doit donc rester un **`fixed` sous le provider**, pas un enfant de `TopBar`.

**Refactor à comportement constant** : 6.1 (poubelle) et 6.2 (météo) doivent se comporter **à l'identique** ; seules leurs **coordonnées** changent (elles deviennent des enfants qui « flottent » dans un conteneur). Aucune nouvelle capacité produit.

## Acceptance Criteria

1. **Couche de composition `TopBarSlots` (remplace les `fixed` à la main).**
   **Given** les tuiles HA top-bar (`TopBarWeather`, `BinTile`)
   **When** l'accueil s'affiche
   **Then** elles sont disposées par **une seule région `fixed`** (flex/grid, `gap`) montée **sous le provider**, leurs enfants **s'écoulant** au lieu d'être positionnés un par un. **Aucune coordonnée par-tuile** (`left-44`/`left-1/2`/`-translate-x-…`) ne subsiste sur les tuiles.
   **And** aucun **chevauchement** avec `Clock` (gauche) ni `Alarme`/`Caméras` (droite) de `TopBar`.

2. **Comportement 6.1/6.2 préservé (aucune régression).**
   **Given** le refactor
   **When** les parcours 6.1/6.2 s'exécutent
   **Then** la poubelle (affichage conditionnel show/hide, bordure rouge oubli, confirmation `sortie` désactivée, tap→ack/sortie) et la météo (obsolescence `opacity-60`, tap→`/meteo`) se comportent **exactement comme avant** ; **les tests existants restent verts**.
   **And** quand `BinTile` renvoie `null` (aucune poubelle), le conteneur **flex ne laisse aucun trou** (l'absence d'un enfant ≠ coordonnée vide — supérieur au `fixed` actuel).

3. **Extensible + kiosque + gates.**
   **Given** `TopBarSlots`
   **When** je termine
   **Then** la couche **accepte N enfants** (la tuile tortue de 6.3 en sera un, sans retoucher la couche) ; **kiosque 1024×768 sans scroll** vérifié sur iPad ; **aucun `entity_id` touché** ; `build`+`typecheck`+`lint`+`test` **verts** ; le **pre-commit** (Prettier+oxlint+typecheck+tests) passe. **TD-4 marqué payé** dans `TECH_DEBT.md`.

## Tasks / Subtasks

- [x] **Task 1 — Composant `TopBarSlots`** (AC: 1, 3)
  - [x] `src/ui/TopBarSlots.tsx` : région **`fixed`** dans la bande top-bar (`top-6`), **`flex`** en ligne avec `gap`, positionnée dans l'espace disponible **sans recouvrir** `Clock` (gauche) ni `Alarme`/`Caméras` (droite). Rend `children`. **Pas de hook HA** (couche layout pure) — mais héberge des enfants HA, donc montée **sous le provider**.
  - [x] Ancrage retenu : **cluster centré** `fixed left-1/2 top-6 z-40 flex -translate-x-1/2 items-center gap-3` — à valider sur iPad (Task 4, preuve device).

- [x] **Task 2 — Déplacer les tuiles dans la couche** (AC: 1, 2)
  - [x] `src/widgets/BinTile.tsx` : **retiré** `fixed left-1/2 top-6 z-40 -translate-x-1/2` du `className` du `<button>` ; **tout le reste conservé** (min-h, rounded-lg, bordure oubli, disabled sortie, ✓, backdrop, logique). Tuile = **enfant flex**.
  - [x] `src/widgets/TopBarWeather.tsx` : retiré `fixed left-44 top-6 z-40` ; reste conservé (opacity obsolescence, contenu, tap→`/meteo`).
  - [x] `src/App.tsx` : les deux frères nus remplacés par `<TopBarSlots><TopBarWeather/><BinTile/></TopBarSlots>` (sous le provider) ; commentaire top-bar mis à jour (TD-1/TD-4).

- [x] **Task 3 — Préserver le comportement + tests** (AC: 2, 3)
  - [x] `BinTile.test.tsx`, `TopBarWeather.test.tsx`, `App.test.tsx` **restés verts sans modification** (aucune assertion ne portait sur une classe de position).
  - [x] Ajouté `src/ui/TopBarSlots.test.tsx` : rend ses enfants (fixed/flex) ; un enfant `null` (poubelle absente) ne casse rien / ne laisse pas de trou.

- [x] **Task 4 — Validation (gates) + preuve device** (AC: 3)
  - [x] `typecheck` + `oxlint` + suite complète **verts** (138 tests, 28 fichiers, +2 ; 0 régression) ; `build` **sans token** OK (PWA générée, AD-8 respecté) ; 0 token dans `dist/`.
  - [x] **⏳ Preuve device (Florian)** — ✅ validée 2026-07-18 (ancrage gauche météo→tortue→poubelle). _(Le décrochage au scroll → un-fix, story de suivi.)_

## Dev Notes

**Discipline refactor (Rule 6) — comportement CONSTANT.** Cette story **déplace** des tuiles existantes dans un conteneur ; elle **ne réécrit rien** et **n'ajoute aucune capacité**. **Ne PAS** modifier la logique de 6.1/6.2. Si un bug de 6.1/6.2 est repéré pendant le refactor, **le noter** (deferred-work), **ne pas le corriger inline** (intent unique, commit séparé).

**Contrainte TD-1 (ne pas la casser).** `TopBar`/`Clock` restent **au-dessus** du gate (`App.tsx:67`). `TopBarSlots` est un **`fixed` sous le provider** (là où vivent déjà les tuiles HA) — layout pur, mais ses enfants sont des tuiles HA, donc il **doit** être monté sous `HakitProvider` (dans `KioskShell`, en remplacement des deux frères `App.tsx:76-77`). Ne pas déplacer les tuiles HA dans `TopBar` (elles casseraient au reconnect).

**Positionnement — les coordonnées VONT changer, c'est le but.** Aujourd'hui météo `left-44`, poubelle centrée. Après : un **cluster flex** ; l'important est **zéro chevauchement** avec `Clock` (gauche) et `Alarme`/`Caméras` (droite de `TopBar`, en flux normal `justify-between`). Le décalage visuel des tuiles est **acceptable** (attendu) — à valider sur iPad.

**Enfants conditionnels = gain réel.** `BinTile` renvoie `null` quand aucune poubelle. En `flex`, un enfant absent **ne laisse pas de trou** (contrairement au `fixed` actuel où chaque tuile a sa coordonnée figée). C'est précisément ce que la tortue permanente (6.3) + la poubelle conditionnelle rendaient fragile.

**Réutilisation / anti-réinvention.** Les tuiles existantes gardent **toutes** leurs classes sauf l'auto-positionnement. Taille déjà harmonisée (`min-h-[48px]`, `rounded-lg`) depuis la revue 6.1 — garder cohérent. **Ne pas** créer un système de « slots nommés » élaboré : un simple conteneur `flex` de `children` suffit (YAGNI) ; 6.3 y ajoutera `<TurtleTile/>`.

**Remboursement TD-4.** Mettre à jour `TECH_DEBT.md` (TD-4 → ✅ PAID (Story 6.4)) une fois livré.

### Project Structure Notes

- **NEW** : `src/ui/TopBarSlots.tsx` (+ `.test.tsx`).
- **UPDATE** : `src/widgets/BinTile.tsx` (retirer auto-position) ; `src/widgets/TopBarWeather.tsx` (retirer auto-position) ; `src/App.tsx` (envelopper dans `TopBarSlots`) ; `TECH_DEBT.md` (TD-4 payé) ; `sprint-status.yaml` (6-4 → in-progress → review).
- **Direction de dépendance** : `App` → `ui/TopBarSlots` → (enfants) `widgets/*`. `TopBarSlots` = layout pur (`src/ui/`, à côté de `TopBar`/`Skeleton`), pas de hook HA.
- **Style** : Tailwind ; `fixed` top-bar band, `flex gap`, kiosque sans scroll.

### Décisions ouvertes / dépendances

- **Ancrage de `TopBarSlots`** : cluster centré (`left-1/2 -translate-x-1/2 flex gap-3`) vs bande dédiée entre l'heure et les contrôles de droite. Choix dev, **validé sur iPad** (le seul juge des offsets, TD-4).
- **Bloque 6.3** : la Task 4 de 6.3 (placer la tortue) attend cette couche. Faire **6.4 avant 6.3**.
- **`z-index`** : conserver un `z` suffisant (les tuiles avaient `z-40`) pour rester au-dessus du contenu de page.

### References

- [Source: TECH_DEBT.md#TD-4 (l.52-67 — extraire un `TopBarSlots` : région `fixed` flex/grid sous le provider qui dispose ses enfants HA ; trigger = 4ᵉ élément top-bar) · #TD-1 (chrome au-dessus du gate, raison des `fixed`)]
- [Source: src/App.tsx#KioskShell (l.61-89 — `TopBar` au-dessus du gate ; `TopBarWeather`+`BinTile` `fixed` sous le provider, l.76-77)]
- [Source: 6-1-sortie-poubelles.md (BinTile, `fixed left-1/2 top-6`) · 6-2-meteo-topbar-detail.md (TopBarWeather, `fixed left-44 top-6`) — tuiles déplacées ; comportement inchangé]
- [Source: 6-3-nourrir-les-tortues.md (consommateur : la tuile tortue s'insère dans `TopBarSlots`, Task 4)]
- [Source: memory target-device-and-layout (iPad 1024×768, jamais de scroll)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Liza Pairing, Autonomous — bmad dev-story).

### Debug Log References

- **Refactor à comportement constant** : les tuiles gardent tout leur `className` sauf l'auto-positionnement (`fixed left-… top-6 z-40 [-translate-x-1/2]`), déplacé dans `TopBarSlots`. Aucune logique touchée.
- **Filet de régression** : `BinTile.test`/`TopBarWeather.test`/`App.test` **verts sans retouche** (ils testent comportement/obsolescence, pas la position). +2 tests `TopBarSlots` (rendu des enfants, enfant `null` sans trou).
- **Build/AD-8** : `npm run build` échoue **si** `VITE_HA_TOKEN` est présent (garde T0.5/AD-8, pré-existant). Vérifié **sans token** en mettant `.env.local` de côté puis restauré (op exploratoire bornée, sans lecture du fichier) → build OK, PWA générée. Ne PAS contourner le garde.

### Completion Notes List

- **AC1–AC3 satisfaits (côté app).** `TopBarSlots` (couche `fixed` sous le provider, contrainte TD-1) dispose `TopBarWeather` + `BinTile` en `flex` centré ; plus aucune coordonnée par-tuile. Comportement 6.1/6.2 inchangé (tests verts). Enfant conditionnel (`BinTile`→`null`) sans trou (flex). Extensible : la tortue (6.3) s'ajoutera comme 3ᵉ enfant.
- **TD-4 remboursé** — marqué ✅ PAID (Story 6.4) dans `TECH_DEBT.md`.
- **Gates** : typecheck + oxlint + 138 tests verts ; build sans token OK ; pre-commit passe.
- **Reste (non-agent)** : **preuve device** (Florian) — valider le cluster centré à 1024×768 (offsets vs heure/contrôles de droite). Seul point pouvant demander un ajustement d'ancrage.

### File List

**Créés :**
- `src/ui/TopBarSlots.tsx`, `src/ui/TopBarSlots.test.tsx`

**Modifiés :**
- `src/widgets/BinTile.tsx` (retrait auto-position)
- `src/widgets/TopBarWeather.tsx` (retrait auto-position)
- `src/App.tsx` (enveloppe `<TopBarSlots>` + import + commentaire)
- `TECH_DEBT.md` (TD-4 → PAID)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (6-4 → in-progress → review)

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-17 | 0.3 | **Ajustement layout (retour Florian, preuve device).** `TopBarSlots` ré-ancré de **cluster centré (`left-1/2 -translate-x-1/2`) → gauche (`left-44`)** pour que la météo soit collée à l'heure. Ordre des enfants : **météo → tortue → poubelle** (poubelle à droite de la tortue, commit `b0cab0e`). Livré avec l'impl 6.3. |
| 2026-07-17 | 0.2 | **Implémentée (dev-story).** `TopBarSlots` créé (région `fixed` sous le provider, `flex` centré `gap-3`) ; `TopBarWeather` + `BinTile` déplacés dedans (auto-position retirée, comportement inchangé) ; `App.tsx` enveloppe les deux. `TECH_DEBT.md` : TD-4 → ✅ PAID. +2 tests (`TopBarSlots`), 138 verts, 0 régression, build sans token OK. Reste : preuve device (Florian). → review. |
| 2026-07-17 | 0.1 | Story 6.4 créée (correct-course, remboursement TD-4) — **couche de composition `TopBarSlots`** : région `fixed` sous le provider (contrainte TD-1) disposant `TopBarWeather` + `BinTile` en `flex` au lieu de coordonnées `fixed` à la main. Refactor **à comportement constant** (aucune régression 6.1/6.2), **préalable à 6.3** (la tortue = 4ᵉ élément = trigger TD-4). Enfants conditionnels sans trou (flex). Discipline : intent unique, commit séparé, pas de correction de bug inline. → ready-for-dev. |
