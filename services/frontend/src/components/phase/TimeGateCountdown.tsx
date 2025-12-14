import { useState, useEffect } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimeGateCountdownProps {
  expiresAt: string | null
  className?: string
}

interface CountdownState {
  timeLeft: string
  isExpired: boolean
  isUrgent: boolean
}

function calculateCountdown(expiresAt: string | null): CountdownState {
  if (!expiresAt) {
    return { timeLeft: '', isExpired: false, isUrgent: false }
  }

  const now = new Date()
  const expiry = new Date(expiresAt)
  const diff = expiry.getTime() - now.getTime()

  if (diff <= 0) {
    return { timeLeft: 'Expired', isExpired: true, isUrgent: false }
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  const isUrgent = diff < 6 * 60 * 60 * 1000

  let timeLeft: string
  if (days > 0) {
    timeLeft = `${days}d ${hours}h`
  } else if (hours > 0) {
    timeLeft = `${hours}h ${minutes}m`
  } else {
    timeLeft = `${minutes}m`
  }

  return { timeLeft, isExpired: false, isUrgent }
}

export function TimeGateCountdown({ expiresAt, className }: TimeGateCountdownProps) {
  // Calculate initial state and on every render when expiresAt changes
  const initialState = calculateCountdown(expiresAt)

  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!expiresAt) return undefined

    // Set up interval to force re-render for countdown updates
    const interval = setInterval(() => {
      setTick((t) => t + 1)
    }, 60000)

    return () => clearInterval(interval)
  }, [expiresAt])

  // Recalculate on every render (triggered by tick or expiresAt change)
  const state = tick >= 0 ? calculateCountdown(expiresAt) : initialState
  const { timeLeft, isExpired, isUrgent } = state

  if (!expiresAt || !timeLeft) {
    return null
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        isExpired
          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
          : isUrgent
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
            : 'bg-muted text-muted-foreground',
        className
      )}
    >
      {isExpired ? (
        <AlertTriangle className="h-3 w-3" />
      ) : (
        <Clock className="h-3 w-3" />
      )}
      <span>{timeLeft}</span>
    </div>
  )
}

interface TimeGateInfoProps {
  preset: string | null
  expiresAt: string | null
  className?: string
}

export function TimeGateInfo({ preset, expiresAt, className }: TimeGateInfoProps) {
  const presetLabels: Record<string, string> = {
    '24h': '24 hours',
    '2d': '2 days',
    '3d': '3 days',
    '4d': '4 days',
    '5d': '5 days',
  }

  if (!preset && !expiresAt) {
    return null
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {preset && (
        <span className="text-xs text-muted-foreground">
          Time gate: {presetLabels[preset] || preset}
        </span>
      )}
      <TimeGateCountdown expiresAt={expiresAt} />
    </div>
  )
}
