import { describe, it, expect } from "vitest";
import { resolveNutriConfig } from "./config";

/**
 * Mirrors the hakit/config resolver tests: a pure function over env inputs so
 * both the configured and unconfigured paths are unit-testable without touching
 * import.meta.env.
 */
describe("resolveNutriConfig", () => {
  it("is configured when URL + anon key are both present", () => {
    const c = resolveNutriConfig({
      url: "https://ywoubvebmlhtomwgouci.supabase.co",
      anonKey: "anon-key",
    });
    expect(c.isConfigured).toBe(true);
    expect(c.supabaseUrl).toBe("https://ywoubvebmlhtomwgouci.supabase.co");
    expect(c.supabaseAnonKey).toBe("anon-key");
  });

  it("is NOT configured when the URL is missing (build sans secret)", () => {
    const c = resolveNutriConfig({ url: undefined, anonKey: "anon-key" });
    expect(c.isConfigured).toBe(false);
  });

  it("is NOT configured when the anon key is missing", () => {
    const c = resolveNutriConfig({ url: "https://x.supabase.co", anonKey: "" });
    expect(c.isConfigured).toBe(false);
  });

  it("is NOT configured when both are absent (empty strings normalise)", () => {
    const c = resolveNutriConfig({ url: "", anonKey: undefined });
    expect(c.isConfigured).toBe(false);
    expect(c.supabaseUrl).toBe("");
    expect(c.supabaseAnonKey).toBe("");
  });
});
