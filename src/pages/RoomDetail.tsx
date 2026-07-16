import { useParams } from 'react-router-dom'
import { ROOMS } from '../entities'
import type { RoomId } from '../entities'

/**
 * Room detail — STUB (Story 1.5 lays the route; the full page is Epic 5).
 * Reached by tapping a room sensor card.
 */
export function RoomDetail() {
  const { roomId } = useParams()
  const room = ROOMS.find((r) => r.id === (roomId as RoomId))

  // Content only — the ground + top bar are owned by KioskShell (App.tsx).
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-title font-bold">{room?.label ?? 'Pièce inconnue'}</h1>
      <p className="text-meta text-text-muted">Détail de pièce — à venir (Epic 5).</p>
    </div>
  )
}
