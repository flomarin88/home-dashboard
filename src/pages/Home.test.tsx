import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Home } from "./Home";

describe("Home", () => {
  it("renders standalone without an HA provider (unconfigured → not blank, AD-6/NFR4)", () => {
    // No HakitProvider: unconfigured in the test env, so Home shows its fallback
    // instead of calling @hakit — the shell can never blank. A Router is needed
    // only because the (HA-independent) Courses tile navigates.
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText(/non configuré/i)).toBeInTheDocument();
  });

  it("keeps the Courses tile visible when HA is unconfigured (seam decoupled, D3)", () => {
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>,
    );
    expect(screen.getByText("Courses")).toBeInTheDocument();
  });
});
