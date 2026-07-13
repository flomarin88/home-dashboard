# Review — Good-Spine Rubric Walker

**Target:** `ARCHITECTURE-SPINE.md` (Home Dashboard v1)
**Reviewer role:** Good-Spine Rubric Walker
**Date:** 2026-07-12
**Context weighting:** Personal hobby project — iPad kiosk React SPA (Vite) over Home Assistant via `@hakit`; HA is sole backend; v1 = domotics only. Rigor kept proportionate.

**VERDICT: minor** — a well-formed, coherent spine. Real divergence points are fixed by enforceable ADs. A handful of owned dimensions are under-specified (camera media path, deploy/update mechanism, secret handling); none let two v1 units diverge silently in a damaging way.

---

## 1. Does it fix the real divergence points for the level below, missing none?

Mostly yes. The spine nails the divergences that matter for a multi-widget thin client:

- **State authority** (AD-1, AD-3) — single reactive source, no parallel store. This is the #1 divergence a dashboard-of-widgets would otherwise suffer. Fixed.
- **HA I/O** (AD-2) — one access layer, no ad-hoc connections. Fixed.
- **Optimistic-action behavior** (AD-5) — every control widget behaves identically (immediate feedback → reconcile → rollback+signal). This is a genuine cross-widget divergence and it's pinned. Strong.
- **Disconnect behavior** (AD-6) — one degradation rule, no per-widget improvisation, no blank screen. Fixed.
- **entity_id mapping** (AD-7) — single source, entity_id as integration contract. Fixed.
- **Dependency direction** — the second mermaid graph + AD-7 give a clear allowed-dependency shape (Widgets → @hakit layer → HA; EntityMap → @hakit). Fixed.

**Gap — camera media path (FR8).** AD-2 is absolute ("uniquement via `@hakit`, aucun appel REST/WebSocket ad-hoc"). But live camera streaming and event history through HA typically ride HA-specific endpoints (`/api/camera_proxy`, `stream`/HLS, or WebRTC/go2rtc URLs) that `@hakit` hooks may not fully wrap. Any *working* camera implementation risks technically violating AD-2, or silently carving an undocumented exception — which is exactly the divergence AD-2 exists to prevent. The FR8 `[À RISQUE]` flag and the deferred spike acknowledge the *feasibility* risk but not this *invariant* tension. **This is the sharpest finding.**

## 2. Is every AD's Rule enforceable and does it prevent its stated divergence?

| AD | Enforceable? | Prevents its divergence? |
| --- | --- | --- |
| AD-1 source of truth | Yes (review/lint on stores) | Yes |
| AD-2 @hakit-only I/O | Yes (grep/lint for fetch/ws) | Yes — **except camera media, see §1** |
| AD-3 single reactive source | Yes (review) | Yes |
| AD-4 zero client automation logic | Yes (review) | Yes |
| AD-5 optimistic + reconcile | Yes (shared control primitive) | Yes — strongest cross-unit rule |
| AD-6 disconnect degradation | Yes (shared UI wrapper) | Yes |
| AD-7 entity_id mapping | Yes (single config module) | Yes |
| AD-8 long-lived token | Yes | Yes — but see secret-handling note §6 |
| AD-9 static, same-origin | Partially — topology decided, **mechanism left as 3-way OR** | Prevents phantom app-server; deploy/update mechanism undecided (§6) |
| AD-10 composed home + deep routes | Yes | Yes |

All rules are observable/review-checkable — appropriate for a solo project (no need for automated fitness functions). No rule is vacuous.

## 3. Could anything under Deferred let two units diverge silently?

No. Deferred items are cleanly future-scoped and preserve the v1 invariants:

- **Family coordination v2 → HA-native primitives first** (To-do entities, `input_boolean`/`input_datetime`) — keeps AD-1 single-source-of-truth intact. Good.
- **Backend+DB** deferred behind an explicit trigger (structured recipes/meal-planning/chore history). Trigger stated → real debt, not denial.
- **Rules-editing UI / Voice v2** — both reflect-not-implement, consistent with AD-4/AD-1.
- **Arlo live spike / snapshot fallback** — single page, one decision; fallback affects one page's implementation, not cross-unit contracts.
- **Tests/observability "minimal"** — proportionate for a personal kiosk; absence of tests does not cause architectural divergence.
- **Security hardening deferred** — accepted for LAN mono-foyer (see §6 caveat).

None of these create a shared-state or shared-behavior surface where two v1 units could quietly disagree.

## 4. Is named tech verified-current?

- **`@hakit/core` / `@hakit/components` 6.0.2** — **verified current** against npm registry (`registry.npmjs.org/@hakit/core/latest` → `6.0.2`) on 2026-07-12. Correct and pinned.
- **React 19.x (seed)** — current major line; fine as a seed.
- **Vite / TypeScript "courant" (seed)** — acceptable; marked as seed.
- **Tailwind CSS + TailAdmin (React/Vite variant) "courant" (seed)** — TailAdmin ships a React/Vite variant; plausible and current.
- The **SEED disclaimer** ("vérifié courant à la rédaction ; le code en devient propriétaire une fois écrit") is the right stance — versions get pinned at first build. No stale or unverified-and-load-bearing tech found.

## 5. Spec coverage (FR1–FR9, NFR1–NFR5)

**FRs — fully covered** via the Capability → Architecture Map (FR1–FR9 each mapped to a home + governing ADs). FR8 correctly carries the risk flag.

**NFRs:**
- NFR1 (rapidity/<1s hot, <200ms feedback) — AD-5 + FR9 row. Covered.
- NFR2 (children simplicity) — mapped to FR9 row. Note: not structurally enforceable by the spine (it's a UX-spec quality); acceptable to leave to UX, but worth an explicit "owned by UX spec, not spine" pointer.
- NFR3 (always-on, no re-auth) — AD-8. Covered.
- NFR4 (robustness/last-known-value) — AD-6. Covered well.
- **NFR5 (LAN-first, low latency)** — **no dedicated AD binds it.** It is *implicitly* satisfied by AD-9 (same-origin on the Pi = local) + AD-6 (cloud-source staleness handled). The binding is real but unstated; add a one-line note that LAN-local operation is a property of the AD-9 topology so NFR5 isn't orphaned.

## 6. Every owned dimension decided/deferred/open? (esp. operational/environmental envelope)

The altitude (initiative) owns: module boundaries, dependency direction, state authority, error/degradation, auth, tech stack, **and the operational/environmental envelope**. Walking that envelope:

- **Deployment topology** — DECIDED (AD-9: static, same-origin).
- **Infra/provider** — DECIDED (Raspberry Pi + HA; iPad/iPadOS PWA + Guided Access).
- **Deploy/update mechanism** — **UNDER-DECIDED.** AD-9 offers "add-on / dossier `www` / host statique sur le même Pi" as an unresolved 3-way OR. It's named (not silent) but should be resolved to one target before build, or explicitly marked OPEN with a decision trigger.
- **PWA update / service-worker caching strategy** — **effectively silent.** The seed lists a PWA manifest and NFR1 (hot-start <1s) + AD-6 (offline last-known-value) both imply a caching/update policy, yet no AD governs it. For a kiosk that is "toujours allumé," how the app updates (and whether a stale service-worker cache can pin an old build) is a genuine owned dimension. Decide or explicitly defer.
- **Secret / token handling** — **under-specified + minor security note.** The Structural Seed places the HA long-lived token config in `src/hakit/`. Two concerns: (a) no rule states the token is git-ignored / injected at runtime rather than committed; (b) a *static, same-origin* bundle bakes any embedded token into readable client JS. Both are **accepted-risk-tier for a LAN mono-foyer** (and "Durcissement sécurité" is explicitly deferred), but the spine should (i) state the token lives in a gitignored/local config, and (ii) note that same-origin-from-HA actually enables using HA's own session/ingress auth as a lower-exposure alternative to a baked token.
- **Environments (dev vs kiosk)** — not addressed; for a solo project a single environment is fine, but local dev connects to HA with a token too — same handling note applies.

No *whole* dimension is entirely silent-and-unnamed: the operational envelope is present via AD-9 + seed, just partially under-decided. That keeps this at **minor**, not needs-work.

---

## Findings (ranked)

1. **[MEDIUM] AD-2 vs FR8 camera media.** Live stream / event history through HA use HA-specific endpoints (`camera_proxy`, HLS/WebRTC) that `@hakit` may not wrap; AD-2's absolute "no ad-hoc REST/WS" carves no exception, so any working camera impl risks silently violating it. **Fix:** add a media-path sub-rule to AD-2 — route camera media through a single defined helper (@hakit camera card or one documented HA-endpoint wrapper), keeping the "one access layer" spirit.
2. **[MEDIUM] Deploy/update + PWA cache dimension under-decided.** AD-9's 3-way OR is unresolved and no rule governs service-worker caching/update, though NFR1 hot-start + AD-6 offline imply one. **Fix:** pick one deploy target and state the PWA cache/update policy (e.g., network-first for app shell, or a versioned-cache bust), or mark explicitly OPEN with a trigger.
3. **[MEDIUM] Token/secret handling unstated.** Seed puts the HA long-lived token in `src/hakit/` with no rule it's gitignored/runtime-injected; a static same-origin bundle also bakes the token into readable JS. **Fix:** state token = local gitignored/runtime config (never committed); note same-origin enables HA session/ingress auth as a lower-exposure alternative. (Consistent with the already-deferred "Durcissement sécurité.")
4. **[LOW] NFR5 has no binding AD.** LAN-first low-latency is only implicitly met via AD-9 + AD-6. **Fix:** one-line note binding NFR5 to the AD-9 topology so it isn't orphaned.
5. **[LOW] NFR2 enforcement location unstated.** Children-simplicity is an owned quality the spine can't structurally enforce. **Fix:** one-line pointer that NFR2 is owned by the UX spec, not the spine.

**Overall:** Coherent, proportionate, enforceable. Ship after addressing findings 1–3 (or explicitly accepting them); 4–5 are cosmetic.
