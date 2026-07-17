import { Clock } from "./Clock";

/**
 * TopBar — persistent kiosk chrome (heure · Armer/Désarmer · entrée Caméras).
 *
 * It renders the `Clock` (stateful, runs an interval) and needs no HA
 * connection, so it is mounted ABOVE the HA connection gate (see `KioskShell`
 * in App.tsx). That keeps the clock and shell from remounting every time
 * `HassConnect` swaps loading↔children on (re)connect (was TD-1).
 *
 * Alarm + Cameras are inert placeholders here (features: Epic 4). State is
 * carried by TEXT + ICON, never colour alone (UX-DR14).
 */
export function TopBar() {
  return (
    <header className="flex items-center justify-between gap-4">
      <Clock />
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled
          aria-label="Alarme — bientôt disponible"
          className="inline-flex min-h-[56px] items-center gap-2 rounded-lg border border-card-border bg-card-fill px-4 text-label font-semibold text-text opacity-60"
        >
          <LockOpenIcon />
          <span>Désarmé</span>
        </button>
        <button
          type="button"
          disabled
          aria-label="Caméras — bientôt disponible"
          className="inline-flex min-h-[56px] items-center gap-2 rounded-lg border border-card-border bg-card-fill px-4 text-label font-semibold text-text opacity-60"
        >
          <span>Caméras</span>
          <ChevronRightIcon />
        </button>
      </div>
    </header>
  );
}

function LockOpenIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
