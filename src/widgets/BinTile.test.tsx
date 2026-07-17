import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BinTile } from "./BinTile";

const hass = vi.hoisted(() => ({
  state: "jaune_a_sortir" as string,
  connectionStatus: "connected" as string,
  setDatetime: vi.fn(),
}));

vi.mock("@hakit/core", () => ({
  useEntity: () => ({
    state: hass.state,
    last_changed: "2026-07-16T18:00:00Z",
    attributes: {},
  }),
  useHass: (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: hass.connectionStatus }),
  useService: () => ({ setDatetime: hass.setDatetime }),
}));

describe("BinTile (Story 6.1 — top-bar indicator)", () => {
  beforeEach(() => {
    hass.state = "jaune_a_sortir";
    hass.connectionStatus = "connected";
    hass.setDatetime.mockClear();
  });

  it("a_sortir → shown + marks sortie by writing the input_datetime", () => {
    render(<BinTile />);
    const btn = screen.getByRole("button", { name: /jaune à sortir/i });

    fireEvent.click(btn);

    expect(hass.setDatetime).toHaveBeenCalledWith({
      target: "input_datetime.poubelle_jaune_sortie",
      serviceData: { timestamp: expect.any(Number) },
    });
  });

  it("oubli → red thicker border; tap acknowledges by writing the ack helper (no sortie)", () => {
    hass.state = "noire_oubli";
    render(<BinTile />);
    const btn = screen.getByRole("button", { name: /noire oubliée/i });

    expect(btn.className).toContain("border-2");
    expect(btn.className).toContain("border-security-alert");
    const icon = btn.querySelector("svg");
    expect(icon?.getAttribute("class") ?? "").not.toContain(
      "text-security-alert",
    );

    fireEvent.click(btn);
    expect(hass.setDatetime).toHaveBeenCalledWith({
      target: "input_datetime.poubelle_noire_oubli_ack",
      serviceData: { timestamp: expect.any(Number) },
    });
  });

  it("noire_a_sortir → writes the noire sortie helper (colour×branch cover)", () => {
    hass.state = "noire_a_sortir";
    render(<BinTile />);
    fireEvent.click(screen.getByRole("button", { name: /noire à sortir/i }));
    expect(hass.setDatetime).toHaveBeenCalledWith({
      target: "input_datetime.poubelle_noire_sortie",
      serviceData: { timestamp: expect.any(Number) },
    });
  });

  it("jaune_oubli → writes the jaune ack helper (colour×branch cover)", () => {
    hass.state = "jaune_oubli";
    render(<BinTile />);
    fireEvent.click(screen.getByRole("button", { name: /jaune oubliée/i }));
    expect(hass.setDatetime).toHaveBeenCalledWith({
      target: "input_datetime.poubelle_jaune_oubli_ack",
      serviceData: { timestamp: expect.any(Number) },
    });
  });

  it("sortie → shown as a disabled done confirmation, no HA write on click", () => {
    hass.state = "jaune_sortie";
    render(<BinTile />);
    const btn = screen.getByRole("button", { name: /jaune sortie/i });

    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(hass.setDatetime).not.toHaveBeenCalled();
  });

  it("oubli_ack → renders nothing (acknowledged, hidden)", () => {
    hass.state = "jaune_oubli_ack";
    const { container } = render(<BinTile />);
    expect(container).toBeEmptyDOMElement();
  });

  it("aucune → renders nothing (no top-bar clutter)", () => {
    hass.state = "aucune";
    const { container } = render(<BinTile />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offline → renders nothing", () => {
    hass.connectionStatus = "disconnected";
    const { container } = render(<BinTile />);
    expect(container).toBeEmptyDOMElement();
  });
});
