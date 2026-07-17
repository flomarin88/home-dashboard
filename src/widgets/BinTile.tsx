import { useService } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import { binsConfig } from "../entities";
import { useEntityValue } from "../hakit/useEntityValue";
import { binView } from "./bin-state";
import type { BinColor } from "./bin-state";

/**
 * BinIndicator (Story 6.1) — the bin-out reminder, a compact icon in the TOP BAR.
 * Reflects `sensor.poubelle_a_sortir` (schedule + oubli/ack logic live in HA,
 * AD-4). HA is the single source of truth: the tile only mirrors it, and every
 * tap writes an `input_datetime` that HA re-evaluates the sensor from. Phases:
 *   - `a_sortir` → bin due now; tap writes `sortie` (marks it out).
 *   - `sortie`   → taken out; a disabled "done ✓" confirmation until `aucune`.
 *   - `oubli`    → missed; red thicker border; tap writes `oubli_ack` (dismiss,
 *                  no sortie logged) → HA moves to `{c}_oubli_ack` → hidden, and
 *                  because the ack lives in HA it stays hidden across reloads.
 * Hidden for `aucune` and `{c}_oubli_ack`.
 *
 * It NEEDS HA (`useEntity`) so it must live UNDER the provider — but the TopBar is
 * ABOVE the connection gate (TD-1). So it's mounted inside `HakitProvider`
 * (KioskShell) and `fixed`-positioned into the top-bar area (like UndoToast).
 */
const COLOR: Record<BinColor, string> = {
  jaune: "text-yellow-400",
  noire: "text-neutral-400", // "noire" bin, lightened for contrast on the dark ground
  idle: "text-text-muted",
};

const BIN_NAME: Record<BinColor, string> = {
  jaune: "jaune",
  noire: "noire",
  idle: "",
};

export function BinTile() {
  const cfg = binsConfig();
  const { value, isStale } = useEntityValue(cfg.stateEntityId as EntityName);
  const svc = useService("input_datetime");

  const view = binView(value);

  // Present only when there's a bin to deal with, online. Absent otherwise — an
  // optional top-bar hint. `phase === null` covers `aucune` and `{c}_oubli_ack`.
  if (isStale || view.bin == null || view.phase == null) return null;

  const isOubli = view.phase === "oubli";
  const isSortie = view.phase === "sortie";

  // a_sortir → write the sortie timestamp; oubli → write the ack timestamp
  // (dismiss without logging a sortie). sortie is a passive confirmation.
  // Epoch seconds (not a local wall-clock string) so HA reads it unambiguously
  // whatever the kiosk's timezone. Fire-and-forget, but surface a failed call.
  const onTap = () => {
    if (!view.bin || isSortie) return;
    void Promise.resolve(
      svc.setDatetime({
        target: isOubli ? cfg.ack[view.bin] : cfg.sortie[view.bin],
        serviceData: { timestamp: Math.floor(Date.now() / 1000) },
      }),
    ).catch((err) => console.warn("bin: setDatetime failed", err));
  };

  const name = BIN_NAME[view.color];
  const label = isSortie
    ? `Poubelle ${name} sortie`
    : isOubli
      ? `Poubelle ${name} oubliée — masquer`
      : `Poubelle ${name} à sortir — marquer sortie`;

  return (
    <button
      type="button"
      onClick={onTap}
      disabled={isSortie}
      aria-label={label}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-card-fill px-4 backdrop-blur-glass ${
        isOubli ? "border-2 border-security-alert" : "border border-card-border"
      } ${isSortie ? "opacity-60" : ""}`}
    >
      <PoubelleIcon className={COLOR[view.color]} />
      {isSortie ? <CheckIcon /> : null}
    </button>
  );
}

function PoubelleIcon({ className = "" }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-security-ok"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
