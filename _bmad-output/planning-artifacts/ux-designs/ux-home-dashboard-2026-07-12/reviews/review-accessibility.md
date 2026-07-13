---
name: Accessibility & Usability Review — Home Dashboard
reviewer: accessibility/usability lens
scope: DESIGN.md + EXPERIENCE.md (UX spines)
critical-lens: NFR2 — usable by a 5-year-old, reachable & operable by a 3-year-old (kids ACT, no restriction)
date: 2026-07-13
---

# Accessibility & Usability Review

Product: always-on iPad kitchen kiosk (landscape, 0–1m) over Home Assistant. Users
include Nathan (5) and Gaspard (3), who operate any control with no lock. Single dark
theme is an accepted design choice and is **not** treated as a finding. This is a hobby
kiosk, so the bar is "an owner would regret missing this," not WCAG-AAA.

Overall the spines do many a11y things right: state is never carried by color alone
(icon + label + state text accompany the accent tint), tabular-nums are mandated on all
live numbers, optimistic tap feedback is defined at <200ms, navigation is genuinely
shallow (home + one level), and offline entities keep last-known value instead of
blanking. The findings below are the gaps that matter for the kid lens.

---

## Findings

### 1. HIGH — Shutter control buttons (34px) are the smallest targets and the kid boost doesn't reach them

`shutter-control.buttonHeight: 34px` (radius `sm` 9px), three buttons in a row
(down / pause / up). 34px is **below the Apple ~44pt minimum**, and on iPad CSS-px ≈
points, so this is genuinely ~34pt of physical target. These are also the *only* way to
drive shutters, and shutters are explicitly a kid-operable control (Nathan/Gaspard
bedrooms).

Worse, the kid accommodation — `device-tile-kid.minHeight: 92px` — applies to the
*toggle tile* height, not to the shutter sub-buttons inside it. So on the exact rooms
where a 3-year-old acts, the actual hit targets stay at 34px. A 3-year-old's finger pad
is large and imprecise; three 34px buttons packed together invites mis-taps (hitting
"up" instead of "pause").

Also: every component specifies `minHeight` but **no min width**. A tall, narrow button
is still hard to hit. Down/pause/up have no width floor.

**Fix:** Raise shutter buttons to ≥48px (56px on kid rooms), specify a min *width*
(e.g. ≥56px), and add spacing between the three so an off-center tap doesn't land on the
neighbor. Consider making "up/down" the large primary pair and "pause" secondary rather
than three equal small buttons.

---

### 2. HIGH — Stale/offline treatment is the least legible state yet carries the info that matters most

`colors.stale: #5b6172` is used as the foreground for the "—" value and offline text.
Measured against the darkest ground band (~#122a3a) that text lands at **≈2.4:1
contrast — below even the 3:1 large-text/non-text floor.** It is also rendered small:
the "Hors ligne · dernière donnée HH:MM" line sits at `meta`/`caption` size (11–12px).
So the one moment a viewer needs to read carefully — "is this number real or an hour
old?" — is when the text is both faintest and smallest.

Compounding it: the stale *signal* is a dashed `#5b6172` border vs the normal solid
`rgba(255,255,255,0.10)` hairline. Both are thin and near-invisible at 0–1m, so
distinguishing **stale vs simply off** relies on two faint hairline treatments plus a
faint value. The "Hors ligne" pill is the one genuinely readable cue and it's currently
secondary to the color.

**Fix:** Keep the dashed border as the machine-distinct signal, but (a) lift the stale
*text* to at least `text-muted` legibility (~4.5:1; #aab3c8 already measures ~7:1) so the
timestamp is readable, and (b) make the "Hors ligne" pill the primary, always-visible
offline indicator rather than leaning on the muted color. Reserve #5b6172 for the border
chrome only, not for text a human must read.

---

### 3. MEDIUM — Alarm arm/disarm state is ambiguous: green means both "armed-ok" and "disarmed-safe"

`security-ok #38d17a` is documented as covering **both** "armed" and "disarmed-safe,"
and the arm-tile shows a green dot + glow that "toggles to red on alert." That means the
two everyday states a parent (or a kid who just tapped it) most needs to distinguish —
**currently armed vs currently disarmed** — are both green with a glow. Nothing in the
spec guarantees a non-color indicator of the *current* armed state; the only color change
is the exceptional alert (red).

Given kids can disarm with no lock and the accepted risk that a 3-year-old could do so,
the owner will want to glance and know "is it actually armed right now?" A same-color
tile doesn't answer that.

Also, green/red for ok/alert is the classic colorblind-ambiguous pair; low stakes for a
known owner, but trivially fixed with an icon.

**Fix:** Give the arm tile an explicit, color-independent current-state indicator —
"Armé" vs "Désarmé" text and/or a lock-closed/lock-open icon — so state is legible
without relying on the green/green/red distinction. Pair the alert state with an icon +
word, not red alone.

---

### 4. MEDIUM — The UNDO safety net (the only thing standing between a kid tap and "tout fermer / désarmer") is underspecified

The owner explicitly accepted that a 3-year-old could disarm the alarm or close all
shutters, with a "few-seconds Annuler toast" as the universal safety net. That makes the
toast a load-bearing safety control — yet it has **no defined dwell time, no target size,
and no contrast spec.** "A few seconds" auto-dismiss is easy for a distracted parent (or
the toddler who caused it) to miss, and a small/low-contrast Annuler button on the dark
ground would be hard to hit in the window that exists.

**Fix:** Specify the undo affordance concretely for the high-impact actions ("Tout
fermer", "Désarmer", scene applies): a generous dwell (e.g. ≥6–8s, or persist-until-
dismissed for alarm disarm), a large high-contrast "Annuler" tap target (≥52px, same
floor as scene buttons), and a clear countdown or progress cue so the window is visible.
The accepted kid-risk is only as safe as this toast is reliable.

---

### 5. MEDIUM — Density claim is self-contradictory and the one no-scroll screen risks the "info overload" anti-goal for kids

The a11y floor says "**low information density**"; DESIGN.md says "**medium density**."
Meanwhile the home screen packs, with no scroll: top bar (clock + date + arm + cameras),
scenes row, 4 Netatmo room cards each showing **temp + CO₂ + humidity** (three numbers
×4 rooms), lights master + per-room, shutters master + per-room, and climate — all at
once. The explicit anti-goal is "info overload / unusable by kids." A wall of numbers is
exactly what a 3–5-year-old cannot parse, and the CO₂/humidity meta in particular is
parent-only data occupying kid-facing real estate.

This isn't a call to cut features, but the two spines disagree on the target and the
kid-facing screen hasn't been separated from the parent-facing data.

**Fix:** Reconcile the density statement (pick one and make both spines agree), and
confirm the per-room CO₂/humidity meta earns its place at 0–1m for the kid lens — or
demote it (secondary size, or into the room-detail page) so the home screen's primary
read is the big, tappable, kid-legible controls.

---

## Lesser notes (not ranked)

- **Scene/navigation tap confirmation.** Device tiles get a defined <200ms tint+glow, but
  a scene button and room/cameras navigation taps have no described *own* press state —
  the only feedback for a scene is the (possibly off-zone) devices reacting. A kid tapping
  "Petit déjeuner" benefits from the button itself acknowledging the press. Add a pressed
  state to scene buttons and nav entries.
- **master-tile has no minHeight** while device-tile (74) and device-tile-kid (92) do.
  It's a large control; give it an explicit floor for consistency.
- **Glanceability of meta at 0–1m.** 11px caption / 12px meta is readable at arm's length
  but is the floor; anything a parent must actually read (offline timestamp — see #2)
  should not live at caption size.

## What's already good (keep)

- State never by color alone (icon + label + state text) — explicitly stated and correct.
- Tabular-nums mandated on clock, temps, setpoint — prevents jitter, aids glanceability.
- Optimistic <200ms visual feedback — answers "did my tap work?" well for device tiles.
- Genuinely shallow nav: home + one level (room detail / cameras), tap-only, no hover /
  keyboard / drag / long-press. This is the right model for a 3-year-old.
- Never-blank offline policy (last-known value) beats spinners/empty tiles.
- Primary text #f2f4fa (~very high contrast) and muted #aab3c8 (~7:1) both comfortably
  legible on the dark ground.
