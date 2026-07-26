import { useNavigate } from "react-router-dom";
import type { EntityEntry } from "../entities";
import { useClimate, type ClimateState } from "./useClimate";
import { SetpointStepper, ClimateIcon } from "./ClimateControls";
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
      className="relative flex flex-col gap-3 rounded-md border border-tile-border bg-tile-fill px-4 py-3"
    >
      {/* Full-tile tap target → detail. Absolutely positioned so it is a SIBLING
          of the ± buttons, never their parent — a nested <button> is invalid
          HTML (same rule as VacuumTile). Transparent, and positioned elements
          paint above non-positioned siblings, so it covers the header and the
          summary: they read normally but tap through to the detail. Explicit
          offsets rather than `inset-0`, matching KioskShell's convention. */}
      <button
        type="button"
        onClick={() => navigate("/climatisation")}
        aria-label="Ouvrir le détail de la climatisation"
        className="absolute top-0 right-0 bottom-0 left-0 rounded-md"
      />

      {/* Header — shared tile template. It no longer carries `onOpen`: the whole
          tile navigates now, and two competing tap targets would only fight. */}
      <TileHeader icon={<ClimateIcon />} title="Climatisation" />

      {/* Temperature — the only thing the tile controls. Powered off → the
          control block greys out, same treatment as the Bureau tile
          (`LightTile`): header and running summary stay legible, only the
          control dims. The dim has to live HERE because the tile reuses
          `SetpointStepper` alone, not the wrapping <div> of `ClimateControls`
          that carries it on the detail page — which is why the tile had the
          `disabled` but never the grey. */}
      {/* Running: only the ± buttons sit above the overlay, so they bump the
          setpoint while the rest of the row still taps through to the detail.
          Off: the block drops below the overlay entirely — the ± are disabled
          anyway, and a powered-off tile is wholly a gateway to the detail. */}
      <div
        className={
          c.isOff
            ? "pointer-events-none opacity-30"
            : "pointer-events-none relative z-10 [&_button]:pointer-events-auto"
        }
      >
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
      </div>

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
