import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Clock, Users, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PhaseBadge } from '@/components/ui/game-badges'
import type { CampaignPhase } from '@/types'

interface UnifiedHeaderProps {
  title: string
  description?: string | null
  currentPhase: CampaignPhase
  phaseStartedAt: string | null
  expiresAt: string | null
  isPaused?: boolean
  isExpired?: boolean
  playersRemaining?: number
  totalPlayers?: number
  // GM controls
  isGM?: boolean
  canTransition?: boolean
  transitionBlock?: string | null
  onTransitionPhase?: (toPhase: CampaignPhase) => void
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

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function calculateIsUrgent(expiresAt: string | null, now: number): boolean {
  if (!expiresAt) return false
  const diff = new Date(expiresAt).getTime() - now
  return diff > 0 && diff < 6 * 60 * 60 * 1000 // < 6 hours
}

export function UnifiedHeader({
  title,
  description,
  currentPhase,
  phaseStartedAt,
  expiresAt,
  isPaused,
  isExpired: isExpiredProp = false,
  playersRemaining,
  totalPlayers,
  isGM,
  canTransition,
  onTransitionPhase,
  className,
}: UnifiedHeaderProps) {
  const [now, setNow] = useState(() => Date.now())

  // Update countdown every minute
  useEffect(() => {
    if (!expiresAt) return undefined

    const interval = setInterval(() => {
      setNow(Date.now())
    }, 60000)

    return () => clearInterval(interval)
  }, [expiresAt])

  const progress = calculateProgress(phaseStartedAt, expiresAt, now)
  const timeLeft = formatTimeLeft(expiresAt, now)
  const isUrgent = calculateIsUrgent(expiresAt, now)
  const hasTimeGate = !!expiresAt
  // Use backend-provided isExpired, fallback to local calculation
  const isExpired = isExpiredProp || timeLeft === 'Expired'

  const targetPhase: CampaignPhase =
    currentPhase === 'gm_phase' ? 'pc_phase' : 'gm_phase'

  const handlePhaseSwap = () => {
    if (!isGM || !canTransition || !onTransitionPhase) return
    onTransitionPhase(targetPhase)
  }

  // Paused state
  if (isPaused) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3 min-w-0 flex-1">
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight truncate">
              {title}
            </h1>
            {description && (
              <span className="text-muted-foreground text-sm truncate hidden md:block">
                {description}
              </span>
            )}
          </div>
          <PhaseBadge phase="paused" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Row 1: Title + Description + Phase Badge + Swap Icon */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3 min-w-0 flex-1">
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight truncate">
            {title}
          </h1>
          {description && (
            <span className="text-muted-foreground text-sm truncate hidden md:block">
              {description}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Swap icon - only visible when GM can transition */}
          {isGM && canTransition && onTransitionPhase && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePhaseSwap}
              className="h-8 w-8 rounded-full"
              aria-label={`Switch to ${targetPhase === 'gm_phase' ? 'GM' : 'PC'} Phase`}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <PhaseBadge phase={currentPhase} />
        </div>
      </div>

      {/* Row 2: Progress Bar */}
      {hasTimeGate && (
        <div className="h-1.5 w-full bg-background/30 overflow-hidden rounded-full">
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

      {/* Row 3: Status Info */}
      <div className="flex items-center justify-between gap-4">
        {/* Time gate countdown */}
        {hasTimeGate ? (
          <div
            className={cn(
              'flex items-center gap-1.5 text-xs',
              isExpired
                ? 'text-red-500 font-medium'
                : isUrgent
                  ? 'text-amber-500'
                  : 'text-muted-foreground'
            )}
          >
            <Clock className="h-3 w-3" />
            <span>
              {isExpired
                ? 'Phase expired. Waiting for GM to transition.'
                : `Time to next phase: ${timeLeft}`}
            </span>
          </div>
        ) : (
          <div />
        )}

        {/* Players remaining */}
        {playersRemaining !== undefined && totalPlayers !== undefined && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>
              {isExpired || playersRemaining === 0
                ? 'All players passed'
                : `${playersRemaining} of ${totalPlayers} players pending`}
            </span>
            <Users className="h-3 w-3" />
          </div>
        )}
      </div>
    </div>
  )
}
