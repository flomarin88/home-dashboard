import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Story 9.4: consumption + cost come from `recorder.get_statistics` via
// `callService` (day rows for the figures, hour rows for the chart); only the
// tariff entities of 9.2 are still read as entity state.
const state = vi.hoisted(() => ({
  connectionStatus: "connected" as string,
  period: "on" as string,
  priceCreuses: "0.0890" as string,
  pricePleines: "0.1491" as string,
  nextSwitch: "2026-09-25T12:38:00Z" as string,
  callService: vi.fn(),
  // History of the period binary_sensor over 24 Sept (local): the four flips
  // of the house's HC windows, plus the state in force at the window start.
  periodHistory: [] as { s: string; lu: number }[],
}));

vi.mock("@hakit/core", () => ({
  useEntity: (id: string) => {
    const last_changed = "2026-09-25T09:00:00Z";
    if (id.includes("prix_kwh_creuses"))
      return { state: state.priceCreuses, last_changed, attributes: {} };
    if (id.includes("prix_kwh_pleines"))
      return { state: state.pricePleines, last_changed, attributes: {} };
    if (id.startsWith("binary_sensor."))
      return { state: state.period, last_changed, attributes: {} };
    if (id.includes("prochaine_bascule"))
      return { state: state.nextSwitch, last_changed, attributes: {} };
    return null;
  },
  useHistory: () => ({
    entityHistory: state.periodHistory,
    coordinates: [],
    timeline: [],
    loading: false,
  }),
  useHass: (
    selector: (s: {
      connectionStatus: string;
      helpers: { callService: unknown };
    }) => unknown,
  ) =>
    selector({
      connectionStatus: state.connectionStatus,
      helpers: { callService: state.callService },
    }),
}));

// Recharts stubbed — the chart mounts (with data) without ResizeObserver/canvas.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: unknown }) => children,
  LineChart: ({ children }: { children: unknown }) => children,
  BarChart: ({ children }: { children: unknown }) => children,
  Line: () => null,
  Bar: ({ children }: { children: unknown }) => children,
  Cell: ({ fill }: { fill: string }) => (
    <i data-testid="bar-cell" data-fill={fill} />
  ),
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}));

import { ElectricityDetailContent } from "./ElectricityDetail";
import { electricityConfig } from "../entities";

const CONSO = "linky:24305788525104";
const COST = "linky:24305788525104_cost";
const D23 = "2026-09-22T22:00:00+00:00";
const D24 = "2026-09-23T22:00:00+00:00";

const dayReply = (
  conso: { start: string; change?: number }[],
  cost: { start: string; change?: number }[],
) => ({ response: { statistics: { [CONSO]: conso, [COST]: cost } } });

// Hourly rows for BOTH days of the default window (23 and 24 Sept local);
// the page must keep only the shown day's 24. `skipHours` punches gaps.
const hourReply = (skipHours: number[] = []) => ({
  response: {
    statistics: {
      [CONSO]: Array.from({ length: 48 }, (_, h) => ({
        start: new Date(Date.UTC(2026, 8, 22, 22 + h)).toISOString(),
        change: 0.2 + h * 0.01,
      })).filter((_, h) => !(h >= 24 && skipHours.includes(h - 24))),
    },
  },
});
let hourData = hourReply();

// Story 9.5 — navigation asks for OTHER windows. Replies are keyed by
// `period|start_time`; a window nobody configured answers with no statistics.
// The default two-day window (9.4) keeps its fixtures above.
type ServiceData = { period: string; start_time: string; end_time: string };
const DEFAULT_START = "2026-09-22T22:00:00.000Z";
const replies = new Map<string, unknown>();
const key = (period: string, start: Date) => `${period}|${start.toISOString()}`;
const reply = (
  stats: Record<string, { start: string; change?: number }[]>,
) => ({
  response: { statistics: stats },
});
/** A row starting at LOCAL midnight (or the 1st), as HA sends it: UTC ISO. */
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const rowAt = (y: number, m: number, d: number, change?: number) => ({
  start: at(y, m, d).toISOString(),
  ...(change === undefined ? {} : { change }),
});
function route(data: ServiceData): unknown {
  if (data.start_time === DEFAULT_START)
    return data.period === "hour" ? hourData : dayData;
  return replies.get(`${data.period}|${data.start_time}`) ?? reply({});
}
const callsFor = (period: string) =>
  state.callService.mock.calls
    .map((c) => c[0] as { serviceData: ServiceData })
    .filter((a) => a.serviceData.period === period)
    .map((a) => a.serviceData);

let dayData = dayReply(
  [
    { start: D23, change: 6.1 },
    { start: D24, change: 8.2 },
  ],
  [
    { start: D23, change: 0.8 },
    { start: D24, change: 1.07 },
  ],
);

const tree = (cfg = electricityConfig()) => (
  <MemoryRouter initialEntries={["/electricite"]}>
    <Routes>
      <Route
        path="/electricite"
        element={<ElectricityDetailContent cfg={cfg} />}
      />
      <Route path="/" element={<div>home-page</div>} />
    </Routes>
  </MemoryRouter>
);

async function renderPage() {
  // The chart is `React.lazy`: its dynamic import is real I/O, not a timer, so
  // under fake timers a loaded machine can leave Suspense unresolved after the
  // flush below (seen as an order-dependent failure in the full suite). Warm the
  // module first, so the lazy factory resolves in a microtask that `act` awaits.
  await import("../widgets/SensorHistoryChart");
  const utils = render(tree());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);
  });
  return {
    ...utils,
    rerenderPage: async () => {
      utils.rerender(tree());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
    },
  };
}

const localSec = (h: number, m = 0, d = 24) =>
  Math.floor(new Date(2026, 8, d, h, m).getTime() / 1000);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 25, 10, 30)); // Fri 25 Sept 2026
  state.periodHistory = [
    { s: "off", lu: localSec(23, 0, 23) },
    { s: "on", lu: localSec(1, 8) },
    { s: "off", lu: localSec(6, 8) },
    { s: "on", lu: localSec(12, 38) },
    { s: "off", lu: localSec(15, 38) },
  ];
  state.connectionStatus = "connected";
  state.period = "on";
  state.priceCreuses = "0.0890";
  state.pricePleines = "0.1491";
  state.nextSwitch = "2026-09-25T12:38:00Z";
  dayData = dayReply(
    [
      { start: D23, change: 6.1 },
      { start: D24, change: 8.2 },
    ],
    [
      { start: D23, change: 0.8 },
      { start: D24, change: 1.07 },
    ],
  );
  hourData = hourReply();
  replies.clear();
  state.callService.mockReset();
  state.callService.mockImplementation(
    async (args: { serviceData: ServiceData }) => route(args.serviceData),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ElectricityDetail (Story 9.4 — yesterday, from the Linky statistics)", () => {
  it("names the day shown in full, with HA's cost and the consumption — no price line any more", async () => {
    await renderPage();
    expect(screen.getByText("Hier · jeudi 24 septembre")).toBeInTheDocument();
    expect(screen.getByText(/1,07\s*€/)).toBeInTheDocument();
    expect(screen.getByText(/8,2\s*kWh/)).toBeInTheDocument();
    // The 9.2 "price × current period" line is gone: HA priced the day.
    expect(screen.queryByText(/€\/kWh · Creuses/)).toBeNull();
    expect(screen.queryByText(/depuis 00:00/)).toBeNull();
  });

  it("charts the 24 HOURS of the shown day: ONE hourly query over the two-day window, sliced client-side", async () => {
    await renderPage();
    expect(
      screen.getByRole("img", {
        name: /Consommation horaire, hier, jeudi 24 septembre/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Conso horaire — Hier")).toBeInTheDocument();

    const hourCalls = state.callService.mock.calls
      .map((c) => c[0])
      .filter((a) => a.serviceData.period === "hour");
    expect(hourCalls).toHaveLength(1); // no "guess yesterday" request, no refetch on arrival
    expect(hourCalls[0].serviceData.statistic_ids).toEqual([CONSO]);
    // Same [J-2, J) window as the daily query.
    expect(hourCalls[0].serviceData.start_time).toBe(
      "2026-09-22T22:00:00.000Z",
    );
    expect(hourCalls[0].serviceData.end_time).toBe("2026-09-24T22:00:00.000Z");
    // 48 rows came back, 24 are shown — the other day's never leak in.
    expect(screen.getAllByTestId("bar-cell")).toHaveLength(24);
  });

  it("keeps a missing hour VISIBLE as a gap: 20 rows still make 24 slots", async () => {
    hourData = hourReply([3, 4, 10, 17]);
    await renderPage();
    expect(screen.getAllByTestId("bar-cell")).toHaveLength(24);
  });

  it("a cost row for another day than the shown one renders « — », not that day's euros", async () => {
    dayData = dayReply(
      [
        { start: D23, change: 6.1 },
        { start: D24, change: 8.2 },
      ],
      [{ start: D23, change: 0.8 }],
    );
    await renderPage();
    expect(screen.getByText("Hier · jeudi 24 septembre")).toBeInTheDocument();
    expect(screen.queryByText(/0,80\s*€/)).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("a failing HOURLY refresh dims the page too — old bars must not look current", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rerenderPage } = await renderPage();
    state.callService.mockImplementation(
      async (args: { serviceData: { period: string } }) => {
        if (args.serviceData.period === "hour") throw new Error("boom");
        return dayData;
      },
    );
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    await rerenderPage();
    expect(screen.getByText(/Hors ligne/)).toBeInTheDocument();
    warn.mockRestore();
  });

  it("an unreadable daily answer says « Valeur illisible », not « Pas encore de relevé »", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    dayData = {
      response: { statistics: { [CONSO]: [{ foo: 1 }], [COST]: [] } },
    };
    await renderPage();
    expect(screen.getByText("Valeur illisible")).toBeInTheDocument();
    expect(screen.queryByText("Pas encore de relevé")).toBeNull();
    warn.mockRestore();
  });

  it("before the morning import: the day before, dated « Avant-hier · … »", async () => {
    dayData = dayReply(
      [{ start: D23, change: 6.1 }],
      [{ start: D23, change: 0.8 }],
    );
    await renderPage();
    expect(
      screen.getByText("Avant-hier · mercredi 23 septembre"),
    ).toBeInTheDocument();
    expect(screen.getByText(/0,80\s*€/)).toBeInTheDocument();
  });

  it("no complete day → « Pas encore de relevé », never a blank tile", async () => {
    dayData = dayReply([], []);
    await renderPage();
    expect(screen.getByText("Pas encore de relevé")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("offline → keeps the last-known day (never blank) + « Hors ligne · HH:MM » pill stamped with the REQUEST time (AD-17)", async () => {
    const { rerenderPage } = await renderPage();
    expect(screen.getByText(/1,07\s*€/)).toBeInTheDocument();

    state.connectionStatus = "disconnected";
    await rerenderPage();

    expect(screen.getByText(/Hors ligne · \d{2}:\d{2}/)).toBeInTheDocument();
    expect(screen.getByText(/1,07\s*€/)).toHaveClass("text-stale-text");
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  // ——— The HC/HP tile of Story 9.2 — unchanged, and asserted unchanged ———

  it("fills the HC/HP tile — the 9.1 seam is gone (Story 9.2)", async () => {
    await renderPage();
    expect(screen.getByText("Heures creuses / pleines")).toBeInTheDocument();
    expect(screen.queryByText("À venir")).toBeNull();
  });

  it("shows BOTH tariffs, spelled out, with four decimals", async () => {
    await renderPage();
    expect(screen.getByText(/0,0890\s*€\/kWh/)).toBeInTheDocument();
    expect(screen.getByText(/0,1491\s*€\/kWh/)).toBeInTheDocument();
    expect(screen.getAllByText("Creuses").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pleines").length).toBeGreaterThan(0);
  });

  it("marks the applied tariff with a WORD, not with colour alone (UX-DR14)", async () => {
    await renderPage();
    const applied = screen.getByText("Appliqué");
    expect(applied.closest("li")?.textContent).toMatch(/Creuses/);
  });

  it("tints the applied row with its OWN period colour, not a generic one", async () => {
    const { container, unmount } = await renderPage();
    const li = screen.getByText("Appliqué").closest("li")!;
    expect(li.className).toMatch(/tariff-creuses/);
    expect(container.innerHTML).toMatch(/text-tariff-creuses/);
    unmount();

    state.period = "off";
    await renderPage();
    expect(screen.getByText("Appliqué").closest("li")!.className).toMatch(
      /tariff-pleines/,
    );
  });

  it("moves the 'Appliqué' marker when the period flips", async () => {
    state.period = "off";
    await renderPage();
    expect(screen.getByText("Appliqué").closest("li")?.textContent).toMatch(
      /Pleines/,
    );
  });

  it("reads the next switch from HA and names the period it leads to", async () => {
    await renderPage();
    expect(
      screen.getByText(/Passage en pleines à \d{2}h\d{2}/),
    ).toBeInTheDocument();
  });

  it("an invalid next-switch state degrades to the house dash, never 'Invalid Date'", async () => {
    state.nextSwitch = "unavailable";
    await renderPage();
    expect(screen.getByText(/Passage en pleines à —/)).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
  });

  it("a period never seen: no applied tariff, both prices still listed, the day's cost untouched", async () => {
    state.period = "unknown";
    await renderPage();
    expect(screen.queryByText("Appliqué")).toBeNull();
    expect(screen.getByText(/0,0890\s*€\/kWh/)).toBeInTheDocument();
    expect(screen.getByText(/0,1491\s*€\/kWh/)).toBeInTheDocument();
    // HA priced yesterday; an unknown period NOW does not erase that figure.
    expect(screen.getByText(/1,07\s*€/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("back link navigates home", async () => {
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Accueil/i }));
    expect(screen.getByText("home-page")).toBeInTheDocument();
  });
});

// ——— Story 9.5 — navigating the past, and the month view ———

describe("ElectricityDetail (Story 9.5 — ‹ ›, Jour / Mois, « Dernier relevé »)", () => {
  const click = async (name: RegExp | string) => {
    fireEvent.click(screen.getByRole("button", { name }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
    });
  };
  const tab = async (name: string) => {
    fireEvent.click(screen.getByRole("tab", { name }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);
    });
  };

  it("renders ONE control row: Jour / Mois tabs, ‹ ›, the period reminder and « Dernier relevé » — none disabled", async () => {
    const { container } = await renderPage();
    const row = container.querySelector(".h-\\[52px\\]");
    expect(row).not.toBeNull();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Jour", "Mois"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    for (const name of [
      "Période précédente",
      "Période suivante",
      "Dernier relevé",
    ]) {
      expect(screen.getByRole("button", { name })).not.toBeDisabled();
    }
    // The reminder wears the SHORT form; the tile title carries the long one.
    expect(screen.getByText("Hier")).toBeInTheDocument();
    expect(screen.getByText("Hier · jeudi 24 septembre")).toBeInTheDocument();
  });

  it("without navigating, asks HA exactly what 9.4 asked: the two default-window queries, nothing more", async () => {
    await renderPage();
    expect(state.callService).toHaveBeenCalledTimes(2);
    expect(callsFor("month")).toHaveLength(0);
  });

  it("‹ steps back one day: day + hour queries on [23, 24 Sept), the tile named for that day", async () => {
    replies.set(
      key("day", at(2026, 9, 23)),
      reply({
        [CONSO]: [rowAt(2026, 9, 23, 6.1)],
        [COST]: [rowAt(2026, 9, 23, 0.8)],
      }),
    );
    replies.set(
      key("hour", at(2026, 9, 23)),
      reply({
        [CONSO]: Array.from({ length: 24 }, (_, h) => ({
          start: new Date(2026, 8, 23, h).toISOString(),
          change: 0.25,
        })),
      }),
    );
    await renderPage();
    await click("Période précédente");

    const day = callsFor("day").at(-1)!;
    expect(day.start_time).toBe(at(2026, 9, 23).toISOString());
    expect(day.end_time).toBe(at(2026, 9, 24).toISOString());
    const hour = callsFor("hour").at(-1)!;
    expect(hour.start_time).toBe(at(2026, 9, 23).toISOString());
    expect(hour.end_time).toBe(at(2026, 9, 24).toISOString());

    expect(
      screen.getByText("Avant-hier · mercredi 23 septembre"),
    ).toBeInTheDocument();
    expect(screen.getByText(/0,80\s*€/)).toBeInTheDocument();
    expect(screen.getByText(/6,1\s*kWh/)).toBeInTheDocument();
    expect(screen.getAllByTestId("bar-cell")).toHaveLength(24);
    expect(screen.getByText("mer. 23")).toBeInTheDocument();
  });

  it("› at the last complete day is idempotent: no new query, same day on screen", async () => {
    await renderPage();
    const before = state.callService.mock.calls.length;
    await click("Période suivante");
    expect(state.callService.mock.calls.length).toBe(before);
    expect(screen.getByText("Hier · jeudi 24 septembre")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Période suivante" }),
    ).not.toBeDisabled();
  });

  it("« Dernier relevé » comes back to the latest day after navigating", async () => {
    await renderPage();
    await click("Période précédente");
    expect(screen.queryByText("Hier · jeudi 24 septembre")).toBeNull();
    await click("Dernier relevé");
    expect(screen.getByText("Hier · jeudi 24 septembre")).toBeInTheDocument();
  });

  it("a past day HA has no row for says « Pas de relevé ce jour-là » — not « Pas encore de relevé »", async () => {
    await renderPage();
    await click("Période précédente");
    await click("Période précédente"); // 22 Sept: nothing configured
    expect(screen.getByText("Pas de relevé ce jour-là")).toBeInTheDocument();
    expect(screen.queryByText("Pas encore de relevé")).toBeNull();
    expect(screen.getByText("Mardi 22 septembre")).toBeInTheDocument();
  });

  it("bars of a day the period history does not cover stay NEUTRAL — never a guessed tariff", async () => {
    // The fixture history starts 23 Sept 23:00; the 23rd's hours before that
    // have no known state, so 23 of its 24 bars carry no tariff colour.
    replies.set(
      key("hour", at(2026, 9, 23)),
      reply({
        [CONSO]: Array.from({ length: 24 }, (_, h) => ({
          start: new Date(2026, 8, 23, h).toISOString(),
          change: 0.25,
        })),
      }),
    );
    await renderPage();
    await click("Période précédente");
    const fills = screen
      .getAllByTestId("bar-cell")
      .map((c) => c.getAttribute("data-fill"));
    expect(fills.filter((f) => f === "var(--color-text)")).toHaveLength(23);
    expect(
      screen.getByRole("img", { name: /période tarifaire non disponible/i }),
    ).toBeInTheDocument();
  });

  // ——— Month view ———

  const monthFixtures = () => {
    // 14 months of buckets [Aug 2025, Oct 2026): M, M−1, M−12 all present.
    replies.set(
      key("month", at(2025, 8, 1)),
      reply({
        [CONSO]: [
          rowAt(2025, 9, 1, 210),
          rowAt(2026, 7, 1, 150),
          rowAt(2026, 8, 1, 180),
          rowAt(2026, 9, 1, 200),
        ],
        [COST]: [
          rowAt(2025, 9, 1, 24),
          rowAt(2026, 7, 1, 0),
          rowAt(2026, 8, 1, 22),
          rowAt(2026, 9, 1, 25),
        ],
      }),
    );
    // Daily rows of September: 1 → 24 (the data stops at the last complete day).
    replies.set(
      key("day", at(2026, 9, 1)),
      reply({
        [CONSO]: Array.from({ length: 24 }, (_, i) => rowAt(2026, 9, i + 1, 8)),
      }),
    );
    // « à date » references, TRUNCATED to 24 days — HA's own change of the portion.
    replies.set(
      key("month", at(2026, 8, 1)),
      reply({
        [CONSO]: [rowAt(2026, 8, 1, 178.6)],
        [COST]: [rowAt(2026, 8, 1, 22.9)],
      }),
    );
    replies.set(
      key("month", at(2025, 9, 1)),
      reply({ [CONSO]: [rowAt(2025, 9, 1, 210.5)], [COST]: [] }),
    );
  };

  it("Mois: ONE 14-month query + the month's daily rows; cost hero, conso, title « à date (N j) » on the current month", async () => {
    monthFixtures();
    await renderPage();
    await tab("Mois");

    const months = callsFor("month");
    expect(months[0].start_time).toBe(at(2025, 8, 1).toISOString());
    expect(months[0].end_time).toBe(at(2026, 10, 1).toISOString());
    const days = callsFor("day").at(-1)!;
    expect(days.start_time).toBe(at(2026, 9, 1).toISOString());
    expect(days.end_time).toBe(at(2026, 10, 1).toISOString());

    expect(
      screen.getByText("Septembre 2026 · à date (24 j)"),
    ).toBeInTheDocument();
    expect(screen.getByText(/25,00\s*€/)).toBeInTheDocument();
    expect(screen.getByText(/200,0\s*kWh/)).toBeInTheDocument();
    expect(screen.getByText("sept. 2026")).toBeInTheDocument();
    // One bar per calendar day of September, the 6 future days as gaps.
    expect(screen.getAllByTestId("bar-cell")).toHaveLength(30);
  });

  it("current month compares « à date » through TRUNCATED windows HA computes — the app sums nothing", async () => {
    monthFixtures();
    await renderPage();
    await tab("Mois");

    const truncated = callsFor("month").slice(1);
    expect(truncated.map((q) => [q.start_time, q.end_time])).toEqual([
      [at(2026, 8, 1).toISOString(), at(2026, 8, 25).toISOString()],
      [at(2025, 9, 1).toISOString(), at(2025, 9, 25).toISOString()],
    ]);
    // 200 vs 178.6 = +12 % · 25 vs 22.9 = +9 % ; 200 vs 210.5 = −5 % · cost absent = —
    expect(
      screen.getByText(/vs août \(à date\) : conso \+12\s*% · coût \+9\s*%/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/vs sept\. 2025 \(à date\) : conso [−-]5\s*% · coût —/),
    ).toBeInTheDocument();
  });

  it("a CLOSED month compares whole months from the same 14-month reply — no truncated query; a zero reference renders —", async () => {
    monthFixtures();
    replies.set(
      key("month", at(2025, 7, 1)),
      reply({
        [CONSO]: [
          rowAt(2025, 8, 1, 190),
          rowAt(2026, 7, 1, 150),
          rowAt(2026, 8, 1, 180),
        ],
        [COST]: [
          rowAt(2025, 8, 1, 21),
          rowAt(2026, 7, 1, 0),
          rowAt(2026, 8, 1, 22),
        ],
      }),
    );
    replies.set(
      key("day", at(2026, 8, 1)),
      reply({
        [CONSO]: Array.from({ length: 31 }, (_, i) => rowAt(2026, 8, i + 1, 6)),
      }),
    );
    await renderPage();
    await tab("Mois");
    const monthCallsBefore = callsFor("month").length;
    await click("Période précédente");

    expect(screen.getByText("Août 2026")).toBeInTheDocument();
    expect(screen.queryByText(/à date/)).toBeNull();
    expect(callsFor("month").length).toBe(monthCallsBefore + 1);
    const last = callsFor("month").at(-1)!;
    expect(last.start_time).toBe(at(2025, 7, 1).toISOString());
    expect(last.end_time).toBe(at(2026, 9, 1).toISOString());
    // 180 vs 150 = +20 % ; cost 22 vs 0 → — (never Infinity)
    expect(
      screen.getByText(/vs juillet : conso \+20\s*% · coût —/),
    ).toBeInTheDocument();
    // 180 vs 190 = −5 % ; 22 vs 21 = +5 %
    expect(
      screen.getByText(/vs août 2025 : conso [−-]5\s*% · coût \+5\s*%/),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("bar-cell")).toHaveLength(31);
  });

  it("› on the current month is idempotent, and the anchor survives a view switch", async () => {
    monthFixtures();
    await renderPage();
    await tab("Mois");
    const before = state.callService.mock.calls.length;
    await click("Période suivante");
    expect(state.callService.mock.calls.length).toBe(before);
    expect(screen.getByText(/^Septembre 2026/)).toBeInTheDocument();

    await click("Période précédente"); // août
    await tab("Jour");
    // The day view lands inside August — the 1st, as the month step does.
    expect(screen.getByText("Samedi 1 août")).toBeInTheDocument();
  });

  it("a month HA has no rows for renders « — » everywhere and no truncated query (N = 0)", async () => {
    await renderPage();
    await tab("Mois");
    expect(callsFor("month")).toHaveLength(1);
    expect(screen.getByText("Septembre 2026")).toBeInTheDocument();
    expect(screen.getByText(/vs août : conso — · coût —/)).toBeInTheDocument();
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
  });
});
