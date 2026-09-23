import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const hass = vi.hoisted(() => ({
  callService: vi.fn(),
}));

vi.mock("@hakit/core", () => ({
  useHass: (selector: (s: { helpers: { callService: unknown } }) => unknown) =>
    selector({ helpers: { callService: hass.callService } }),
}));

import { useEntityRefresh, REFRESH_GUARD_MS } from "./useEntityRefresh";

const ID = "sensor.temps_trajet";
const GUARD = 12_000;

beforeEach(() => {
  hass.callService.mockReset();
  hass.callService.mockResolvedValue(undefined);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("useEntityRefresh (Story 11.1, AD-18)", () => {
  it("calls homeassistant.update_entity on the entity", () => {
    const { result } = renderHook(() => useEntityRefresh(ID, "k"));
    act(() => result.current.refresh());

    expect(hass.callService).toHaveBeenCalledTimes(1);
    const arg = hass.callService.mock.calls[0][0];
    expect(arg.domain).toBe("homeassistant");
    expect(arg.service).toBe("update_entity");
    expect(arg.target).toEqual({ entity_id: ID });
  });

  it("NEVER passes returnResponse — the service is SupportsResponse.NONE", () => {
    // Passing it makes HA refuse the call outright, so every tap would fail.
    // Asserted on the key's presence, not its value: `returnResponse: false`
    // would be just as wrong as `true`.
    const { result } = renderHook(() => useEntityRefresh(ID, "k"));
    act(() => result.current.refresh());

    expect(hass.callService.mock.calls[0][0]).not.toHaveProperty(
      "returnResponse",
    );
  });

  it("guards for at least the 10 s coordinator debouncer floor", () => {
    // A shorter guard would desynchronise on a double tap: HA batches the
    // second request behind a 10 s cooldown.
    expect(REFRESH_GUARD_MS).toBeGreaterThanOrEqual(10_000);
  });

  it("goes pending on tap and publishes no timestamp until it settles", () => {
    const { result } = renderHook(() => useEntityRefresh(ID, "k", GUARD));
    expect(result.current.pending).toBe(false);
    expect(result.current.requestedAt).toBeNull();

    act(() => result.current.refresh());
    expect(result.current.pending).toBe(true);
    // Still null: the tile must not claim freshness while the answer is in flight.
    expect(result.current.requestedAt).toBeNull();
  });

  it("settles on the guard delay even when NO state event ever arrives", async () => {
    // The nominal case for stable traffic: HA suppresses state_changed when
    // state and attributes are unchanged, so the guard is the only way out.
    const { result } = renderHook(() => useEntityRefresh(ID, "k", GUARD));
    act(() => result.current.refresh());

    await tick(GUARD + 1);
    expect(result.current.pending).toBe(false);
    expect(result.current.requestedAt).toBeTypeOf("number");
    expect(result.current.failed).toBe(false);
  });

  it("settles EARLY when a new state lands while pending", async () => {
    const { result, rerender } = renderHook(
      ({ key }) => useEntityRefresh(ID, key, GUARD),
      { initialProps: { key: "34|t0" } },
    );
    act(() => result.current.refresh());
    expect(result.current.pending).toBe(true);

    await act(async () => {
      rerender({ key: "41|t1" });
    });
    expect(result.current.pending).toBe(false);
    expect(result.current.requestedAt).toBeTypeOf("number");
  });

  it("ignores a state change that lands while NOT pending", async () => {
    const { result, rerender } = renderHook(
      ({ key }) => useEntityRefresh(ID, key, GUARD),
      { initialProps: { key: "34|t0" } },
    );
    // Background push with no tap: must not fabricate a freshness stamp.
    await act(async () => {
      rerender({ key: "41|t1" });
    });
    expect(result.current.requestedAt).toBeNull();
  });

  it("reports a rejected call and logs it — never a silent catch", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    hass.callService.mockRejectedValueOnce(new Error("HA injoignable"));

    const { result } = renderHook(() => useEntityRefresh(ID, "k", GUARD));
    await act(async () => {
      result.current.refresh();
    });

    expect(result.current.pending).toBe(false);
    expect(result.current.failed).toBe(true);
    expect(result.current.requestedAt).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "trafic: homeassistant.update_entity failed",
      expect.any(Error),
    );
    warn.mockRestore();
  });

  it("clears the failure on the next tap", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    hass.callService.mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() => useEntityRefresh(ID, "k", GUARD));
    await act(async () => {
      result.current.refresh();
    });
    expect(result.current.failed).toBe(true);

    act(() => result.current.refresh());
    expect(result.current.failed).toBe(false);
    expect(result.current.pending).toBe(true);
    warn.mockRestore();
  });

  it("does not let a superseded call clobber the newer one (race guard)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    let rejectFirst: ((e: Error) => void) | undefined;
    hass.callService.mockImplementationOnce(
      () =>
        new Promise((_res, rej) => {
          rejectFirst = rej;
        }),
    );
    hass.callService.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useEntityRefresh(ID, "k", GUARD));
    act(() => result.current.refresh()); // #1 — will reject late
    act(() => result.current.refresh()); // #2 — supersedes it

    await act(async () => {
      rejectFirst?.(new Error("late failure"));
      await Promise.resolve();
    });

    // #1's late rejection must not mark the tile failed: #2 is the live request.
    expect(result.current.failed).toBe(false);
    expect(result.current.pending).toBe(true);
    warn.mockRestore();
  });

  it("clears its timer on unmount", () => {
    const clear = vi.spyOn(globalThis, "clearTimeout");
    const { result, unmount } = renderHook(() =>
      useEntityRefresh(ID, "k", GUARD),
    );
    act(() => result.current.refresh());
    clear.mockClear();

    unmount();
    expect(clear).toHaveBeenCalled();
    clear.mockRestore();
  });
});
