---
baseline_commit: 76d63400fd8a853105d931038e91c8349e3edd73
---

# Story 1.1: Scaffold & connexion Home Assistant

Status: done

## Story

As a développeur du Home Dashboard,
I want un projet Vite + React + @hakit qui se connecte à Home Assistant,
so that toutes les features suivantes disposent d'un socle connecté à la source de vérité.

## Acceptance Criteria

1. Le projet est scaffoldé en **Vite + React 19 + TypeScript + Tailwind** (base TailAdmin variante React/Vite) et produit un **build statique** dans `dist/` (aucun serveur applicatif). _(AD-9, NFR)_
2. **`@hakit/core` + `@hakit/components` 6.0.2** sont installés ; **tout accès à Home Assistant passe par un seam unique `src/hakit/`** (aucun appel REST/WebSocket ad-hoc ailleurs). _(AD-2)_
3. La connexion est alimentée par un **long-lived access token HA en config locale gitignorée** (`.env.local`, jamais commité) — ou, en variante, par la **session HA** si servi depuis HA. _(AD-8)_
4. Au démarrage, le provider **`HassConnect`** (@hakit) se connecte à HA en **WebSocket** ; une **vue de contrôle** affiche l'**état de connexion**, le **nombre d'entités** et l'**état live d'au moins une entité** (mis à jour en temps réel).
5. **Aucun secret n'apparaît dans le bundle ni dans le dépôt** : `.env.local` gitignoré, `.env.example` sans valeurs, et le token absent de `dist/`.

## Tasks / Subtasks

- [x] **Task 1 — Scaffolder le projet** (AC: 1, 2)
  - [x] ~~Scaffolder avec le starter officiel : `npm create hakit@latest`~~ → **écart documenté** : `create-hakit@1.2.3` est purement interactif et demande URL+token **au scaffold** (conflit AD-8) ; repli (déjà prévu au plan) sur `npm create vite@latest -- --template react-ts` + install explicite de `@hakit` épinglé
  - [x] Vérifier/pinner **`@hakit/core` et `@hakit/components` à 6.0.2** (= dernière version courante) et confirmer **React 19** (19.2.7 installé)
  - [x] Ajouter **Tailwind CSS** (v4 via `@tailwindcss/vite`), primaire ; Emotion isolé à `@hakit/components`. _Base TailAdmin complète = Story 1.2 (design system) ; ici seulement Tailwind câblé + primaire, cf. Dev Notes « ne pas sur-construire »_
  - [x] Configurer le **build statique** (`vite build` → `dist/`), aucune dépendance serveur
- [x] **Task 2 — Seam HA + connexion** (AC: 2, 3, 4)
  - [x] Créer le dossier **`src/hakit/`** : `HakitProvider` (HassConnect) + `config.ts` centralisant toute config de connexion
  - [x] Envelopper l'app avec `<HassConnect hassUrl={...} hassToken={...}>` (via `HakitProvider`)
  - [x] Lire `hassUrl` + token depuis un **env local gitignoré** (`VITE_HA_URL`, `VITE_HA_TOKEN`) ; variante session HA (ingress) documentée en commentaire, non implémentée
- [x] **Task 3 — Vue de contrôle « connexion »** (AC: 4)
  - [x] Écran debug (`src/ConnectionCheck.tsx`) : état de connexion, **nombre d'entités**, **état live d'une entité** témoin, via `useHass`/store @hakit (lu live, non recopié — AD-3)
  - [x] Câblage réactif du live update (le store zustand @hakit re-render sur push WS). _Observation runtime contre le HA réel = étape review (voir Task 5)_
- [x] **Task 4 — Hygiène des secrets** (AC: 3, 5)
  - [x] `.env.local` gitignoré (`git check-ignore` OK) ; `.env.example` créé (clés sans valeurs)
  - [x] Vérifié : aucun token dans `dist/` après build. **+ garde AD-8 ajoutée** dans `vite.config.ts` : `vite build` échoue si `VITE_HA_TOKEN` est présent (empêche l'inline du secret dans le bundle statique)
- [x] **Task 5 — Validation** (AC: 1–5)
  - [x] `vite build` OK (statique → `dist/`) ; `tsc -b` (typecheck) + `oxlint src` verts
  - [x] **Preuve manuelle — VÉRIFIÉE par Florian (2026-07-14)** : `.env.local` (HA URL+token) → `npm run dev` → connexion `connected`, **N entités > 0**, témoin mis à jour en live depuis le HA réel. AC4/AC5 validés en runtime.

## Dev Notes

**Portée stricte de cette story** : poser **uniquement** le socle (scaffold + Tailwind), le **seam de connexion HA**, et une **vue de contrôle** prouvant la connexion temps réel. **Pas** de widgets, pas de design system complet, pas de PWA (Story 1.2 = design system, 1.3 = shell/PWA, 1.4 = mapping, 1.5 = capteurs). Ne pas sur-construire.

**Guardrails architecture (spine) — à respecter impérativement :**
- **AD-1** : Home Assistant = source de vérité unique ; **aucun backend ni base de données propre** (le token/env local n'est pas un backend).
- **AD-2** : accès HA **exclusivement via @hakit**, concentré dans `src/hakit/` ; aucun `fetch`/WebSocket ad-hoc vers HA ailleurs.
- **AD-3** : **pas de cache persistant** de l'état d'entité — l'abonnement @hakit est la source réactive (la vue de contrôle lit l'état live, ne le recopie pas).
- **AD-8** : token = **config gitignorée injectée au runtime, jamais bundlée** ; préférer la session HA quand servi depuis HA.
- **AD-9** : **build statique** destiné à être servi depuis HA (même origine) ; aucun serveur Node.

**Stack contrainte (Stack du spine, vérifié courant) :** React **19.x** (peerDep @hakit 6.x — contrainte, pas un simple seed) · `@hakit/core` **6.0.2** · `@hakit/components` **6.0.2** · Vite · TypeScript · Tailwind/TailAdmin.

**Structural seed (spine) à amorcer** (dossiers créés au fil des stories, placeholders OK) :
```
src/
  hakit/     # CE STORY : provider @hakit + connexion (token = env gitignoré)
  entities/  # Story 1.4 — mapping entity_id ↔ pièce/widget
  state/     # Story 2.1 — couche pending
  media/     # Story 4.2 — helper média caméras
  widgets/   # Epic 2+
  pages/     # Story 1.3 + Epic 4/5
  ui/        # Story 1.2 — primitives TailAdmin/Tailwind
public/      # Story 1.3 — manifest PWA / service worker
```

**@hakit — spécificités (vérifiées sur le web) :**
- `@hakit/core` expose **`HassConnect`** ; props **`hassUrl`** + **`hassToken`** permettent de **bypasser l'écran de login** ; les tokens sont stockés par `hassUrl`.
- Scaffold officiel : **`npm create hakit@latest`** (met en place React + TypeScript + Vite + HAKit).
- L'état circule en **WebSocket** — les hooks (ex. `useEntity`) restent synchronisés sans glue supplémentaire (cohérent avec AD-3).

**Testing standards :** le spine diffère les tests (kiosque perso — voir Deferred). Minimum pour cette story : **build + typecheck verts** et **preuve manuelle** que la vue de contrôle affiche des entités réelles depuis HA. La story doit laisser le système **fonctionnel end-to-end** (l'app démarre, se connecte, affiche un état live).

### Project Structure Notes

- `npm create hakit@latest` génère une structure Vite standard ; **réorganiser vers le seam `src/hakit/`** et créer les dossiers placeholders du seed sans les remplir.
- Variance possible : le starter HAKit peut imposer sa propre arborescence — l'adapter au structural seed du spine **sans le combattre** ; documenter tout écart.
- Un long-lived token se crée dans HA (profil utilisateur → jetons d'accès longue durée) ; ne jamais le committer.

### References

- [Source: _bmad-output/planning-artifacts/architecture/architecture-home-dashboard-2026-07-12/ARCHITECTURE-SPINE.md#Design Paradigm · AD-1 · AD-2 · AD-3 · AD-8 · AD-9 · Stack · Structural Seed]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1 / Story 1.1]
- [Source: _bmad-output/planning-artifacts/prds/prd-home-dashboard-2026-07-12/prd.md#NFR1 · NFR3 · NFR5]
- [Source: _bmad-output/planning-artifacts/ux-designs/ux-home-dashboard-2026-07-12/DESIGN.md — tokens Glass Gradient (implémentés en Story 1.2, pas ici)]
- [Web: @hakit / ha-component-kit — https://github.com/shannonhochkins/ha-component-kit (HassConnect hassUrl/hassToken ; `npm create hakit@latest`)]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Liza Pairing mode, Autonomous).

### Debug Log References

- `npm create hakit@latest` (create-hakit@1.2.3) : interactif, prompt URL/token au scaffold → inutilisable non-interactivement et conflit AD-8 ⇒ repli Vite (prévu au plan).
- Build : @hakit/core émet de nombreux chunks de locales (i18n) — attendu, non bloquant.
- API @hakit vérifiée contre les types installés (pas d'invention) : `HassConnect` (hassUrl/hassToken/onReady), `useHass((s)=>s.connectionStatus|ready|entities)`, `useEntity`, `ConnectionStatus = pending|disconnected|pending-suspension|suspended|connected`.
- Faux positif corrigé : un `grep | head` masquait le code retour de grep (exit de `head`) — re-vérifié sans pipe : aucun token dans `dist/`.

### Completion Notes List

- **AC1/AC2/AC3/AC5 : satisfaits et vérifiés** (build/typecheck/lint verts, seam unique `src/hakit/`, secrets propres).
- **AC4 : code complet**, mais la **preuve live runtime** (N entités > 0 depuis le HA réel, mise à jour temps réel) reste à observer par Florian au review — non exécutable côté agent (ni HA ni token). Story en `review` = état PARTIEL honnête (T0.4).
- **Écart scaffold** : Vite `react-ts` + install `@hakit` épinglé au lieu de `create-hakit` (interactif + inline token au scaffold, contraire à AD-8). Repli explicitement prévu dans le plan approuvé.
- **Ajout au-delà des tâches littérales** : garde AD-8 dans `vite.config.ts` (échec de `vite build` si `VITE_HA_TOKEN` présent). Transforme un footgun silencieux (Vite inline `import.meta.env.VITE_*` au build) en échec bruyant. À valider/veto par Florian.
- **TailAdmin** : seul Tailwind v4 câblé (primaire) ; tokens/base TailAdmin complète = Story 1.2.
- **Dossiers seed** créés en placeholders (`.gitkeep`) : `entities/ state/ media/ widgets/ pages/ ui/` ; `hakit/` rempli.

### File List

**Créés :**
- `package.json`, `package-lock.json`
- `vite.config.ts` (+ garde AD-8), `index.html`, `.oxlintrc.json`
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- `.env.example`, `README.md`
- `src/main.tsx`, `src/App.tsx`, `src/index.css` (Tailwind v4), `src/vite-env.d.ts`
- `src/ConnectionCheck.tsx` (vue de contrôle, throwaway)
- `src/hakit/config.ts`, `src/hakit/HakitProvider.tsx`, `src/hakit/index.ts`
- `src/entities/.gitkeep`, `src/state/.gitkeep`, `src/media/.gitkeep`, `src/widgets/.gitkeep`, `src/pages/.gitkeep`, `src/ui/.gitkeep`
- `public/favicon.svg`

**Modifiés :**
- `.gitignore` (ajout node_modules/dist/secrets)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (1-1 → review)

## Change Log

| Date | Version | Description |
| --- | --- | --- |
| 2026-07-13 | 0.1 | Scaffold Vite+React19+TS+Tailwind, seam `src/hakit/` (@hakit 6.0.2), vue de contrôle connexion, hygiène secrets + garde AD-8. Build/typecheck/lint verts. Preuve live runtime en attente (review). |
| 2026-07-14 | 1.0 | **Preuve live vérifiée par Florian** (connected, entités > 0, témoin live). AC1–AC5 tous satisfaits → **Status: done**. |
| 2026-07-14 | 0.2 | Code-review (high) + corrections des 5 findings. **#1** : témoin live via `useEntity` (primitive per-entité @hakit) au lieu du sélecteur `s.entities` global — fiabilise la preuve WS d'AC4. **#2** : `isConfigured` exige URL **et** token (le variant session HA n'est pas implémenté) → message clair au lieu de l'écran de login HA. **#4** : override `VITE_HA_WITNESS_ENTITY` honoré + « not found » si typo. **#5** : `Record<ConnectionStatus, string>` (exhaustivité). **#3** : StrictMode **conservé** volontairement (le retirer masquerait un éventuel leak socket — Rule 14) + commenté. Build/typecheck/lint verts. |
