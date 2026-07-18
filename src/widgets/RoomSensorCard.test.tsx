import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useParams } from "react-router-dom";

// Mutable mock state (vi.hoisted so the hoisted vi.mock factory can read it).
const state = vi.hoisted(() => ({
  connectionStatus: "connected" as string,
  tempState: "21.53" as string,
}));

vi.mock("@hakit/core", () => ({
  useEntity: (id: string) => {
    const last_changed = "2026-07-15T14:02:00Z";
    if (id.includes("temperature"))
      return {
        state: state.tempState,
        last_changed,
        attributes: { unit_of_measurement: "°C" },
      };
    if (id.includes("carbone"))
      return {
        state: "620",
        last_changed,
        attributes: { unit_of_measurement: "ppm" },
      };
    if (id.includes("humidite"))
      return {
        state: "48",
        last_changed,
        attributes: { unit_of_measurement: "%" },
      };
    return null;
  },
  useHistory: () => ({
    entityHistory: [{ s: "20" }, { s: "22" }, { s: "21.5" }],
    coordinates: [],
    timeline: [],
    loading: false,
  }),
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: state.connectionStatus }),
}));

import { RoomSensorCard } from "./RoomSensorCard";
import type { RoomId } from "../entities";

function Detail() {
  const { roomId } = useParams();
  return <div>detail:{roomId}</div>;
}

function renderCard(room: RoomId = "salon") {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<RoomSensorCard room={room} />} />
        <Route path="/room/:roomId" element={<Detail />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.connectionStatus = "connected";
  state.tempState = "21.53";
});

describe("RoomSensorCard", () => {
  it("shows the room label, temperature (glance) and CO₂ / humidity when live", () => {
    renderCard();
    expect(screen.getByText("Salon")).toBeInTheDocument();
    expect(screen.getByText(/21\.5\s*°C/)).toBeInTheDocument();
    expect(screen.getByText(/620 ppm/)).toBeInTheDocument();
    // CO₂ 620 < 1000 → green air-quality colour while live.
    expect(screen.getByText(/620 ppm/).className).toContain("text-security-ok");
    expect(screen.getByText(/48 %/)).toBeInTheDocument();
    expect(screen.queryByText(/Hors ligne/)).toBeNull();
  });

  it("shows a sofa glyph for the living room, a bed glyph for a bedroom", () => {
    const { unmount } = renderCard("salon");
    expect(screen.getByTestId("room-icon-living")).toBeInTheDocument();
    expect(screen.queryByTestId("room-icon-bedroom")).toBeNull();
    unmount();

    renderCard("nathan");
    expect(screen.getByTestId("room-icon-bedroom")).toBeInTheDocument();
    expect(screen.queryByTestId("room-icon-living")).toBeNull();
  });

  it("navigates to the room detail route on tap", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("detail:salon")).toBeInTheDocument();
  });

  it("keeps the last value + shows the offline pill + timestamp when the socket is lost (never blank)", () => {
    state.connectionStatus = "disconnected";
    renderCard();
    expect(screen.getByText(/Hors ligne/)).toBeInTheDocument();
    expect(screen.getByText(/21\.5/)).toBeInTheDocument(); // frozen last value, not blank
    expect(screen.getByText(/dernière donnée \d{2}:\d{2}/)).toBeInTheDocument();
  });

  it("shows a skeleton while connecting with no data yet — not the offline pill", () => {
    state.connectionStatus = "pending";
    state.tempState = "unavailable"; // no known value
    const { container } = renderCard();
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    expect(screen.queryByText(/Hors ligne/)).toBeNull();
    expect(screen.queryByText(/°C/)).toBeNull();
  });

  it("shows offline (not a perpetual skeleton) when connected but the entity is unavailable", () => {
    state.connectionStatus = "connected";
    state.tempState = "unavailable"; // connected, but never a value
    const { container } = renderCard();
    expect(screen.getByText(/Hors ligne/)).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(screen.getByText(/—/)).toBeInTheDocument();
  });
});
