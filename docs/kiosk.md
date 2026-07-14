# Kiosk setup (iPad)

The Home Dashboard is an always-on PWA on an iPad in landscape, in the kitchen.
This is the one-time setup to turn it into a locked, full-screen kiosk.

## 1. Install as a PWA (Add to Home Screen)

1. Open the dashboard URL in **Safari** (the same-origin Home Assistant URL in
   production, or `http://<dev-host>:5173` while developing).
2. Tap the **Share** button → **Sur l'écran d'accueil / Add to Home Screen**.
3. Confirm. An icon named **Maison** appears on the home screen.
4. Launch it from that icon — it opens full-screen (no Safari chrome), reads the
   cached app-shell, and is glanceable in well under a second (NFR1).

The service worker precaches the **app-shell only**. Home Assistant entity data
is never cached — it always streams live over the WebSocket (AD-9). When HA is
unreachable the shell still renders (never blank, AD-6/NFR4); data fills in once
the connection is up.

## 2. Lock it down with Guided Access

Guided Access keeps the iPad on the dashboard (no accidental exits by the kids).

1. **Réglages → Accessibilité → Accès guidé** → turn **on**.
2. Set a **passcode** (Réglages de code).
3. Open the **Maison** PWA, then **triple-click** the side/home button to start
   Guided Access. Optionally disable touch in screen areas you want inert.
4. Triple-click + passcode to exit.

Also worth enabling for an always-on panel: **Réglages → Écran et luminosité →
Verrouillage auto → Jamais** (keep the screen awake), and Guided Access will
keep the session pinned.

## Notes for developers

- **Dev CORS:** the Vite dev server origin (`http://localhost:5173`) must be in
  Home Assistant's `http.cors_allowed_origins`. The same-origin production build
  served from HA does not need this.
- **Production build must omit the token:** `.env.local`'s `VITE_HA_TOKEN` is a
  dev-server convenience. The AD-8 guard fails `vite build` if it is set (it
  would be inlined into `dist/`). Build with `VITE_HA_TOKEN= npm run build`, or
  move `.env.local` aside; production authenticates via the HA session.
- **Crisp iOS icon (optional follow-up):** iOS prefers a PNG `apple-touch-icon`.
  Generate 180/192/512 PNGs from `public/icon.svg`, e.g. with
  `npx @vite-pwa/assets-generator` (add the dev dep first), then reference the
  180×180 PNG from `index.html`. The SVG icon works in the meantime.
