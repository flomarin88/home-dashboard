import { useEffect, useRef } from "react";
import { useService } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import { plantsConfig } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { offerUndo } from "../state/undo";
import { plantView, type PlantFill } from "./plant-state";

/**
 * PlantTile (Story 7.1) — the daily plant-watering reminder, a permanent tile in
 * the TOP BAR (a `TopBarSlots` child, 6.4). The `maximum: 1` twin of TurtleTile
 * (6.3): reflects `counter.plantes_arrosees` (0 = à arroser, 1 = arrosé today);
 * the schedule/reset live in HA (AD-4: a midnight automation).
 *
 * HA is the single source of truth (like TurtleTile): the tile only mirrors the
 * counter, and a tap calls `counter.increment` — HA re-evaluates and echoes the
 * new count. No local optimistic state. The tile fills from the bottom (empty →
 * full); at 1/1 it stays visible but disabled until the midnight reset. Offline →
 * dimmed + inert (AD-6), never hidden (like TurtleTile, unlike BinTile).
 */
const FILL_HEIGHT: Record<PlantFill, string> = {
  empty: "h-0",
  full: "h-full",
};

export function PlantTile() {
  const cfg = plantsConfig();
  const { value, isStale } = useEntityValue(cfg.counterEntityId as EntityName);
  const svc = useService("counter");

  const view = plantView(value);
  const interactive = !isStale && !view.done;

  // In-flight guard: the counter is NOT idempotent, so a double-tap during the HA
  // round-trip could over-count. `maximum: 1` clamps it HA-side, but keep the
  // guard for parity with TurtleTile and to avoid a wasted second write. This is a
  // write debounce, NOT display-optimism — the shown state still mirrors HA.
  const pending = useRef(false);
  useEffect(() => {
    pending.current = false;
  }, [value]);

  // Tap → increment the HA counter (no serviceData). HA echoes the new count.
  // On failure, release the guard so a retry is possible. Then offer a 5 s undo
  // (misclick safety-net, UX-DR9): the reverse is `counter.decrement`, floored at
  // 0 by the HA counter's min so an undo after a reset can't underflow.
  const water = () => {
    if (!interactive || pending.current) return;
    pending.current = true;
    void Promise.resolve(svc.increment({ target: cfg.counterEntityId }))
      .then(() => {
        // Offer the undo ONLY once the write landed (D3): a failed increment
        // has nothing to revert, so a phantom undo (→ decrement of a no-op)
        // would be misleading.
        offerUndo(
          "Plantes arrosées",
          () => {
            void Promise.resolve(
              svc.decrement({ target: cfg.counterEntityId }),
            ).catch((err) => console.warn("plant: undo decrement failed", err));
          },
          5000,
        );
      })
      .catch((err) => {
        pending.current = false;
        console.warn("plant: counter.increment failed", err);
      });
  };

  const label = `Arrosage : ${view.done ? "fait" : "à faire"}${interactive ? " — arroser" : ""}`;

  return (
    <button
      type="button"
      onClick={water}
      disabled={!interactive}
      aria-label={label}
      className={`relative inline-flex min-h-[56px] items-center justify-center overflow-hidden rounded-lg border border-card-border bg-card-fill px-4 backdrop-blur-glass ${
        isStale ? "opacity-60" : ""
      }`}
    >
      {/* Tile-background fill, rises bottom-up with the watering. The height
          (empty/full) is the non-colour cue (UX-DR14/UX-DR22); colour is secondary. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 ${FILL_HEIGHT[view.fill]} bg-security-ok/25 transition-[height] duration-300`}
      />
      <PlantIcon className="relative text-text" />
    </button>
  );
}

function PlantIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* Potted plant: a leafy stem rising from a pot. */}
      <path d="M12 22V12" />
      <path d="M12 12c0-3 2-5 5-5-.3 3-2.2 5-5 5Z" />
      <path d="M12 14c0-3-2-5-5-5 .3 3 2.2 5 5 5Z" />
      <path d="M6 22h12l-1-6H7l-1 6Z" />
    </svg>
  );
}
