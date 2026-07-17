import { describe, it, expect } from "vitest";
import {
  listRooms,
  getRoom,
  roomSensors,
  sensor,
  lights,
  vacuum,
  assertCanonicalMapping,
  assertNoPlaceholders,
  ENTITIES,
  type EntityEntry,
} from "./index";

describe("rooms", () => {
  it("exposes the 4 canonical rooms in order", () => {
    expect(listRooms().map((r) => r.id)).toEqual([
      "salon",
      "chambre_parents",
      "gaspard",
      "nathan",
    ]);
  });

  it("flags nathan and gaspard as kid rooms, not the others", () => {
    expect(getRoom("nathan").kid).toBe(true);
    expect(getRoom("gaspard").kid).toBe(true);
    expect(getRoom("salon").kid).toBe(false);
    expect(getRoom("chambre_parents").kid).toBe(false);
  });
});

describe("sensor mapping", () => {
  it("maps the Salon to its 3 Netatmo measures + the sonomètre (read-only)", () => {
    const salon = roomSensors("salon");
    expect(salon.map((s) => s.measure).sort()).toEqual([
      "co2",
      "humidity",
      "noise",
      "temperature",
    ]);
    expect(
      salon.every((s) => s.domain === "sensor" && s.service === null),
    ).toBe(true);
  });

  it("covers all 4 rooms — 13 sensor entries (Salon adds noise)", () => {
    expect(listRooms().flatMap((r) => roomSensors(r.id))).toHaveLength(13);
  });

  it("gives every room its 3 base measures (Salon also has noise)", () => {
    const base = ["co2", "humidity", "temperature"];
    for (const room of listRooms()) {
      const measures = roomSensors(room.id)
        .map((s) => s.measure)
        .sort();
      const expected =
        room.id === "salon"
          ? ["co2", "humidity", "noise", "temperature"]
          : base;
      expect(measures).toEqual(expected);
    }
  });

  it("resolves a specific (room, measure) to a single entity", () => {
    const s = sensor("nathan", "temperature");
    expect(s?.room).toBe("nathan");
    expect(s?.measure).toBe("temperature");
  });
});

describe("canonical invariant (AD-7)", () => {
  it("accepts the real mapping — no duplicate concept or entity_id", () => {
    expect(() => assertCanonicalMapping()).not.toThrow();
  });

  it("rejects a duplicate (room, measure) sensor", () => {
    const dup: EntityEntry[] = [
      {
        entityId: "sensor.a",
        room: "salon",
        domain: "sensor",
        service: null,
        measure: "temperature",
      },
      {
        entityId: "sensor.b",
        room: "salon",
        domain: "sensor",
        service: null,
        measure: "temperature",
      },
    ];
    expect(() => assertCanonicalMapping(dup)).toThrow(/salon\/temperature/);
  });

  it("rejects the same entity_id mapped to two concepts", () => {
    const dup: EntityEntry[] = [
      {
        entityId: "sensor.x",
        room: "salon",
        domain: "sensor",
        service: null,
        measure: "temperature",
      },
      {
        entityId: "sensor.x",
        room: "nathan",
        domain: "sensor",
        service: null,
        measure: "co2",
      },
    ];
    expect(() => assertCanonicalMapping(dup)).toThrow(/sensor\.x/);
  });

  it("rejects a malformed entity_id (missing domain separator)", () => {
    const bad: EntityEntry[] = [
      {
        entityId: "sensorsalon_temp",
        room: "salon",
        domain: "sensor",
        service: null,
        measure: "temperature",
      },
    ];
    expect(() => assertCanonicalMapping(bad)).toThrow(/malformed/i);
  });
});

describe("lights mapping (FR2)", () => {
  it("exposes the mapped light control entities with a service", () => {
    const ls = lights();
    expect(ls.length).toBeGreaterThanOrEqual(1);
    expect(ls.every((l) => l.domain === "light" && l.service != null)).toBe(
      true,
    );
  });
});

describe("vacuum mapping (FR10)", () => {
  it("maps the real Roborock vacuum entity (not a placeholder)", () => {
    const v = vacuum();
    expect(v?.entityId).toBe("vacuum.roborock_s8");
    expect(v?.domain).toBe("vacuum");
    expect(v?.placeholder).toBeUndefined();
  });
});

describe("placeholder guard", () => {
  it("has exactly one known placeholder — light.salon, pending Florian real HA id (Story 2.1)", () => {
    // Sensors are real since 1.5; 2.1 adds ONE deliberate light placeholder.
    // This documents the interim state AND still catches any unexpected/forgotten
    // placeholder (incl. a sensor regressing to placeholder).
    const placeholders = ENTITIES.filter((e) => e.placeholder).map(
      (e) => e.entityId,
    );
    expect(placeholders).toEqual(["light.salon"]);
    expect(() => assertNoPlaceholders()).toThrow(/light\.salon/);
  });

  it("throws while any placeholder entity_id remains", () => {
    const withPlaceholder: EntityEntry[] = [
      {
        entityId: "sensor.x",
        room: "salon",
        domain: "sensor",
        service: null,
        measure: "temperature",
        placeholder: true,
      },
    ];
    expect(() => assertNoPlaceholders(withPlaceholder)).toThrow(/placeholder/i);
  });

  it("passes once no placeholders remain", () => {
    const real: EntityEntry[] = [
      {
        entityId: "sensor.real",
        room: "salon",
        domain: "sensor",
        service: null,
        measure: "temperature",
      },
    ];
    expect(() => assertNoPlaceholders(real)).not.toThrow();
  });
});
