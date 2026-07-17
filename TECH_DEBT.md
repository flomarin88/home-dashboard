# Tech Debt

Deliberate deferrals, each with **what · why deferred · payback trigger** (per the
Core contract). Deliberate debt is fine; undocumented debt is just bugs.

Opened from the Epic 1 retrospective (`_bmad-output/implementation-artifacts/epic-1-retro-2026-07-15.md`).

---

## TD-1 — Shell remounts on HA (re)connect · ✅ PAID (Story 2.1)

_Source: Story 1.3 code-review finding #2. Resolved: Story 2.1 (2026-07-15)._

- **What:** `App` passed `<Home/>` as both `HassConnect`'s `loading` fallback **and**
  its children. On connect (and every reconnect) HassConnect swaps loading→children,
  so `Home` unmounted and a fresh `Home` mounted — the `Clock` interval restarted and any
  component state was lost.
- **Fix (Story 2.1):** introduced `KioskShell` (App.tsx) — the ground + `TopBar` (which
  runs the Clock) now live **above** the connection gate; `HakitProvider` wraps only the
  data zones, with a `ConnectingZones` skeleton fallback. A (re)connect now remounts only
  the data zones (they degrade via `useEntityValue`), never the shell or Clock. `TopBar`
  extracted to `src/ui/TopBar.tsx`; `Home`/`RoomDetail` became content-only (shell owns the
  ground). Note: because the pending layer (AD-11) is a module-level Zustand store, in-flight
  optimistic state already survived a remount — so this fix is about chrome/Clock stability
  and structural correctness, not saving pending state.
- **Follow-up (minor):** `TopBar` is now persistent across routes (also shows on the
  `RoomDetail` stub). Fine for the kiosk; revisit when Epic 5 designs RoomDetail.

## TD-2 — Test files are not type-checked · severity: low

_Source: Story 1.3 code-review finding #5._

- **What:** `tsconfig.app.json` excludes `*.test.*` from `tsc -b`, and Vitest transpiles
  via esbuild without type-checking — so a type error in a test (wrong prop, renamed
  export, bad import) is caught by nothing until it blows up at runtime.
- **Why deferred:** tooling nicety; low risk; keeps the build/typecheck fast and clean.
- **Payback trigger:** when a test type-error slips through, or when test complexity grows.
  Options: `vitest --typecheck`, or a test-scoped tsconfig added to the build graph.

## TD-3 — Foundation unverified on real HA · severity: medium (verification, not code)

_Source: Epic 1 retrospective._

- **What:** Epic 1 stories were accepted with **live/device proof pending** (owner away
  from the LAN). The dashboard has not been run end-to-end against real Home Assistant
  this cycle — the offline/loading behaviour, live sensors, and PWA kiosk are all
  machine-verified but not eyeballed on real data.
- **Why deferred:** HA is LAN-only and the owner was off-network.
- **Payback trigger:** once Tailscale + the deploy secrets are set — run the E2E proof
  (all four rooms live + refresh, offline degradation, warm PWA start, tap→room stub).

## TD-4 — Top-bar HA widgets are hand-placed `fixed` siblings · ✅ PAID (Story 6.4)

_Source: Story 6.2 (2026-07-16). Recurring since 6.1. **Paid 2026-07-17 (Story 6.4):**
extracted `src/ui/TopBarSlots.tsx` — a `fixed` flex region mounted under the provider
that flows its HA children (`TopBarWeather`, `BinTile`, and the turtle in 6.3) instead of
per-tile coordinates; a conditional tile that renders `null` now leaves no gap. Final
on-device offsets validated in 6.4's device-proof (Florian)._

- **What:** HA-backed top-bar elements (`BinTile` 6.1, `TopBarWeather` 6.2) can't live in
  `TopBar` (it's above the connection gate, TD-1), so each is a `fixed`-positioned sibling
  mounted under the provider in `KioskShell`, with hand-tuned coordinates to avoid overlap
  (weather left `left-44`, bins centered). This is now the **3rd** top-bar element and the
  placement is coordinate-fragile — a 4th will make collisions likely, and the offsets are
  guesses until validated on the real iPad.
- **Why deferred:** two/three elements are manageable; a real composition layer is scope
  the current stories don't need.
- **Payback trigger:** a 4th HA top-bar element, or an observed overlap on-device. Then
  extract a `TopBarSlots` layout (a `fixed` fl/grid region under the provider that lays
  out its HA children) so elements flow instead of being individually positioned.
