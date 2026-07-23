import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App / KioskShell (TD-1: chrome above the connection gate)", () => {
  it("renders the persistent chrome and the zones together (unconfigured, no provider)", () => {
    render(<App />);
    // Chrome (TopBar = clock) lives above the provider → always present.
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeInTheDocument();
    // Content (Home) renders within the same shell (unconfigured fallback here).
    expect(screen.getByText(/non configuré/i)).toBeInTheDocument();
  });

  it("renders the routed content when entered at the deployed /index.html file path", () => {
    // The HA /local/ deploy is entered at `…/home-dashboard/index.html` (the bare
    // directory 403s). A path-based router would leave the in-app path at
    // `/index.html` — matching no route — and render only the chrome. HashRouter
    // ignores the file path and resolves the empty hash to "/", so Home renders.
    // Regression for the "only the top bar on first load" bug.
    const original = window.location.pathname + window.location.hash;
    window.history.pushState({}, "", "/local/home-dashboard/index.html");
    try {
      render(<App />);
      expect(screen.getByText(/non configuré/i)).toBeInTheDocument();
    } finally {
      window.history.pushState({}, "", original);
    }
  });
});
