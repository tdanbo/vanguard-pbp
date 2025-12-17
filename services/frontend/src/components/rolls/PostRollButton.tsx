import { Button } from '@/components/ui/button'
import { Dice5, X, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Post, Roll } from '@/types'

interface PostRollButtonProps {
  post: Post
  roll?: Roll | null
  isOwner: boolean
  isGM: boolean
  onClick: () => void
  className?: string
}

const statusStyles = {
  pending: 'bg-warning/20 text-warning border-warning/30 hover:bg-warning/30',
  completed: 'bg-success/20 text-success border-success/30 hover:bg-success/30',
  invalidated:
    'bg-destructive/20 text-destructive border-destructive/30 hover:bg-destructive/30',
}

export function PostRollButton({
  post,
  roll,
  isOwner,
  isGM,
  onClick,
  className,
}: PostRollButtonProps) {
  // Don't render if no intention and no roll
  const intention = roll?.intention || post.intention
  if (!intention) return null

  // Visibility: only owner and GM can see/interact
  const canInteract = isOwner || isGM
  if (!canInteract) return null

  // Determine status - if we have a roll, use its status; otherwise pending
  const status = roll?.status || 'pending'

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        'gap-1.5 px-2 py-1 h-auto text-xs',
        statusStyles[status],
        className
      )}
    >
      <span className="font-medium">{intention}</span>
      <span className="opacity-50">|</span>
      {status === 'completed' && roll && roll.total !== null ? (
        <span className="font-bold">{roll.total}</span>
      ) : status === 'invalidated' ? (
        <X className="h-3 w-3" />
      ) : (
        <Dice5 className="h-3 w-3" />
      )}
      {roll?.wasOverridden && (
        <AlertTriangle className="h-3 w-3 text-amber-500 ml-0.5" />
      )}
    </Button>
  )
}
