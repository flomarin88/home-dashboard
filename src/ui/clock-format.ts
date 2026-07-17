const TIME_FMT = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Format a Date into the kiosk clock's { time: "HH:MM", date: "mardi 14 juillet" }. */
export function formatClock(date: Date): { time: string; date: string } {
  return {
    time: TIME_FMT.format(date),
    date: DATE_FMT.format(date),
  };
}
