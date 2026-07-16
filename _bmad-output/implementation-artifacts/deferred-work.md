
## Deferred from: code review of story 2.1 (2026-07-15)

- **LightTile ignores `failed`** — a control-hook timeout clears the intent and sets `failed`, but `LightTile` (src/widgets/LightTile.tsx) doesn't consume it, so a failed command silently snaps back with no cue. Deferred to **Story 2.2** (undo/toast/failure UX owner). AC2's "flag exposé au widget" is satisfied at the hook; the visual treatment belongs to 2.2.
- **Per-hook `failed` divergence on a shared entity** — two widgets driving one `entity_id` (e.g. room tile + master "Tout éteindre") each hold their own `useState(failed)` + timer, so on timeout one shows failed and the sibling doesn't. Fix = move terminal status into the shared pending store. Deferred to **Story 2.3** (introduces the first shared-entity widget: the master light tile).
- **`ConnectingZones` route mismatch** — the single `HakitProvider` loading fallback is a fixed Home-shaped skeleton, shown even on `/room/:id` during the initial HA connect. Cosmetic; RoomDetail is a stub. Deferred to **Epic 5** (RoomDetail build) — render the skeleton per-route or accept it.
