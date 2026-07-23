import { Clock } from "./Clock";

/**
 * TopBar — persistent kiosk chrome (the clock).
 *
 * It renders the `Clock` (stateful, runs an interval) and needs no HA
 * connection, so it is mounted ABOVE the HA connection gate (see `KioskShell`
 * in App.tsx). That keeps the clock and shell from remounting every time
 * `HassConnect` swaps loading↔children on (re)connect (was TD-1).
 *
 * (The Alarm + Cameras affordances of Epic 4 were removed — Florian, 2026-07-23.)
 */
export function TopBar() {
  return (
    <header className="flex items-center">
      <Clock />
    </header>
  );
}
