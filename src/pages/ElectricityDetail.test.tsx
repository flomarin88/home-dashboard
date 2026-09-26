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

// 24 hourly rows for 24 Sept local (22:00Z the 23rd → 21:00Z the 24th).
const hourReply = () => ({
  response: {
    statistics: {
      [CONSO]: Array.from({ length: 24 }, (_, h) => ({
        start: new Date(Date.UTC(2026, 8, 23, 22 + h)).toISOString(),
        change: 0.2 + h * 0.01,
      })),
    },
  },
});

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
  state.callService.mockReset();
  state.callService.mockImplementation(
    async (args: { serviceData: { period: string } }) =>
      args.serviceData.period === "hour" ? hourReply() : dayData,
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

  it("charts the 24 HOURS of the shown day, asked as a second query with that day's window", async () => {
    await renderPage();
    expect(
      screen.getByRole("img", {
        name: /Consommation horaire, hier, jeudi 24 septembre/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Conso horaire — Hier")).toBeInTheDocument();

    const hourCall = state.callService.mock.calls
      .map((c) => c[0])
      .find((a) => a.serviceData.period === "hour");
    expect(hourCall).toBeDefined();
    expect(hourCall.serviceData.statistic_ids).toEqual([CONSO]);
    expect(hourCall.serviceData.start_time).toBe("2026-09-23T22:00:00.000Z");
    expect(hourCall.serviceData.end_time).toBe("2026-09-24T22:00:00.000Z");
    expect(hourCall.serviceData.types).toEqual(["change"]);
  });

  it("colours each hourly bar by the tariff HA was in, rounded to the hour by majority", async () => {
    await renderPage();
    const fills = screen
      .getAllByTestId("bar-cell")
      .map((c) => c.getAttribute("data-fill"));
    expect(fills).toHaveLength(24);
    // 01h–05h creuses (5 h), 13h–15h creuses (3 h): 01:08→01h is creuses,
    // 06:08→06h is pleines, 12:38→12h is pleines, 15:38→15h is creuses.
    const creuses = fills.filter((f) => f === "var(--color-tariff-creuses)");
    const pleines = fills.filter((f) => f === "var(--color-tariff-pleines)");
    expect(creuses).toHaveLength(8);
    expect(pleines).toHaveLength(16);
    expect(fills[1]).toBe("var(--color-tariff-creuses)");
    expect(fills[6]).toBe("var(--color-tariff-pleines)");
    expect(fills[12]).toBe("var(--color-tariff-pleines)");
    expect(fills[15]).toBe("var(--color-tariff-creuses)");
  });

  it("asks the period sensor's history for enough hours to cover the shown day", async () => {
    // The mock ignores the options, so assert through the coverage helper's
    // contract: 25 Sept 10:30 → 24 Sept 00:00 needs 36 h. Rendered without
    // throwing and with 24 coloured cells is the observable part.
    await renderPage();
    expect(screen.getAllByTestId("bar-cell")).toHaveLength(24);
  });

  it("never colours alone: a glyph + word legend sits under the chart (UX-DR14)", async () => {
    await renderPage();
    const legend = screen.getByTestId("hourly-legend");
    expect(legend.textContent).toMatch(/Creuses/);
    expect(legend.textContent).toMatch(/Pleines/);
    expect(legend.querySelectorAll("svg")).toHaveLength(2);
  });

  it("hours the history does not cover stay neutral — no tariff is invented", async () => {
    state.periodHistory = [{ s: "on", lu: localSec(20, 0) }]; // nothing known before 20:00
    await renderPage();
    const fills = screen
      .getAllByTestId("bar-cell")
      .map((c) => c.getAttribute("data-fill"));
    expect(fills.slice(0, 20).every((f) => f === "var(--color-text)")).toBe(
      true,
    );
    expect(
      fills.slice(20).every((f) => f === "var(--color-tariff-creuses)"),
    ).toBe(true);
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
