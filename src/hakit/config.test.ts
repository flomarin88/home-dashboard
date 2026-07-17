import { describe, it, expect } from "vitest";
import { resolveHassConfig } from "./config";

/**
 * The dev/prod connection split (AD-8). The prod token-less branch is otherwise
 * only exercised in a real HA-served build, so the pure resolver is where it
 * gets asserted — including the guard that keeps `hassUrl` empty under test so
 * the unconfigured path (App.test) stays reachable.
 */
describe("resolveHassConfig", () => {
  const ORIGIN = "http://192.168.1.29:8123";

  it("test/CI (no URL, no token, not prod): unconfigured, empty URL", () => {
    // Mirrors the vitest env — must stay unconfigured or App.test regresses.
    expect(
      resolveHassConfig({
        viteUrl: undefined,
        viteToken: undefined,
        isProd: false,
        origin: ORIGIN,
      }),
    ).toEqual({ hassUrl: "", hassToken: undefined, isConfigured: false });
  });

  it("dev without token: URL present but unconfigured (avoids CORS login dead-end)", () => {
    expect(
      resolveHassConfig({
        viteUrl: "http://homeassistant.local:8123",
        viteToken: undefined,
        isProd: false,
        origin: ORIGIN,
      }),
    ).toEqual({
      hassUrl: "http://homeassistant.local:8123",
      hassToken: undefined,
      isConfigured: false,
    });
  });

  it("dev with token: configured, token path", () => {
    expect(
      resolveHassConfig({
        viteUrl: "http://homeassistant.local:8123",
        viteToken: "tok",
        isProd: false,
        origin: ORIGIN,
      }),
    ).toEqual({
      hassUrl: "http://homeassistant.local:8123",
      hassToken: "tok",
      isConfigured: true,
    });
  });

  it("prod token-less: falls back to origin and is configured (AD-8 session auth)", () => {
    expect(
      resolveHassConfig({
        viteUrl: undefined,
        viteToken: undefined,
        isProd: true,
        origin: ORIGIN,
      }),
    ).toEqual({ hassUrl: ORIGIN, hassToken: undefined, isConfigured: true });
  });

  it("empty-string token in dev is treated as no token (unconfigured)", () => {
    expect(
      resolveHassConfig({
        viteUrl: "http://homeassistant.local:8123",
        viteToken: "",
        isProd: false,
        origin: ORIGIN,
      }).isConfigured,
    ).toBe(false);
  });
});
