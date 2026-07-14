import { useEffect, useState } from 'react'
import { formatClock } from './clock-format'

/**
 * Kiosk clock — local time + date (no HA), updated on an interval. Tabular-nums
 * so digits don't jitter. Ticks every 30s (minute precision is enough for a
 * wall clock); the interval is cleaned up on unmount.
 */
export function Clock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const { time, date } = formatClock(now)

  return (
    <div className="flex flex-col">
      <span className="text-clock font-semibold leading-none tracking-tight tabular-nums">
        {time}
      </span>
      <span className="text-meta capitalize text-text-muted">{date}</span>
    </div>
  )
}
