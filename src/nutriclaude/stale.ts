/**
 * Obsolescence formatting for the NutriClaude (non-HA) source (AD-6 extended,
 * AD-14). `formatSince` is duplicated from `hakit/stale` on purpose: the two
 * state layers stay isolated (AD-2/AD-12), so this seam never imports from
 * `src/hakit/`. The function is trivial; the copy is cheaper than the coupling.
 */

const SINCE_FMT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Format a last-changed timestamp as "HH:MM"; '' for missing/invalid input. */
export function formatSince(iso: string | number | null | undefined): string {
  if (iso == null) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return SINCE_FMT.format(d);
}
