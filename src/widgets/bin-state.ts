/**
 * Maps the HA `sensor.poubelle_a_sortir` state to a view for the tile (Story 6.1).
 * Pure — NO schedule logic here (that lives in the HA template, AD-4); this only
 * translates the reflected state. State space (contract: docs/home-assistant.md):
 * `aucune | {c}_a_sortir | {c}_sortie | {c}_oubli | {c}_oubli_ack`, c ∈ {jaune,noire}.
 */
export type BinColor = "jaune" | "noire" | "idle";
export type BinId = "jaune" | "noire";

/**
 * Tile phase (drives interaction + look). `null` → tile hidden: for `aucune`
 * (nothing due) and `{c}_oubli_ack` (a missed bin the user acknowledged — the ack
 * lives in HA now, so it stays hidden across reloads).
 */
export type BinPhase = "a_sortir" | "sortie" | "oubli";

export interface BinView {
  /** Which bin this concerns (for the `input_datetime` to write), or null. */
  readonly bin: BinId | null;
  /** Icon colour — the bin's own colour, kept in every visible phase. */
  readonly color: BinColor;
  /** Tile phase, or null when the tile is hidden. */
  readonly phase: BinPhase | null;
}

const HIDDEN: BinView = { bin: null, color: "idle", phase: null };

export function binView(state: string | null | undefined): BinView {
  switch (state) {
    case "jaune_a_sortir":
      return { bin: "jaune", color: "jaune", phase: "a_sortir" };
    case "noire_a_sortir":
      return { bin: "noire", color: "noire", phase: "a_sortir" };
    case "jaune_sortie":
      return { bin: "jaune", color: "jaune", phase: "sortie" };
    case "noire_sortie":
      return { bin: "noire", color: "noire", phase: "sortie" };
    case "jaune_oubli":
      return { bin: "jaune", color: "jaune", phase: "oubli" };
    case "noire_oubli":
      return { bin: "noire", color: "noire", phase: "oubli" };
    // `aucune`, `{c}_oubli_ack`, unknown, null → hidden.
    default:
      return HIDDEN;
  }
}
