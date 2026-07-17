import { describe, it, expect } from "vitest";
import { binView } from "./bin-state";

describe("binView", () => {
  it("maps active windows (a_sortir)", () => {
    expect(binView("jaune_a_sortir")).toEqual({
      bin: "jaune",
      color: "jaune",
      phase: "a_sortir",
    });
    expect(binView("noire_a_sortir")).toEqual({
      bin: "noire",
      color: "noire",
      phase: "a_sortir",
    });
  });
  it("maps sortie (done confirmation, keeps the bin colour)", () => {
    expect(binView("jaune_sortie")).toEqual({
      bin: "jaune",
      color: "jaune",
      phase: "sortie",
    });
    expect(binView("noire_sortie")).toEqual({
      bin: "noire",
      color: "noire",
      phase: "sortie",
    });
  });
  it("maps oubli (bin colour kept)", () => {
    expect(binView("jaune_oubli")).toEqual({
      bin: "jaune",
      color: "jaune",
      phase: "oubli",
    });
    expect(binView("noire_oubli")).toEqual({
      bin: "noire",
      color: "noire",
      phase: "oubli",
    });
  });
  it("maps aucune / oubli_ack / unknown / null to hidden (phase null)", () => {
    const hidden = { bin: null, color: "idle", phase: null };
    expect(binView("aucune")).toEqual(hidden);
    expect(binView("jaune_oubli_ack")).toEqual(hidden);
    expect(binView("noire_oubli_ack")).toEqual(hidden);
    expect(binView("unavailable")).toEqual(hidden);
    expect(binView(null)).toEqual(hidden);
  });
});
