/**
 * Maps the HA `sensor.poubelle_a_sortir` state to a view for the tile (Story 6.1).
 * Pure — NO schedule logic here (that lives in the HA template, AD-4); this only
 * translates the reflected state.
 */
export type BinColor = 'jaune' | 'noire' | 'rouge' | 'idle'
export type BinId = 'jaune' | 'noire'

export interface BinView {
  /** Icon colour. */
  readonly color: BinColor
  /** In an active collection window (tappable to mark "sortie"). */
  readonly active: boolean
  /** Which bin this concerns (for the `input_datetime` to write), or null. */
  readonly bin: BinId | null
}

export function binView(state: string | null | undefined): BinView {
  switch (state) {
    case 'jaune':
      return { color: 'jaune', active: true, bin: 'jaune' }
    case 'noire':
      return { color: 'noire', active: true, bin: 'noire' }
    case 'oubli_jaune':
      return { color: 'rouge', active: false, bin: 'jaune' }
    case 'oubli_noire':
      return { color: 'rouge', active: false, bin: 'noire' }
    default:
      return { color: 'idle', active: false, bin: null }
  }
}

/** Format a Date as HA's `input_datetime` value: `YYYY-MM-DD HH:mm:ss`. */
export function haDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  )
}
