import { Badge } from '@/components/ui/badge'
import { Dices, AlertTriangle, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Roll } from '@/types'

interface RollDisplayProps {
  roll: Roll
  compact?: boolean
  showCharacter?: boolean
}

export function RollDisplay({ roll, compact = false, showCharacter = false }: RollDisplayProps) {
  const statusIcon = {
    pending: <Dices className="h-4 w-4 animate-pulse" />,
    completed: <Check className="h-4 w-4" />,
    invalidated: <X className="h-4 w-4" />,
  }

  const statusColor = {
    pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    completed: 'bg-green-500/10 text-green-600 border-green-500/20',
    invalidated: 'bg-red-500/10 text-red-600 border-red-500/20',
  }

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <Badge variant="outline" className={cn('gap-1', statusColor[roll.status])}>
          {statusIcon[roll.status]}
          {roll.intention}
          {roll.status === 'completed' && roll.total !== null && (
            <span className="font-bold">: {roll.total}</span>
          )}
        </Badge>
        {roll.wasOverridden && (
          <span className="cursor-help" aria-label="Intention was overridden by GM">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('gap-1', statusColor[roll.status])}>
            {statusIcon[roll.status]}
            {roll.status}
          </Badge>
          {showCharacter && roll.characterName && (
            <span className="text-sm font-medium">{roll.characterName}</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {roll.diceCount}{roll.diceType}
          {roll.modifier !== 0 && (
            <span className={roll.modifier > 0 ? 'text-green-600' : 'text-red-600'}>
              {roll.modifier > 0 ? '+' : ''}{roll.modifier}
            </span>
          )}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{roll.intention}</span>
            {roll.wasOverridden && (
              <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/20">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Overridden
              </Badge>
            )}
          </div>
          {roll.wasOverridden && roll.originalIntention && (
            <p className="text-xs text-muted-foreground">
              Original: {roll.originalIntention}
            </p>
          )}
        </div>

        {roll.status === 'completed' && roll.total !== null && (
          <div className="text-right">
            <div className="text-2xl font-bold">{roll.total}</div>
            {roll.result && roll.result.length > 1 && (
              <div className="text-xs text-muted-foreground">
                [{roll.result.join(', ')}]
              </div>
            )}
            {roll.manualResult !== null && (
              <Badge variant="outline" className="text-xs">
                Manual
              </Badge>
            )}
          </div>
        )}
      </div>

      {roll.overrideReason && (
        <p className="text-xs text-muted-foreground italic">
          Override reason: {roll.overrideReason}
        </p>
      )}

      {roll.manualResolutionReason && (
        <p className="text-xs text-muted-foreground italic">
          Resolution reason: {roll.manualResolutionReason}
        </p>
      )}
    </div>
  )
}
