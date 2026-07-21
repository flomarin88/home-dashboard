/**
 * NutriClaude seam — public surface (AD-2 2nd exception, AD-12).
 *
 * The Courses feature consumes NutriClaude/Supabase through this seam ONLY. This
 * module and everything under `src/nutriclaude/` must never import from
 * `src/hakit/`, and vice-versa: the two state layers stay isolated (no shared
 * store). Enforced by isolation.test.ts.
 */
export { nutriIsConfigured } from "./config";
export { useGrocerySummary } from "./useGrocerySummary";
export type { GrocerySummaryValue } from "./useGrocerySummary";
export type { GroceryPreviewItem } from "./queries";
