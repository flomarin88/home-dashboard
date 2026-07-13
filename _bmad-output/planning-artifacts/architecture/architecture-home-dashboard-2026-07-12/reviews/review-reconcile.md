---
title: Reconciliation Review — PRD vs Architecture Spine
type: architecture-review
subtype: reconcile
target: ARCHITECTURE-SPINE.md
against: prd.md
reviewer: subagent (read-write, review-file only)
created: 2026-07-12
verdict: MOSTLY-RECONCILED — 1 real UX-constraint gap, 2 minor governance thin-spots
---

# Reconciliation — PRD → Spine

Question: what in the PRD did **not** land in the spine? Context: personal hobby
project; spine deliberately terse. Only real omissions reported below.

## Method / Sources

Based on: full read of ARCHITECTURE-SPINE.md and prd.md (this session). Traced every
v1 FR (FR1–FR9) and NFR (NFR1–NFR5) plus the three named PRD decisions
(scenes-in-HA, Arlo at-risk/snapshot fallback, local-network + cloud caveat) into the
spine's ADs, Consistency Conventions, Capability→Architecture Map, and Deferred list.

## What reconciled cleanly (no action)

- **FR1–FR9** all appear in the Capability→Architecture Map with a home and at least
  one governing AD. FR7 (armer/désarmer) and FR8 (caméras) correctly match the PRD
  numbering (FR7 = arm/disarm on home screen; FR8 = dedicated camera page).
- **Scenes-in-HA decision** — reflected: AD-4 ("toute logique ... ou scène vit dans HA")
  + FR5 map row → "appel scène HA", governed AD-4.
- **Arlo at-risk / snapshot fallback** — reflected: FR8 map row tagged `[À RISQUE]`,
  and Deferred bullet "Faisabilité flux live Arlo via HA (FR8 [À RISQUE]) — spike à
  statuer tôt ; repli snapshots." Matches PRD §5 SPIKE and FR8 fallback verbatim in
  intent.
- **Cloud caveat portion of NFR5** — reflected: AD-6 explicitly states "Les sources
  cloud (Netatmo/Arlo) relèvent du même indicateur si le net tombe."
- **NFR3 (always-on, no re-auth)** — reflected: AD-8 (long-lived token, no interactive
  login) + Stack row "iPad / iPadOS — PWA plein écran + Guided Access."
- **NFR4 (robustesse HA, last-known + staleness, never blank)** — reflected: AD-6 verbatim.
- **v2 family-coordination layer** — correctly deferred (Deferred section, first bullet)
  with HA-native persistence stance matching PRD §2 and the §5 PM note.
- **NFR1 <200 ms action feedback** — reflected: AD-5 ("retour visuel immédiat
  (<200 ms, NFR1)").

## Gaps (real omissions)

### G1 [MEDIUM-HIGH] — NFR2 (child usability) is bound but effectively un-governed

`binds:` lists NFR2 and the FR9 map row references it, but there is **no AD and no
Consistency-Convention row** that encodes NFR2's substantive design constraints:
**large touch targets, shallow navigation, controlled information density** ("utilisable
par un enfant de 5 ans"). AD-10 partially covers the shallow-nav aspect (deep nav must
not break glanceable), but the touch-target-size and info-density constraints — the core
of the anti-objective "illisible / inutilisable avec les enfants" — have no home. This
is exactly the class of UX constraint architecture tends to silently drop. For this
product it is a first-order requirement, not a nicety.

- **Impact:** widgets can be built AD-compliant yet violate the single loudest product
  principle; nothing in the spine would flag it.
- **Suggested fix:** add one AD (e.g. "AD-11 — Contraintes d'affordance kiosque
  enfant-friendly: cibles tactiles ≥ Nn px/pt, densité d'info plafonnée, nav ≤ 1 niveau
  depuis l'accueil pour tout contrôle primaire") **or** a Consistency-Convention row
  "Affordance / densité". Even one terse line closes it.

### G2 [LOW-MEDIUM] — NFR1 warm-interactive "<1 s" budget has no governance

The spine captures the <200 ms feedback (AD-5) but not the other half of NFR1: warm
state, home screen "interactif en moins d'1 seconde." AD-9 (static build, same origin)
supports it implicitly but nothing states or defers the 1 s budget.

- **Suggested fix:** one clause on AD-9 or a convention row ("chargement à chaud < 1 s
  = objectif; mesure différée"), or an explicit Deferred line if measurement is punted.

### G3 [LOW] — NFR5 local-network primary/low-latency path not explicitly bound

NFR5's cloud caveat lives in AD-6, but its primary assertion — pilotage/affichage
fonctionne sur le **réseau local** à faible latence — is bound in front-matter yet
governed by no AD (AD-9 covers deployment topology/same-origin, not the LAN-latency
guarantee). Largely implied by the topology, so low severity.

- **Suggested fix:** append to AD-9 a note that the primary control path is LAN
  (iPad + HA co-located), or add NFR5 to AD-9's Binds.

## Non-gaps considered and dismissed

- FR2/FR4 "par groupe" — groups are HA entities; covered by AD-7 mapping. Not a gap.
- FR3 intensité/couleur — inside `widgets/ (lumières)`, AD-4/AD-5/AD-7. Not a gap.
- Terseness of Deferred/observability/security — deliberate per project context; not
  omissions.
