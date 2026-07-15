# Tech Debt

Deliberate deferrals, each with **what · why deferred · payback trigger** (per the
Core contract). Deliberate debt is fine; undocumented debt is just bugs.

Opened from the Epic 1 retrospective (`_bmad-output/implementation-artifacts/epic-1-retro-2026-07-15.md`).

---

## TD-1 — Shell remounts on HA (re)connect  ·  severity: medium
_Source: Story 1.3 code-review finding #2._

- **What:** `App` passes `<Home/>` as both `HassConnect`'s `loading` fallback **and**
  its children. On connect (and every reconnect) HassConnect swaps loading→children,
  so `Home` unmounts and a fresh `Home` mounts — the `Clock` interval restarts and any
  component state is lost.
- **Why deferred:** cosmetic while the zones were empty/stateless (Stories 1.3–1.6).
- **Payback trigger:** **Epic 2 / Story 2.1** — control widgets will hold *optimistic*
  in-flight state (AD-11 pending layer); the remount would reset it mid-action. Fix by
  keeping the shell **chrome outside the connection gate** so individual widgets (not the
  whole shell) handle connecting/offline. **Do this before the first control widget.**

## TD-2 — Test files are not type-checked  ·  severity: low
_Source: Story 1.3 code-review finding #5._

- **What:** `tsconfig.app.json` excludes `*.test.*` from `tsc -b`, and Vitest transpiles
  via esbuild without type-checking — so a type error in a test (wrong prop, renamed
  export, bad import) is caught by nothing until it blows up at runtime.
- **Why deferred:** tooling nicety; low risk; keeps the build/typecheck fast and clean.
- **Payback trigger:** when a test type-error slips through, or when test complexity grows.
  Options: `vitest --typecheck`, or a test-scoped tsconfig added to the build graph.

## TD-3 — Foundation unverified on real HA  ·  severity: medium (verification, not code)
_Source: Epic 1 retrospective._

- **What:** Epic 1 stories were accepted with **live/device proof pending** (owner away
  from the LAN). The dashboard has not been run end-to-end against real Home Assistant
  this cycle — the offline/loading behaviour, live sensors, and PWA kiosk are all
  machine-verified but not eyeballed on real data.
- **Why deferred:** HA is LAN-only and the owner was off-network.
- **Payback trigger:** once Tailscale + the deploy secrets are set — run the E2E proof
  (all four rooms live + refresh, offline degradation, warm PWA start, tap→room stub).
