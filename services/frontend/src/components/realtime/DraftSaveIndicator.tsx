import { Check, Cloud, CloudOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error'

interface DraftSaveIndicatorProps {
  state: SaveState
  className?: string
}

export function DraftSaveIndicator({ state, className }: DraftSaveIndicatorProps) {
  const config: Record<SaveState, {
    icon: typeof Check
    text: string
    className: string
    iconClassName?: string
  }> = {
    saved: {
      icon: Check,
      text: 'Saved',
      className: 'text-success',
    },
    saving: {
      icon: Loader2,
      text: 'Saving...',
      className: 'text-muted-foreground',
      iconClassName: 'animate-spin',
    },
    unsaved: {
      icon: Cloud,
      text: 'Unsaved',
      className: 'text-muted-foreground',
    },
    error: {
      icon: CloudOff,
      text: 'Save failed',
      className: 'text-destructive',
    },
  }

  const { icon: Icon, text, className: stateClassName, iconClassName } = config[state]

  return (
    <div className={cn('flex items-center gap-1 text-xs', stateClassName, className)}>
      <Icon className={cn('h-3 w-3', iconClassName)} />
      <span>{text}</span>
    </div>
  )
}

export type { SaveState }
export default DraftSaveIndicator
