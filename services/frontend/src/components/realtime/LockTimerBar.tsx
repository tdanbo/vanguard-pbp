import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface LockTimerBarProps {
  timeRemaining: number // seconds
  totalTime?: number // seconds (default 600 = 10 minutes)
  className?: string
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function LockTimerBar({
  timeRemaining,
  totalTime = 600,
  className,
}: LockTimerBarProps) {
  const percentage = Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100))
  const isUrgent = timeRemaining < 120 // Less than 2 minutes

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('h-1 w-full bg-secondary overflow-hidden', className)}>
            <div
              className={cn(
                'h-full transition-all duration-1000 ease-linear',
                isUrgent ? 'bg-destructive' : 'bg-gold'
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <span className="font-mono text-xs">{formatTime(timeRemaining)}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default LockTimerBar
