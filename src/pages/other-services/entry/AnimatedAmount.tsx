import { useEffect, useRef, useState } from 'react'
import { money } from './format'

export function AnimatedAmount({
  value,
  className = '',
}: {
  value: number
  className?: string
}) {
  const prev = useRef(value)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    if (prev.current === value) return
    prev.current = value
    setPulse(true)
    const t = window.setTimeout(() => setPulse(false), 280)
    return () => window.clearTimeout(t)
  }, [value])

  return (
    <strong className={`nse-amount ${pulse ? 'is-pulse' : ''} ${className}`.trim()} aria-live="polite">
      {money(value)}
    </strong>
  )
}
