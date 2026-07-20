import { useEntity, useService } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import type { EntityEntry } from "../entities";
import { getRoom } from "../entities";
import { useOptimisticControl } from "../hakit/useOptimisticControl";
import { useOptimisticAttr } from "../hakit/useOptimisticAttr";
import { lightModel } from "../state/control-model";

// Local light → fast echo; debounce just coalesces a burst of palier taps.
const LIGHT_DEBOUNCE_MS = 400;

/** Brightness paliers offered on the tile (percent). */
export const BRIGHTNESS_STEPS = [20, 40, 60, 80, 100] as const;

interface LightAttrs {
  brightness?: number; // 0..255
  color_temp_kelvin?: number;
  min_color_temp_kelvin?: number;
  max_color_temp_kelvin?: number;
  supported_color_modes?: string[];
}

export interface ColorPreset {
  readonly key: "warm" | "neutral" | "cool";
  readonly label: string;
  readonly kelvin: number;
}

/**
 * Light state + intents, capability-driven — the tile only offers what the lamp
 * actually supports (`supported_color_modes`). On/off is the state token via
 * `useOptimisticControl` + `lightModel`; brightness and color-temperature are
 * numeric ATTRIBUTES with their own optimistic overlays (`useOptimisticAttr`,
 * shared with climate) since they can't share the single per-entity pending slot
 * (AD-11). An Elgato Key Light reports `color_temp` only (no RGB): the tile shows
 * brightness paliers + warm/neutral/cool presets, no colour dots.
 */
export interface LightState {
  isStale: boolean;
  failed: boolean;
  on: boolean;
  label: string;
  toggle: () => void;
  supportsBrightness: boolean;
  /** 0..100, or null when off/unknown. */
  brightnessPct: number | null;
  setBrightness: (pct: number) => void;
  supportsColorTemp: boolean;
  colorTempK: number | null;
  presets: readonly ColorPreset[];
  setColorTemp: (kelvin: number) => void;
}

export function useLight(entry: EntityEntry): LightState {
  const id = entry.entityId as EntityName;
  const entity = useEntity(id, { returnNullIfNotFound: true });
  const lightSvc = useService("light");
  const { displayState, send, isStale, failed } = useOptimisticControl(
    id,
    lightModel,
  );

  const attrs = (entity?.attributes ?? {}) as unknown as LightAttrs;
  const modes = attrs.supported_color_modes ?? [];
  // Every colour mode except the bare on/off implies brightness support.
  const supportsBrightness = modes.some((m) => m !== "onoff");
  const supportsColorTemp = modes.includes("color_temp");

  const confirmedPct =
    attrs.brightness != null
      ? Math.round((attrs.brightness / 255) * 100)
      : null;
  const [brightnessPct, setBrightness] = useOptimisticAttr<number>(
    confirmedPct,
    (pct) =>
      lightSvc.turnOn({ target: id, serviceData: { brightness_pct: pct } }),
    LIGHT_DEBOUNCE_MS,
  );

  const confirmedK = attrs.color_temp_kelvin ?? null;
  const [colorTempK, setColorTemp] = useOptimisticAttr<number>(
    confirmedK,
    (k) =>
      lightSvc.turnOn({ target: id, serviceData: { color_temp_kelvin: k } }),
    LIGHT_DEBOUNCE_MS,
  );

  const minK = attrs.min_color_temp_kelvin ?? 2700;
  const maxK = attrs.max_color_temp_kelvin ?? 6500;
  const presets: readonly ColorPreset[] = [
    { key: "warm", label: "Chaud", kelvin: minK },
    { key: "neutral", label: "Neutre", kelvin: Math.round((minK + maxK) / 2) },
    { key: "cool", label: "Froid", kelvin: maxK },
  ];

  const on = displayState === "on";
  return {
    isStale,
    failed,
    on,
    label: entry.label ?? getRoom(entry.room).label,
    toggle: () => send(on ? "off" : "on"),
    supportsBrightness,
    brightnessPct,
    setBrightness,
    supportsColorTemp,
    colorTempK,
    presets,
    setColorTemp,
  };
}

/** The preset key closest to the current colour temperature, or null. */
export function nearestPresetKey(state: LightState): string | null {
  if (state.colorTempK == null) return null;
  let best = state.presets[0];
  for (const p of state.presets) {
    if (
      Math.abs(p.kelvin - state.colorTempK) <
      Math.abs(best.kelvin - state.colorTempK)
    ) {
      best = p;
    }
  }
  return best.key;
}
