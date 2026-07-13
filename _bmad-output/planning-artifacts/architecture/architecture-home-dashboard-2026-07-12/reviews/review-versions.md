# Review — Version & Technology Reality-Check

**Reviewer lens:** Verify every named technology was reality-checked against current sources, not asserted from training data.
**Date:** 2026-07-12
**Target:** `ARCHITECTURE-SPINE.md` (Home Dashboard v1)
**Method:** Live web + npm registry API queries (2026-07-12). Sources listed per finding.

---

## VERDICT

**PASS with minor caveats.** Every named technology exists, is current, and fits the stated goal (personal iPad kiosk over Home Assistant). Versions in the Stack table are accurate. The "no-backend static SPA + long-lived token" approach is genuinely viable with @hakit. Two things to make explicit rather than fix: @hakit is effectively a solo-maintainer project with its last release ~4 months old (maintenance/bus-factor risk), and cross-origin dev/deploy against HA needs `http.cors_allowed_origins` — which AD-9 (same-origin serving) neatly sidesteps in production but not during Vite dev.

---

## Findings

### 1. `@hakit/core` / `@hakit/components` 6.0.2 — CONFIRMED CURRENT ✅
- **Claim:** spine lists both at `6.0.2`.
- **Verified:** npm registry API (`registry.npmjs.org/@hakit/core`) — `dist-tags.latest = 6.0.2`, published **2026-03-02**. 83 total versions; last stable line is 6.0.1 → 6.0.2. Package exists, is real, and is the current latest.
- **Note:** A web-search snippet claimed "last published a month ago" and a GitHub-releases fetch claimed "March 2, 2024" — both are noise/misreads. The registry is authoritative: **2026-03-02**. Version number in the spine is correct; no change needed.

### 2. React 19 is a HARD peer dependency of @hakit 6.x — STRENGTHENS the spine ✅
- **Claim:** "React 19.x (seed)" — presented as a chosen seed.
- **Verified:** `@hakit/core@6.0.2` peerDependencies include `react: >=19.x`, `react-dom: >=19.x`, plus `home-assistant-js-websocket >=9.x`, `zustand ^5.0.5`, `@emotion/react >=11`, `@emotion/styled >=11`, `@iconify/react >=5`.
- **Implication:** React 19 is not merely a seed choice — it is **required** by @hakit 6.x. That's good (aligned), but the spine should note it as a *binding constraint*, not a swappable seed. Downgrading React would break the core dependency (AD-2).

### 3. @hakit uses Emotion (CSS-in-JS) internally — minor friction with Tailwind/TailAdmin ⚠️ (low)
- **Observed:** `@hakit/components` depends on `@emotion/react` + `@emotion/styled`. The spine pairs `@hakit/components` with Tailwind + TailAdmin.
- **Impact:** Two styling systems coexist (Emotion for @hakit widgets, Tailwind for shell/TailAdmin). Functionally fine and common, but expect some visual-consistency work to make @hakit components match the TailAdmin look. Not a blocker; worth a one-line acknowledgment in Consistency Conventions.
- **Fix (optional):** Either theme @hakit components via its ThemeProvider to match TailAdmin tokens, or use `@hakit/core` hooks only and build widgets with Tailwind, treating `@hakit/components` as optional. Decide early to avoid double-styling churn.

### 4. No-backend static SPA + long-lived token — VIABLE ✅ with a CORS caveat
- **Claim (AD-1, AD-8, AD-9):** static Vite build, served same-origin as HA, single long-lived access token on the iPad, no app backend.
- **Verified:** @hakit/core wraps the official HA WebSocket API (`home-assistant-js-websocket`) for auth/state/actions; long-lived tokens are a first-class HA auth mechanism (valid 10 years, created in the user profile). @hakit supports connecting with a supplied token — no interactive login required. The whole point of @hakit is building a *separate* React dashboard against HA, so this pattern is exactly its intended use.
- **CORS caveat (real, actionable):** @hakit does **not** require same-origin, but connecting from a *different* origin to HA needs `http.cors_allowed_origins` set in HA `configuration.yaml`. AD-9 (serve same-origin as HA — add-on / `www` / static host on the Pi) **eliminates this in production** — good call. BUT during development the Vite dev server runs on a different origin (`http://localhost:5173`), so **you will need `cors_allowed_origins` including the dev origin** to talk to HA while developing. Add this to the setup/deferred notes so it isn't discovered painfully.
- **Second caveat:** long-lived token in browser storage on the iPad = a 10-year, full-user-permission credential sitting on the device. The spine already acknowledges this (security deferred, LAN-only). Acceptable for a single-home hobby kiosk; just confirm the iPad isn't left where the token can be extracted, and prefer same-origin so the token isn't sent cross-origin.

### 5. Vite + React + Tailwind/TailAdmin — CURRENT AND BLESSED ✅
- **Verified:** @hakit's own `create` wizard scaffolds **React + TypeScript + Vite + HAKit** — Vite is not just sane here, it's the project's blessed path. Tailwind CSS is current. **TailAdmin** ships an official free **React + Vite + Tailwind** variant (`TailAdmin/free-react-tailwind-admin-dashboard`), now at V2.0 with a React build. All three exist and are maintained. No change needed.
- **Minor:** TailAdmin V2 targets Tailwind v4-era tooling; just pin Tailwind and TailAdmin versions together at scaffold time to avoid a v3/v4 config mismatch.

### 6. iPad PWA + Guided Access kiosk — REAL AND CORRECT PATH ✅
- **Claim:** "PWA plein écran + Guided Access"; Fully Kiosk unavailable on iOS.
- **Verified:** Fully Kiosk Browser is **Android-only** — correct, it is not on iOS. On iPadOS the standard kiosk recipe is exactly: install the PWA (Add to Home Screen, `display: standalone` manifest) + lock with **Guided Access** (single-app accessibility lock). This is the documented community approach. Viable.
- **Context worth adding (not a problem):** As of HA/Companion **2026.7.0+**, the official HA iOS Companion app now has a native Kiosk mode Labs feature. That's for the *HA app's own dashboards*, not a custom @hakit SPA — so for this project PWA + Guided Access remains the right path. Mentioning it lets the owner make an informed choice (custom SPA vs. native app kiosk).
- **Watch-item:** iOS may reload a standalone PWA after memory eviction; ensure the long-lived token persists in `localStorage` (it does across reloads) so the kiosk re-connects without interaction — this aligns with AD-8's "no interactive login."

---

## Corrected / Confirmed version numbers

| Item | Spine says | Reality (2026-07-12) | Status |
| --- | --- | --- | --- |
| @hakit/core | 6.0.2 | 6.0.2 (pub 2026-03-02) | ✅ correct |
| @hakit/components | 6.0.2 | 6.0.2 (pub 2026-03-02) | ✅ correct |
| React | 19.x seed | 19.x **required** by @hakit 6.x peerDep | ✅ correct (make it a constraint, not a seed) |
| Vite | courant | current; @hakit create-wizard default | ✅ correct |
| Tailwind / TailAdmin | courant | current; official React+Vite variant (V2) exists | ✅ correct |
| iPad PWA + Guided Access | kiosk path | valid; Fully Kiosk is Android-only (correct) | ✅ correct |

## Maintenance / risk flag (not a version error)

`@hakit` is a **single-maintainer** project (shannonhochkins) with its latest stable **~4 months old** at review time (2026-03-02). Not abandoned, but for a build that makes AD-2 "connect to HA *exclusively* via @hakit" a hard invariant, note the bus-factor: if @hakit stalls against a future HA breaking change, the fallback is dropping to `home-assistant-js-websocket` directly (which @hakit already wraps). Cheap insurance: keep HA-access behind the `src/hakit/` seam (the spine already does this), so a swap stays contained.

## Sources

- https://www.npmjs.com/package/@hakit/core , https://www.npmjs.com/package/@hakit/components
- registry.npmjs.org/@hakit/core (JSON API, queried 2026-07-12) — latest 6.0.2, published 2026-03-02, React >=19 peer dep
- https://github.com/shannonhochkins/ha-component-kit
- https://developers.home-assistant.io/docs/auth_api/ , https://www.home-assistant.io/docs/authentication/
- https://www.home-assistant.io/integrations/http/ (cors_allowed_origins)
- https://companion.home-assistant.io/docs/integrations/ios-kiosk-mode/
- https://timmyomahony.com/blog/kiosk-mode-on-ipads-with-pwa/
- https://github.com/TailAdmin/free-react-tailwind-admin-dashboard , https://tailadmin.com/react
