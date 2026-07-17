import { useEffect, useState } from "react";
import { useUndoStore, undoCountdown } from "../state/undo";

/**
 * UndoToast (UX-DR9, NFR6) — the safety-net toast for high-impact actions.
 *
 * Subscribes to the single undo store; renders nothing when idle. When an action
 * is offered it shows the action label, a visible countdown bar + seconds, and a
 * high-contrast ≥52px "Annuler" (text + icon, not colour alone — UX-DR14) that
 * reverts to the prior confirmed state. It auto-dismisses at the end of the
 * 6–8 s dwell.
 *
 * It owns its timers (tick + auto-dismiss) and cleans them up on change/unmount
 * (timer-leak lesson from 2.1). It needs no HA — it mounts in KioskShell ABOVE
 * the connection gate; the `undo` closure (built by the caller under the
 * provider) is what talks to HA.
 */
export function UndoToast() {
  const current = useUndoStore((s) => s.current);
  const dismiss = useUndoStore((s) => s.dismiss);
  const runUndo = useUndoStore((s) => s.runUndo);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!current) return;
    setNow(Date.now());
    const { id, expiresAt } = current;
    const tick = setInterval(() => setNow(Date.now()), 100);
    const auto = setTimeout(
      () => dismiss(id),
      Math.max(0, expiresAt - Date.now()),
    );
    return () => {
      clearInterval(tick);
      clearTimeout(auto);
    };
  }, [current, dismiss]);

  if (!current) return null;

  const { fraction, secondsLeft } = undoCountdown(
    current.offeredAt,
    current.expiresAt,
    now,
  );

  return (
    <div
      className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-4 rounded-lg border border-card-border bg-card-fill px-5 py-3 shadow-card backdrop-blur-glass">
        <span className="text-label font-semibold text-text">
          {current.label}
        </span>

        {/* Visible countdown (bar) so the window is legible (UX-DR9) */}
        <div
          className="h-1.5 w-24 overflow-hidden rounded bg-tile-border"
          aria-hidden
        >
          <div
            className="h-full bg-text transition-[width] duration-100 ease-linear"
            style={{ width: `${fraction * 100}%` }}
          />
        </div>

        {/* High-contrast hero action (UX-DR9): light fill + dark text, ≥52px */}
        <button
          type="button"
          onClick={runUndo}
          aria-label={`Annuler ${current.label}`}
          className="inline-flex min-h-[52px] items-center gap-2 rounded-lg bg-text px-5 text-label font-semibold text-ground-indigo"
        >
          <UndoIcon />
          <span className="tabular-nums">
            Annuler
            {/* seconds tick — hidden from AT so the polite live region isn't
                re-announced every second (the static aria-label covers it) */}
            {secondsLeft > 0 ? (
              <span aria-hidden="true">{` (${secondsLeft})`}</span>
            ) : null}
          </span>
        </button>
      </div>
    </div>
  );
}

function UndoIcon() {
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
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
    </svg>
  );
}
