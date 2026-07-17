# Home Dashboard

iPad kiosk dashboard on top of [Home Assistant](https://www.home-assistant.io/).
A reactive thin-client (React + Vite + `@hakit`) over a single system-of-record:
Home Assistant. No application backend, no own database — entity state flows
HA → UI over the WebSocket; user intent flows UI → HA via service/scene calls.

See the architecture spine and PRD under
`_bmad-output/planning-artifacts/` for the full design.

## Stack

React 19 · Vite · TypeScript · Tailwind CSS v4 · `@hakit/core` + `@hakit/components` 6.0.2

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a local, gitignored env file from the template:
   ```bash
   cp .env.example .env.local
   ```
3. In Home Assistant, create a **long-lived access token**
   (profile → _Long-lived access tokens_ → _Create token_), then fill
   `.env.local`:

   ```
   VITE_HA_URL=http://homeassistant.local:8123
   VITE_HA_TOKEN=<your-long-lived-token>
   ```

   `.env.local` is never committed and never bundled into `dist/` (AD-8).

   > Dev CORS: the Vite dev server (`localhost:5173`) needs
   > `http.cors_allowed_origins` set for that origin in HA's `configuration.yaml`.
   > The same-origin production build (served from HA) does not.

## Commands

```bash
npm run dev        # start the Vite dev server
npm run build      # type-check + static build to dist/ (served same-origin from HA)
npm run typecheck  # type-check only
npm run lint       # oxlint
npm run preview    # preview the production build locally
```

## Connection check (Story 1.1)

With `.env.local` set and HA reachable, `npm run dev` renders a throwaway
connection-control view showing the HA connection status, the entity count, and
one witness entity updating live over the WebSocket. This is a debug surface and
will be replaced by the real kiosk shell in later stories.

## HA connectivity seam

All Home Assistant access goes through `src/hakit/` (the `@hakit` provider and
hooks) — there are no ad-hoc REST/WebSocket calls to HA anywhere else (AD-2).

## Accessing the Pi (SSH)

The dashboard is hosted on a Raspberry Pi running Home Assistant OS. SSH is **not**
native to HAOS — it's provided by the _Advanced SSH & Web Terminal_ add-on, which
must be installed and started (see [`docs/deploy.md`](docs/deploy.md) § Pi
prerequisites).

Once the add-on is up with your **public** key in its `authorized_keys`, connect
through the `pi-dashboard` alias:

```bash
ssh pi-dashboard        # → root@<pi-lan-ip>, LAN-only
```

The alias lives in `~/.ssh/config` (per machine, never committed):

```
Host pi-dashboard
    HostName 192.168.1.29      # the Pi's LAN IP
    User root
    IdentityFile ~/.ssh/home_dashboard_pi
    IdentitiesOnly yes
```

**New machine / new key:**

```bash
ssh-keygen -t ed25519 -f ~/.ssh/home_dashboard_pi   # dedicated key, no passphrase
cat ~/.ssh/home_dashboard_pi.pub                    # → paste into the add-on's authorized_keys
```

For the automated cloud deploy (over Tailscale, not this LAN alias), see
[`docs/deploy.md`](docs/deploy.md).
