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
    const { result } = renderHook(() => useCalendarEvents(undefined, 60_000));
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
    renderHook(() => useCalendarEvents(undefined, 3_600_000));
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

  it("retries 60s after a failure — an error must not burn the refresh budget", async () => {
    // Review 2026-07-28 (P4): `lastFetchAt` was stamped BEFORE the await, so a
    // rejected call consumed the whole 15-minute period and a transient blip
    // pinned the tile to stale data for a quarter of an hour.
    vi.useFakeTimers();
    hass.callService.mockRejectedValue(new Error("boom"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    renderHook(() => useCalendarEvents(undefined, 15 * 60_000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hass.callService).toHaveBeenCalledTimes(1);
    // Logged like every other HA failure in this app — on a wall-mounted iPad
    // this is the only diagnostic there is (P1).
    expect(warn).toHaveBeenCalledWith(
      "agenda: calendar.get_events failed",
      expect.any(Error),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(hass.callService).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("a slow reply landing after a newer one does not overwrite it", async () => {
    // Review 2026-07-28 (P5): three triggers can fire with nothing sequencing
    // them. A late resolution used to rewind `since`, restore the old window and
    // clear a genuine failure.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 28, 12, 0, 0));

    let releaseFirst: (v: unknown) => void = () => {};
    hass.callService
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValue(okResponse("Récent"));

    const { result } = renderHook(() => useCalendarEvents(undefined, 60_000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // Second trigger (the tick) answers first, with the newer data.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].summary).toBe("Récent");

    // Now the very first request finally resolves — with older content.
    await act(async () => {
      releaseFirst(okResponse("Périmé"));
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.events[0].summary).toBe("Récent");
  });

  it("flags an unreadable answer instead of reporting an empty day", async () => {
    // Review 2026-07-28 (D2): entries came back, none parsed, and the tile said
    // "Rien aujourd'hui" on a full day. Task 0 bis (observing the real payload)
    // is still open, so this guard is what stands between a format drift and a
    // silent lie.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    hass.callService.mockResolvedValue({
      context: {},
      response: {
        "calendar.chats": {
          events: [
            { summary: "X", start: { dateTime: "2026-07-28T17:00:00" } },
          ],
        },
      },
    });

    const { result } = renderHook(() => useCalendarEvents());
    await waitFor(() => expect(result.current.unreadable).toBe(true));

    expect(result.current.events).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringMatching(/aucun lisible/i),
      expect.anything(),
    );
    warn.mockRestore();
  });

  it("a genuinely empty day is NOT flagged unreadable", async () => {
    hass.callService.mockResolvedValue({
      context: {},
      response: { "calendar.chats": { events: [] } },
    });

    const { result } = renderHook(() => useCalendarEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.unreadable).toBe(false);
    expect(result.current.events).toHaveLength(0);
  });

  it("stops its timer and listener on unmount (no leak, leçon timers 2.1)", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useCalendarEvents(undefined, 60_000));
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

  it("interroge la plage EXPLICITE qu'on lui donne, pas la journée", async () => {
    // Story 10.2 : la vue semaine/mois passe sa propre plage. Sans ça le hook
    // resterait collé à aujourd'hui et les trois vues afficheraient la même chose.
    const range = {
      start: new Date(2026, 6, 27, 0, 0, 0, 0),
      end: new Date(2026, 7, 3, 0, 0, 0, 0),
    };
    const { result } = renderHook(() => useCalendarEvents(range));
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    const { start_date_time, end_date_time } =
      hass.callService.mock.calls[0][0].serviceData;
    expect(start_date_time).toBe("2026-07-27 00:00:00");
    expect(end_date_time).toBe("2026-08-03 00:00:00");
  });

  it("sans plage, garde le comportement de 10.1 : aujourd'hui", async () => {
    const { result } = renderHook(() => useCalendarEvents());
    await waitFor(() => expect(result.current.events).toHaveLength(1));

    const { start_date_time } = hass.callService.mock.calls[0][0].serviceData;
    expect(start_date_time).toMatch(/^\d{4}-\d{2}-\d{2} 00:00:00$/);
  });

  it("re-interroge quand la plage CHANGE — c'est la bascule de vue", async () => {
    vi.useFakeTimers();
    const jour = {
      start: new Date(2026, 6, 29, 0, 0, 0, 0),
      end: new Date(2026, 6, 30, 0, 0, 0, 0),
    };
    const semaine = {
      start: new Date(2026, 6, 27, 0, 0, 0, 0),
      end: new Date(2026, 7, 3, 0, 0, 0, 0),
    };
    const { rerender } = renderHook(({ r }) => useCalendarEvents(r), {
      initialProps: { r: jour },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hass.callService).toHaveBeenCalledTimes(1);

    rerender({ r: semaine });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hass.callService).toHaveBeenCalledTimes(2);
    expect(hass.callService.mock.calls[1][0].serviceData.start_date_time).toBe(
      "2026-07-27 00:00:00",
    );
  });

  it("ne re-interroge PAS quand la plage est recréée à l'identique", async () => {
    // Un objet neuf à chaque rendu est le cas nominal en React. Si le hook
    // s'armait sur l'identité de l'objet, il martèlerait HA à chaque frappe.
    vi.useFakeTimers();
    const mk = () => ({
      start: new Date(2026, 6, 29, 0, 0, 0, 0),
      end: new Date(2026, 6, 30, 0, 0, 0, 0),
    });
    const { rerender } = renderHook(({ r }) => useCalendarEvents(r), {
      initialProps: { r: mk() },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hass.callService).toHaveBeenCalledTimes(1);

    rerender({ r: mk() });
    rerender({ r: mk() });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hass.callService).toHaveBeenCalledTimes(1);
  });
});
