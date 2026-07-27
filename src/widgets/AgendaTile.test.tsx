import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AgendaEvent } from "./agenda-select";

// The tile is tested against the READ hook's contract, not against HA: the query
// path has its own suite (useCalendarEvents.test.ts).
const read = vi.hoisted(() => ({
  events: [] as AgendaEvent[],
  isStale: false,
  loading: false,
  since: undefined as string | undefined,
}));

vi.mock("../hakit/useCalendarEvents", () => ({
  useCalendarEvents: () => read,
}));

import { AgendaTile } from "./AgendaTile";

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min);

const ev = (
  o: Partial<AgendaEvent> & Pick<AgendaEvent, "summary" | "start" | "end">,
): AgendaEvent => ({
  allDay: false,
  calendarId: "calendar.chats",
  ...o,
});

beforeEach(() => {
  read.events = [];
  read.isStale = false;
  read.loading = false;
  read.since = "2026-07-28T12:00:00.000Z";
  vi.useFakeTimers();
  vi.setSystemTime(at(2026, 7, 28, 13, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AgendaTile (Story 10.1, UX-DR28)", () => {
  it("always shows the PROCHAIN label — an icon alone would be mystery meat", () => {
    render(<AgendaTile />);
    expect(screen.getByText(/prochain/i)).toBeInTheDocument();
  });

  it("rank 1 — renders the hour and the relative delay", () => {
    read.events = [
      ev({
        summary: "Vétérinaire",
        start: at(2026, 7, 28, 17, 0),
        end: at(2026, 7, 28, 17, 30),
      }),
    ];
    render(<AgendaTile />);

    expect(screen.getByText("17:00")).toBeInTheDocument();
    expect(screen.getByText("dans 4h")).toBeInTheDocument();
    expect(screen.getByText("Vétérinaire")).toBeInTheDocument();
  });

  it("rank 2 — a whole-day event shows 'Aujourd'hui', with NO hour and NO delay", () => {
    read.events = [
      ev({
        summary: "Anniversaire de Nathan",
        start: at(2026, 7, 28),
        end: at(2026, 7, 29),
        allDay: true,
        calendarId: "calendar.anniversaires",
      }),
    ];
    render(<AgendaTile />);

    expect(screen.getByText("Aujourd'hui")).toBeInTheDocument();
    expect(screen.getByText("Anniversaire de Nathan")).toBeInTheDocument();
    expect(screen.queryByText(/dans /)).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d{2}:\d{2}$/)).not.toBeInTheDocument();
  });

  it("rank 3 — a running multi-day event shows how long it lasts", () => {
    read.events = [
      ev({
        summary: "Vacances d'été",
        start: at(2026, 7, 4),
        end: at(2026, 9, 1),
        allDay: true,
        calendarId: "calendar.calendrier_scolaire_zone_c",
      }),
    ];
    render(<AgendaTile />);

    expect(screen.getByText(/Jusqu'au 31 août/)).toBeInTheDocument();
    expect(screen.getByText("Vacances d'été")).toBeInTheDocument();
  });

  it("empty day — renders a stated result, not a blank (UX-DR27)", () => {
    render(<AgendaTile />);
    expect(screen.getByText("Rien aujourd'hui")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/rien d'ici la fin de la journée/i),
    );
  });

  it("keeps a constant footprint across states — the top bar must not dance", () => {
    const { container, rerender } = render(<AgendaTile />);
    const emptyWidthClass = container.querySelector("span.flex")?.className;

    read.events = [
      ev({
        summary: "Un titre particulièrement long qui doit être tronqué ici",
        start: at(2026, 7, 28, 17, 0),
        end: at(2026, 7, 28, 18, 0),
      }),
    ];
    rerender(<AgendaTile />);

    expect(container.querySelector("span.flex")?.className).toBe(
      emptyWidthClass,
    );
    // The long title is clipped by CSS, never wrapped onto a second line.
    expect(
      screen.getByText(/Un titre particulièrement long/).className,
    ).toMatch(/truncate/);
  });

  it("offline with a known answer — dims, keeps the event, and says so", () => {
    read.events = [
      ev({
        summary: "Vétérinaire",
        start: at(2026, 7, 28, 17, 0),
        end: at(2026, 7, 28, 17, 30),
      }),
    ];
    read.isStale = true;
    render(<AgendaTile />);

    expect(screen.getByText("Vétérinaire")).toBeInTheDocument(); // last known kept
    expect(screen.getByRole("status").className).toMatch(/opacity-60/);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/hors ligne/i),
    );
  });

  it("offline having never answered — says unavailable, never 'nothing today'", () => {
    read.isStale = true;
    read.since = undefined;
    render(<AgendaTile />);

    expect(screen.getByText("Indisponible")).toBeInTheDocument();
    expect(screen.queryByText("Rien aujourd'hui")).not.toBeInTheDocument();
  });

  it("loading — a placeholder, never a spinner", () => {
    read.loading = true;
    render(<AgendaTile />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Rien aujourd'hui")).not.toBeInTheDocument();
  });

  it("is not interactive in 10.1 — navigation to /agenda is Story 10.2", () => {
    render(<AgendaTile />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
