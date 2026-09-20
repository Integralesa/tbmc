import { useEffect, useState } from 'react'

function getRemaining(endsAt) {
  const end = endsAt?.toDate ? endsAt.toDate() : new Date(endsAt)
  const diff = end.getTime() - Date.now()
  return Math.max(diff, 0)
}

function formatRemaining(ms) {
  if (ms <= 0) return 'Cerrada'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export default function Countdown({ endsAt, onEnd }) {
  const [remaining, setRemaining] = useState(() => getRemaining(endsAt))

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = getRemaining(endsAt)
      setRemaining(ms)
      if (ms <= 0) {
        clearInterval(interval)
        onEnd?.()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [endsAt, onEnd])

  const urgent = remaining > 0 && remaining < 5 * 60 * 1000

  return (
    <span className={urgent ? 'text-bidRed font-medium' : 'text-muted'}>
      {formatRemaining(remaining)}
    </span>
  )
}
