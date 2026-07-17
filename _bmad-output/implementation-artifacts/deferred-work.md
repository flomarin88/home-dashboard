
## Deferred from: code review of story 2.1 (2026-07-15)

- **LightTile ignores `failed`** — ✅ **RESOLVED in Story 2.2 (2026-07-16).** `LightTile` now consumes `useOptimisticControl.failed` and surfaces an "Échec" cue (text, not colour alone) on a timed-out command instead of snapping back silently. _(Was: deferred to 2.2 as the failure-UX owner.)_
- **Per-hook `failed` divergence on a shared entity** — two widgets driving one `entity_id` (e.g. room tile + master "Tout éteindre") each hold their own `useState(failed)` + timer, so on timeout one shows failed and the sibling doesn't. Fix = move terminal status into the shared pending store. Deferred to **Story 2.3** (introduces the first shared-entity widget: the master light tile).
- **`ConnectingZones` route mismatch** — the single `HakitProvider` loading fallback is a fixed Home-shaped skeleton, shown even on `/room/:id` during the initial HA connect. Cosmetic; RoomDetail is a stub. Deferred to **Epic 5** (RoomDetail build) — render the skeleton per-route or accept it.

## Deferred from: code review of story 2.2 (2026-07-16)

- **Undo closure may capture stale HA refs** — `UndoToast` mounts above the connection gate; the `undo` closure is built by a caller *under* `HakitProvider` and (in 2.3) will capture a means to command HA. If that caller unmounts (navigation) or HA reconnects while a toast is live, running the closure could hit stale entity/service references. 2.2 ships no real caller so it's untested. Deferred to **Story 2.3** (first real trigger): resolve the entity/service at run-time via `useHass().callService(domain, service, { target: { entity_id } })` with a string `entity_id` — do NOT capture a live `useEntity(...)` object in the closure. The `reapply` path via `usePendingStore.getState()` (module scope) is already safe.

Ajouter en haut à droite tuile -> étage (0 ou 1 dans une pill avec couleur différente)
Chambre Parents -> Parents
Inverser les tuiles Gaspard et Nathan

## Deferred from: code review of 6-2-meteo-topbar-detail (2026-07-17)

- **`SensorHistoryChart` — robustesse du composant réutilisable** — garder contre un domaine Y dégénéré (série plate → `stepTicks` renvoie un seul tick → `domain=[x,x]`, ligne rendue à plat/invisible) et filtrer les valeurs non finies **dans le composant** (aujourd'hui seul le chemin `/meteo` pré-filtre `Number.isFinite`, `WeatherDetail.tsx:65`). À durcir quand le consommateur room-detail (historique CO₂/humidité) est branché — c'est lui qui n'aura pas le pré-filtre. [src/widgets/SensorHistoryChart.tsx:98,165]
- **Duplication `BackLink`/`Tile` entre `WeatherDetail` et `VacuumDetail`** — « zéro duplication » (AC3) tenu au niveau hooks/helpers, mais la coquille de page (retour « ‹ Accueil » + tuile frostée) a été copiée. Extraire une coquille de page « contenu-seul 2 colonnes » partagée. Lié à TD-4 (composition top-bar). [src/pages/WeatherDetail.tsx:219,250]

## Deferred from: code review of 6-1-sortie-poubelles (2026-07-17)

_Revue multi-agent (Blind Hunter + Edge Case Hunter). Patch + 2 defers appliqués dans `9f14001` ; les points ci-dessous ont été revus et **consciemment acceptés tels quels** (déclinés par Florian) — consignés pour qu'une revue future ne les re-signale pas._

- **Double-tap → écritures `setDatetime` en double** — l'optimiste local ayant été retiré, rien ne débounce un second tap pendant la latence d'écho HA. Écritures **idempotentes** (même phase en sortie) → accepté ; un garde `pending` réintroduirait l'état local supprimé exprès. À revisiter seulement si des doublons d'historique HA gênent. [src/widgets/BinTile.tsx]
- **Identité jaune vs noire portée par la couleur d'icône seule** (WCAG 1.4.1 / UX-DR14) — pré-existant ; l'`aria-label` porte le texte et `oubli`/`sortie` utilisent des repères non-colorés (épaisseur de bordure / forme ✓). Accepté pour un kiosque mono-utilisateur ; ajouter une forme/lettre si un daltonien entre dans le scope. [src/widgets/BinTile.tsx]
- **La confirmation `sortie` est un `<button disabled>`** — les lecteurs d'écran sautent les contrôles désactivés → état « fait » visuel seul. Accepté (pas d'utilisateur AT sur le kiosque) ; passer `disabled`→`aria-disabled` si ça change. [src/widgets/BinTile.tsx]
- **Risque fuseau de `haDateTime`** — ✅ **RÉSOLU cette session** : l'écriture envoie désormais un epoch `timestamp`, lu par HA sans ambiguïté de fuseau ; `haDateTime` supprimé. _(C'était le point le plus solide de la revue ; corrigé dans `9f14001`.)_
