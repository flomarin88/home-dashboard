import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCalendarEvents } from "./useCalendarEvents";

// Mutable HA mock (vi.hoisted so the mock factory can read it).
const hass = vi.hoisted(() => ({
  connectionStatus: "connected" as string,
  callService: vi.fn(),
}));

vi.mock("@hakit/core", () => ({
  useHass: (
    selector: (s: {
      connectionStatus: string;
      helpers: { callService: unknown };
    }) => unknown,
  ) =>
    selector({
      connectionStatus: hass.connectionStatus,
      helpers: { callService: hass.callService },
    }),
}));

const okResponse = (summary = "Vétérinaire") => ({
  context: {},
  response: {
    "calendar.chats": {
      events: [
        {
          summary,
          start: "2026-07-28 17:00:00",
          end: "2026-07-28 17:30:00",
        },
      ],
    },
  },
});

beforeEach(() => {
  hass.connectionStatus = "connected";
  hass.callService.mockReset();
  hass.callService.mockResolvedValue(okResponse());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCalendarEvents — the query-read path (AD-17)", () => {
  it("queries calendar.get_events for all mapped calendars in ONE call", async () => {
    const { result } = renderHook(() => useCalendarEvents());
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    expect(hass.callService).toHaveBeenCalledTimes(1);
    const args = hass.callService.mock.calls[0][0];
    expect(args.domain).toBe("calendar");
    expect(args.service).toBe("get_events");
    expect(args.target.entity_id).toHaveLength(4);
    expect(args.target.entity_id).toContain("calendar.chats");
  });

  it("passes returnResponse: true — without it the reply is silently void", async () => {
    const { result } = renderHook(() => useCalendarEvents());
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    expect(hass.callService.mock.calls[0][0].returnResponse).toBe(true);
  });

  it("asks for [today 00:00 → tomorrow 00:00) in local time", async () => {
    const { result } = renderHook(() => useCalendarEvents());
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    const { start_date_time, end_date_time } =
      hass.callService.mock.calls[0][0].serviceData;
    expect(start_date_time).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/);
    expect(end_date_time).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/);
    expect(end_date_time > start_date_time).toBe(true);
  });

  it("exposes the parsed events and a success timestamp", async () => {
    const { result } = renderHook(() => useCalendarEvents());
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    expect(result.current.events[0].summary).toBe("Vétérinaire");
    expect(result.current.isStale).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.since).toBeDefined();
  });

  it("on failure: keeps the LAST KNOWN response and flags staleness (never blanks)", async () => {
    const { result } = renderHook(() => useCalendarEvents());
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    hass.callService.mockRejectedValue(new Error("HA injoignable"));
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(result.current.isStale).toBe(true));
    expect(result.current.events).toHaveLength(1); // last known kept
    expect(result.current.events[0].summary).toBe("Vétérinaire");
  });

  it("first-ever failure: no events, stale, and NOT stuck loading", async () => {
    hass.callService.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useCalendarEvents());

    await waitFor(() => expect(result.current.isStale).toBe(true));
    expect(result.current.events).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("is stale while disconnected — a live socket is NOT what proves freshness (AD-17)", async () => {
    hass.connectionStatus = "disconnected";
    const { result } = renderHook(() => useCalendarEvents());
    expect(result.current.isStale).toBe(true);
  });

  it("replays the query when the app returns to the foreground", async () => {
    const { result } = renderHook(() => useCalendarEvents());
    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(hass.callService).toHaveBeenCalledTimes(1);

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(hass.callService).toHaveBeenCalledTimes(2));
  });

  it("replays the query when the refresh period elapses", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCalendarEvents(60_000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.events).toHaveLength(1);
    expect(hass.callService).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(hass.callService).toHaveBeenCalledTimes(2);
  });

  it("replays the query when the local date rolls over, before the period elapses", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 28, 23, 59, 30));
    // A long refresh period: only the date change can trigger the second call.
    renderHook(() => useCalendarEvents(3_600_000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hass.callService).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000); // crosses midnight
    });

    expect(hass.callService).toHaveBeenCalledTimes(2);
    // The new window must describe the NEW day, not the old one.
    const second = hass.callService.mock.calls[1][0].serviceData;
    expect(second.start_date_time).toBe("2026-07-29 00:00:00");
  });

  it("stops its timer and listener on unmount (no leak, leçon timers 2.1)", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useCalendarEvents(60_000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hass.callService).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000);
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(hass.callService).toHaveBeenCalledTimes(1);
  });
});
