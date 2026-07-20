import { useNavigate } from "react-router-dom";
import type { EntityEntry } from "../entities";
import { useClimate, type ClimateState } from "./useClimate";
import { SetpointStepper, ClimateIcon } from "./ClimateControls";
import { OfflinePill } from "../ui/OfflinePill";
import { hvacModeLabel, fanLabel, formatSetpoint } from "./climate-status";

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
        <div className="flex items-center gap-2">
          <ClimateIcon />
          <span className="text-label font-semibold text-text">
            Climatisation
          </span>
        </div>
        <OfflinePill />
      </div>
    );
  }

  return (
    <div
      data-domain="climate"
      className="flex flex-col gap-3 rounded-md border border-tile-border bg-tile-fill px-4 py-3"
    >
      {/* Header — tap to open the full controls on /climatisation */}
      <button
        type="button"
        onClick={() => navigate("/climatisation")}
        aria-label="Ouvrir le détail de la climatisation"
        className="flex min-h-[44px] items-center gap-2 text-left"
      >
        <ClimateIcon />
        <span className="text-label font-semibold text-text">
          Climatisation
        </span>
        <span className="flex-1" />
        <Chevron />
      </button>

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

      {/* Read-only footer: running summary + ambient (set on the detail page) */}
      <div className="flex items-center justify-between gap-2 border-t border-tile-border pt-2 text-meta text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              c.isOff
                ? "bg-stale"
                : "bg-accent-climate shadow-[0_0_6px_var(--color-accent-climate)]"
            }`}
          />
          <span className="font-semibold text-text">{statusSummary(c)}</span>
          <span className="rounded border border-tile-border px-1 text-caption text-text-muted">
            lecture
          </span>
        </span>
        {c.ambient != null ? (
          <span className="tabular-nums">
            Ambiant{" "}
            <span className="font-semibold text-text">
              {formatSetpoint(c.ambient)}°
            </span>
          </span>
        ) : null}
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

function Chevron() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-text-muted"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
