import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LockHolderProps {
  characterName?: string
  isHidden?: boolean
  className?: string
}

export function LockHolderIndicator({ characterName, isHidden = false, className }: LockHolderProps) {
  const message = isHidden || !characterName
    ? 'Another player is composing...'
    : `${characterName} is composing...`

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm text-muted-foreground px-4 py-3',
        className
      )}
    >
      <Lock className="h-4 w-4" />
      <span>{message}</span>
    </div>
  )
}

export default LockHolderIndicator
