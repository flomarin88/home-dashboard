/** Minimal "offline" glyph (a slashed signal). Decorative — the "Hors ligne"
 *  text is the real cue. Shared by DeviceTile and OfflinePill (DRY). */
export function OfflineIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M2 2 L22 22" />
      <path d="M5 12.5a10 10 0 0 1 4-2.4M12 5c2.5 0 4.9.9 6.8 2.5" />
      <path d="M8.5 16a5 5 0 0 1 5-1.3" />
    </svg>
  )
}
