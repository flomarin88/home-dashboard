import { describe, it, expect } from "vitest";
import { GRID_COLS } from "./home-grid";

describe("GRID_COLS", () => {
  // Régression (2026-07-25) : la rangée RDC déclarait 3 colonnes en portant 4
  // tuiles (la LightTile de lights() n'était pas comptée) → 2ᵉ rangée, contenu à
  // 804px pour un viewport de 748, carte du bas rognée. Les colonnes sont
  // maintenant dérivées du nombre de tuiles ; ce test garde la table que cette
  // dérivation lit — une entrée manquante retomberait sur le fallback et
  // déborderait tout autant, silencieusement.
  it("maps every supported tile count to a literal Tailwind column class", () => {
    for (let n = 1; n <= 6; n += 1) {
      expect(GRID_COLS[n]).toBe(`grid-cols-${n}`);
    }
  });
});
