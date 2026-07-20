/**
 * Canonical rooms (AD-7 / spine Consistency Conventions). The single place the
 * 4 rooms are declared — id, French label, and whether it's a kid room (Nathan
 * & Gaspard get larger touch targets downstream, NFR2). No other file redefines
 * the room list.
 */
export type RoomId = "salon" | "chambre_parents" | "nathan" | "gaspard";

/** What a room is used for — drives the tile glyph (bed vs sofa). Structural
 * (AD-7): a room's purpose doesn't change, so it lives here, not read from HA. */
export type RoomKind = "bedroom" | "living";

/** Which floor a room is on. "rdc" = rez-de-chaussée, "etage1" = 1er étage. */
export type Floor = "rdc" | "etage1";

export interface Room {
  readonly id: RoomId;
  readonly label: string;
  readonly kid: boolean;
  readonly kind: RoomKind;
  /**
   * Floor the room sits on. Static structural mapping (AD-7), like the entity_ids
   * — a room doesn't change floor, so it lives here, not read live from HA's floor
   * registry. Grouping key for the home: rooms are listed under their floor's
   * heading (`roomsOnFloor`, `FLOOR_ORDER`).
   */
  readonly floor: Floor;
}

export const ROOMS: readonly Room[] = [
  { id: "salon", label: "Salon", kid: false, kind: "living", floor: "rdc" },
  {
    id: "chambre_parents",
    label: "Parents",
    kid: false,
    kind: "bedroom",
    floor: "etage1",
  },
  {
    id: "gaspard",
    label: "Gaspard",
    kid: true,
    kind: "bedroom",
    floor: "etage1",
  },
  {
    id: "nathan",
    label: "Nathan",
    kid: true,
    kind: "bedroom",
    floor: "etage1",
  },
];

export function listRooms(): readonly Room[] {
  return ROOMS;
}

export function getRoom(id: RoomId): Room {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) throw new Error(`Unknown room: ${id}`);
  return room;
}

/** Display order of floors on the home, top → bottom. */
export const FLOOR_ORDER: readonly Floor[] = ["etage1", "rdc"];

/** Human label per floor (French kiosk copy). */
export const FLOOR_LABEL: Record<Floor, string> = {
  etage1: "1er étage",
  rdc: "RDC",
};

/** Rooms on a given floor, in declaration order — the home's grouping key. */
export function roomsOnFloor(floor: Floor): readonly Room[] {
  return ROOMS.filter((r) => r.floor === floor);
}
