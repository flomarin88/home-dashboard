/**
 * Pure formatters for the Courses tile summary (UX-DR19). Kept separate from the
 * hook/tile so they are directly unit-testable (mirrors `widgets/*-format.ts`).
 */

/**
 * Build the "derniers ajouts" preview line: up to `maxShown` article names, then
 * a "+N" tail for the remaining pending count. Empty string when nothing pending.
 *
 * e.g. formatPreview(["Poivrons","Lait","Café"], 12) → "Poivrons, Lait, Café +9"
 */
export function formatPreview(
  names: readonly string[],
  pendingCount: number,
  maxShown = 3,
): string {
  if (pendingCount <= 0 || names.length === 0) return "";
  const shown = names.slice(0, maxShown);
  const remaining = pendingCount - shown.length;
  const head = shown.join(", ");
  return remaining > 0 ? `${head} +${remaining}` : head;
}

/**
 * Relative "il y a …" label for the last-update timestamp. `nowMs` is injected
 * (no Date.now()) so the function is pure and testable. '' for missing/invalid.
 */
export function formatRelativeTime(
  iso: string | null | undefined,
  nowMs: number,
): string {
  if (iso == null) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.round((nowMs - t) / 1000));
  if (sec < 60) return "à l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}
