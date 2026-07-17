/**
 * Obsolescence detection (AD-6), per entity and independent of the socket:
 * an entity is stale when the WebSocket is lost OR its state is
 * unavailable / unknown / missing.
 */
export function isStale(
  state: string | null | undefined,
  connected: boolean,
): boolean {
  return (
    !connected ||
    state == null ||
    state === "unavailable" ||
    state === "unknown"
  );
}

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
