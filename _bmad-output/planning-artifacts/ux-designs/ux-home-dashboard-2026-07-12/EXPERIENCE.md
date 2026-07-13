---
name: Home Dashboard
status: final
created: 2026-07-12
updated: 2026-07-13
sources:
  - ../../prds/prd-home-dashboard-2026-07-12/prd.md
  - ../../architecture/architecture-home-dashboard-2026-07-12/ARCHITECTURE-SPINE.md
---

<!-- Distilled at Finalize from .memlog.md — experience spine (owns how it works). Cross-references DESIGN.md tokens by {path.to.token}. -->

# Home Dashboard — Experience Spine

> Visual identity lives in `DESIGN.md`; behavior lives here. **Both spines win over any mock on conflict.** Reference mockups (Direction A): home [`mockups/home-directions.html`](mockups/home-directions.html), room detail [`mockups/mock-room-detail.html`](mockups/mock-room-detail.html). Sources (PRD, Architecture Spine) are inherited by reference, not restated.

## Foundation

An **iPad in landscape**, mounted/placed in the **kitchen** as an **always-on kiosk**, viewed at **0–1m** (close range, not a far wall-glance). It is a **front-end over Home Assistant** — HA is the single source of truth (AD-1); the app owns only ephemeral UI state and drives HA via service/scene calls. Kitchen kiosk startup is **warm, ~0–1m to glanceable** (app-shell cached, data always live — AD-9/NFR1).

There is **no named third-party UI system**: TailAdmin/Tailwind is **styling only** (base UI primitives), not an interaction framework whose patterns we inherit. Users: Florian + wife + **Nathan (5)** and **Gaspard (3)** — all act.

## Information Architecture

Three surfaces (AD-10 — composed home + deep pages):

| Surface | Reached from | Purpose |
|---|---|---|
| **Home (glanceable)** | kiosk default | One composed screen — status + primary controls + scenes |
| **Cameras** | top-bar Cameras entry | Deep page — live feeds + history (FR8, `[À RISQUE]`) |
| **Room detail** | tapping a room card | All of one room's devices + sensor history |

Home zones, top → bottom:

| Zone | Content |
|---|---|
| **Top bar** | Clock + date · **Armer / Désarmer** (alarm) · **Caméras** entry |
| **Scènes** | Scene row — **given prominence** (hero action, not buried at the bottom) |
| **Ambiance** | Netatmo — 4 rooms (Salon, Chambre Parents, Nathan, Gaspard). **Temperature is the glance value (large); CO₂ + humidity are secondary; sensor history lives in Room detail, not on the home.** |
| **Éclairage** | Master ("Toutes les lumières") + per-room lights |
| **Volets** | Master ("Tous les volets") + per-room shutters |
| **Climatisation** | Étage (setpoint + mode) |

Tapping a **room card opens its detail page**. Rooms are canonical (AD-7): `salon`, `chambre_parents`, `nathan`, `gaspard`.

> The mock places Scènes at the bottom; per the key UX insight, **Scènes take IA prominence** — the spine wins.

## Voice and Tone

**French**, warm and concise. Action labels **say what happens**, not what the control is. Real labels: Salon, Chambre Parents, Cuisine, Nathan, Gaspard, "Toutes les lumières", "Tous les volets". Scene names are plain-language rituals: **"Petit déjeuner"**, **"Bonne nuit les petits"**.

| Do | Don't |
|---|---|
| "Petit déjeuner" · "Bonne nuit les petits" | "Scène 1" · "Activer preset A" |
| "Hors ligne · dernière donnée 14:02" | "Erreur capteur" / blank |
| "Appuyer pour allumer" | "Toggle" |

## Component Patterns

Behavioral only — visual specs in `DESIGN.md`.

| Component | Behavior |
|---|---|
| **Device tile** ({components.device-tile}) | Tap = toggle on/off. Optimistic feedback then converge (AD-5). Kid tiles behave identically, just larger. |
| **Master tile** ({components.master-tile}) | Tap = apply to the whole group (all lights / all shutters). Own optimistic owner in the pending layer (AD-11) — coexists with per-room tiles without racing. |
| **Room sensor card** ({components.room-sensor-card}) | Tap = open room detail. Read-only value display; never blank (AD-6). |
| **Shutter control** ({components.shutter-control}) | Three actions — **down / pause / up**. Position % bar reflects converged state; transitional `opening`/`closing` is a valid state, not a failure (AD-5). |
| **Climate stepper** ({components.climate-stepper}) | −/+ steps the setpoint; each step is optimistic then converges. `target ≠ current` is transitional, not an error. |
| **Scene button** ({components.scene-button}) | **One tap applies a mixed scene** — lights + shutters + climate together (FR5). Logic lives in HA (AD-4); the app only invokes. |

## State Patterns

Per Architecture Spine:

| State | Treatment | Rule |
|---|---|---|
| **Stale / offline (per entity)** | Last-known value + **"Hors ligne" pill (primary cue, `{colors.stale-text}`)**; dashed `{colors.stale}` border is secondary. Timestamp "dernière donnée HH:MM". **Never blank.** Per entity, independent of socket — a cloud entity (Netatmo/Arlo) can fall while the socket is open. | AD-6 |
| **In-flight action** | Immediate optimistic feedback **< 200ms** ({components.device-tile-on} tint/glow) via the pending layer, then converge on HA echo. | AD-5 / AD-11 / NFR1 |
| **Transitional** | Shutter `opening`/`closing` + position, climate `target ≠ current` shown as legitimate in-progress states, **not failures**. Failure = timeout without convergence → revert to confirmed state + signal. | AD-5 |

## Interaction Primitives

- **Tap-only.** Everything is a single tap on a large target; no hover, no keyboard, no drag, no long-press-to-configure in v1.
- **Toggle** (tiles), **step** (−/+ climate), **directional** (shutter down/pause/up), **one-tap apply** (scenes), **navigate** (room card / Cameras entry → deep page).
- **Optimistic-first:** the UI responds before HA confirms, then reconciles (AD-5). Feedback is visual (tint + glow), < 200ms.

## Accessibility Floor

Grounded in **NFR2 — usable by a 5-year-old** (and reachable by a 3-year-old):

- **Minimum touch target = `{spacing.target-min}` (48px) for every control**, including the shutter down/pause/up and climate −/+ buttons (the previously smallest targets); **`{spacing.target-min-kid}` (56px) in kid rooms** (Nathan, Gaspard). Kid device tiles also get extra height ({components.device-tile-kid}).
- **Shallow navigation** — home + one level (Cameras / Room detail). No deeper.
- **Density is deliberately low on the home glance.** Each room card leads with **one glance value — the temperature** (large); **CO₂ and humidity are secondary** (parent-relevant, not kid-facing) and their **history lives in Room detail**, not on the home screen. This resolves the density tension against the "info overload" anti-goal.
- **Stale legibility:** the "**Hors ligne**" pill (label + icon, `{colors.stale-text}`) is the **primary** offline cue — never the faint dashed border alone; readable at 0–1m.
- **State never by color alone:** alarm shows **"Armé / Désarmé" text + lock icon** (green safe-state vs red alert is secondary); on/off tiles carry a state label + icon, not just accent tint.
- **Undo is legible:** the safety-net toast ({components.undo-toast}) dwells **6–8s** with a **visible countdown** and a **≥52px "Annuler"** — long enough for a parent to catch an accidental kid tap.
- **Tabular-nums** on clock, temperatures, setpoint (`DESIGN.md` Typography). Contrast: light text `{colors.text}` on the dark gradient ground.

## Enfants & sécurité

- **Kids act with no restriction** — explicit owner decision. Nathan (5) and Gaspard (3) can operate any control, including their own bedroom lights/shutters. **No child-lock in v1.** The owner was warned that a 3-year-old could, in principle, disarm the alarm or open all shutters; the trade-off is **accepted**.
- A general few-seconds **UNDO** on high-impact actions (**"Tout fermer"**, **"Désarmer"**, and scene applies) as a safety net for everyone — including accidental kid taps. **Confirmed for v1.** Not a child-lock: a universal reversible-action pattern (immediate action + a few-seconds "Annuler" toast that reverts to the prior confirmed state).
- **Out of v1 scope:** the kid household-coordination moment (marking rituals done — *tortues nourries*, *poubelles sorties*) is deferred to **v2** (family-coordination layer). The v1 kid moment is simply tapping their own bedroom light.

## Key Flows

### Flow 1 — "Le petit-déjeuner" (a parent, ~7h)

1. A parent walks up to the kitchen iPad in the morning; the kiosk is already on and glanceable.
2. They tap the **"Petit déjeuner"** scene — one gesture.
3. Optimistic feedback fires immediately (< 200ms); lights and shutters begin to move, shown as transitional states (AD-5).
4. **Climax:** the whole house wakes up in one tap — lights on and shutters open house-wide — without touching a single per-room control.

### Flow 2 — "Bonne nuit les petits" (a parent, ~20h)

1. A parent taps the **"Bonne nuit les petits"** scene.
2. The kids' rooms (Nathan, Gaspard) respond as a mixed scene: their **lights** dim/off, **shutters** close, **AC** settles to the night setpoint (FR5 — lights + shutters + climate).
3. Shutters show `closing` + position, climate shows `target ≠ current` — transitional, not errors.
4. **Climax:** the kids' rooms settle for the night in one gesture.

> [PROPOSED] undo (see *Enfants & sécurité*) would apply as the safety net on the high-impact end of these flows (e.g. an accidental "Tout fermer" / "Désarmer").
