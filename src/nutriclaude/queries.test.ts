import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getGrocerySummary } from "./queries";

/**
 * A minimal stand-in for the Supabase fluent client covering exactly the two
 * reads `getGrocerySummary` issues: the `head`+count query and the preview
 * select. `from()` returns the count chain on the first call and the preview
 * chain on the second (the order `Promise.all` evaluates them).
 */
function mockClient(opts: {
  count?: number | null;
  countError?: unknown;
  data?: unknown[] | null;
  dataError?: unknown;
}): { client: SupabaseClient; from: ReturnType<typeof vi.fn> } {
  const countChain = {
    select: vi.fn(() => countChain),
    eq: vi.fn(() =>
      Promise.resolve({
        count: opts.count ?? null,
        error: opts.countError ?? null,
      }),
    ),
  };
  const previewChain = {
    select: vi.fn(() => previewChain),
    eq: vi.fn(() => previewChain),
    order: vi.fn(() => previewChain),
    limit: vi.fn(() =>
      Promise.resolve({
        data: opts.data ?? null,
        error: opts.dataError ?? null,
      }),
    ),
  };
  let call = 0;
  const from = vi.fn(() => (call++ === 0 ? countChain : previewChain));
  return { client: { from } as unknown as SupabaseClient, from };
}

describe("getGrocerySummary", () => {
  it("reads pending count + preview and maps rows (name, createdAt)", async () => {
    const { client, from } = mockClient({
      count: 12,
      data: [
        { name: "Poivrons", created_at: "2026-07-21T11:00:00Z" },
        { name: "Lait", created_at: "2026-07-21T10:00:00Z" },
      ],
    });

    const summary = await getGrocerySummary(client);

    expect(from).toHaveBeenCalledWith("grocery_list_items");
    expect(summary.pendingCount).toBe(12);
    expect(summary.lastAdded).toEqual([
      { name: "Poivrons", createdAt: "2026-07-21T11:00:00Z" },
      { name: "Lait", createdAt: "2026-07-21T10:00:00Z" },
    ]);
  });

  it("coerces a null/missing name to '' and a missing created_at to null", async () => {
    const { client } = mockClient({
      count: 2,
      data: [{ name: null }, {}],
    });

    const summary = await getGrocerySummary(client);

    expect(summary.lastAdded).toEqual([
      { name: "", createdAt: null },
      { name: "", createdAt: null },
    ]);
  });

  it("returns an empty preview and count 0 when there is nothing pending", async () => {
    const { client } = mockClient({ count: 0, data: [] });

    const summary = await getGrocerySummary(client);

    expect(summary.pendingCount).toBe(0);
    expect(summary.lastAdded).toEqual([]);
  });

  it("throws when the count query errors", async () => {
    const { client } = mockClient({
      countError: new Error("count boom"),
      data: [],
    });
    await expect(getGrocerySummary(client)).rejects.toThrow("count boom");
  });

  it("throws when the preview query errors", async () => {
    const { client } = mockClient({
      count: 3,
      dataError: new Error("preview boom"),
    });
    await expect(getGrocerySummary(client)).rejects.toThrow("preview boom");
  });
});
