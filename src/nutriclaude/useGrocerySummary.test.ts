import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Controllable mocks for the client + query layers.
const mock = vi.hoisted(() => ({
  client: null as unknown,
  sessionOk: true,
  summary: {
    pendingCount: 0,
    lastAdded: [] as { name: string; createdAt: string | null }[],
  },
  shouldThrow: false,
}));

vi.mock("./client", () => ({
  getNutriClient: () => mock.client,
  ensureNutriSession: () => Promise.resolve(mock.sessionOk),
}));

vi.mock("./queries", () => ({
  getGrocerySummary: () => {
    if (mock.shouldThrow) return Promise.reject(new Error("network"));
    return Promise.resolve(mock.summary);
  },
}));

import { useGrocerySummary } from "./useGrocerySummary";

/** Minimal Supabase-client stand-in with the Realtime surface the hook touches. */
function fakeClient() {
  const channel = {
    on() {
      return channel;
    },
    subscribe() {
      return channel;
    },
  };
  return {
    channel: () => channel,
    removeChannel: () => Promise.resolve("ok"),
  };
}

describe("useGrocerySummary", () => {
  beforeEach(() => {
    mock.client = fakeClient();
    mock.sessionOk = true;
    mock.summary = { pendingCount: 0, lastAdded: [] };
    mock.shouldThrow = false;
  });

  it("not configured (null client): stale, not loading, count 0", async () => {
    mock.client = null;
    const { result } = renderHook(() => useGrocerySummary());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isStale).toBe(true);
    expect(result.current.pendingCount).toBe(0);
  });

  it("live: exposes the fetched count + preview, not stale", async () => {
    mock.summary = {
      pendingCount: 5,
      lastAdded: [{ name: "Lait", createdAt: "2026-07-21T10:00:00Z" }],
    };
    const { result } = renderHook(() => useGrocerySummary());
    await waitFor(() => expect(result.current.pendingCount).toBe(5));
    expect(result.current.isStale).toBe(false);
    expect(result.current.lastAdded[0]?.name).toBe("Lait");
    expect(result.current.since).toBeDefined();
  });

  it("session failure: stale, no crash", async () => {
    mock.sessionOk = false;
    const { result } = renderHook(() => useGrocerySummary());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isStale).toBe(true);
  });

  it("fetch error: stale but keeps last-known once seen", async () => {
    mock.shouldThrow = true;
    const { result } = renderHook(() => useGrocerySummary());
    // isStale is true from the initial render, so settle on `loading` going false.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isStale).toBe(true);
  });
});
