import { describe, it, expect } from "vitest";
import {
  listRooms,
  getRoom,
  roomsOnFloor,
  roomBattery,
  roomSensors,
  sensor,
  lights,
  vacuum,
  climate,
  electricityConfig,
  calendarsConfig,
  assertCanonicalMapping,
  assertWellFormedAuxIds,
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

  it("assigns floors — salon at RDC, the bedrooms upstairs", () => {
    expect(getRoom("salon").floor).toBe("rdc");
    expect(getRoom("chambre_parents").floor).toBe("etage1");
    expect(getRoom("nathan").floor).toBe("etage1");
    expect(getRoom("gaspard").floor).toBe("etage1");
  });

  it("groups rooms into the right floor baskets", () => {
    expect(roomsOnFloor("rdc").map((r) => r.id)).toEqual(["salon"]);
    expect(roomsOnFloor("etage1").map((r) => r.id)).toEqual([
      "chambre_parents",
      "gaspard",
      "nathan",
    ]);
  });

  it("maps battery sensors for battery-powered rooms, none for the mains Salon", () => {
    expect(roomBattery("salon")).toBeUndefined();
    expect(roomBattery("nathan")).toBe(
      "sensor.interieur_thermometre_nathan_batterie",
    );
    expect(roomBattery("gaspard")).toBe(
      "sensor.interieur_thermometre_gaspard_batterie",
    );
    expect(roomBattery("chambre_parents")).toBe(
      "sensor.interieur_thermometre_parents_batterie",
    );
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

describe("auxiliary entity_ids (counters + input_datetime, outside ENTITIES)", () => {
  it("accepts the real aux ids (turtle/plant counters, bin helpers)", () => {
    expect(() => assertWellFormedAuxIds()).not.toThrow();
  });

  it("rejects a malformed aux id (typo would ship as a silently dimmed tile)", () => {
    expect(() => assertWellFormedAuxIds(["counter.plantes_arosees "])).toThrow(
      /malformed/i,
    );
    expect(() => assertWellFormedAuxIds(["plantes_arrosees"])).toThrow(
      /malformed/i,
    );
  });
});

describe("electricity mapping (Story 9.1, tariff-aware since 9.2)", () => {
  it("exposes the daily-kWh sensor (unchanged — it stays the single meter)", () => {
    expect(electricityConfig().dailyKwhEntityId).toMatch(
      /^sensor\.[a-z0-9_]+$/,
    );
  });

  it("exposes the current-period binary_sensor (Story 9.2)", () => {
    // `on` = creuses is the interface contract; the windows themselves live in
    // HA (AD-4) and must never appear in the bundle.
    expect(electricityConfig().periodEntityId).toMatch(
      /^binary_sensor\.[a-z0-9_]+$/,
    );
  });

  it("exposes TWO price helpers, not one flat price (Story 9.2)", () => {
    const e = electricityConfig();
    expect(e.priceCreusesEntityId).toMatch(/^input_number\.[a-z0-9_]+$/);
    expect(e.pricePleinesEntityId).toMatch(/^input_number\.[a-z0-9_]+$/);
    expect(e.priceCreusesEntityId).not.toBe(e.pricePleinesEntityId);
  });

  it("exposes the next-switch timestamp sensor (Story 9.2)", () => {
    // Read and formatted, never computed: no schedule arithmetic in the app.
    expect(electricityConfig().nextSwitchEntityId).toMatch(
      /^sensor\.[a-z0-9_]+$/,
    );
  });

  it("no longer carries the flat price helper of 9.1", () => {
    // Leaving it would let a caller keep reading a price that no longer drives
    // anything — two sources of truth for the same number.
    expect(
      (electricityConfig() as Record<string, unknown>).priceEntityId,
    ).toBeUndefined();
  });

  it("registers all five ids for aux well-formedness validation (leçon 7.1 D4)", () => {
    // They are part of the default AUX_ENTITY_IDS, so the real-ids check covers
    // them; a typo in any would throw at dev-time instead of shipping dimmed.
    expect(() => assertWellFormedAuxIds()).not.toThrow();
    const e = electricityConfig();
    for (const id of [
      e.dailyKwhEntityId,
      e.periodEntityId,
      e.priceCreusesEntityId,
      e.pricePleinesEntityId,
      e.nextSwitchEntityId,
    ]) {
      expect(() => assertWellFormedAuxIds([id])).not.toThrow();
    }
  });

  it("keeps every tariff window and price OUT of the mapping (AD-4)", () => {
    // The gate of Task 7, asserted in code so it cannot rot: the schedule and
    // the euros live in docs/home-assistant.md and in HA, nowhere else.
    const serialised = JSON.stringify(electricityConfig());
    expect(serialised).not.toMatch(/01:08|06:08|12:38|15:38/);
    expect(serialised).not.toMatch(/0\.0890|0\.1491/);
  });
});

describe("calendars mapping (Story 10.1)", () => {
  it("exposes the four REAL calendar entity_ids (Task 0 done — no placeholders)", () => {
    const cals = calendarsConfig();
    expect(cals).toHaveLength(4);
    expect(cals.every((c) => /^calendar\.[a-z0-9_]+$/.test(c.entityId))).toBe(
      true,
    );
    expect(cals.map((c) => c.entityId)).toContain("calendar.chats");
  });

  it("gives every calendar a non-empty human label (shown by the 10.3 filter, UX-DR26)", () => {
    expect(calendarsConfig().every((c) => c.label.trim().length > 0)).toBe(
      true,
    );
  });

  it("keeps a fixed order — it seeds the stable tie-break inside a rank", () => {
    // Deterministic tie-break (same start instant, same rank) depends on this
    // order, so a reshuffle must be a conscious edit, not a silent one. The
    // order itself is the contract; no calendar carries a "timed" flag, because
    // all-day is read per EVENT from the payload (review 2026-07-28, P9).
    expect(calendarsConfig().map((c) => c.entityId)).toEqual([
      "calendar.chats",
      "calendar.anniversaires",
      "calendar.calendrier_scolaire_zone_c",
      "calendar.jours_feries_et_autres_fetes_en_france",
    ]);
  });

  it("registers the calendar ids for aux well-formedness validation (leçon 7.1 D4)", () => {
    // A typo would otherwise ship as a permanently empty tile instead of a
    // dev-time throw.
    expect(() => assertWellFormedAuxIds()).not.toThrow();
    expect(() => assertWellFormedAuxIds(["calendar.Anniversaires"])).toThrow(
      /malformed/i,
    );
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

  it("maps the real Bureau light (not a placeholder) with its display label (Story 2.3)", () => {
    const bureau = lights().find((l) => l.entityId === "light.bureau_elgato");
    expect(bureau).toBeDefined();
    expect(bureau?.label).toBe("Bureau");
    expect(bureau?.placeholder).toBeUndefined();
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

describe("climate mapping (FR6, Story 2.6)", () => {
  it("maps the real Daikin Onecta climate entity (not a placeholder)", () => {
    const c = climate();
    expect(c?.entityId).toBe("climate.climatiseur_etage_room_temperature");
    expect(c?.domain).toBe("climate");
    expect(c?.placeholder).toBeUndefined();
  });

  it("declares the dedicated ambient sensor fallback (cloud current_temperature may be null)", () => {
    expect(climate()?.ambientEntityId).toBe(
      "sensor.climatiseur_etage_climatecontrol_room_temperature",
    );
  });

  it("stays canonical with the climate entity added (AD-7)", () => {
    expect(() => assertCanonicalMapping()).not.toThrow();
  });
});

describe("placeholder guard", () => {
  it("has no placeholder entity_ids left — the last one (the light) became real in 2.3", () => {
    // Sensors real since 1.5; the deliberate light placeholder (2.1) became the
    // real Bureau light in 2.3. Still catches any unexpected/forgotten
    // placeholder (incl. a sensor regressing to placeholder).
    const placeholders = ENTITIES.filter((e) => e.placeholder).map(
      (e) => e.entityId,
    );
    expect(placeholders).toEqual([]);
    expect(() => assertNoPlaceholders()).not.toThrow();
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
