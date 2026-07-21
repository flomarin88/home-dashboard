import type { SupabaseClient } from "@supabase/supabase-js";

/** One recently-added pending article, for the tile preview. */
export interface GroceryPreviewItem {
  readonly name: string;
  /** created_at (ISO) — drives the "dernière maj" relative timestamp. */
  readonly createdAt: string | null;
}

/** The read the Courses tile needs: pending count + a short recent-adds preview. */
export interface GrocerySummary {
  readonly pendingCount: number;
  readonly lastAdded: readonly GroceryPreviewItem[];
}

const PREVIEW_LIMIT = 4;

/**
 * Read the grocery list summary for the current household (bounded by RLS
 * `grocery_all`). Reads only — the tile is lecture-only in this story (writes
 * are stories 8.3/8.4).
 *
 * Provenance (`added_by` → prénom) is NOT resolved here: it needs a `profiles`
 * join and is added in Story 8.2. The preview shows names + timestamp only.
 */
export async function getGrocerySummary(
  client: SupabaseClient,
): Promise<GrocerySummary> {
  const [countRes, previewRes] = await Promise.all([
    client
      .from("grocery_list_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    client
      .from("grocery_list_items")
      .select("name, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(PREVIEW_LIMIT),
  ]);

  if (countRes.error) throw countRes.error;
  if (previewRes.error) throw previewRes.error;

  const lastAdded: GroceryPreviewItem[] = (previewRes.data ?? []).map((r) => ({
    name: String((r as { name: unknown }).name ?? ""),
    createdAt: ((r as { created_at: string | null }).created_at ?? null) as
      string | null,
  }));

  return { pendingCount: countRes.count ?? 0, lastAdded };
}
