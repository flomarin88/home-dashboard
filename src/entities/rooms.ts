/**
 * Canonical rooms (AD-7 / spine Consistency Conventions). The single place the
 * 4 rooms are declared — id, French label, and whether it's a kid room (Nathan
 * & Gaspard get larger touch targets downstream, NFR2). No other file redefines
 * the room list.
 */
export type RoomId = "salon" | "chambre_parents" | "nathan" | "gaspard";

export interface Room {
  readonly id: RoomId;
  readonly label: string;
  readonly kid: boolean;
  /**
   * Floor level (0 = rez-de-chaussée, 1 = étage), shown as a pill on the tile.
   * Static structural mapping (AD-7), like the entity_ids — a room doesn't change
   * floor, so it lives here, not read live from HA's floor registry.
   */
  readonly floor: 0 | 1;
}

export const ROOMS: readonly Room[] = [
  { id: "salon", label: "Salon", kid: false, floor: 0 },
  { id: "chambre_parents", label: "Parents", kid: false, floor: 1 },
  { id: "gaspard", label: "Gaspard", kid: true, floor: 1 },
  { id: "nathan", label: "Nathan", kid: true, floor: 1 },
];

export function listRooms(): readonly Room[] {
  return ROOMS;
}

export function getRoom(id: RoomId): Room {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) throw new Error(`Unknown room: ${id}`);
  return room;
}
