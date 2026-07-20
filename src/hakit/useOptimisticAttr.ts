import { useEffect, useRef, useState } from "react";

// The overlay's only time-based clear is a long safety net (never a short
// snap-back). Long enough to outlive a polled cloud entity's echo (e.g. Onecta);
// harmless for fast local echoes — a converged value clears the overlay earlier.
const OVERLAY_SAFETY_MS = 120000;

/**
 * Local optimistic overlay for a device ATTRIBUTE — climate setpoint/fan/swing,
 * light brightness/color_temp, … — the write-side that `useOptimisticControl`
 * deliberately doesn't cover (it owns the single per-entity pending slot for the
 * state token; AD-11). A single owner touches the entity, so there's no
 * cross-widget race — a component-local overlay is legitimate ephemeral UI state
 * (AD-1/AD-3), not a cache.
 *
 *  - optimistic value shows immediately; the HA service call is debounced so a
 *    burst of taps coalesces into one command (quota / cloud);
 *  - the overlay is HELD until the confirmed value moves off the base it was set
 *    against — reaching our target (converged) OR an external change (confirmed
 *    wins). No short revert that would flash backwards before a slow echo;
 *  - a long safety net drops a truly stuck overlay. Never a "failure" — the
 *    service call was accepted.
 */
export function useOptimisticAttr<T extends string | number>(
  confirmed: T | null,
  apply: (target: T) => void,
  debounceMs: number,
): readonly [T | null, (target: T) => void, boolean] {
  const [pending, setPending] = useState<T | null>(null);
  const base = useRef<T | null>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    if (pending == null) return;
    if (confirmed != null && confirmed !== base.current) setPending(null);
  }, [confirmed, pending]);

  useEffect(
    () => () => {
      if (sendTimer.current) clearTimeout(sendTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    },
    [],
  );

  const commit = (target: T) => {
    if (pending == null) base.current = confirmed;
    setPending(target);
    if (sendTimer.current) clearTimeout(sendTimer.current);
    sendTimer.current = setTimeout(() => applyRef.current(target), debounceMs);
    if (safetyTimer.current) clearTimeout(safetyTimer.current);
    safetyTimer.current = setTimeout(() => setPending(null), OVERLAY_SAFETY_MS);
  };

  return [pending ?? confirmed, commit, pending != null] as const;
}
