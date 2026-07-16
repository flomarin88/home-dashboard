
## Deferred from: code review of story 2.1 (2026-07-15)

- **LightTile ignores `failed`** — ✅ **RESOLVED in Story 2.2 (2026-07-16).** `LightTile` now consumes `useOptimisticControl.failed` and surfaces an "Échec" cue (text, not colour alone) on a timed-out command instead of snapping back silently. _(Was: deferred to 2.2 as the failure-UX owner.)_
- **Per-hook `failed` divergence on a shared entity** — two widgets driving one `entity_id` (e.g. room tile + master "Tout éteindre") each hold their own `useState(failed)` + timer, so on timeout one shows failed and the sibling doesn't. Fix = move terminal status into the shared pending store. Deferred to **Story 2.3** (introduces the first shared-entity widget: the master light tile).
- **`ConnectingZones` route mismatch** — the single `HakitProvider` loading fallback is a fixed Home-shaped skeleton, shown even on `/room/:id` during the initial HA connect. Cosmetic; RoomDetail is a stub. Deferred to **Epic 5** (RoomDetail build) — render the skeleton per-route or accept it.

## Deferred from: code review of story 2.2 (2026-07-16)

- **Undo closure may capture stale HA refs** — `UndoToast` mounts above the connection gate; the `undo` closure is built by a caller *under* `HakitProvider` and (in 2.3) will capture a means to command HA. If that caller unmounts (navigation) or HA reconnects while a toast is live, running the closure could hit stale entity/service references. 2.2 ships no real caller so it's untested. Deferred to **Story 2.3** (first real trigger): resolve the entity/service at run-time via `useHass().callService(domain, service, { target: { entity_id } })` with a string `entity_id` — do NOT capture a live `useEntity(...)` object in the closure. The `reapply` path via `usePendingStore.getState()` (module scope) is already safe.
