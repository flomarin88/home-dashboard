
## Deferred from: code review of story 2.1 (2026-07-15)

- **LightTile ignores `failed`** — ✅ **RESOLVED in Story 2.2 (2026-07-16).** `LightTile` now consumes `useOptimisticControl.failed` and surfaces an "Échec" cue (text, not colour alone) on a timed-out command instead of snapping back silently. _(Was: deferred to 2.2 as the failure-UX owner.)_
- **Per-hook `failed` divergence on a shared entity** — two widgets driving one `entity_id` (e.g. room tile + master "Tout éteindre") each hold their own `useState(failed)` + timer, so on timeout one shows failed and the sibling doesn't. Fix = move terminal status into the shared pending store. Deferred to **Story 2.3** (introduces the first shared-entity widget: the master light tile).
- **`ConnectingZones` route mismatch** — the single `HakitProvider` loading fallback is a fixed Home-shaped skeleton, shown even on `/room/:id` during the initial HA connect. Cosmetic; RoomDetail is a stub. Deferred to **Epic 5** (RoomDetail build) — render the skeleton per-route or accept it.

## Deferred from: code review of story 2.2 (2026-07-16)

- **Undo closure may capture stale HA refs** — `UndoToast` mounts above the connection gate; the `undo` closure is built by a caller *under* `HakitProvider` and (in 2.3) will capture a means to command HA. If that caller unmounts (navigation) or HA reconnects while a toast is live, running the closure could hit stale entity/service references. 2.2 ships no real caller so it's untested. Deferred to **Story 2.3** (first real trigger): resolve the entity/service at run-time via `useHass().callService(domain, service, { target: { entity_id } })` with a string `entity_id` — do NOT capture a live `useEntity(...)` object in the closure. The `reapply` path via `usePendingStore.getState()` (module scope) is already safe.

Ajouter en haut à droite tuile -> étage (0 ou 1 dans une pill avec couleur différente)
~~Chambre Parents -> Parents~~ ✅ fait 2026-07-17
~~Inverser les tuiles Gaspard et Nathan~~ ✅ fait 2026-07-17

## Deferred from: code review of 6-3/6-4 (2026-07-17)

_Revue multi-agent. Patchs (double-tap, 56px, ordre) appliqués ; ci-dessous = accepté/différé._

- ~~**⭐ Sortir la barre supérieure du `fixed`** — décrochage des tuiles HA au rebond overscroll iOS.~~ ✅ **RÉSOLU 2026-07-18 (option C)** : `overscroll-behavior: none` sur `html, body` (`src/index.css`) tue le rebond → plus de décrochage (validé device Florian). _(Les tuiles restent techniquement `fixed` ; l'option A — portal dans un slot `TopBar` pour vraiment les mettre dans le flux et solder TD-4 — reste dispo si un jour un vrai scroll de contenu apparaît.)_
- **Durcissement collision top-bar** — `TopBarSlots` est un `fixed` ancré `left-44` avec des offsets à la main ; rien en code n'empêche un chevauchement si l'horloge/le label météo s'élargit ou si une 4ᵉ tuile s'ajoute. Aujourd'hui ~280px de marge → OK, mais fragile. Piste : `max-w`/borne droite, ou vraie couche grid (reste contraint par TD-1). À revoir si un 5ᵉ élément arrive ou si le device-proof montre un souci. [src/ui/TopBarSlots.tsx]
- **Distinction « fait » (2/2) vs hors-ligne** — les deux états sont atténués/désactivés et sans texte ; l'`aria-label` à 2/2 dit « 2 repas sur 2 » sans « fait/terminé ». Marginal sur kiosque mono-utilisateur ; ajouter « — fait » à l'aria + un repère visuel si besoin. [src/widgets/TurtleTile.tsx]

## Deferred from: code review of 6-2-meteo-topbar-detail (2026-07-17)

- **`SensorHistoryChart` — robustesse du composant réutilisable** — garder contre un domaine Y dégénéré (série plate → `stepTicks` renvoie un seul tick → `domain=[x,x]`, ligne rendue à plat/invisible) et filtrer les valeurs non finies **dans le composant** (aujourd'hui seul le chemin `/meteo` pré-filtre `Number.isFinite`, `WeatherDetail.tsx:65`). À durcir quand le consommateur room-detail (historique CO₂/humidité) est branché — c'est lui qui n'aura pas le pré-filtre. [src/widgets/SensorHistoryChart.tsx:98,165]
- **Duplication `BackLink`/`Tile` entre `WeatherDetail` et `VacuumDetail`** — « zéro duplication » (AC3) tenu au niveau hooks/helpers, mais la coquille de page (retour « ‹ Accueil » + tuile frostée) a été copiée. Extraire une coquille de page « contenu-seul 2 colonnes » partagée. Lié à TD-4 (composition top-bar). [src/pages/WeatherDetail.tsx:219,250]

## Deferred from: code review of 6-1-sortie-poubelles (2026-07-17)

_Revue multi-agent (Blind Hunter + Edge Case Hunter). Patch + 2 defers appliqués dans `9f14001` ; les points ci-dessous ont été revus et **consciemment acceptés tels quels** (déclinés par Florian) — consignés pour qu'une revue future ne les re-signale pas._

- **Double-tap → écritures `setDatetime` en double** — l'optimiste local ayant été retiré, rien ne débounce un second tap pendant la latence d'écho HA. Écritures **idempotentes** (même phase en sortie) → accepté ; un garde `pending` réintroduirait l'état local supprimé exprès. À revisiter seulement si des doublons d'historique HA gênent. [src/widgets/BinTile.tsx]
- **Identité jaune vs noire portée par la couleur d'icône seule** (WCAG 1.4.1 / UX-DR14) — pré-existant ; l'`aria-label` porte le texte et `oubli`/`sortie` utilisent des repères non-colorés (épaisseur de bordure / forme ✓). Accepté pour un kiosque mono-utilisateur ; ajouter une forme/lettre si un daltonien entre dans le scope. [src/widgets/BinTile.tsx]
- **La confirmation `sortie` est un `<button disabled>`** — les lecteurs d'écran sautent les contrôles désactivés → état « fait » visuel seul. Accepté (pas d'utilisateur AT sur le kiosque) ; passer `disabled`→`aria-disabled` si ça change. [src/widgets/BinTile.tsx]
- **Risque fuseau de `haDateTime`** — ✅ **RÉSOLU cette session** : l'écriture envoie désormais un epoch `timestamp`, lu par HA sans ambiguïté de fuseau ; `haDateTime` supprimé. _(C'était le point le plus solide de la revue ; corrigé dans `9f14001`.)_
