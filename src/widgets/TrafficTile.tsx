import type { EntityName } from "@hakit/core";
import { trafficConfig } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { useEntityRefresh } from "../hakit/useEntityRefresh";
import { trafficView } from "./traffic-view";
import { RouteIcon } from "./TrafficIcons";

/**
 * TrafficTile (Story 11.1, AD-18) — home → work travel time, on demand.
 *
 * Reflect-only for the VALUE (AD-3/AD-6: a plain `sensor.*` read through
 * `useEntityValue`), but the FRESHNESS is user-driven: the integration's
 * background polling is off HA-side because the Waze endpoint it leans on is
 * unofficial, so a tap calls `homeassistant.update_entity`. That makes this the
 * first tile in the kiosk whose data is asked for rather than pushed.
 *
 * Two departures from the top-bar family, both deliberate:
 *  - it is a `<button>` that ACTS on itself instead of navigating (there is no
 *    detail page in this story);
 *  - it shows NO duration until a refresh settles in this session (AD-18b) — a
 *    bounded exception to UX-DR10/NFR4, because a stale "34 min" is
 *    indistinguishable from a fresh one, unlike a stale temperature or cost.
 *
 * Otherwise it follows the family: same 56px mould, neutral chip with no domain
 * accent (UX-DR24), `opacity-60` when unavailable, and the "Hors ligne · HH:MM"
 * pill deliberately absent from the chip.
 */
export function TrafficTile() {
  const cfg = trafficConfig();
  const travel = useEntityValue(cfg.travelTimeEntityId as EntityName);

  // What "a new state landed" means for the wait. `since` alone is not enough:
  // HA leaves `last_changed` frozen when the value repeats, which is precisely
  // the nominal case here — hence the guard delay inside the hook.
  const settleKey = `${travel.value ?? ""}|${travel.since ?? ""}`;
  const { refresh, pending, failed, requestedAt } = useEntityRefresh(
    cfg.travelTimeEntityId,
    settleKey,
  );

  const view = trafficView({
    minutes: travel.value,
    isStale: travel.isStale,
    pending,
    failed,
    requestedAt,
  });

  // Dim only when there is nothing trustworthy to show. Waiting is not an
  // outage: dimming a tap the user just made would read as a rejection.
  const dimmed = view.kind === "unavailable";

  return (
    <button
      type="button"
      onClick={refresh}
      aria-label={view.aria}
      className={`inline-flex min-h-[56px] items-center gap-2 rounded-lg border border-card-border bg-card-fill px-4 backdrop-blur-glass ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <RouteIcon size={18} className="text-text-muted" />
      {/* Width pinned, not content-driven: the top bar is clipped rather than
          scrollable, so a chip that grows pushes a neighbour out of sight. */}
      <span
        data-testid="traffic-lines"
        className="flex w-[132px] flex-col items-start leading-tight"
      >
        <span className="truncate text-label font-semibold tabular-nums text-text">
          {view.hero}
        </span>
        {/* The waiting affordance is the WORDS plus a slow pulse — never a
            spinner, which UX-DR19/23/27 and DESIGN.md all rule out. The wait is
            ≥10 s by construction (HA's coordinator debouncer), so it needs to
            read as "working", not as a flash. */}
        <span
          className={`truncate text-caption text-text-muted ${
            view.kind === "pending" ? "animate-pulse" : ""
          }`}
        >
          {view.sub}
        </span>
      </span>
    </button>
  );
}
