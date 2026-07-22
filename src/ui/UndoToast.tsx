import { useEffect, useState } from "react";
import { useUndoStore, undoCountdown } from "../state/undo";
import type { UndoableAction } from "../state/undo";

/**
 * UndoToast (UX-DR9, NFR6) — the safety-net toast for high-impact actions.
 *
 * Subscribes to the undo queue; renders nothing when idle. Each pending action
 * is a stacked toast (bottom-centre column, oldest on top) showing its label, a
 * visible countdown bar + seconds, and a high-contrast ≥52px "Annuler" (text +
 * icon, not colour alone — UX-DR14) that reverts to the prior confirmed state.
 * Concurrent offers coexist, so tapping two adjacent tiles no longer drops the
 * first undo (D1). Each toast auto-dismisses at the end of its own 6–8 s dwell.
 *
 * Each toast owns its timers (tick + auto-dismiss) and cleans them up on
 * change/unmount (timer-leak lesson from 2.1). It needs no HA — it mounts in
 * KioskShell ABOVE the connection gate; the `undo` closure (built by the caller
 * under the provider) is what talks to HA.
 */
export function UndoToast() {
  const queue = useUndoStore((s) => s.queue);
  const dismiss = useUndoStore((s) => s.dismiss);
  const runUndo = useUndoStore((s) => s.runUndo);

  if (queue.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-6"
      role="status"
      aria-live="polite"
    >
      {queue.map((action) => (
        <UndoToastItem
          key={action.id}
          action={action}
          dismiss={dismiss}
          runUndo={runUndo}
        />
      ))}
    </div>
  );
}

function UndoToastItem({
  action,
  dismiss,
  runUndo,
}: {
  action: UndoableAction;
  dismiss: (id?: number) => void;
  runUndo: (id?: number) => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  // `action` identity is stable per id and `dismiss` is a stable store action,
  // so a sibling toast appearing/expiring never resets this one's timers.
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 100);
    const auto = setTimeout(
      () => dismiss(action.id),
      Math.max(0, action.expiresAt - Date.now()),
    );
    return () => {
      clearInterval(tick);
      clearTimeout(auto);
    };
  }, [action, dismiss]);

  const { fraction, secondsLeft } = undoCountdown(
    action.offeredAt,
    action.expiresAt,
    now,
  );

  return (
    <div className="flex items-center gap-4 rounded-lg border border-card-border bg-card-fill px-5 py-3 shadow-card backdrop-blur-glass">
      <span className="text-label font-semibold text-text">{action.label}</span>

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
        onClick={() => runUndo(action.id)}
        aria-label={`Annuler ${action.label}`}
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
