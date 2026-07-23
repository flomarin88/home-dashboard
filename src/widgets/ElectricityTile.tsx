import { useNavigate } from "react-router-dom";
import type { EntityName } from "@hakit/core";
import { electricityConfig } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { electricityView } from "./electricity-cost";
import { formatEuro, formatKwh } from "./consumption-format";
import { BoltIcon } from "./ConsumptionIcons";

/**
 * ElectricityTile (Story 9.1) — a compact "coût du jour" glance in the top bar:
 * bolt icon + derived daily cost (hero) + a consumption subline (variant B,
 * UX-DR23). Tappable → the `/electricite` detail page (like `TopBarWeather →
 * /meteo`) — the unit price + history + HC/HP seam live there, not on the chip.
 *
 * Reflect-only (AD-3/AD-16): reads the daily-kWh sensor + the price helper via
 * `useEntityValue`; cost = kWh × price is a display derivation, never persisted.
 * No HA write, no optimism (unlike the ritual tiles). Neutral chip — no domain
 * accent (UX-DR24). Obsolescence (AD-6): any stale input dims the whole chip
 * (opacity-60) and the label says "hors ligne"; the last-known value is kept
 * (never blank). The "Hors ligne · HH:MM" pill lives on the detail page (room),
 * matching the top-bar family (weather/plant/turtle dim without a pill) and
 * keeping this 5th chip narrow (top-bar collision, deferred-work.md:21).
 */
export function ElectricityTile() {
  const cfg = electricityConfig();
  const navigate = useNavigate();
  const kwh = useEntityValue(cfg.dailyKwhEntityId as EntityName);
  const price = useEntityValue(cfg.priceEntityId as EntityName);

  const view = electricityView({ kwh: kwh.value, price: price.value });
  const anyStale = kwh.isStale || price.isStale;
  const costLabel = formatEuro(view.cost);
  const kwhLabel = formatKwh(view.kwh);

  return (
    <button
      type="button"
      onClick={() => navigate("/electricite")}
      aria-label={`Électricité : ${costLabel} aujourd'hui, ${kwhLabel}${
        anyStale ? " — hors ligne" : ""
      } — ouvrir le détail`}
      className={`inline-flex min-h-[56px] items-center gap-2 rounded-lg border border-card-border bg-card-fill px-4 backdrop-blur-glass ${
        anyStale ? "opacity-60" : ""
      }`}
    >
      <BoltIcon size={18} className="text-text-muted" />
      <span className="flex flex-col items-start leading-tight">
        <span className="text-label font-semibold tabular-nums text-text">
          {costLabel}
        </span>
        <span className="text-caption tabular-nums text-text-muted">
          {kwhLabel}
        </span>
      </span>
    </button>
  );
}
