import { CharacterPortrait } from '@/components/character/CharacterPortrait'
import { PassCheckmark } from '@/components/ui/game-badges'
import { cn } from '@/lib/utils'
import type { PassState } from '@/types'

export interface CharacterBubbleCharacter {
  id: string
  displayName: string
  avatarUrl?: string | null
  passState: PassState
  isOwnedByUser?: boolean
}

export interface CharacterBubbleProps {
  character: CharacterBubbleCharacter
  size?: 'sm' | 'md' | 'lg'
  isSelected?: boolean
  showName?: boolean
  onClick?: () => void
  disabled?: boolean
  title?: string
}

const sizeClasses = {
  sm: {
    portrait: 'sm' as const,
    ring: 'ring-1 ring-offset-1',
    name: 'text-[10px] max-w-[40px]',
    checkmark: '-bottom-0.5 -right-0.5',
  },
  md: {
    portrait: 'md' as const,
    ring: 'ring-2 ring-offset-2',
    name: 'text-xs max-w-[50px]',
    checkmark: '-bottom-1 -right-1',
  },
  lg: {
    portrait: 'lg' as const,
    ring: 'ring-2 ring-offset-2',
    name: 'text-xs max-w-[60px]',
    checkmark: '-bottom-1 -right-1',
  },
}

export function CharacterBubble({
  character,
  size = 'lg',
  isSelected = false,
  showName = true,
  onClick,
  disabled = false,
  title,
}: CharacterBubbleProps) {
  const sizeConfig = sizeClasses[size]
  const canInteract = !disabled && !!onClick

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canInteract}
      className={cn(
        'flex flex-col items-center gap-1 transition-all group',
        canInteract && 'cursor-pointer hover:scale-105',
        !canInteract && 'cursor-default',
        disabled && 'opacity-80'
      )}
      title={title ?? character.displayName}
    >
      {/* Portrait with selection ring and pass overlay */}
      <div className="relative">
        <div
          className={cn(
            'rounded-full p-0.5 transition-all',
            isSelected && `${sizeConfig.ring} ring-gold ring-offset-background`
          )}
        >
          <CharacterPortrait
            src={character.avatarUrl}
            name={character.displayName}
            size={sizeConfig.portrait}
            variant="circle"
            className={cn(
              'border-2',
              isSelected ? 'border-gold' : 'border-border/50'
            )}
          />
        </div>

        {/* Pass state checkmark */}
        {character.passState !== 'none' && (
          <div className={cn('absolute', sizeConfig.checkmark)}>
            <PassCheckmark state={character.passState} size={size} />
          </div>
        )}
      </div>

      {/* Name label */}
      {showName && (
        <span
          className={cn(
            'truncate text-center',
            sizeConfig.name,
            isSelected ? 'text-gold font-medium' : 'text-muted-foreground'
          )}
        >
          {character.displayName}
        </span>
      )}
    </button>
  )
}
