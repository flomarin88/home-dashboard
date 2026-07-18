import { useEffect, useRef } from "react";
import { useService } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import { turtlesConfig } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { offerUndo } from "../state/undo";
import { turtleView, type TurtleFill } from "./turtle-state";

/**
 * TurtleTile (Story 6.3) — the turtle-feeding reminder, a permanent tile in the
 * TOP BAR (a `TopBarSlots` child, 6.4). Reflects `counter.tortues_repas` (0..2
 * feedings today); the schedule/reset live in HA (AD-4: a midnight automation).
 *
 * HA is the single source of truth (like BinTile after 6.1's rework): the tile
 * only mirrors the counter, and a tap calls `counter.increment` — HA re-evaluates
 * and echoes the new count. No local optimistic state. The tile fills from the
 * bottom (empty → half → full); at 2/2 it stays visible but disabled until the
 * midnight reset. Offline → dimmed + inert (AD-6), never hidden (unlike BinTile).
 */
const FILL_HEIGHT: Record<TurtleFill, string> = {
  empty: "h-0",
  half: "h-1/2",
  full: "h-full",
};

export function TurtleTile() {
  const cfg = turtlesConfig();
  const { value, isStale } = useEntityValue(cfg.counterEntityId as EntityName);
  const svc = useService("counter");

  const view = turtleView(value);
  const interactive = !isStale && !view.done;

  // In-flight guard: the counter is NOT idempotent (unlike BinTile's timestamp),
  // so a double-tap during the HA round-trip would over-count (0→2 from one tap).
  // Block a second write until HA echoes a new count. This is a write debounce,
  // NOT the display-optimism removed in 6.1 — the shown state still mirrors HA.
  const pending = useRef(false);
  useEffect(() => {
    pending.current = false;
  }, [value]);

  // Tap → increment the HA counter (no serviceData). HA echoes the new count.
  // On failure, release the guard so a retry is possible. Then offer a 5 s undo
  // (misclick safety-net, UX-DR9): the reverse is `counter.decrement`, floored
  // at 0 by the HA counter's min so an undo after a reset can't underflow.
  const feed = () => {
    if (!interactive || pending.current) return;
    pending.current = true;
    void Promise.resolve(svc.increment({ target: cfg.counterEntityId })).catch(
      (err) => {
        pending.current = false;
        console.warn("turtle: counter.increment failed", err);
      },
    );
    offerUndo(
      "Tortues nourries",
      () => {
        void Promise.resolve(
          svc.decrement({ target: cfg.counterEntityId }),
        ).catch((err) => console.warn("turtle: undo decrement failed", err));
      },
      5000,
    );
  };

  const label = `Tortues : ${view.count} repas sur 2${interactive ? " — nourrir" : ""}`;

  return (
    <button
      type="button"
      onClick={feed}
      disabled={!interactive}
      aria-label={label}
      className={`relative inline-flex min-h-[56px] items-center justify-center overflow-hidden rounded-lg border border-card-border bg-card-fill px-4 backdrop-blur-glass ${
        isStale ? "opacity-60" : ""
      }`}
    >
      {/* Tile-background fill, rises bottom-up with the feeding count. The height
          (empty/half/full) is the non-colour cue (UX-DR14); colour is secondary. */}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 bottom-0 ${FILL_HEIGHT[view.fill]} bg-security-ok/25 transition-[height] duration-300`}
      />
      <TurtleIcon className="relative text-text" />
    </button>
  );
}

function TurtleIcon({ className = "" }: { className?: string }) {
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
      <path d="M4 15a8 8 0 0 1 16 0" />
      <path d="M4 15h16" />
      <path d="M20 15c1.6 0 2.4-1 2.4-2.3" />
      <path d="M6.5 15 5.5 18" />
      <path d="M10.5 15 9.5 18" />
      <path d="m13.5 15 1 3" />
      <path d="m17.5 15 1 3" />
    </svg>
  );
}
