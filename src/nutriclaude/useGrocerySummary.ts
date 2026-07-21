import { useEffect, useRef, useState } from "react";
import { getNutriClient, ensureNutriSession } from "./client";
import { getGrocerySummary, type GroceryPreviewItem } from "./queries";

/**
 * Mirrors `hakit/useEntityValue.EntityValue`: same obsolescence contract, a
 * different transport. The Courses tile consumes this exactly as room cards
 * consume `useEntityValue` (AD-14 — optimiste/obsolescence decoupled from transport).
 */
export interface GrocerySummaryValue {
  /** Last-known pending count (0 until first successful read). */
  readonly pendingCount: number;
  readonly lastAdded: readonly GroceryPreviewItem[];
  /** true when NutriClaude is unreachable (no session, fetch error, not configured). */
  readonly isStale: boolean;
  /** Stale AND nothing ever read — still connecting (show a skeleton). */
  readonly loading: boolean;
  /** ISO time of the last good read, for "dernière donnée HH:MM". */
  readonly since: string | undefined;
}

/** Polling baseline (Realtime is OFF in prod until Task 0 enables it — AD-14). */
const POLL_MS = 20_000;

/**
 * Read the grocery summary with the non-HA obsolescence pattern (AD-6 extended):
 * keep the last-good value in an ephemeral ref (NOT a persistent cache — AD-3),
 * expose stale/loading, converge via Supabase Realtime with a polling fallback.
 */
export function useGrocerySummary(): GrocerySummaryValue {
  const lastGood = useRef<{
    pendingCount: number;
    lastAdded: readonly GroceryPreviewItem[];
    since: string;
  } | null>(null);
  const [, forceRender] = useState(0);
  const [isStale, setIsStale] = useState(true);
  const [everRead, setEverRead] = useState(false);

  useEffect(() => {
    const client = getNutriClient();
    if (client == null) {
      // Not configured (build sans secret): stale, but not "loading" forever.
      setIsStale(true);
      setEverRead(true);
      return;
    }

    let mounted = true;

    const refetch = async () => {
      try {
        const ok = await ensureNutriSession();
        if (!ok) {
          // Session couldn't be established → settled as offline (not "loading").
          if (mounted) {
            setIsStale(true);
            setEverRead(true);
          }
          return;
        }
        const summary = await getGrocerySummary(client);
        if (!mounted) return;
        lastGood.current = {
          pendingCount: summary.pendingCount,
          lastAdded: summary.lastAdded,
          since: new Date().toISOString(),
        };
        setIsStale(false);
        setEverRead(true);
        forceRender((n) => n + 1);
      } catch {
        if (mounted) {
          setIsStale(true);
          setEverRead(true);
        }
      }
    };

    void refetch();

    // Realtime convergence (activated by Task 0) + polling baseline until then.
    const channel = client
      .channel("grocery-summary")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grocery_list_items" },
        () => void refetch(),
      )
      .subscribe();
    const timer = setInterval(() => void refetch(), POLL_MS);

    return () => {
      mounted = false;
      clearInterval(timer);
      void client.removeChannel(channel);
    };
  }, []);

  const known = lastGood.current;
  return {
    pendingCount: known?.pendingCount ?? 0,
    lastAdded: known?.lastAdded ?? [],
    isStale,
    // Only "loading" while nothing has ever been read and we're not yet stale-known.
    loading: !everRead && known == null,
    since: known?.since,
  };
}
