import { useCallback, useEffect, useRef, useState } from "react";
import { useHass } from "@hakit/core";
import { calendarsConfig } from "../entities";
import {
  parseEvents,
  dayRange,
  haDateTimeString,
  type AgendaEvent,
  type CalendarResponse,
} from "../widgets/agenda-select";

/**
 * Default refresh period. These calendars barely move — birthdays, holidays,
 * school terms — and the only timed source (`chats`) rarely gains a last-minute
 * entry, so 15 min is generous without hammering HA.
 */
export const CALENDAR_REFRESH_MS = 15 * 60_000;

/** How often we WAKE UP to decide whether to re-query (not how often we query). */
const TICK_MS = 60_000;

export interface CalendarEventsRead {
  /** Last known events. Never emptied by a failure (AD-17/NFR4). */
  readonly events: AgendaEvent[];
  /** The last query failed, or HA is unreachable. */
  readonly isStale: boolean;
  /** No query has come back yet and none has failed — show a placeholder. */
  readonly loading: boolean;
  /** ISO timestamp of the last SUCCESSFUL query, for "hors ligne · HH:MM". */
  readonly since: string | undefined;
}

/** Local day identity — the trigger for rebuilding the query window. */
const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/**
 * The QUERY read path (Story 10.1, AD-17) — the first of its kind in this app.
 *
 * Everything else here reflects entity state pushed over the WebSocket. Calendar
 * events can't: a `calendar.*` entity only exposes its current/next event, so a
 * whole day has to be *asked for* via `calendar.get_events`, a service that
 * returns data. That difference drives every decision below:
 *
 *  - **Freshness is ours to manage.** AD-6 keys obsolescence off entity state,
 *    and cannot cover a reply that nothing pushes. A perfectly live socket says
 *    NOTHING about the age of a response fetched three hours ago — that
 *    confusion is the failure this hook exists to prevent. Hence an explicit
 *    policy: on mount, on a period, on returning to the foreground, and on the
 *    local date rolling over.
 *  - **The window is rebuilt per request.** The kiosk never restarts, so a range
 *    computed once at mount would keep describing yesterday after midnight.
 *  - **No persistent cache** (AD-3). The last reply lives in component state for
 *    the session only — the same carve-out `useEntityValue` takes for AD-6.
 *  - **Read only.** No pending layer, no optimism, no writes (AD-5/AD-11 simply
 *    don't apply).
 *
 * It stays inside `src/hakit/` on purpose: this is still Home Assistant, just
 * queried instead of subscribed. It is NOT a second source of truth like
 * `src/nutriclaude/` — no extra seam, no client secret (AD-2/AD-17).
 */
export function useCalendarEvents(
  refreshMs: number = CALENDAR_REFRESH_MS,
): CalendarEventsRead {
  const callService = useHass((s) => s.helpers.callService);
  const connected = useHass((s) => s.connectionStatus) === "connected";
  const calendars = calendarsConfig();

  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [since, setSince] = useState<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [settled, setSettled] = useState(false);

  // Bookkeeping for the refresh policy — refs, so updating them never re-renders
  // and never re-arms the interval.
  const lastFetchAt = useRef(0);
  const windowDay = useRef<string | null>(null);

  const ids = calendars.map((c) => c.entityId);
  // Stable across renders unless the mapping itself changes, so the effects
  // below don't re-arm on every render.
  const idsKey = ids.join(",");

  const fetchEvents = useCallback(async () => {
    const now = new Date();
    const { start, end } = dayRange(now);
    lastFetchAt.current = now.getTime();
    try {
      const res = await callService({
        domain: "calendar",
        service: "get_events",
        target: { entity_id: idsKey.split(",") },
        serviceData: {
          start_date_time: haDateTimeString(start),
          end_date_time: haDateTimeString(end),
        },
        // ⚠️ Load-bearing: @hakit/core only returns the payload on this
        // overload. Omit it and the call type-checks but resolves to `void`.
        returnResponse: true,
      });
      // The single cast in this file, at the boundary where an external payload
      // enters. `parseEvents` validates every field itself, so nothing is
      // trusted past this line.
      const payload = (res as { response?: unknown } | undefined)?.response;
      setEvents(
        parseEvents((payload ?? {}) as CalendarResponse, calendarsConfig()),
      );
      setSince(new Date().toISOString());
      setFailed(false);
      windowDay.current = dayKey(now);
    } catch {
      // Keep the last known events on purpose (AD-17/NFR4): a failed refresh
      // degrades to "stale", never to a blank tile.
      setFailed(true);
    } finally {
      setSettled(true);
    }
  }, [callService, idsKey]);

  // Initial query, and a retry once the connection comes up.
  useEffect(() => {
    if (!connected) return;
    void fetchEvents();
  }, [connected, fetchEvents]);

  // Wake up every minute; re-query when the day changed (the window is now
  // wrong) or when the refresh period has elapsed. One timer, two reasons.
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      const dayChanged = windowDay.current !== dayKey(now);
      const periodElapsed = now.getTime() - lastFetchAt.current >= refreshMs;
      if (dayChanged || periodElapsed) void fetchEvents();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [fetchEvents, refreshMs]);

  // Back to the foreground — the response may have aged while hidden.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "hidden") void fetchEvents();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchEvents]);

  return {
    events,
    isStale: failed || !connected,
    // Only "loading" before anything has settled: once a query has failed we
    // fall through to the offline rendering rather than spin forever.
    loading: !settled && !failed,
    since,
  };
}
