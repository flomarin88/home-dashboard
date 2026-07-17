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
}

export const ROOMS: readonly Room[] = [
  { id: "salon", label: "Salon", kid: false },
  { id: "chambre_parents", label: "Chambre Parents", kid: false },
  { id: "nathan", label: "Nathan", kid: true },
  { id: "gaspard", label: "Gaspard", kid: true },
];

export function listRooms(): readonly Room[] {
  return ROOMS;
}

export function getRoom(id: RoomId): Room {
  const room = ROOMS.find((r) => r.id === id);
  if (!room) throw new Error(`Unknown room: ${id}`);
  return room;
}
