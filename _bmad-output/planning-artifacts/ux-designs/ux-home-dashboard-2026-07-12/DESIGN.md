---
name: Home Dashboard
description: Visual identity for an always-on iPad kitchen kiosk over Home Assistant. Single dark "Glass Gradient" theme — frosted translucent tiles on a diagonal indigo→teal→magenta ground, one accent color per device type.
status: final
created: 2026-07-12
updated: 2026-07-13
colors:
  # Ground — dark diagonal gradient (indigo → teal → magenta)
  ground-indigo: '#1a1140'
  ground-teal: '#122a3a'
  ground-magenta: '#251034'
  # Frosted card surfaces
  card-fill: 'rgba(255,255,255,0.06)'
  card-border: 'rgba(255,255,255,0.12)'
  tile-fill: 'rgba(255,255,255,0.04)'
  tile-border: 'rgba(255,255,255,0.10)'
  # Text
  text: '#f2f4fa'
  text-muted: '#aab3c8'
  # Accent-per-device-type (semantic-by-domain)
  accent-lights: '#ffb23e'      # amber
  accent-shutters: '#4aa3ff'    # blue
  accent-climate: '#35e0d8'     # cyan
  accent-vacuum: '#a06bff'      # violet — Roborock (FR10)
  security-ok: '#38d17a'        # green (armed/disarmed-safe)
  security-alert: '#ff5d5d'     # red
  # Stale / offline
  stale: '#5b6172'          # dashed border ONLY (color cue)
  stale-text: '#c2c8d6'     # readable offline text (~AA) — the "Hors ligne" pill is the PRIMARY cue, not the faint border
typography:
  # System sans; large tabular-nums for temperatures & clock.
  font-family:
    note: 'System sans — -apple-system / SF Pro on iPadOS (BlinkMacSystemFont, Segoe UI, Roboto fallback)'
  clock:
    fontSize: 34px
    fontWeight: '600'
    letterSpacing: -0.02em
    note: 'tabular-nums'
  numeric-xl:
    # climate setpoint
    fontSize: 36px
    fontWeight: '600'
    letterSpacing: -0.03em
    note: 'tabular-nums — °C setpoint'
  numeric-lg:
    # room temperature
    fontSize: 24px
    fontWeight: '600'
    letterSpacing: -0.02em
    note: 'tabular-nums — room temp'
  title:
    fontSize: 16px
    fontWeight: '700'
  label:
    fontSize: 14px
    fontWeight: '600'
  section-heading:
    fontSize: 12px
    fontWeight: '700'
    letterSpacing: 0.08em
    note: 'UPPERCASE card heading'
  meta:
    fontSize: 12px
    fontWeight: '500'
  caption:
    fontSize: 11px
    fontWeight: '500'
rounded:
  sm: 9px      # control buttons (shutter, stepper)
  md: 14px     # room cards, device tiles, master tiles
  lg: 20px     # section cards, scene buttons, top-bar entries
  full: 9999px # pills, chips, toggles, status dots
spacing:
  '1': 4px
  '2': 6px
  '3': 8px
  '4': 10px
  '5': 14px
  '6': 16px
  '7': 20px
  '8': 22px
  card-padding: 14px 16px
  grid-gap: 14px
  tile-gap: 10px
  target-min: 48px       # minimum touch target — applies to ALL controls incl. shutter & stepper buttons
  target-min-kid: 56px   # kid rooms (Nathan, Gaspard)
components:
  section-card:
    background: '{colors.card-fill}'
    border: '1px solid {colors.card-border}'
    radius: '{rounded.lg}'
    backdropBlur: 8px
    shadow: '0 8px 30px rgba(0,0,0,0.25)'
  device-tile:
    background: '{colors.tile-fill}'
    border: '1px solid {colors.tile-border}'
    radius: '{rounded.md}'
    minHeight: 74px
  device-tile-on:
    # accent tint keyed to device type, e.g. lights:
    background: 'rgba(255,178,62,0.16)'
    border: '1px solid rgba(255,178,62,0.45)'
    glow: '0 0 20px rgba(255,178,62,0.15)'
  device-tile-stale:
    border: '1px dashed {colors.stale}'
    background: 'rgba(91,97,114,0.08)'
    foreground: '{colors.stale-text}'   # readable, not the faint border color
    primaryCue: '"Hors ligne" pill (label + icon) — the dashed border is secondary'
  device-tile-kid:
    minHeight: 92px
    note: 'taller target — kids act (Nathan, Gaspard)'
  master-tile:
    background: 'rgba(255,178,62,0.12)'
    border: '1px solid rgba(255,178,62,0.35)'
    radius: '{rounded.md}'
    note: 'accent tint = device-type of the group (lights amber shown)'
  room-sensor-card:
    background: '{colors.tile-fill}'
    border: '1px solid {colors.tile-border}'
    radius: '{rounded.md}'
    temp: '{typography.numeric-lg}'
  shutter-control:
    buttons: 'down / pause / up'
    buttonRadius: '{rounded.sm}'
    buttonHeight: '{spacing.target-min}'   # 48px min (56px in kid rooms) — was the smallest target, now meets the floor
    buttonMinWidth: 56px
    tint: '{colors.accent-shutters}'
    positionBar:
      track: 'rgba(255,255,255,0.12)'
      fill: '{colors.accent-shutters}'
      height: 5px
  climate-stepper:
    buttons: '− / +'
    buttonSize: '{spacing.target-min}'   # 48px
    buttonRadius: 12px
    tint: '{colors.accent-climate}'
    value: '{typography.numeric-xl}'
  scene-button:
    background: '{colors.card-fill}'
    border: '1px solid {colors.card-border}'
    radius: '{rounded.lg}'
    minHeight: 52px
    note: 'emoji + label; hero action — see EXPERIENCE.md IA prominence'
  top-bar-clock:
    value: '{typography.clock}'
    sub: '{colors.text-muted}'
  arm-tile:
    background: 'rgba(56,209,122,0.12)'
    border: '1px solid rgba(56,209,122,0.4)'
    glow: '0 0 24px rgba(56,209,122,0.18)'
    dot: '{colors.security-ok}'
    radius: '{rounded.lg}'
    minHeight: 56px
    alertColor: '{colors.security-alert}'
    stateCue: 'state carried by TEXT + ICON, not color alone — "Armé" (cadenas fermé) vs "Désarmé" (cadenas ouvert); green is safe-state, red is alert'
  cameras-entry:
    background: '{colors.card-fill}'
    border: '1px solid {colors.card-border}'
    radius: '{rounded.lg}'
    minHeight: 52px
    note: 'thumbnail + label + chevron → opens Cameras page'
  undo-toast:
    dwell: 6-8s
    annulerButton:
      minHeight: 52px
      contrast: high
    countdown: 'visible (ring or bar) so the window is legible'
    note: 'reversible safety net on high-impact actions (Tout fermer, Désarmer, scenes)'
---

<!-- Distilled at Finalize from .memlog.md — visual identity spine (owns how it looks). -->

> Reference mockups (Direction A): [`mockups/home-directions.html`](mockups/home-directions.html) (the home, chosen among 3 directions) · [`mockups/mock-room-detail.html`](mockups/mock-room-detail.html) (room detail). The spine wins over the mock on conflict.

## Brand & Style

Direction A — **"Glass Gradient"**: a premium control-room that stays playful. The chosen feel is *salle de contrôle + ludique* — a real "home cockpit" that a parent reads at a glance and a 3- and 5-year-old can operate. A dark diagonal gradient ground carries frosted, translucent rounded tiles with soft glows: calm but rich, never sterile. Every device type owns a single accent color so the eye finds "lights vs shutters vs climate vs alarm" instantly without visual overload. Measured density — deliberately **low on the home glance** (temperature leads; CO₂/humidity secondary, history in Room detail) — with large radii and soft shadows, built for an always-on kitchen wall panel viewed at 0–1m.

**Single dark theme is a deliberate choice, not an omission.** There is no light mode. The surface is a fixed kitchen kiosk that runs day and night; one tuned dark ground removes theme-switching entirely and keeps the panel calm in a lit room and unobtrusive at night. Light-mode tokens are intentionally out of scope.

## Colors

- **Ground gradient** — a diagonal blend of `{colors.ground-indigo}` `#1a1140` → `{colors.ground-teal}` `#122a3a` → `{colors.ground-magenta}` `#251034`, warmed by soft radial glows. This is the whole-screen ground; nothing else uses these hues as fills.
- **Frosted surfaces** — `{colors.card-fill}` (section cards) and `{colors.tile-fill}` (inner tiles) over `{colors.card-border}` / `{colors.tile-border}` hairlines. Translucency + `backdrop-blur` is what makes the glass read; never replace with an opaque fill.
- **Text** — `{colors.text}` `#f2f4fa` primary, `{colors.text-muted}` `#aab3c8` for secondary/meta.
- **Accent-per-device-type (semantic-by-domain)** — each domain gets exactly one accent, used only for that domain's on-state tint, glow, icon, and control chrome:
  - Lights → `{colors.accent-lights}` amber `#ffb23e`
  - Shutters → `{colors.accent-shutters}` blue `#4aa3ff`
  - Climate → `{colors.accent-climate}` cyan `#35e0d8`
  - Vacuum (Roborock) → `{colors.accent-vacuum}` violet `#a06bff`
  - Security → `{colors.security-ok}` green `#38d17a` (safe/armed-ok) / `{colors.security-alert}` red `#ff5d5d` (alert)
- **Stale / offline** — `{colors.stale}` `#5b6172`, always rendered as a **dashed** border with muted text. Reserved exclusively for the obsolescence indicator (AD-6); never a decorative color.

## Typography

System sans throughout (`{typography.font-family}` — SF Pro on iPadOS). No custom or display face; the visual character comes from the gradient and glass, not the type. **Large tabular-nums** (`font-variant-numeric: tabular-nums`) on everything that reads as a live number so digits don't jitter as values update: the clock (`{typography.clock}`), room temperatures (`{typography.numeric-lg}`), and the climate setpoint (`{typography.numeric-xl}`). Card headings (`{typography.section-heading}`) are small, uppercase, letter-spaced; labels and meta stay quiet so numbers dominate.

## Layout & Spacing

Landscape iPad (~16:10), viewed at 0–1m — close enough to carry medium density, but every touchable element stays large (NFR2). The home screen is a **composed dashboard, not a scroll**: a top bar, a section-card grid (Ambiance · Éclairage · Volets · Climatisation), and a prominent scenes row, all on one screen. Grid gap `{spacing.grid-gap}` between section cards; `{spacing.tile-gap}` between inner tiles; card padding `{spacing.card-padding}`. Kid-operable tiles get extra height (`{components.device-tile-kid.minHeight}`) so a 3-year-old hits them reliably.

## Elevation & Depth

Depth is built from **translucency + blur + soft glow**, not hard drop shadows. Section cards sit on the gradient with a gentle `{components.section-card.shadow}` and 8px backdrop blur. On-state device tiles gain a colored glow keyed to their device accent (e.g. amber halo for a lit lamp) — the glow *is* the "on" signal. Layering order: gradient ground → frosted section cards → inner tiles → active/on tiles (accent-tinted, glowing).

## Shapes

Generous, consistent radii: section cards, scene buttons, and top-bar entries at `{rounded.lg}` (~20px); room cards, device tiles, and master tiles at `{rounded.md}` (~14px); control buttons at `{rounded.sm}` (~9px); pills, chips, toggles, and status dots fully round (`{rounded.full}`). Rounded-soft everywhere reinforces the calm, tactile, "safe to touch" character.

## Components

Visual specs only — behavior lives in EXPERIENCE.md.

| Component | Visual |
|---|---|
| **Device tile** (light) | `{components.device-tile}`. **Default:** neutral frosted tile, grey bulb dot, muted state text. **On:** `{components.device-tile-on}` — amber tint, amber bulb with glow, accent state text. **Stale:** `{components.device-tile-stale}` — dashed `{colors.stale}` border, "—" value, "Hors ligne" pill. **Kid variant:** `{components.device-tile-kid}` — taller, larger label. |
| **Master tile** | `{components.master-tile}` — group control ("Toutes les lumières", "Tous les volets"); accent-tinted to its domain, aggregate state + % on the right. |
| **Room sensor card** | `{components.room-sensor-card}` — room name, large tabular temp `{typography.numeric-lg}`, CO₂ + humidity meta. Netatmo, 4 rooms (Salon, Chambre Parents, Nathan, Gaspard). |
| **Shutter control** | `{components.shutter-control}` — down / pause / up buttons in shutters-blue (**≥48px, 56px in kid rooms** — meets `{spacing.target-min}`), plus a position % bar (track + blue fill). |
| **Climate stepper** | `{components.climate-stepper}` — −/+ buttons (**≥48px**) flanking the large cyan tabular setpoint `{typography.numeric-xl}`; mode chip + on/off meta. |
| **Scene button** | `{components.scene-button}` — emoji + label, `{rounded.lg}`. Given IA prominence (hero action). |
| **Top bar** | Clock `{components.top-bar-clock}` (tabular, with date sub) · **Arm/disarm tile** `{components.arm-tile}` — current state carried by **text + lock icon** ("Armé" / "Désarmé"), not color alone; green = safe-state, `{colors.security-alert}` = alert · **Cameras entry** `{components.cameras-entry}` (thumbnail + label + chevron → Cameras page). |
| **Undo toast** | `{components.undo-toast}` — appears after a high-impact action; large high-contrast "Annuler" (≥52px) + visible countdown, 6–8s dwell. |

## Do's and Don'ts

| Do | Don't |
|---|---|
| Keep the single dark Glass Gradient theme | Add a light mode or per-time-of-day theme |
| Use translucency + blur + glow for depth | Replace frosted fills with opaque panels or hard shadows |
| One accent per device type, for that domain only | Reuse an accent across domains or for decoration |
| Reserve `{colors.stale}` dashed for obsolescence (AD-6) | Use dashed/grey styling decoratively |
| Tabular-nums on clock, temps, setpoint | Let live numbers reflow with proportional digits |
| Large targets, extra height on kid tiles | Shrink hit areas to raise density |
| Every control ≥ `{spacing.target-min}` (48px), incl. shutter/stepper buttons | Let secondary controls fall below the target floor |
| Make the "Hors ligne" pill (label+icon) the primary stale cue | Rely on the faint dashed border alone to signal offline |
| Carry alarm/on-off state with text + icon, not color alone | Signal state by color only (green-armed vs green-safe is ambiguous) |
| Show last-known value + stale indicator when offline | Blank a tile or show a spinner in place of data |
