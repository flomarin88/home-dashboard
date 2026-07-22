import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BinTile } from "./BinTile";
import { useUndoStore } from "../state/undo";

const hass = vi.hoisted(() => ({
  state: "jaune_a_sortir" as string,
  connectionStatus: "connected" as string,
  setDatetime: vi.fn(),
  // prior epoch of the target input_datetime, snapshotted by the tile on tap.
  priorTimestamp: 1_600_000_000 as number | undefined,
}));

vi.mock("@hakit/core", () => {
  const useHass = (selector: (s: { connectionStatus: string }) => unknown) =>
    selector({ connectionStatus: hass.connectionStatus });
  // The tile reads the target helper's prior value imperatively via
  // `useHass.getState().entities[...]` — mirror that shape here.
  useHass.getState = () => ({
    entities: {
      "input_datetime.poubelle_jaune_sortie": {
        attributes: { timestamp: hass.priorTimestamp },
      },
      "input_datetime.poubelle_noire_sortie": {
        attributes: { timestamp: hass.priorTimestamp },
      },
      "input_datetime.poubelle_jaune_oubli_ack": {
        attributes: { timestamp: hass.priorTimestamp },
      },
      "input_datetime.poubelle_noire_oubli_ack": {
        attributes: { timestamp: hass.priorTimestamp },
      },
    },
  });
  return {
    useEntity: () => ({
      state: hass.state,
      last_changed: "2026-07-16T18:00:00Z",
      attributes: {},
    }),
    useHass,
    useService: () => ({ setDatetime: hass.setDatetime }),
  };
});

describe("BinTile (Story 6.1 — top-bar indicator)", () => {
  beforeEach(() => {
    hass.state = "jaune_a_sortir";
    hass.connectionStatus = "connected";
    hass.priorTimestamp = 1_600_000_000;
    hass.setDatetime.mockClear();
    useUndoStore.setState({ queue: [] });
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

  it("tap offers a 5 s undo that restores the target's prior timestamp (misclick net)", () => {
    render(<BinTile />);
    fireEvent.click(screen.getByRole("button", { name: /jaune à sortir/i }));
    hass.setDatetime.mockClear(); // drop the forward write; assert only the revert

    const undo = useUndoStore.getState().queue.at(-1);
    expect(undo).not.toBeNull();
    expect(undo!.expiresAt - undo!.offeredAt).toBe(5000);

    useUndoStore.getState().runUndo();
    expect(hass.setDatetime).toHaveBeenCalledWith({
      target: "input_datetime.poubelle_jaune_sortie",
      serviceData: { timestamp: 1_600_000_000 },
    });
  });

  it("undo of a never-set helper restores epoch 0 (first-ever use → phase reverts)", () => {
    hass.priorTimestamp = undefined;
    render(<BinTile />);
    fireEvent.click(screen.getByRole("button", { name: /jaune à sortir/i }));
    hass.setDatetime.mockClear();

    useUndoStore.getState().runUndo();
    expect(hass.setDatetime).toHaveBeenCalledWith({
      target: "input_datetime.poubelle_jaune_sortie",
      serviceData: { timestamp: 0 },
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

  it("sortie → disabled, green fill instead of a check, no HA write on click", () => {
    hass.state = "jaune_sortie";
    render(<BinTile />);
    const btn = screen.getByRole("button", { name: /jaune sortie/i });

    expect(btn).toBeDisabled();

    // Done cue = ground fills green (parity with TurtleTile), not a checkmark.
    const fill = btn.querySelector("span[aria-hidden]");
    expect(fill?.getAttribute("class") ?? "").toContain("bg-security-ok");
    expect(fill?.getAttribute("class") ?? "").toContain("h-full");
    expect(btn.querySelectorAll("svg")).toHaveLength(1); // poubelle icon only

    fireEvent.click(btn);
    expect(hass.setDatetime).not.toHaveBeenCalled();
  });

  it("a_sortir → no green fill yet (fill span at h-0)", () => {
    render(<BinTile />);
    const fill = screen
      .getByRole("button", { name: /jaune à sortir/i })
      .querySelector("span[aria-hidden]");
    expect(fill?.getAttribute("class") ?? "").toContain("h-0");
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
