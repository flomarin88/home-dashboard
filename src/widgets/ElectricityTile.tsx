import { useNavigate } from "react-router-dom";
import type { EntityName } from "@hakit/core";
import { electricityConfig } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { useStatistics } from "../hakit/useStatistics";
import {
  dayLabel,
  selectLastCompleteDay,
  startOfDay,
} from "../energy/statistics";
import { normalisePeriod } from "./electricity-cost";
import {
  formatEuro,
  formatKwh,
  periodLabel,
  periodName,
  periodTone,
} from "./consumption-format";
import { BoltIcon, PeriodIcon } from "./ConsumptionIcons";

/** Unit conversion asked of HA: the Linky statistic is in Wh, the screen reads kWh. */
const UNITS = { energy: "kWh" } as const;

/**
 * ElectricityTile (Story 9.1 → 9.2 → 9.4) — a compact glance in the top bar:
 * bolt icon + the cost of the LAST COMPLETE DAY (hero) + a dated consumption
 * subline ("Hier · 8,2 kWh"), plus the HC/HP pill of 9.2. Tappable → the
 * `/electricite` detail page.
 *
 * The consumption is not an entity (Story 9.4): the house's source, ha-linky,
 * writes long-term statistics into HA's recorder, imported each morning for
 * the day before. So this tile READS BY QUERY (`recorder.get_statistics`,
 * AD-17) through `useStatistics`, shows the most recent complete day — never
 * today, which cannot be complete — and always SAYS which day it is (UX-DR30):
 * "Hier" when it is yesterday, the short date when the morning import has not
 * landed yet. The cost is computed BY HA (ha-linky `costs`); nothing is
 * multiplied here any more (AD-4). Cost and consumption are two statistics,
 * read independently: one missing renders "—" without hiding the other.
 *
 * Freshness is the query's, not an entity's: `isStale` means the last request
 * failed or HA is unreachable, and the last known day stays on screen, dimmed
 * (AD-17/NFR4). The period pill still reflects an entity (AD-6) and takes part
 * in the same dimming rule — if ANY input the chip shows is stale, the glance
 * as a whole is not to be trusted. "Hors ligne · HH:MM" lives on the detail
 * page, as in the whole top-bar family.
 *
 * Neutral chip; the pill wears the compact "HC"/"HP" form (Florian, 2026-07-28)
 * and its tint is never the only carrier — glyph and letters say it (UX-DR14).
 * No `Date.now()` in the render path: `new Date()` is taken once and handed to
 * the pure functions, which is what keeps them testable without timers.
 */
export function ElectricityTile() {
  const cfg = electricityConfig();
  const navigate = useNavigate();
  const stats = useStatistics({
    statisticIds: [cfg.consumptionStatisticId, cfg.costStatisticId],
    period: "day",
    units: UNITS,
  });
  const period = useEntityValue(cfg.periodEntityId as EntityName);

  const today = startOfDay(new Date());
  const conso = selectLastCompleteDay(
    stats.rows[cfg.consumptionStatisticId] ?? [],
    today,
  );
  const cost = selectLastCompleteDay(
    stats.rows[cfg.costStatisticId] ?? [],
    today,
  );
  // The day named is the one actually shown: the consumption's if we have it,
  // else the cost's. Both come from the same import, so they normally agree.
  const shown = conso ?? cost;
  const label = shown ? dayLabel(shown.start, today) : null;

  const anyStale = stats.isStale || period.isStale;
  const tariff = normalisePeriod(period.value);
  const tone = periodTone(tariff);

  const costLabel = formatEuro(cost?.value);
  const kwhLabel = formatKwh(conso?.value);
  // The dated subline (UX-DR30). Placeholder while the first query is in
  // flight ("—", same footprint), an explicit rendered state when no complete
  // day exists (UX-DR27) — never a blank line.
  const dayLine = label
    ? `${label.short} · ${kwhLabel}`
    : stats.loading
      ? "—"
      : "Pas encore de relevé";
  const spokenDay = label ? ` ${label.long}` : "";
  const spokenPeriod =
    tariff === null
      ? "période inconnue"
      : `heures ${periodName(tariff).toLowerCase()}`;

  return (
    <button
      type="button"
      onClick={() => navigate("/electricite")}
      aria-label={`Électricité : ${costLabel}${spokenDay}, ${kwhLabel}, ${spokenPeriod}${
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
        <span
          data-testid="electricity-day"
          className="whitespace-nowrap text-caption tabular-nums text-text-muted"
        >
          {dayLine}
        </span>
      </span>
      {/* Tinted pill — green for creuses, amber for pleines, per the mock
          (Florian, 2026-07-28). The glyph and the letters carry the meaning on
          their own; the colour only makes it readable at a glance from across
          the kitchen (UX-DR14). The accessible name above already spells the
          period, so the pill stays decorative rather than being read twice. */}
      <span
        aria-hidden="true"
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption ${tone.soft} ${tone.text}`}
      >
        <PeriodIcon period={tariff} size={12} />
        {tariff === null ? `Période ${periodLabel(null)}` : periodLabel(tariff)}
      </span>
    </button>
  );
}
