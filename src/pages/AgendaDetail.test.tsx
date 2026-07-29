import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// The page is tested against the READ hook's contract, not against HA — the
// query path has its own suite. Each render records the ranges asked for, which
// is how the view-switch assertions stay honest.
const read = vi.hoisted(() => ({
  events: [] as {
    summary: string;
    start: Date;
    end: Date;
    allDay: boolean;
    calendarId: string;
  }[],
  isStale: false,
  loading: false,
  since: undefined as string | undefined,
  unreadable: false,
  ranges: [] as { start: Date; end: Date }[],
}));

vi.mock("../hakit/useCalendarEvents", () => ({
  useCalendarEvents: (range?: { start: Date; end: Date }) => {
    if (range) read.ranges.push(range);
    return read;
  },
}));

import { AgendaDetail } from "./AgendaDetail";

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min);

const ev = (
  summary: string,
  start: Date,
  end: Date,
  allDay = false,
  calendarId = "calendar.chats",
) => ({ summary, start, end, allDay, calendarId });

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/agenda"]}>
      <Routes>
        <Route path="/agenda" element={<AgendaDetail />} />
        <Route path="/" element={<div>home-page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  read.events = [];
  read.isStale = false;
  read.loading = false;
  read.since = "2026-07-29T12:00:00.000Z";
  read.unreadable = false;
  read.ranges = [];
  vi.useFakeTimers();
  // Mercredi 29 juillet 2026, 13:00 — la semaine court du lundi 27 au 2 août.
  vi.setSystemTime(at(2026, 7, 29, 13, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AgendaDetail (Story 10.2)", () => {
  it("ouvre sur la vue Jour", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: "Jour" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("le fil d'Ariane ramène à l'accueil", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Accueil/i }));
    expect(screen.getByText("home-page")).toBeInTheDocument();
  });

  it("demande la plage du JOUR au montage", () => {
    renderPage();
    const r = read.ranges[0];
    expect(r.start.getDate()).toBe(29);
    expect(r.end.getDate()).toBe(30);
  });

  it("demande la plage de la SEMAINE à la bascule — lundi → lundi", () => {
    renderPage();
    read.ranges = [];
    fireEvent.click(screen.getByRole("tab", { name: "Semaine" }));
    const r = read.ranges[0];
    expect(r.start.getDate()).toBe(27); // lundi
    expect(r.end.getDate()).toBe(3); // lundi suivant, en août
    expect(r.end.getMonth()).toBe(7);
  });

  it("demande le mois STRICT à la bascule (choix de Florian, pas la grille)", () => {
    renderPage();
    read.ranges = [];
    fireEvent.click(screen.getByRole("tab", { name: "Mois" }));
    const r = read.ranges[0];
    expect(r.start.getDate()).toBe(1);
    expect(r.start.getMonth()).toBe(6); // juillet
    expect(r.end.getDate()).toBe(1);
    expect(r.end.getMonth()).toBe(7); // 1er août
  });

  it("vue Jour : montre TOUTE la journée, passé compris", () => {
    // C'est sa raison d'être face à la micro-tuile, qui ne montre que l'à-venir.
    read.events = [
      ev("Enfants - Florian", at(2026, 7, 29, 8, 15), at(2026, 7, 29, 9, 0)),
      ev("Surprise", at(2026, 7, 29, 17, 30), at(2026, 7, 29, 23, 45)),
    ];
    renderPage();
    expect(screen.getByText("Enfants - Florian")).toBeInTheDocument(); // déjà passé
    expect(screen.getByText("Surprise")).toBeInTheDocument();
    expect(screen.getByText("08:15")).toBeInTheDocument();
  });

  it("vue Jour : nomme le calendrier d'origine (UX-DR26)", () => {
    read.events = [
      ev("Surprise", at(2026, 7, 29, 17, 30), at(2026, 7, 29, 23, 45)),
    ];
    renderPage();
    expect(screen.getByText("Chats")).toBeInTheDocument();
  });

  it("vue Semaine : rend SEPT rangées, pas sept colonnes", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Semaine" }));
    for (const j of ["lundi", "mardi", "dimanche"])
      expect(screen.getByText(new RegExp(j, "i"))).toBeInTheDocument();
  });

  it("vue Semaine : un jour vide le DIT, il ne reste pas muet", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Semaine" }));
    expect(screen.getAllByText("rien")).toHaveLength(7);
  });

  it("⚠️ un multi-jours apparaît sur CHAQUE jour couvert, de bout en bout", () => {
    // Le piège central de la story, éprouvé au niveau page et pas seulement sur
    // la fonction pure : « Enfants - Les croûtes » court du 27/07 au 17/08.
    read.events = [ev("Les croûtes", at(2026, 7, 27), at(2026, 8, 17), true)];
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Semaine" }));
    expect(screen.getAllByText("Les croûtes")).toHaveLength(7);
    expect(screen.queryByText("rien")).toBeNull();
  });

  it("vue Mois : 42 cellules, dont celles hors mois", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Mois" }));
    // Juillet 2026 a 31 jours ; la grille en dessine toujours 42.
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("vue Mois : plafonne à 2 pastilles et compte le reste", () => {
    read.events = [
      ev("A", at(2026, 7, 29, 8, 0), at(2026, 7, 29, 9, 0)),
      ev("B", at(2026, 7, 29, 12, 0), at(2026, 7, 29, 13, 0)),
      ev("C", at(2026, 7, 29, 17, 0), at(2026, 7, 29, 18, 0)),
      ev("D", at(2026, 7, 29, 19, 0), at(2026, 7, 29, 20, 0)),
    ];
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Mois" }));
    expect(screen.getByText("+2")).toBeInTheDocument();
    expect(screen.queryByText("C")).toBeNull();
  });

  it("marque aujourd'hui par un MOT, pas seulement par la bordure (UX-DR14)", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Mois" }));
    expect(screen.getByText("auj.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Semaine" }));
    // Le repère précisément, pas le bouton « Aujourd'hui » ajouté depuis : il
    // porte le point médian et vit dans la rangée du jour.
    expect(screen.getByText(/· aujourd'hui/i)).toBeInTheDocument();
  });

  it("les cellules hors du mois ne prétendent RIEN sur leur contenu", () => {
    // Conséquence assumée du mois strict : aucune donnée n'a été demandée pour
    // ces jours, donc ni pastille ni état « rien » — dire rien, pas mentir.
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Mois" }));
    expect(screen.queryByText("rien")).toBeNull();
  });

  it("aucune pastille de couleur de calendrier (arbitrage Florian)", () => {
    read.events = [
      ev("Surprise", at(2026, 7, 29, 17, 30), at(2026, 7, 29, 23, 45)),
    ];
    const { container } = renderPage();
    expect(container.innerHTML).not.toMatch(/cal-(chats|anniversaires)/);
  });

  it("hors ligne : atténue, garde le contenu et horodate", () => {
    read.isStale = true;
    read.events = [
      ev("Surprise", at(2026, 7, 29, 17, 30), at(2026, 7, 29, 23, 45)),
    ];
    const { container } = renderPage();
    expect(screen.getByText(/Hors ligne/)).toBeInTheDocument();
    expect(screen.getByText("Surprise")).toBeInTheDocument(); // jamais de blanc
    expect(container.innerHTML).toMatch(/opacity-60/);
  });

  it("réponse illisible : le dit, ne prétend pas un agenda vide", () => {
    // La garde posée en revue de 10.1 doit survivre au passage à la page.
    read.unreadable = true;
    renderPage();
    expect(screen.getByText(/illisible/i)).toBeInTheDocument();
    expect(screen.queryByText("Rien aujourd'hui")).toBeNull();
  });

  it("chargement : un état dit, jamais un blanc", () => {
    read.loading = true;
    renderPage();
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument();
    expect(screen.queryByText("Rien aujourd'hui")).toBeNull();
  });

  it("journée vide : le dit", () => {
    renderPage();
    expect(screen.getByText("Rien aujourd'hui")).toBeInTheDocument();
  });

  it("la bascule tient sur UNE rangée de 52px (UX-DR29)", () => {
    const { container } = renderPage();
    const row = container.querySelector(".h-\\[52px\\]");
    expect(row).not.toBeNull();
    // Les trois onglets vivent dans cette rangée — 10.3 y ajoutera les filtres.
    expect(within(row as HTMLElement).getAllByRole("tab")).toHaveLength(3);
  });

  it("chaque onglet est une cible d'au moins 44px (NFR2)", () => {
    renderPage();
    for (const tab of screen.getAllByRole("tab"))
      expect(tab.className).toMatch(/h-\[44px\]/);
  });

  it("rappelle la période affichée dans chaque vue", () => {
    renderPage();
    expect(screen.getByText(/mercredi 29 juillet/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Semaine" }));
    expect(screen.getByText(/27 juil\..+2 août/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Mois" }));
    expect(screen.getByText(/juillet 2026/i)).toBeInTheDocument();
  });

  it("la flèche suivante demande la plage SUIVANTE", () => {
    renderPage();
    read.ranges = [];
    fireEvent.click(screen.getByRole("button", { name: /période suivante/i }));
    expect(read.ranges[0].start.getDate()).toBe(30);
    expect(screen.getByText(/jeudi 30 juillet/i)).toBeInTheDocument();
  });

  it("la flèche précédente demande la plage PRÉCÉDENTE", () => {
    renderPage();
    read.ranges = [];
    fireEvent.click(
      screen.getByRole("button", { name: /période précédente/i }),
    );
    expect(read.ranges[0].start.getDate()).toBe(28);
  });

  it("navigue par semaine entière en vue Semaine", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Semaine" }));
    read.ranges = [];
    fireEvent.click(screen.getByRole("button", { name: /période suivante/i }));
    expect(read.ranges[0].start.getDate()).toBe(3); // lundi 3 août
    expect(read.ranges[0].start.getMonth()).toBe(7);
  });

  it("navigue par mois entier, et le rappel suit", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Mois" }));
    read.ranges = [];
    fireEvent.click(screen.getByRole("button", { name: /période suivante/i }));
    expect(read.ranges[0].start.getMonth()).toBe(7); // août
    expect(screen.getByText(/août 2026/i)).toBeInTheDocument();
  });

  it("garde l'ancrage quand on change de vue", () => {
    // On regarde la semaine du 3 août ; passer en mois doit montrer AOÛT,
    // pas retomber sur le mois courant.
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Semaine" }));
    fireEvent.click(screen.getByRole("button", { name: /période suivante/i }));
    fireEvent.click(screen.getByRole("tab", { name: "Mois" }));
    expect(screen.getByText(/août 2026/i)).toBeInTheDocument();
  });

  it("⚠️ « aujourd'hui » reste calé sur la VRAIE date, pas sur l'ancrage", () => {
    // Sinon chaque page naviguée aurait son propre « aujourd'hui » — le repère
    // ne voudrait plus rien dire.
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Mois" }));
    expect(screen.getByText("auj.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /période suivante/i }));
    expect(screen.queryByText("auj.")).toBeNull(); // août ne contient pas le 29 juillet
  });

  it("les flèches sont des cibles d'au moins 44px (NFR2)", () => {
    renderPage();
    for (const nom of [/période précédente/i, /période suivante/i])
      expect(screen.getByRole("button", { name: nom }).className).toMatch(
        /h-\[44px\]/,
      );
  });

  it("⚠️ ne dit pas « Rien AUJOURD'HUI » sur un autre jour que le jour même", () => {
    // Défaut introduit par la navigation : l'état vide de la vue Jour était
    // écrit quand la page ne montrait que le jour courant. Naviguer à demain le
    // transformait en mensonge.
    renderPage();
    expect(screen.getByText("Rien aujourd'hui")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /période suivante/i }));
    expect(screen.queryByText("Rien aujourd'hui")).toBeNull();
    expect(screen.getByText(/rien ce jour-là/i)).toBeInTheDocument();
  });

  it("« Aujourd'hui » ramène à la période contenant la date réelle", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /période suivante/i }));
    fireEvent.click(screen.getByRole("button", { name: /période suivante/i }));
    expect(screen.queryByText(/mercredi 29 juillet/i)).toBeNull();

    read.ranges = [];
    fireEvent.click(screen.getByRole("button", { name: /^aujourd'hui$/i }));
    expect(screen.getByText(/mercredi 29 juillet/i)).toBeInTheDocument();
    expect(read.ranges[0].start.getDate()).toBe(29);
  });

  it("ramène sur la SEMAINE contenant aujourd'hui, pas sur le jour", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Semaine" }));
    fireEvent.click(screen.getByRole("button", { name: /période suivante/i }));
    read.ranges = [];
    fireEvent.click(screen.getByRole("button", { name: /^aujourd'hui$/i }));
    expect(read.ranges[0].start.getDate()).toBe(27); // lundi de la semaine du 29
    expect(screen.getByText(/27 juil\..+2 août/i)).toBeInTheDocument();
  });

  it("ramène sur le MOIS contenant aujourd'hui", () => {
    renderPage();
    fireEvent.click(screen.getByRole("tab", { name: "Mois" }));
    fireEvent.click(screen.getByRole("button", { name: /période suivante/i }));
    expect(screen.queryByText("auj.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /^aujourd'hui$/i }));
    expect(screen.getByText(/juillet 2026/i)).toBeInTheDocument();
    expect(screen.getByText("auj.")).toBeInTheDocument(); // le repère revient
  });

  it("est idempotent : y cliquer en y étant déjà ne redemande rien", () => {
    // Un contrôle qui relance une requête pour rien sur un kiosque mural, c'est
    // du bruit ; et le rendre `disabled` en ferait une cible morte que les
    // lecteurs d'écran sautent (précédent 6.1).
    renderPage();
    read.ranges = [];
    fireEvent.click(screen.getByRole("button", { name: /^aujourd'hui$/i }));
    expect(screen.getByText(/mercredi 29 juillet/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^aujourd'hui$/i }),
    ).not.toBeDisabled();
  });

  it("est une cible d'au moins 44px, à droite des flèches", () => {
    renderPage();
    const btn = screen.getByRole("button", { name: /^aujourd'hui$/i });
    expect(btn.className).toMatch(/h-\[44px\]/);
    const suivante = screen.getByRole("button", { name: /période suivante/i });
    // Même conteneur, et après la flèche « suivante » dans l'ordre du document.
    expect(
      suivante.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
