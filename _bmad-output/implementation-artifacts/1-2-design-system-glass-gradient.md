# Story 1.2: Design system « Glass Gradient »

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a développeur du Home Dashboard,
I want les **tokens** Glass Gradient et les **deux primitives de base** (Tuile appareil + Carte section) avec le plancher d'accessibilité,
so that tous les écrans suivants partagent une identité visuelle cohérente, accessible et opérable par les enfants — sans réinventer le style à chaque widget.

## Acceptance Criteria

1. **Tokens (UX-DR1).** Tous les tokens de `DESIGN.md` sont définis comme **tokens de thème Tailwind v4** (bloc `@theme`, dark unique — **pas de light mode**) et utilisables comme classes :
   - **Couleurs** : ground (`ground-indigo #1a1140`, `ground-teal #122a3a`, `ground-magenta #251034`), surfaces givrées (`card-fill`, `card-border`, `tile-fill`, `tile-border`), texte (`text #f2f4fa`, `text-muted #aab3c8`), **accents par domaine** (`accent-lights #ffb23e`, `accent-shutters #4aa3ff`, `accent-climate #35e0d8`, `accent-vacuum #a06bff`, `security-ok #38d17a`, `security-alert #ff5d5d`), stale (`stale #5b6172`, `stale-text #c2c8d6`).
   - **Rayons** : `sm 9px` / `md 14px` / `lg 20px` / `full`.
   - **Spacing** : échelle DESIGN + `grid-gap 14px`, `tile-gap 10px`, `card-padding 14px 16px`, et le plancher tactile **`target-min 48px` / `target-min-kid 56px`**.
   - **Typographie** : système sans ; échelle `clock 34`, `numeric-xl 36`, `numeric-lg 24`, `title 16`, `label 14`, `section-heading 12 UPPERCASE`, `meta 12`, `caption 11` ; **tabular-nums** disponible pour horloge/températures/consigne.
   - **Fond dégradé** ground (indigo→teal→magenta, diagonale + glows radiaux doux) disponible comme classe applicable à un conteneur plein écran.
2. **Carte section (UX-DR2).** Composant `SectionCard` : surface givrée translucide (`card-fill` + hairline `card-border` + `rounded-lg` + `backdrop-blur` + ombre douce) avec **titre de section UPPERCASE** (`section-heading`) et zone d'enfants. Jamais de fond opaque (la translucidité + blur *est* le verre).
3. **Tuile appareil (UX-DR2), 4 états.** Composant `DeviceTile` paramétré par **domaine** (`lights | shutters | climate | vacuum | security`) :
   - **default** : tuile givrée neutre, texte d'état discret.
   - **on** : teinte + **glow** de l'accent du domaine, texte d'état en accent.
   - **stale** : bordure **pointillée** `stale`, valeur `—`, **pill « Hors ligne » (label + icône) = repère PRIMAIRE** (la bordure pointillée est secondaire).
   - **kid** : cible plus haute (≥ `target-min-kid` / 92px de haut) pour Nathan & Gaspard.
   - L'accent est dérivé du domaine par **un seul mécanisme** (variable CSS par domaine — **pas** de nom de classe Tailwind construit dynamiquement).
4. **Plancher d'accessibilité (NFR2 / UX-DR14).** Sur ces primitives : tout élément interactif **≥ 48px (≥ 56px pièces enfants)** ; l'état (on/off, hors-ligne, armé) est porté par **texte + icône, jamais par la couleur seule** ; les nombres live utilisent **tabular-nums** ; le texte respecte le contraste sur le ground sombre. Ces conventions deviennent le socle hérité par tous les composants ultérieurs.
5. **Preuve visuelle + gates.** Une **vue styleguide jetable** rend le ground + `SectionCard` + `DeviceTile` (les 4 états, pour ≥1 domaine) sur le fond sombre. `npm run build` + `npm run typecheck` + `npm run lint` (oxlint src) **verts**. La styleguide sera remplacée par le vrai shell en Story 1.3.

## Tasks / Subtasks

- [ ] **Task 1 — Tokens Glass Gradient** (AC: 1)
  - [ ] Définir un bloc `@theme` Tailwind v4 avec toutes les couleurs, rayons, spacing, typo de `DESIGN.md` (voir Dev Notes → « Mapping tokens Tailwind v4 »). Emplacement : `src/index.css` (après `@import 'tailwindcss'`) **ou** `src/ui/theme.css` importé depuis `index.css`.
  - [ ] Rayons : mapper `sm/md/lg` de DESIGN sur `--radius-sm/md/lg` (**override assumé** des defaults Tailwind — on possède tout le style).
  - [ ] Plancher tactile : exposer `target-min 48px` / `target-min-kid 56px` (token spacing **ou** valeurs arbitraires `min-h-[3rem]`/`min-h-[3.5rem]` — l'invariant est le plancher, pas le nom d'utilitaire).
  - [ ] Fond ground : créer une classe composant `.bg-ground` (dégradé linéaire indigo→teal→magenta **+ glows radiaux** — multi-couche, donc classe CSS, pas un simple utilitaire `bg-linear-to-br`).
  - [ ] Confirmer **thème dark unique** : aucun token/branche light-mode.
- [ ] **Task 2 — Primitive `SectionCard`** (AC: 2, 4)
  - [ ] `src/ui/SectionCard.tsx` : props `title: string`, `children`, `className?` (passthrough). Rendu : carte givrée `card-fill` + `card-border` + `rounded-lg` + `backdrop-blur` + ombre ; titre UPPERCASE `section-heading` `text-muted`.
  - [ ] Pur Tailwind — **aucun** import `@hakit/components` / Emotion (isoler le CSS-in-JS, cf. spine).
- [ ] **Task 3 — Primitive `DeviceTile` (4 états)** (AC: 3, 4)
  - [ ] `src/ui/DeviceTile.tsx` : props `domain: 'lights'|'shutters'|'climate'|'vacuum'|'security'`, `label`, `value?`, `state: 'default'|'on'|'stale'`, `kid?: boolean`, `onPress?`.
  - [ ] Accent par domaine via **variable CSS** `--tile-accent` (voir Dev Notes → « Accent par domaine »). Interdiction du class-name dynamique `bg-accent-${domain}` (invisible au compilateur Tailwind).
  - [ ] État **on** : tint (~16% alpha) + border (~45%) + glow de l'accent + texte d'état accentué.
  - [ ] État **stale** : bordure pointillée `stale`, valeur `—`, **pill « Hors ligne » (icône + label)** primaire. **Ne construit aucune logique de détection d'obsolescence** (c'est Story 1.6) — seulement l'**état visuel** rendu quand `state="stale"`.
  - [ ] Variante **kid** : hauteur/target ≥ `target-min-kid`, label plus grand.
  - [ ] Cible tactile ≥ 48px (56 kid) ; `onPress` → `<button>` sémantique ; état par **texte + icône** (jamais couleur seule).
- [ ] **Task 4 — Vue styleguide (preuve visuelle jetable)** (AC: 4, 5)
  - [ ] `src/ui/StyleGuide.tsx` : sur `.bg-ground`, rendre une `SectionCard` contenant des `DeviceTile` dans les 4 états (au moins domaine `lights`, idéalement plusieurs domaines pour vérifier les accents), + un échantillon typo tabular-nums.
  - [ ] Câbler temporairement depuis `App.tsx` (remplace/complète `ConnectionCheck` de 1.1 le temps de la story). Marquer **jetable** (retirée en 1.3 quand le vrai shell arrive).
- [ ] **Task 5 — Validation** (AC: 1–5)
  - [ ] `npm run build` (statique) + `npm run typecheck` (`tsc -b`) + `npm run lint` (`oxlint src`) **verts**.
  - [ ] Preuve manuelle : la styleguide affiche correctement le ground, la carte givrée, et les 4 états de tuile avec les bons accents, cibles ≥48/56px, et repères non-couleur-seule.

## Dev Notes

**Portée stricte.** Cette story livre **uniquement** : les tokens + **deux** primitives (`SectionCard`, `DeviceTile`) + le plancher a11y + une styleguide jetable. **Hors scope** (stories ultérieures, ne pas construire) :
- Autres composants (`master-tile`, `room-sensor-card`, `shutter-control`, `climate-stepper`, `scene-button`, `top-bar`, `arm-tile`, `cameras-entry`, `undo-toast`) → leurs stories features (Epic 2–5).
- Shell / écran d'accueil / layout paysage / PWA → **Story 1.3**.
- Mapping `entity_id` / données live → **Story 1.4/1.5**.
- **Logique** de détection d'obsolescence → **Story 1.6** (ici seulement l'**état visuel** `stale`).
- Aucun usage de `@hakit/components`.

**Continuité depuis Story 1.1 (done).**
- Tailwind v4 déjà câblé : plugin `@tailwindcss/vite` dans `vite.config.ts`, `@import 'tailwindcss'` dans `src/index.css`. **Cette story ajoute les tokens dans un bloc `@theme`.**
- `src/ui/` existe (placeholder `.gitkeep`) — **c'est le foyer de ces primitives** (spine : `ui/` = primitives + affichage obsolescence).
- **Convention de style (spine, impérative)** : **Tailwind = primaire** ; l'Emotion interne à `@hakit/components` doit rester **isolé**, ne pas mélanger les deux systèmes. Les primitives de 1.2 sont **pur Tailwind**, zéro `@hakit/components`.
- Gate établi en 1.1 : `build` + `typecheck` (`tsc -b`) + `lint` (`oxlint src`) verts ; **tests automatisés différés** (kiosque perso, cf. spine « Deferred ») → preuve = styleguide visuelle.
- `tsconfig.app.json` a `verbatimModuleSyntax` + `noUnusedLocals` : utiliser `import type` pour les types, pas de variable inutilisée.
- Ne pas casser la garde AD-8 de `vite.config.ts` (échec build si `VITE_HA_TOKEN` présent) — sans rapport avec 1.2 mais à préserver.

**⚠️ TailAdmin — anti-disaster.** Le spine nomme « TailAdmin » comme base UI, mais l'identité **Glass Gradient** de `DESIGN.md` est **bespoke** (kiosque sombre, verre translucide). **Ne PAS installer le template TailAdmin complet** (sur-scaffold + pages démo + conflit visuel). Construire les tokens directement depuis `DESIGN.md`. TailAdmin reste au mieux une source ponctuelle d'utilitaires, jamais l'identité.

**Mapping tokens Tailwind v4 (vérifié contre `tailwindcss@4.3.2` installé).**
- Tailwind v4 = **config CSS-first** : les tokens vivent dans un bloc `@theme { --color-*: …; --radius-*: …; }` ; chaque variable génère ses utilitaires. Pas de `tailwind.config.js`.
- Couleurs : `--color-accent-lights: #ffb23e;` → `bg-accent-lights` / `text-accent-lights` / `border-accent-lights`. Idem pour tous les accents, ground, surfaces, texte, stale.
- Rayons : `--radius-sm: 9px; --radius-md: 14px; --radius-lg: 20px;` → `rounded-sm/md/lg` (override intentionnel des defaults).
- Blur : `--blur-glass: 8px;` → `backdrop-blur-glass` (ou `backdrop-blur-[8px]`).
- Dégradé : l'utilitaire v4 est **`bg-linear-to-br`** (`bg-gradient-to-*` = alias déprécié). **Mais** le ground DESIGN = linéaire **+ glows radiaux** → pas exprimable en un seul utilitaire ⇒ classe CSS `.bg-ground` dédiée (linear-gradient + 1–2 radial-gradient superposés).
- `tabular-nums` : utilitaire natif (`font-variant-numeric`) — l'appliquer à horloge/temp/consigne.
- Valeurs on-state (DESIGN) — lights p.ex. : fill `rgba(255,178,62,0.16)`, border `rgba(255,178,62,0.45)`, glow `0 0 20px rgba(255,178,62,0.15)`.

**Accent par domaine — mécanisme unique (altitude, anti-disaster).**
Tailwind **ne compile pas** les classes dynamiques (`bg-accent-${domain}` échoue silencieusement). Deux approches propres, choisir **A** de préférence :
- **A (recommandé, DRY, scale)** : poser une **variable CSS** par domaine sur la tuile, p.ex. `data-domain` → CSS `[data-domain="lights"]{--tile-accent:var(--color-accent-lights)}`, puis dériver on-state en une classe composant via `color-mix(in srgb, var(--tile-accent) 16%, transparent)` (tint), `… 45% …` (border), `0 0 20px …` (glow). Ajouter un domaine (ex. `vacuum` violet, UX-DR17) = 1 ligne. `color-mix` est supporté sur iPadOS Safari cible.
- **B (fallback, 100% statique)** : `Record<Domain, {tint:string; border:string; glow:string; text:string}>` avec des **classes littérales complètes** (Tailwind les voit). Plus verbeux, aucune dépendance `color-mix`.

**A11y (NFR2 / UX-DR14) — le socle posé ici.**
- Cibles : `min-h`/`min-w` ≥ 48px (≥ 56px si `kid`). S'applique **aussi** aux futurs boutons volet/stepper (les plus petits) — le token est le contrat.
- **État jamais par couleur seule** : on/off et stale portés par **texte + icône** (pill « Hors ligne » = label + cadenas/icône ; pas seulement la bordure grise). Pattern à répliquer pour l'alarme (Armé/Désarmé texte+cadenas) plus tard.
- `tabular-nums` sur tout nombre live (anti-jitter).
- Contraste : `text` / `stale-text` sur ground sombre (viser AA).

**Testing standards.** Tests automatisés différés (spine). Minimum : `build` + `typecheck` + `lint` verts **et** preuve visuelle via la styleguide (les 4 états + accents + plancher tactile rendus correctement sur le ground). Laisser le système **fonctionnel end-to-end** (l'app démarre et rend la styleguide).

### Project Structure Notes

- Primitives → `src/ui/` (spine). Tokens → `src/index.css` (`@theme`) ou `src/ui/theme.css` importé — choisir une **source unique**.
- Fichiers attendus (NEW) : `src/ui/SectionCard.tsx`, `src/ui/DeviceTile.tsx`, `src/ui/StyleGuide.tsx`, (+ éventuel `src/ui/theme.css`). UPDATE : `src/index.css` (tokens + `.bg-ground`), `src/App.tsx` (câbler la styleguide, temporaire).
- `src/ConnectionCheck.tsx` (1.1) est jetable : peut être remplacé ou coexister le temps de 1.2 ; sera supprimé quand le shell 1.3 arrive. Ne pas toucher au seam `src/hakit/`.
- Respecter `.gitkeep` : une fois `src/ui/` rempli, le `.gitkeep` peut être retiré.

### References

- [Source: _bmad-output/planning-artifacts/ux-designs/ux-home-dashboard-2026-07-12/DESIGN.md — tokens Glass Gradient (colors/typography/rounded/spacing/components), Do's & Don'ts]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2 · UX-DR1 · UX-DR2 · UX-DR14]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-home-dashboard-2026-07-12/ARCHITECTURE-SPINE.md#Consistency Conventions (Styling : Tailwind primaire, Emotion isolé) · Structural Seed (`src/ui/`) · AD-6 (obsolescence)]
- [Source: _bmad-output/planning-artifacts/prds/prd-home-dashboard-2026-07-12/prd.md#NFR2 (simplicité/enfants)]
- [Source: Story 1-1 (done) — Tailwind v4 câblé, gate build/typecheck/oxlint, convention import type]
- [Web/local: `tailwindcss@4.3.2` — `@theme` CSS-first tokens ; utilitaire dégradé `bg-linear-to-br` (alias `bg-gradient-to-*`)]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
