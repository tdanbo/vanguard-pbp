import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AddBubbleProps {
  onClick: (e: React.MouseEvent) => void
  label: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
}

const iconSizes = {
  sm: 'h-4 w-4',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

export function AddBubble({ onClick, label, size = 'lg' }: AddBubbleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 transition-all cursor-pointer hover:scale-105"
      title={label}
    >
      <div
        className={cn(
          sizeClasses[size],
          'rounded-full flex items-center justify-center transition-all',
          'bg-background/40 backdrop-blur-md border border-border/30',
          'hover:border-gold/50 hover:bg-background/60'
        )}
      >
        <Plus className={cn(iconSizes[size], 'text-muted-foreground')} />
      </div>
    </button>
  )
}
