import { Badge } from '@/components/ui/badge'
import { Users, Crown, Pause, AlertCircle } from 'lucide-react'
import type { PhaseStatus, CampaignPhase } from '@/types'
import { cn } from '@/lib/utils'

interface PhaseIndicatorProps {
  phase: CampaignPhase
  isPaused?: boolean
  phaseStatus?: PhaseStatus | null
  size?: 'sm' | 'md' | 'lg'
  showDetails?: boolean
  className?: string
}

export function PhaseIndicator({
  phase,
  isPaused = false,
  phaseStatus,
  size = 'md',
  showDetails = false,
  className,
}: PhaseIndicatorProps) {
  const isGMPhase = phase === 'gm_phase'
  const isPCPhase = phase === 'pc_phase'

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  if (isPaused) {
    return (
      <Badge variant="secondary" className={cn(sizeClasses[size], 'gap-1.5', className)}>
        <Pause className={iconSizes[size]} />
        Paused
      </Badge>
    )
  }

  const phaseLabel = isGMPhase ? 'GM Phase' : 'PC Phase'
  const PhaseIcon = isGMPhase ? Crown : Users

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge
        variant={isGMPhase ? 'secondary' : 'default'}
        className={cn(sizeClasses[size], 'gap-1.5')}
      >
        <PhaseIcon className={iconSizes[size]} />
        {phaseLabel}
      </Badge>
      {showDetails && phaseStatus && isPCPhase && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>
            {phaseStatus.passedCount}/{phaseStatus.totalCount} passed
          </span>
          {!phaseStatus.canTransition && phaseStatus.transitionBlock && (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="text-xs">{phaseStatus.transitionBlock}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
