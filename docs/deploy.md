# Deployment

The dashboard is a static build served **from Home Assistant** on the home LAN
(AD-9) — so it's reachable only at home, and HA itself is never exposed. CI
builds it in the cloud and **pushes** it to the Pi over Tailscale.

```
push to master ─▶ GitHub Actions (cloud)
                   ├─ CI (ci.yml): test · typecheck · lint · build      [gate]
                   └─ Deploy (deploy.yml): build → tailnet → rsync ─▶ Pi HA www/
iPad (LAN) ─▶ http://<ha>:8123/local/home-dashboard/index.html   (@hakit login once)
```

## Hosting

- Build output is copied to HA's `config/www/home-dashboard/`, which HA serves
  at **`/local/home-dashboard/index.html`**. LAN-only by construction.
  > HA's `/local/` static handler does not serve `index.html` for a directory
  > URL — the bare `…/home-dashboard/` returns **403**. Always point at the file.
  > And `config/www/` must exist when HA starts, or `/local/` **404s** until a
  > **Restart** (Settings → System → Restart) re-registers the static path.
- The build's base path is set by `DEPLOY_BASE` (see `vite.config.ts`); CI uses
  `DEPLOY_BASE=/local/home-dashboard/`. Local dev stays at `/`. If you later
  switch to an add-on/ingress served at root, drop `DEPLOY_BASE` (base `/`).
- **Auth:** the build is **token-less** (the AD-8 guard blocks a bundled token).
  On first launch `@hakit` shows the HA login once and stores the token on the
  device (NFR3 — no re-auth after). No secret is ever baked into the bundle.

## CI (`.github/workflows/ci.yml`)

Runs on every push/PR: `npm ci` → `test` → `typecheck` → `lint` → `build`.
Pure gate, no secrets.

## Deploy — cloud build → push to Pi (`.github/workflows/deploy.yml`)

On push to `master`, after the gates: build for the www base, join the tailnet,
`rsync dist/` into HA `www/`. No inbound port is opened at home.

### GitHub secrets to set (repo → Settings → Secrets → Actions)

| Secret               | Value                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------- |
| `TS_OAUTH_CLIENT_ID` | Tailscale **OAuth client** ID (Trust credentials → OAuth, scope `auth_keys`, tag `tag:ci`). |
| `TS_OAUTH_SECRET`    | The OAuth client **secret**. Does not expire — no 90-day auth-key rotation.                 |
| `PI_SSH_KEY`         | Private half of an SSH **deploy key** (`ssh-keygen -t ed25519 -f deploy`).                  |
| `PI_HOST`            | The Pi's Tailscale name or `100.x.y.z` IP.                                                  |
| `PI_USER`            | SSH user that can write `www/` (e.g. `root` on the HAOS SSH add-on).                        |
| `PI_WWW_PATH`        | `/config/www/home-dashboard` (or wherever HA's `www/` lives).                               |

> The deploy workflow joins the tailnet with the OAuth client (`tags: tag:ci`),
> which mints a fresh ephemeral node each run. `tag:ci` must be declared in the
> tailnet ACL (`tagOwners`), and the ACL must let `tag:ci` reach the Pi on `:22`
> (the default allow-all ACL already does).

### Pi prerequisites (one-time)

1. **Tailscale** installed and up on the Pi (HAOS: the Tailscale add-on; Pi OS:
   `tailscale up`).
2. **SSH** reachable (HAOS: the _Advanced SSH & Web Terminal_ add-on; Pi OS:
   `sshd`). Add the deploy key's **public** half to the user's
   `~/.ssh/authorized_keys`.
3. `config/www/` exists and is writable by `PI_USER`. Create
   `config/www/home-dashboard/` once.

After that, every push to `master` redeploys automatically. The iPad picks up
the new build on its next load (the PWA service worker auto-updates).

## Kiosk / device setup

See [`kiosk.md`](kiosk.md) — Add to Home Screen, Guided Access, dev CORS, and the
token-less production-build note.
