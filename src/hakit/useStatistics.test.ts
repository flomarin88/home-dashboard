import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useStatistics } from "./useStatistics";

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

const CONSO = "linky:24305788525104";
const COST = "linky:24305788525104_cost";
const QUERY = {
  statisticIds: [CONSO, COST],
  period: "day" as const,
  units: { energy: "kWh" },
};

// Two complete days (23 and 24 Sept 2026, local Paris = 22:00Z the day before).
const okResponse = (kwh = 8.2, cost = 1.07) => ({
  context: {},
  response: {
    statistics: {
      [CONSO]: [
        {
          start: "2026-09-22T22:00:00+00:00",
          end: "2026-09-23T22:00:00+00:00",
          change: 6.1,
        },
        {
          start: "2026-09-23T22:00:00+00:00",
          end: "2026-09-24T22:00:00+00:00",
          change: kwh,
        },
      ],
      [COST]: [
        {
          start: "2026-09-22T22:00:00+00:00",
          end: "2026-09-23T22:00:00+00:00",
          change: 0.8,
        },
        {
          start: "2026-09-23T22:00:00+00:00",
          end: "2026-09-24T22:00:00+00:00",
          change: cost,
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

describe("useStatistics — the query-read path for long-term statistics (AD-17, Story 9.4)", () => {
  it("asks recorder.get_statistics ONCE for both ids, with returnResponse: true", async () => {
    const { result } = renderHook(() => useStatistics(QUERY));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(hass.callService).toHaveBeenCalledTimes(1);
    const args = hass.callService.mock.calls[0][0];
    expect(args.domain).toBe("recorder");
    expect(args.service).toBe("get_statistics");
    expect(args.target).toBeUndefined();
    expect(args.serviceData.statistic_ids).toEqual([CONSO, COST]);
    // ⚠️ Without it @hakit resolves the promise to void (lesson 10.1).
    expect(args.returnResponse).toBe(true);
  });

  it("sends the exact HA shape: period, types as a LIST, units, and UTC ISO bounds two local days apart", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 10, 30)); // Fri 25 Sept, CEST
    renderHook(() => useStatistics(QUERY));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const data = hass.callService.mock.calls[0][0].serviceData;
    expect(data.period).toBe("day");
    expect(data.types).toEqual(["change"]);
    expect(data.units).toEqual({ energy: "kWh" });
    // [J-2 00:00, J 00:00) local → 22:00Z the evening before each.
    expect(data.start_time).toBe("2026-09-22T22:00:00.000Z");
    expect(data.end_time).toBe("2026-09-24T22:00:00.000Z");
  });

  it("honours an explicit range (the hourly chart asks for ONE day)", async () => {
    const range = {
      start: new Date(2026, 8, 24, 0, 0),
      end: new Date(2026, 8, 25, 0, 0),
    };
    const { result } = renderHook(() =>
      useStatistics({ statisticIds: [CONSO], period: "hour", range }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    const data = hass.callService.mock.calls[0][0].serviceData;
    expect(data.period).toBe("hour");
    expect(data.start_time).toBe(range.start.toISOString());
    expect(data.end_time).toBe(range.end.toISOString());
    expect(data.units).toBeUndefined();
  });

  it("exposes validated rows PER id, and a success timestamp", async () => {
    const { result } = renderHook(() => useStatistics(QUERY));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.rows[CONSO]).toHaveLength(2);
    expect(result.current.rows[CONSO][1].value).toBe(8.2);
    expect(result.current.rows[COST][1].value).toBe(1.07);
    expect(result.current.isStale).toBe(false);
    expect(result.current.unreadable).toBe(false);
    expect(result.current.since).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("on failure: keeps the LAST KNOWN rows, flags staleness, and logs (never blanks)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { result } = renderHook(() => useStatistics(QUERY));
    await waitFor(() => expect(result.current.loading).toBe(false));

    hass.callService.mockRejectedValue(new Error("HA injoignable"));
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(result.current.isStale).toBe(true));
    expect(result.current.rows[CONSO]).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith(
      "électricité: recorder.get_statistics failed",
      expect.any(Error),
    );
    warn.mockRestore();
  });

  it("first-ever failure: no rows, stale, and NOT stuck loading", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    hass.callService.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useStatistics(QUERY));
    await waitFor(() => expect(result.current.isStale).toBe(true));
    expect(result.current.rows[CONSO] ?? []).toHaveLength(0);
    expect(result.current.loading).toBe(false);
    warn.mockRestore();
  });

  it("is stale while disconnected, and does not even ask", async () => {
    hass.connectionStatus = "disconnected";
    const { result } = renderHook(() => useStatistics(QUERY));
    expect(result.current.isStale).toBe(true);
    expect(hass.callService).not.toHaveBeenCalled();
  });

  it("replays the query when the app returns to the foreground", async () => {
    const { result } = renderHook(() => useStatistics(QUERY));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(hass.callService).toHaveBeenCalledTimes(2));
  });

  it("replays the query every hour, not sooner — the data changes once a day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 10, 0, 0));
    renderHook(() => useStatistics(QUERY));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hass.callService).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59 * 60_000);
    });
    expect(hass.callService).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000);
    });
    expect(hass.callService).toHaveBeenCalledTimes(2);
  });

  it("replays the query when the local date rolls over, with the NEW window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 23, 59, 30));
    renderHook(() => useStatistics(QUERY));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hass.callService).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000); // crosses midnight
    });
    expect(hass.callService).toHaveBeenCalledTimes(2);
    const second = hass.callService.mock.calls[1][0].serviceData;
    // J-2 is now the 24th, J the 26th.
    expect(second.start_time).toBe("2026-09-23T22:00:00.000Z");
    expect(second.end_time).toBe("2026-09-25T22:00:00.000Z");
  });

  it("retries at the next tick after a failure — an error must not burn the hourly budget", async () => {
    vi.useFakeTimers();
    hass.callService.mockRejectedValue(new Error("boom"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderHook(() => useStatistics(QUERY));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hass.callService).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(hass.callService).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("a slow reply landing after a newer one does not overwrite it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 25, 12, 0, 0));
    let releaseFirst: (v: unknown) => void = () => {};
    hass.callService
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseFirst = resolve;
          }),
      )
      .mockResolvedValue(okResponse(9.9, 1.5));

    const { result } = renderHook(() => useStatistics(QUERY, 60_000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000); // tick → second request, answers first
    });
    expect(result.current.rows[CONSO][1].value).toBe(9.9);

    await act(async () => {
      releaseFirst(okResponse(1.1, 0.1)); // the FIRST request finally resolves, with older content
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.rows[CONSO][1].value).toBe(9.9);
  });

  it("flags an unreadable answer (rows sent, none parsable) instead of an empty day", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    hass.callService.mockResolvedValue({
      response: { statistics: { [CONSO]: [{ foo: 1 }], [COST]: [] } },
    });
    const { result } = renderHook(() => useStatistics(QUERY));
    await waitFor(() => expect(result.current.unreadable).toBe(true));
    expect(result.current.rows[CONSO]).toEqual([]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("a genuinely empty statistic is NOT flagged unreadable", async () => {
    hass.callService.mockResolvedValue({
      response: { statistics: { [CONSO]: [], [COST]: [] } },
    });
    const { result } = renderHook(() => useStatistics(QUERY));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.unreadable).toBe(false);
    expect(result.current.rows[CONSO]).toEqual([]);
  });

  it("stops its timer and listener on unmount (no leak)", async () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useStatistics(QUERY, 60_000));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(hass.callService).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * 61_000);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(hass.callService).toHaveBeenCalledTimes(1);
  });
});
