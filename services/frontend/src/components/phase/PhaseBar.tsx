import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Crown, Users, Clock } from 'lucide-react'
import type { CampaignPhase } from '@/types'

interface PhaseBarProps {
  currentPhase: CampaignPhase
  phaseStartedAt: string | null
  expiresAt: string | null
  isGM: boolean
  canTransition: boolean
  transitionBlock?: string | null
  isPaused?: boolean
  onTransitionPhase: (toPhase: CampaignPhase) => void
  className?: string
}

function calculateProgress(
  phaseStartedAt: string | null,
  expiresAt: string | null,
  now: number
): number {
  if (!phaseStartedAt || !expiresAt) return 100

  const start = new Date(phaseStartedAt).getTime()
  const end = new Date(expiresAt).getTime()

  const total = end - start
  const remaining = end - now

  return Math.max(0, Math.min(100, (remaining / total) * 100))
}

function formatTimeLeft(expiresAt: string | null, now: number): string {
  if (!expiresAt) return ''

  const expiry = new Date(expiresAt).getTime()
  const diff = expiry - now

  if (diff <= 0) return 'Expired'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function calculateIsUrgent(expiresAt: string | null, now: number): boolean {
  if (!expiresAt) return false
  const diff = new Date(expiresAt).getTime() - now
  return diff > 0 && diff < 6 * 60 * 60 * 1000 // < 6 hours
}

export function PhaseBar({
  currentPhase,
  phaseStartedAt,
  expiresAt,
  isGM,
  canTransition,
  transitionBlock,
  isPaused,
  onTransitionPhase,
  className,
}: PhaseBarProps) {
  const [now, setNow] = useState(() => Date.now())

  // Update countdown every minute
  useEffect(() => {
    if (!expiresAt) return undefined

    const interval = setInterval(() => {
      setNow(Date.now())
    }, 60000)

    return () => clearInterval(interval)
  }, [expiresAt])

  // Calculate progress and time left using current `now` state
  const progress = calculateProgress(phaseStartedAt, expiresAt, now)
  const timeLeft = formatTimeLeft(expiresAt, now)
  const isUrgent = calculateIsUrgent(expiresAt, now)

  const isGMPhase = currentPhase === 'gm_phase'
  const isPCPhase = currentPhase === 'pc_phase'
  const hasTimeGate = !!expiresAt
  const isExpired = timeLeft === 'Expired'

  const handleTogglePhase = (targetPhase: CampaignPhase) => {
    if (!isGM || targetPhase === currentPhase) return
    if (!canTransition && transitionBlock) {
      // Could show tooltip/toast with transitionBlock reason
      return
    }
    onTransitionPhase(targetPhase)
  }

  if (isPaused) {
    return (
      <div className={cn('bg-panel backdrop-blur-md border-b border-border/30 p-4', className)}>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <span className="text-sm uppercase tracking-wider">Campaign Paused</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-panel backdrop-blur-md border-b border-border/30', className)}>
      {/* Timer bar */}
      {hasTimeGate && (
        <div className="h-1.5 w-full bg-background/30 overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-1000 ease-linear',
              isExpired
                ? 'bg-red-500'
                : isUrgent
                  ? 'bg-amber-500'
                  : 'bg-gold'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Phase info row */}
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        {/* Left: Phase label */}
        <div className="flex items-center gap-2 min-w-0">
          {isGMPhase ? (
            <Crown className="h-4 w-4 text-gm-phase shrink-0" />
          ) : (
            <Users className="h-4 w-4 text-pc-phase shrink-0" />
          )}
          <span
            className={cn(
              'text-sm font-medium uppercase tracking-wider',
              isGMPhase ? 'text-gm-phase' : 'text-pc-phase'
            )}
          >
            {isGMPhase ? 'GM Phase' : 'PC Phase'}
          </span>
        </div>

        {/* Center: Time gate countdown */}
        {hasTimeGate && (
          <div
            className={cn(
              'flex items-center gap-1.5 text-xs',
              isExpired
                ? 'text-red-500'
                : isUrgent
                  ? 'text-amber-500'
                  : 'text-muted-foreground'
            )}
          >
            <Clock className="h-3 w-3" />
            <span>
              {isExpired ? 'Time gate expired' : `Time to next phase: ${timeLeft}`}
            </span>
          </div>
        )}

        {/* Right: Phase toggle */}
        <div className="flex items-center shrink-0">
          <div
            className={cn(
              'flex rounded-full border border-border/50 bg-background/30 p-0.5',
              !isGM && 'opacity-60'
            )}
          >
            <button
              type="button"
              onClick={() => handleTogglePhase('pc_phase')}
              disabled={!isGM || isPCPhase}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-all',
                isPCPhase
                  ? 'bg-pc-phase text-white'
                  : isGM
                    ? 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    : 'text-muted-foreground cursor-default'
              )}
            >
              PC
            </button>
            <button
              type="button"
              onClick={() => handleTogglePhase('gm_phase')}
              disabled={!isGM || isGMPhase}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-all',
                isGMPhase
                  ? 'bg-gm-phase text-white'
                  : isGM
                    ? 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    : 'text-muted-foreground cursor-default'
              )}
            >
              GM
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
