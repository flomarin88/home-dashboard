import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { AgendaEvent } from "../agenda/select";

// The tile is tested against the READ hook's contract, not against HA: the query
// path has its own suite (useCalendarEvents.test.ts).
const read = vi.hoisted(() => ({
  events: [] as AgendaEvent[],
  isStale: false,
  loading: false,
  since: undefined as string | undefined,
  unreadable: false,
}));

vi.mock("../hakit/useCalendarEvents", () => ({
  useCalendarEvents: () => read,
}));

import { AgendaTile } from "./AgendaTile";

function renderTile() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<AgendaTile />} />
        <Route path="/agenda" element={<div>agenda-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

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
  read.unreadable = false;
  vi.useFakeTimers();
  vi.setSystemTime(at(2026, 7, 28, 13, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AgendaTile (Story 10.1, tappable depuis 10.2)", () => {
  it("ouvre /agenda au tap — 10.1 l'avait laissée inerte en renvoyant ici", () => {
    renderTile();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("agenda-page")).toBeInTheDocument();
  });

  it("annonce l'action dans son nom accessible, pas seulement le contenu", () => {
    renderTile();
    expect(
      screen.getByRole("button", { name: /ouvrir l'agenda/i }),
    ).toBeInTheDocument();
  });

  it("n'est plus une région live — le rôle bouton est le bon (revue 10.1, W1)", () => {
    // Elle portait role="status" sur un contenu entièrement aria-hidden : une
    // région live ne peut rien annoncer d'un contenu masqué. Le bouton règle
    // le point différé au lieu de le contourner.
    renderTile();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("always shows the PROCHAIN label — an icon alone would be mystery meat", () => {
    renderTile();
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
    renderTile();

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
    renderTile();

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
    renderTile();

    expect(screen.getByText(/Jusqu'au 31 août/)).toBeInTheDocument();
    expect(screen.getByText("Vacances d'été")).toBeInTheDocument();
  });

  it("empty day — renders a stated result, not a blank (UX-DR27)", () => {
    renderTile();
    expect(screen.getByText("Rien aujourd'hui")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/rien d'ici la fin de la journée/i),
    );
  });

  it("keeps a constant footprint across states — the top bar must not dance", () => {
    // The previous version of this test compared the column's className before
    // and after populating. That string is a static literal in the JSX, so the
    // assertion could not fail — AC5 had no guard at all (review 2026-07-28,
    // P2). jsdom does no layout, so height cannot be measured here either; what
    // CAN be pinned is the mechanism that keeps the height constant: the column
    // always renders the SAME THREE line boxes, and the third one is never
    // empty. A collapsible (ordinary) space there would produce no line box,
    // the column would drop to two lines, and `items-center` would shift the
    // whole block. The device pass at 1024×748 remains the real proof.
    const states: [string, () => void][] = [
      ["loading", () => (read.loading = true)],
      ["empty", () => {}],
      [
        "populated",
        () => {
          read.events = [
            ev({
              summary:
                "Un titre particulièrement long qui doit être tronqué ici",
              start: at(2026, 7, 28, 17, 0),
              end: at(2026, 7, 28, 18, 0),
            }),
          ];
        },
      ],
      ["offline", () => (read.isStale = true)],
      ["unreadable", () => (read.unreadable = true)],
    ];

    for (const [name, setup] of states) {
      read.events = [];
      read.loading = false;
      read.isStale = false;
      read.unreadable = false;
      setup();

      const { container, unmount } = renderTile();
      const column = container.querySelector("span.flex") as HTMLElement;

      expect(column.className, name).toContain("w-[150px]");
      expect(column.children.length, name).toBe(3);

      const third = column.children[2].textContent ?? "";
      expect(third.length, name).toBeGreaterThan(0);
      // And when there is no title, the placeholder must be a NON-collapsible
      // space. `truncate` implies white-space:nowrap, which collapses an
      // ordinary space away entirely — the flex item would then generate no
      // line box at all, and `length > 0` in jsdom would not notice.
      if (third.trim() === "") expect(third, name).toBe(" ");
      unmount();
    }
  });

  it("clips a long title on one line instead of wrapping to a second", () => {
    read.events = [
      ev({
        summary: "Un titre particulièrement long qui doit être tronqué ici",
        start: at(2026, 7, 28, 17, 0),
        end: at(2026, 7, 28, 18, 0),
      }),
    ];
    renderTile();
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
    renderTile();

    expect(screen.getByText("Vétérinaire")).toBeInTheDocument(); // last known kept
    expect(screen.getByRole("button").className).toMatch(/opacity-60/);
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/hors ligne/i),
    );
  });

  it("offline having never answered — says unavailable, never 'nothing today'", () => {
    read.isStale = true;
    read.since = undefined;
    renderTile();

    expect(screen.getByText("Indisponible")).toBeInTheDocument();
    expect(screen.queryByText("Rien aujourd'hui")).not.toBeInTheDocument();
  });

  it("loading — a placeholder, never a spinner", () => {
    read.loading = true;
    renderTile();

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Rien aujourd'hui")).not.toBeInTheDocument();
  });

  it("an appointment under way reads 'Jusqu'à HH:MM', never a past date", () => {
    // Review 2026-07-28 (D1): rank 3 applied the all-day exclusive-end rule to a
    // wall-clock end, so a 09:00–18:00 visit at 13:00 rendered "Jusqu'au 27
    // juil." — yesterday — and announced it too.
    read.events = [
      ev({
        summary: "Vétérinaire",
        start: at(2026, 7, 28, 9, 0),
        end: at(2026, 7, 28, 18, 0),
      }),
    ];
    renderTile();

    expect(screen.getByText("Jusqu'à 18:00")).toBeInTheDocument();
    expect(screen.queryByText(/Jusqu'au/)).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/en cours : vétérinaire, jusqu'à 18:00/i),
    );
  });

  it("a multi-day event still names a DAY — the exclusive end still applies", () => {
    read.events = [
      ev({
        summary: "Vacances d'été",
        start: at(2026, 7, 4),
        end: at(2026, 9, 1),
        allDay: true,
      }),
    ];
    renderTile();
    expect(screen.getByText(/Jusqu'au 31 août/)).toBeInTheDocument();
  });

  it("an unreadable answer says so — it must never look like an empty day", () => {
    // Review 2026-07-28 (D2): a format drift made every entry unparsable, the
    // request still succeeded, and the tile claimed "Rien aujourd'hui" on a full
    // day — undimmed, untraced. Task 0 bis is still open, so this is the guard.
    read.unreadable = true;
    renderTile();

    expect(screen.getByText("Indisponible")).toBeInTheDocument();
    expect(screen.queryByText("Rien aujourd'hui")).not.toBeInTheDocument();
    expect(screen.getByRole("button").className).toMatch(/opacity-60/);
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/illisible/i),
    );
  });

  it("est UN seul contrôle, sans commande imbriquée", () => {
    // Ce test assertait « non interactive » en 10.1 ; 10.2 est précisément la
    // story qui l'ouvre. Réécrit plutôt que supprimé : la spec a changé, mais
    // l'invariant qui compte reste — la chip est une cible unique, on ne peut
    // pas rater /agenda en visant un sous-élément.
    renderTile();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("link")).toBeNull();
  });
});
