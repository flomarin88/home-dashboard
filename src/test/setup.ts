// Extends vitest's `expect` with jest-dom matchers (toBeInTheDocument, …) and
// unmounts rendered React trees between tests (needed because globals:false
// means Testing Library's automatic afterEach cleanup isn't auto-registered).
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
