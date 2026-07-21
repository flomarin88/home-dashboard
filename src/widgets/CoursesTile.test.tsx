import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { GrocerySummaryValue } from "../nutriclaude";

// Mutable mock of the seam hook — the tile is tested at the hook boundary
// (equivalent to a mocked Supabase client, but without async plumbing).
const value = vi.hoisted(
  () =>
    ({
      pendingCount: 0,
      lastAdded: [] as GrocerySummaryValue["lastAdded"],
      isStale: false,
      loading: false,
      since: undefined as string | undefined,
    }) as {
      -readonly [K in keyof GrocerySummaryValue]: GrocerySummaryValue[K];
    },
);

vi.mock("../nutriclaude", () => ({
  useGrocerySummary: () => value,
  nutriIsConfigured: true,
}));

function renderTile() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={
            // Imported lazily below after mocks are set.
            <Tile />
          }
        />
        <Route path="/courses" element={<div>PAGE DÉTAIL</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

// Import after vi.mock so the mock is in place.
import { CoursesTile } from "./CoursesTile";
function Tile() {
  return <CoursesTile />;
}

describe("CoursesTile", () => {
  beforeEach(() => {
    value.pendingCount = 0;
    value.lastAdded = [];
    value.isStale = false;
    value.loading = false;
    value.since = undefined;
  });

  it("live: shows the pending count, the preview, and the courses accent when non-empty", () => {
    value.pendingCount = 12;
    value.lastAdded = [
      { name: "Poivrons", createdAt: "2026-07-21T11:00:00Z" },
      { name: "Lait", createdAt: "2026-07-21T10:00:00Z" },
      { name: "Café", createdAt: "2026-07-21T09:00:00Z" },
    ];
    value.since = "2026-07-21T11:00:00Z";
    renderTile();

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Poivrons, Lait, Café +9")).toBeInTheDocument();
    const tile = screen.getByRole("button");
    expect(tile).toHaveAttribute("data-state", "on");
    expect(tile).toHaveAttribute("data-domain", "courses");
  });

  it("empty list is not accent-tinted (no active state)", () => {
    value.pendingCount = 0;
    renderTile();
    expect(screen.getByRole("button")).not.toHaveAttribute("data-state", "on");
  });

  it("offline: keeps the last-known count + 'Hors ligne' pill, no preview", () => {
    value.pendingCount = 7;
    value.isStale = true;
    value.since = "2026-07-21T08:00:00Z";
    renderTile();

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText(/Hors ligne/)).toBeInTheDocument();
    const tile = screen.getByRole("button");
    expect(tile.className).toContain("border-dashed");
    expect(tile).not.toHaveAttribute("data-state", "on");
  });

  it("loading: shows skeletons, no count text yet", () => {
    value.loading = true;
    renderTile();
    expect(screen.queryByText("à acheter")).not.toBeInTheDocument();
  });

  it("tapping the tile navigates to the detail route", () => {
    renderTile();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("PAGE DÉTAIL")).toBeInTheDocument();
  });
});
