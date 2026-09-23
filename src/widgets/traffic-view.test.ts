import { describe, it, expect } from "vitest";
import { trafficView, type TrafficInput } from "./traffic-view";

/** 2026-07-29T06:14:00Z → 08:14 in Europe/Paris (the suite's pinned TZ). */
const AT_0814 = Date.UTC(2026, 6, 29, 6, 14);

function input(over: Partial<TrafficInput> = {}): TrafficInput {
  return {
    minutes: "34",
    isStale: false,
    pending: false,
    failed: false,
    requestedAt: AT_0814,
    ...over,
  };
}

describe("trafficView (Story 11.1)", () => {
  it("shows the duration and the time of the REQUEST once a refresh settled", () => {
    const v = trafficView(input());
    expect(v.kind).toBe("fresh");
    expect(v.hero).toBe("34 min");
    expect(v.sub).toContain("08:14");
    expect(v.aria).toMatch(/34 minutes/);
  });

  it("rounds to the minute — the sensor state is a float", () => {
    expect(trafficView(input({ minutes: "33.6" })).hero).toBe("34 min");
    expect(trafficView(input({ minutes: 42.2 })).hero).toBe("42 min");
  });

  it("NEVER shows a duration before a refresh settled in this session (AD-18b)", () => {
    // The whole point: a stale duration is indistinguishable from a fresh one,
    // so it is not shown at all — not greyed, not struck through, absent.
    const v = trafficView(input({ requestedAt: null }));
    expect(v.kind).toBe("idle");
    expect(v.hero).not.toMatch(/\d/);
    expect(v.sub).toMatch(/actualiser/i);
  });

  it("keeps the digits out of idle even when HA is already pushing a value", () => {
    // Guards the exception to UX-DR10/NFR4: the value exists and is readable,
    // and we still refuse to render it as a duration.
    const v = trafficView(input({ minutes: "34", requestedAt: null }));
    expect(v.hero).not.toContain("34");
  });

  it("shows a waiting state that is neither blank nor a number", () => {
    const v = trafficView(input({ pending: true, requestedAt: null }));
    expect(v.kind).toBe("pending");
    expect(v.sub).not.toBe("");
    expect(v.hero).not.toMatch(/\d/);
  });

  it("lets a pending refresh win over the previous value", () => {
    // A tap must read as "asking", not as "here is the answer" — otherwise the
    // ≥10 s guard delay looks like the tile ignored the tap.
    expect(trafficView(input({ pending: true })).kind).toBe("pending");
  });

  it("reports a rejected refresh distinctly from an unavailable entity", () => {
    const failed = trafficView(input({ failed: true }));
    const stale = trafficView(input({ isStale: true }));
    expect(failed.kind).toBe("unavailable");
    expect(stale.kind).toBe("unavailable");
    // Same kind, different words: on an iPad with no console these are the only
    // clue separating "HA refused the call" from "Waze went down".
    expect(failed.sub).not.toBe(stale.sub);
  });

  it("treats a settled refresh with an unreadable state as unavailable, not as zero", () => {
    const v = trafficView(input({ minutes: "n'importe quoi" }));
    expect(v.kind).toBe("unavailable");
    expect(v.hero).not.toMatch(/\d/);
    expect(v.hero).not.toMatch(/NaN/);
  });

  it("never renders NaN for any input shape", () => {
    for (const minutes of [null, undefined, "", "  ", "abc", NaN, Infinity]) {
      const v = trafficView(input({ minutes }));
      expect(v.hero).not.toMatch(/NaN|Infinity/);
      expect(v.sub).not.toMatch(/NaN|Infinity/);
    }
  });

  it("keeps a constant footprint — hero and sub are never empty strings", () => {
    // The chip's width is fixed in CSS, but an empty line still collapses the
    // block by ~7px under `truncate`. Every state must carry printable content.
    const states: Partial<TrafficInput>[] = [
      {},
      { requestedAt: null },
      { pending: true },
      { failed: true },
      { isStale: true },
      { minutes: null },
    ];
    for (const over of states) {
      const v = trafficView(input(over));
      expect(v.hero.trim().length).toBeGreaterThan(0);
      expect(v.sub.trim().length).toBeGreaterThan(0);
      expect(v.aria.trim().length).toBeGreaterThan(0);
    }
  });

  it("invites the tap in every state that is not already waiting", () => {
    expect(trafficView(input({ requestedAt: null })).aria).toMatch(/toucher/i);
    expect(trafficView(input({ failed: true })).aria).toMatch(/toucher/i);
    expect(trafficView(input({ isStale: true })).aria).toMatch(/toucher/i);
    expect(trafficView(input()).aria).toMatch(/toucher/i);
    expect(trafficView(input({ pending: true })).aria).not.toMatch(/toucher/i);
  });
});
