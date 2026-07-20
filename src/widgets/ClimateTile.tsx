import { useNavigate } from "react-router-dom";
import type { EntityEntry } from "../entities";
import { useClimate, type ClimateState } from "./useClimate";
import { SetpointStepper, ClimateIcon, PowerToggle } from "./ClimateControls";
import { OfflinePill } from "../ui/OfflinePill";
import { TileHeader } from "../ui/TileHeader";
import { hvacModeLabel, fanLabel } from "./climate-status";

/**
 * ClimateTile (FR6, Story 2.6 → Intent B) — the compact home tile for the
 * upstairs A/C. It controls ONE thing: the temperature (−/+). Mode, speed and
 * oscillation are read-only here — a glance summary ("Froid · Vitesse 1") — and
 * are set on the `/climatisation` detail page, opened by tapping the header. This
 * keeps the tile short so the floor-grouped home fits 1024×768 with no scroll
 * (resolves TD-8). Offline → a non-interactive "Hors ligne" tile (AD-6).
 *
 * All state/optimism lives in `useClimate` (shared with the detail page, DRY);
 * this component is a pure renderer of a subset of it.
 */
export function ClimateTile({ entry }: { entry: EntityEntry }) {
  const navigate = useNavigate();
  const c = useClimate(entry);

  if (c.isStale) {
    return (
      <div
        data-domain="climate"
        className="flex flex-col gap-2 rounded-md border border-dashed border-stale bg-tile-fill px-4 py-3 text-stale-text"
      >
        <TileHeader icon={<ClimateIcon />} title="Climatisation" />
        <OfflinePill />
      </div>
    );
  }

  return (
    <div
      data-domain="climate"
      className="flex flex-col gap-3 rounded-md border border-tile-border bg-tile-fill px-4 py-3"
    >
      {/* Header — shared tile template: title taps through to /climatisation,
          power toggle in the top-right slot (siblings, never nested). */}
      <TileHeader
        icon={<ClimateIcon />}
        title="Climatisation"
        onOpen={() => navigate("/climatisation")}
        openLabel="Ouvrir le détail de la climatisation"
        right={<PowerToggle on={!c.isOff} onToggle={c.togglePower} />}
      />

      {/* Temperature — the only thing the tile controls */}
      {c.hasSetpoint ? (
        <SetpointStepper
          value={c.setpointValue as number}
          disabled={c.isOff}
          onBump={c.bump}
        />
      ) : (
        <div className="text-center text-title font-semibold text-text">
          {hvacModeLabel(c.mode)}
        </div>
      )}

      {/* Read-only running summary (mode · speed) — set on the detail page */}
      <div className="flex items-center gap-1.5 border-t border-tile-border pt-2 text-meta text-text-muted">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            c.isOff
              ? "bg-stale"
              : "bg-accent-climate shadow-[0_0_6px_var(--color-accent-climate)]"
          }`}
        />
        <span className="font-semibold text-text">{statusSummary(c)}</span>
      </div>
    </div>
  );
}

/** Read-only one-liner: "Éteinte" when off, else "<Mode> · Vitesse N". */
function statusSummary(c: ClimateState): string {
  if (c.isOff) return "Éteinte";
  const label = hvacModeLabel(c.mode);
  const fan = c.fanValue;
  if (fan == null) return label;
  const speed = /^\d+$/.test(fan) ? `Vitesse ${fan}` : fanLabel(fan);
  return `${label} · ${speed}`;
}
