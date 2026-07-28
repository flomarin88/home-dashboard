import { useNavigate } from "react-router-dom";
import type { EntityName } from "@hakit/core";
import { electricityConfig } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { electricityView } from "./electricity-cost";
import {
  formatEuro,
  formatKwh,
  periodLabel,
  periodName,
} from "./consumption-format";
import { BoltIcon, PeriodIcon } from "./ConsumptionIcons";

/**
 * ElectricityTile (Story 9.1, tariff-aware since 9.2) — a compact "coût du jour"
 * glance in the top bar: bolt icon + derived daily cost (hero) + a consumption
 * subline (variant B, UX-DR23), plus an HC/HP pill since 9.2. Tappable → the
 * `/electricite` detail page (like `TopBarWeather → /meteo`) — the two prices,
 * the applied tariff, the next switch and the history live there, not on the chip.
 *
 * Reflect-only (AD-3/AD-16): reads four entities via `useEntityValue`; cost =
 * kWh × the price of the CURRENT period is a display derivation, never
 * persisted. No HA write, no optimism (unlike the ritual tiles). The app never
 * decides which period it is — it reflects a `binary_sensor` HA evaluates (AD-4).
 *
 * Neutral chip and neutral pill — no domain accent (UX-DR24), and the period is
 * carried by glyph AND word, never by colour (UX-DR14). Obsolescence (AD-6): any
 * stale input dims the whole chip (opacity-60) and the label says "hors ligne";
 * the last-known value is kept (never blank), which is what lets a period seen
 * earlier keep pricing the day. The "Hors ligne · HH:MM" pill lives on the
 * detail page (room), matching the top-bar family.
 *
 * The pill wears the COMPACT "HC"/"HP" form — UX-DR23's responsive fallback,
 * activated up front by Florian on 2026-07-28 because Story 10.1 had just taken
 * the bar to six chips. The accessible name still spells the period out.
 */
export function ElectricityTile() {
  const cfg = electricityConfig();
  const navigate = useNavigate();
  const kwh = useEntityValue(cfg.dailyKwhEntityId as EntityName);
  const period = useEntityValue(cfg.periodEntityId as EntityName);
  const priceCreuses = useEntityValue(cfg.priceCreusesEntityId as EntityName);
  const pricePleines = useEntityValue(cfg.pricePleinesEntityId as EntityName);

  const view = electricityView({
    kwh: kwh.value,
    priceCreuses: priceCreuses.value,
    pricePleines: pricePleines.value,
    period: period.value,
  });

  // One dimming rule for the whole chip, shared with the rest of the top-bar
  // family: if ANY input it displays is stale, the glance as a whole is not to
  // be trusted. `nextSwitch` is deliberately absent — a detail-page concern, and
  // dimming the chip over a value it never shows would be noise.
  const anyStale =
    kwh.isStale ||
    period.isStale ||
    priceCreuses.isStale ||
    pricePleines.isStale;

  const costLabel = formatEuro(view.cost);
  const kwhLabel = formatKwh(view.kwh);
  const spokenPeriod =
    view.period === null
      ? "période inconnue"
      : `heures ${periodName(view.period).toLowerCase()}`;

  return (
    <button
      type="button"
      onClick={() => navigate("/electricite")}
      aria-label={`Électricité : ${costLabel} aujourd'hui, ${kwhLabel}, ${spokenPeriod}${
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
      {/* Neutral pill: the chip's own fill and border, no accent (UX-DR24). The
          accessible name above already carries the period, so the pill is
          decorative to a screen reader rather than read twice. */}
      <span
        aria-hidden="true"
        className="inline-flex items-center gap-1 rounded-full border border-card-border bg-card-fill px-2 py-0.5 text-caption text-text-muted"
      >
        <PeriodIcon period={view.period} size={12} />
        {view.period === null
          ? `Période ${periodLabel(null)}`
          : periodLabel(view.period)}
      </span>
    </button>
  );
}
