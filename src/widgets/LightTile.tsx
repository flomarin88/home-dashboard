import type { EntityEntry } from "../entities";
import {
  useLight,
  nearestPresetKey,
  BRIGHTNESS_STEPS,
  type LightState,
} from "./useLight";
import { OfflinePill } from "../ui/OfflinePill";
import { TileHeader } from "../ui/TileHeader";

/**
 * LightTile (FR2/FR3, Story 2.3→2.4) — the bespoke light control tile. On/off by
 * tapping the header (optimistic + convergence via `lightModel`); then, when the
 * lamp supports them, inline **intensité** (5 paliers) and **température** presets
 * (warm/neutral/cool), each an optimistic attribute overlay (`useLight`). Amber
 * accent + glow signal "on"; the control rows dim + disable when off. An Elgato
 * Key Light is white-only → no RGB dots. Offline → non-interactive "Hors ligne"
 * tile (AD-6). Capability-driven: rows appear only per `supported_color_modes`.
 */
export function LightTile({ entry }: { entry: EntityEntry }) {
  const c = useLight(entry);

  if (c.isStale) {
    return (
      <div
        data-domain="lights"
        className="flex flex-col gap-2 rounded-md border border-dashed border-stale bg-tile-fill px-4 py-3 text-stale-text"
      >
        <TileHeader icon={<BulbIcon />} title={c.label} />
        <OfflinePill />
      </div>
    );
  }

  const status = !c.on
    ? "Éteint"
    : c.failed
      ? "Échec"
      : c.brightnessPct != null
        ? `Allumé · ${c.brightnessPct} %`
        : "Allumé";
  const dim = c.on ? "" : "pointer-events-none opacity-30";

  return (
    <div
      data-domain="lights"
      className={`flex flex-col gap-3 rounded-md border px-4 py-3 ${
        c.on
          ? "border-accent-lights/50 bg-accent-lights/10"
          : "border-tile-border bg-tile-fill"
      }`}
    >
      {/* Header — shared tile template (icon + title positioned like every tile);
          tapping the title toggles on/off, status sits in the right slot. */}
      <TileHeader
        icon={<BulbIcon />}
        title={c.label}
        onOpen={c.toggle}
        openLabel={c.on ? `Éteindre ${c.label}` : `Allumer ${c.label}`}
        right={
          <span
            className={`text-meta tabular-nums ${
              c.on ? "text-accent-lights" : "text-text-muted"
            }`}
          >
            {status}
          </span>
        }
      />

      {c.supportsBrightness ? (
        <div className={`flex flex-col gap-1.5 ${dim}`}>
          <span className="text-caption font-semibold uppercase tracking-wide text-text-muted">
            Intensité
          </span>
          <div
            role="group"
            aria-label="Intensité"
            className="grid grid-cols-5 gap-1.5"
          >
            {BRIGHTNESS_STEPS.map((step) => {
              const lit =
                c.on && c.brightnessPct != null && c.brightnessPct >= step;
              return (
                <button
                  key={step}
                  type="button"
                  disabled={!c.on}
                  aria-label={`${step} %`}
                  onClick={() => c.setBrightness(step)}
                  className={`min-h-[40px] rounded-sm border text-caption font-semibold tabular-nums ${
                    lit
                      ? "border-accent-lights bg-accent-lights text-[#1a1206]"
                      : "border-tile-border bg-tile-fill text-text-muted"
                  }`}
                >
                  {step}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {c.supportsColorTemp ? (
        <div className={`flex flex-col gap-1.5 ${dim}`}>
          <span className="text-caption font-semibold uppercase tracking-wide text-text-muted">
            Température
          </span>
          <div
            role="group"
            aria-label="Température"
            className="grid grid-cols-3 gap-1.5"
          >
            {c.presets.map((p) => {
              const active = c.on && nearestPresetKey(c) === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  disabled={!c.on}
                  onClick={() => c.setColorTemp(p.kelvin)}
                  className={`min-h-[40px] rounded-sm border text-caption font-semibold ${
                    active
                      ? "border-accent-lights bg-accent-lights/15 text-accent-lights"
                      : "border-tile-border bg-tile-fill text-text"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Bulb glyph; colour is owned by TileHeader (muted, like every tile icon). */
function BulbIcon() {
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
    >
      <path d="M9 18h6M10 21h4M12 2a7 7 0 0 0-4 12c.6.6 1 1.3 1 2h6c0-.7.4-1.4 1-2a7 7 0 0 0-4-12z" />
    </svg>
  );
}

export type { LightState };
