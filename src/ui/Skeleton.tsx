/** Shimmer placeholder shown while a widget waits for its first HA data
 *  (distinct from offline, which shows the last-known value + a pill). */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded bg-white/10 ${className}`}
    />
  )
}
