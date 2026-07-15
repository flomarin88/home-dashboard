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

  return (
    <main className="bg-ground flex min-h-svh flex-col gap-2 p-6 text-text">
      <h1 className="text-title font-bold">{room?.label ?? 'Pièce inconnue'}</h1>
      <p className="text-meta text-text-muted">Détail de pièce — à venir (Epic 5).</p>
    </main>
  )
}
