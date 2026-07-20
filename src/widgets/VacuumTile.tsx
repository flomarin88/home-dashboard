import { useNavigate } from "react-router-dom";
import { useEntity, useService } from "@hakit/core";
import type { EntityName } from "@hakit/core";
import type { EntityEntry } from "../entities";
import { useOptimisticControl } from "../hakit/useOptimisticControl";
import { vacuumModel } from "../state/control-model";
import { OfflinePill } from "../ui/OfflinePill";
import {
  vacuumStatusLabel,
  parseBattery,
  batteryColorClass,
} from "./vacuum-status";

/**
 * VacuumTile (FR10, UX-DR17) — the Roborock control cluster: status (icon +
 * label) + battery (icon + level, coloured) + actions (Lancer / Arrêter /
 * Retour base), violet accent.
 *
 * State/convergence flow through `useOptimisticControl` + `vacuumModel`
 * (optimistic <200ms → converge; `returning` transitional, AD-5). Two attributes
 * live on OTHER entities (HA split them out), read from the mapping (AD-7):
 *  - battery → a separate `sensor.…_battery` (`batteryEntityId`);
 *  - "Lancer" → runs a routine via a `button` entity (`startButtonEntityId`),
 *    not `vacuum.start`; the button press is issued here while the optimistic
 *    display still tracks the vacuum converging to `cleaning`.
 * Offline → non-interactive "Hors ligne" (AD-6); a timed-out command → "Échec".
 */
export function VacuumTile({ entry }: { entry: EntityEntry }) {
  const id = entry.entityId as EntityName;
  // Fall back to the vacuum id so the hooks are always called with a valid name;
  // battery then simply reads as "—" and the start button press is skipped.
  const batteryId = (entry.batteryEntityId ?? entry.entityId) as EntityName;
  const batterySensor = useEntity(batteryId, { returnNullIfNotFound: true });
  const buttonSvc = useService("button");
  const navigate = useNavigate();
  const { displayState, send, isStale, failed } = useOptimisticControl(
    id,
    vacuumModel,
  );

  const battery = parseBattery(batterySensor?.state);
  // Tapping the info area opens the detail page (Story 5.3); the action buttons
  // are siblings (not nested), so pressing them never navigates.
  const openDetail = () => navigate("/aspirateur");

  if (isStale) {
    return (
      <div
        data-domain="vacuum"
        className="flex flex-col gap-2 rounded-md border border-dashed border-stale bg-tile-fill px-4 py-3 text-stale-text"
      >
        <button
          type="button"
          onClick={openDetail}
          className="flex flex-col gap-2 text-left"
        >
          <Header />
          <OfflinePill />
        </button>
      </div>
    );
  }

  const state = displayState ?? "";
  const cleaning = state === "cleaning";
  const docked = state === "docked";

  const start = () => {
    if (entry.startButtonEntityId) {
      buttonSvc.press({ target: entry.startButtonEntityId });
    }
    send("cleaning"); // optimistic display + convergence on the vacuum entity
  };

  return (
    <div
      data-domain="vacuum"
      className="flex flex-col gap-2 rounded-md border border-tile-border bg-tile-fill px-4 py-3"
    >
      <button
        type="button"
        onClick={openDetail}
        aria-label="Aspirateur — ouvrir le détail"
        className="flex flex-col gap-2 text-left"
      >
        <Header />
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-meta text-text">
            <StatusIcon state={state} />
            {failed ? "Échec" : vacuumStatusLabel(displayState)}
          </span>
          <span
            className={`flex items-center gap-1 text-meta tabular-nums ${batteryColorClass(battery)}`}
          >
            <BatteryIcon charging={docked} />
            {battery ?? "—"} %
          </span>
        </div>
      </button>

      <div className="flex gap-tile-gap">
        <button
          type="button"
          onClick={() => (cleaning ? send("idle") : start())}
          className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-sm border border-accent-vacuum/50 bg-accent-vacuum/15 px-4 text-label font-semibold text-text"
        >
          {cleaning ? "Arrêter" : "Lancer"}
        </button>
        {!docked ? (
          <button
            type="button"
            onClick={() => send("docked")}
            className="inline-flex min-h-[48px] items-center justify-center rounded-sm border border-tile-border bg-tile-fill px-4 text-label font-semibold text-text"
          >
            Retour base
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-2">
        <VacuumIcon />
        <span className="text-label font-semibold text-text">Aspirateur</span>
      </span>
    </div>
  );
}

const svgProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function VacuumIcon() {
  return (
    <svg {...svgProps} width={18} height={18} className="text-accent-vacuum">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Status glyph by state — reinforces the label (state never by colour alone). */
function StatusIcon({ state }: { state: string }) {
  if (state === "cleaning") {
    return (
      <svg {...svgProps} className="text-accent-vacuum">
        <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l4 4-9 9-4-4z" />
      </svg>
    );
  }
  if (state === "returning") {
    return (
      <svg {...svgProps} className="text-accent-vacuum">
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
      </svg>
    );
  }
  if (state === "paused") {
    return (
      <svg {...svgProps} className="text-text-muted">
        <line x1="9" y1="5" x2="9" y2="19" />
        <line x1="15" y1="5" x2="15" y2="19" />
      </svg>
    );
  }
  // docked / idle / other → charging plug
  return (
    <svg {...svgProps} className="text-security-ok">
      <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
    </svg>
  );
}

/** Battery glyph; colour comes from the parent's batteryColorClass. */
function BatteryIcon({ charging }: { charging: boolean }) {
  return (
    <svg {...svgProps}>
      <rect x="2" y="7" width="16" height="10" rx="2" />
      <line x1="20" y1="10" x2="20" y2="14" />
      {charging ? <path d="M11 9l-2 4h3l-2 4" /> : null}
    </svg>
  );
}
