import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommitTag } from "./CommitTag";

describe("CommitTag", () => {
  it("renders the injected build SHA (__APP_COMMIT__)", () => {
    // vitest.config.ts defines __APP_COMMIT__ as "test".
    render(<CommitTag />);
    expect(screen.getByText("test")).toBeInTheDocument();
  });
});
