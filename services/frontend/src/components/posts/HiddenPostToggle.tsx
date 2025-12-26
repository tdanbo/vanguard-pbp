import { cn } from '@/lib/utils'
import { Eye, EyeOff } from 'lucide-react'

interface HiddenPostToggleProps {
  isHidden: boolean
  onChange: (hidden: boolean) => void
  disabled?: boolean
}

export function HiddenPostToggle({ isHidden, onChange, disabled }: HiddenPostToggleProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        role="switch"
        aria-checked={isHidden}
        disabled={disabled}
        onClick={() => onChange(!isHidden)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border-2 p-4 transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50',
          isHidden
            ? 'border-amber-500 bg-amber-500/10 hover:bg-amber-500/15'
            : 'border-muted bg-muted/30 hover:bg-muted/50'
        )}
      >
        <div className="flex items-center gap-3">
          {isHidden ? (
            <div className="rounded-full bg-amber-500/20 p-2">
              <EyeOff className="h-5 w-5 text-amber-500" />
            </div>
          ) : (
            <div className="rounded-full bg-muted p-2">
              <Eye className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="text-left">
            <div className={cn('font-medium', isHidden ? 'text-amber-500' : 'text-foreground')}>
              {isHidden ? 'Hidden Post' : 'Visible Post'}
            </div>
            <p className="text-sm text-muted-foreground">
              {isHidden
                ? 'Only the GM can see this post until revealed'
                : 'All witnesses will see this post immediately'}
            </p>
          </div>
        </div>
        <div
          className={cn(
            'flex h-6 w-11 shrink-0 items-center rounded-full border-2 transition-colors',
            isHidden ? 'border-amber-500 bg-amber-500' : 'border-muted-foreground/30 bg-muted'
          )}
        >
          <div
            className={cn(
              'h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
              isHidden ? 'translate-x-5' : 'translate-x-1'
            )}
          />
        </div>
      </button>
    </div>
  )
}
