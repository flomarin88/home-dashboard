import { useCallback, useEffect, useRef, useState } from "react";
import { useHass } from "@hakit/core";
import {
  countRawRows,
  lastTwoDaysWindow,
  parseRows,
  type DayPoint,
  type StatisticsWindow,
} from "../energy/statistics";

/**
 * Default refresh period. A long-term statistic imported once a day (ha-linky,
 * 6h–7h30 with a 9h–10h30 fallback) has nothing new to say for hours; an hourly
 * poll catches the morning import within the hour without hammering HA.
 */
export const STATISTICS_REFRESH_MS = 60 * 60_000;

/** How often we WAKE UP to decide whether to re-query (not how often we query). */
const TICK_MS = 60_000;

/** The granularities the app asks HA for — HA also knows 5minute/week/year, unused. */
export type StatisticsPeriod = "hour" | "day" | "month";

export interface StatisticsQuery {
  /** Long-term statistic ids (`source:object_id`), from the mapping (AD-7). */
  readonly statisticIds: readonly string[];
  readonly period: StatisticsPeriod;
  /** Unit conversions done BY HA, keyed by unit class — e.g. `{ energy: "kWh" }`. */
  readonly units?: Readonly<Record<string, string>>;
  /** Explicit window. Undefined ⇒ the last two complete local days, recomputed at fetch time. */
  readonly range?: StatisticsWindow;
}

export interface StatisticsRead {
  /** Validated rows per statistic id. Never emptied by a failure (AD-17/NFR4). */
  readonly rows: Readonly<Record<string, readonly DayPoint[]>>;
  /** The last query failed, or HA is unreachable. */
  readonly isStale: boolean;
  /** No query has come back yet and none has failed — show a placeholder. */
  readonly loading: boolean;
  /** ISO timestamp of the last SUCCESSFUL query — the freshness the screen shows. */
  readonly since: string | undefined;
  /** HA sent rows for an id and NOT ONE parsed: a format mismatch, not an empty day. */
  readonly unreadable: boolean;
}

/** Local day identity — detects the date rollover under the default window. */
const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Which window the hook SHOULD be showing right now (see useCalendarEvents). */
const windowKey = (
  startMs: number | undefined,
  endMs: number | undefined,
  now: Date,
): string =>
  startMs !== undefined && endMs !== undefined
    ? `${startMs}-${endMs}`
    : `two-days:${dayKey(now)}`;

/**
 * The QUERY read path for long-term statistics (Story 9.4, AD-17) — the second
 * of its kind after `useCalendarEvents`, and a deliberate copy of it rather
 * than a generalisation: two readable hooks beat one with three branches.
 *
 * A recorder statistic (`linky:<PRM>`) has no entity, no state and no event.
 * It is *asked for* via `recorder.get_statistics`, a service with a response,
 * and that shapes everything here exactly as it did for the agenda:
 *
 *  - **Freshness is ours.** AD-6 keys obsolescence off entity state and cannot
 *    cover a reply nothing pushes. `since` is the time of the last successful
 *    REQUEST — not a `last_changed` that does not exist.
 *  - **The window is rebuilt per request.** The kiosk never restarts; a window
 *    captured at mount would keep asking for the wrong two days after midnight.
 *  - **HA does the arithmetic** (AD-4): `types: ["change"]` is the energy of
 *    each period, `units` converts Wh → kWh server-side. Nothing is summed,
 *    split or converted here.
 *  - **No persistent cache** (AD-3), **read only** (no AD-5/AD-11).
 *
 * Inside `src/hakit/` on purpose: still Home Assistant, still via `callService`
 * (AD-2 — no raw WebSocket command, no second seam, no secret).
 */
export function useStatistics(
  query: StatisticsQuery,
  refreshMs: number = STATISTICS_REFRESH_MS,
): StatisticsRead {
  const callService = useHass((s) => s.helpers.callService);
  const connected = useHass((s) => s.connectionStatus) === "connected";

  // Identity React tracks: PRIMITIVES, never the objects. Callers build a fresh
  // `statisticIds` array and `units` object every render; keying the effects on
  // them would re-arm the interval and re-query on every render. The JSON key
  // is what the callback actually parses back, so the dependency states the
  // truth rather than being decoration (Story 10.2).
  const queryKey = JSON.stringify({
    statisticIds: query.statisticIds,
    period: query.period,
    units: query.units ?? null,
  });
  const startMs = query.range?.start.getTime();
  const endMs = query.range?.end.getTime();

  const [rows, setRows] = useState<
    Readonly<Record<string, readonly DayPoint[]>>
  >({});
  const [since, setSince] = useState<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [settled, setSettled] = useState(false);
  const [unreadable, setUnreadable] = useState(false);

  // Bookkeeping for the refresh policy — refs, so updating them never re-renders.
  const lastFetchAt = useRef(0);
  const fetchedWindow = useRef<string | null>(null);
  // Monotonic request id: a slow reply must never land over a newer one.
  const requestSeq = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const fetchStatistics = useCallback(async () => {
    const now = new Date();
    const { start, end } =
      startMs !== undefined && endMs !== undefined
        ? { start: new Date(startMs), end: new Date(endMs) }
        : lastTwoDaysWindow(now);
    const seq = ++requestSeq.current;
    const q = JSON.parse(queryKey) as {
      statisticIds: string[];
      period: StatisticsPeriod;
      units: Record<string, string> | null;
    };
    // HA takes LISTS for `statistic_ids` and `types` (recorder/services.py
    // :77-84) and UTC-aware datetimes (`dt_util.as_utc`) — `toISOString()`
    // leaves it no time zone to assume. The `never` cast is because
    // @hakit/core 6.0.2 types `types` as a single literal; HA is right.
    const serviceData = {
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      statistic_ids: q.statisticIds,
      period: q.period,
      types: ["change"],
      ...(q.units ? { units: q.units } : {}),
    };
    try {
      const res = await callService({
        domain: "recorder",
        service: "get_statistics",
        serviceData: serviceData as never,
        // ⚠️ Load-bearing: without it @hakit resolves to `void` (lesson 10.1).
        returnResponse: true,
      });
      // A newer request already answered (or we unmounted): stale by definition.
      if (!alive.current || seq !== requestSeq.current) return;
      // The single cast in this file, at the boundary where an external payload
      // enters. `parseRows` validates every field; nothing is trusted past here.
      const payload = (res as { response?: unknown } | undefined)?.response;
      const next: Record<string, readonly DayPoint[]> = {};
      let anyUnreadable = false;
      for (const id of q.statisticIds) {
        const parsed = parseRows(payload, id);
        const raw = countRawRows(payload, id);
        if (raw > 0 && parsed.length === 0) {
          anyUnreadable = true;
          console.warn(
            `électricité: ${raw} ligne(s) reçue(s) pour ${id}, aucune lisible — format inattendu ?`,
            payload,
          );
        }
        next[id] = parsed;
      }
      setRows(next);
      setUnreadable(anyUnreadable);
      setSince(new Date().toISOString());
      setFailed(false);
      lastFetchAt.current = now.getTime();
      fetchedWindow.current = windowKey(startMs, endMs, now);
    } catch (err) {
      if (!alive.current || seq !== requestSeq.current) return;
      // Keep the last known rows (AD-17/NFR4): a failed refresh degrades to
      // "stale", never to a blank tile. And it must NOT consume the refresh
      // budget — `lastFetchAt`/`fetchedWindow` stay put, so the next tick
      // retries in 60 s instead of waiting out the hour (lesson 10.1, P4).
      console.warn("électricité: recorder.get_statistics failed", err);
      setFailed(true);
    } finally {
      if (alive.current && seq === requestSeq.current) setSettled(true);
    }
  }, [callService, queryKey, startMs, endMs]);

  // Initial query, and a retry once the connection comes up.
  useEffect(() => {
    if (!connected) return;
    void fetchStatistics();
  }, [connected, fetchStatistics]);

  // Wake up every minute; re-query when the window changed (midnight, or the
  // caller moved the explicit range) or when the refresh period has elapsed.
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      const windowChanged =
        fetchedWindow.current !== windowKey(startMs, endMs, now);
      const periodElapsed = now.getTime() - lastFetchAt.current >= refreshMs;
      if (windowChanged || periodElapsed) void fetchStatistics();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [fetchStatistics, refreshMs, startMs, endMs]);

  // Back to the foreground — the response may have aged while hidden.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "hidden") void fetchStatistics();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchStatistics]);

  return {
    rows,
    isStale: failed || !connected,
    // Only "loading" before anything has settled: once a query has failed we
    // fall through to the offline rendering rather than spin forever.
    loading: !settled && !failed,
    since,
    unreadable,
  };
}
