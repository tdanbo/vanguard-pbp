import { CharacterPortrait } from '@/components/character/CharacterPortrait'
import { PassCheckmark } from '@/components/ui/game-badges'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PassState } from '@/types'

export interface PartySidebarCharacter {
  id: string
  displayName: string
  avatarUrl?: string | null
  passState: PassState
  isOwnedByUser: boolean
}

interface PartySidebarProps {
  characters: PartySidebarCharacter[]
  isGM: boolean
  selectedCharacterId: string | null
  onSelectCharacter: (characterId: string) => void
  onPass: (characterId: string) => void
  onAddPC?: () => void
}

export function PartySidebar({
  characters,
  isGM,
  selectedCharacterId,
  onSelectCharacter,
  onPass,
  onAddPC,
}: PartySidebarProps) {
  const handleBubbleClick = (character: PartySidebarCharacter) => {
    // GM behavior: select, or if already selected, pass for them
    if (isGM) {
      if (selectedCharacterId === character.id) {
        // Already selected - toggle pass
        onPass(character.id)
      } else {
        // Select the character
        onSelectCharacter(character.id)
      }
      return
    }

    // Player behavior: if clicking own character
    if (character.isOwnedByUser) {
      // If already selected, pass the turn
      if (selectedCharacterId === character.id) {
        onPass(character.id)
      } else {
        // Select the character
        onSelectCharacter(character.id)
      }
    }
    // Players can't interact with other characters' bubbles
  }

  // Filter characters: GM sees all, players see only their own
  const visibleCharacters = isGM
    ? characters
    : characters.filter((c) => c.isOwnedByUser)

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
        Party
      </span>

      {/* PC bubbles */}
      {visibleCharacters.map((character) => (
        <CharacterBubble
          key={character.id}
          character={character}
          isSelected={selectedCharacterId === character.id}
          isGM={isGM}
          onClick={() => handleBubbleClick(character)}
        />
      ))}

      {/* Add PC button (GM only) */}
      {isGM && onAddPC && <AddBubble onClick={onAddPC} label="Add PC" />}
    </div>
  )
}

interface CharacterBubbleProps {
  character: PartySidebarCharacter
  isSelected: boolean
  isGM: boolean
  onClick: () => void
}

function CharacterBubble({
  character,
  isSelected,
  isGM,
  onClick,
}: CharacterBubbleProps) {
  const canInteract = isGM || character.isOwnedByUser

  return (
    <button
      onClick={onClick}
      disabled={!canInteract}
      className={cn(
        'flex flex-col items-center gap-1 transition-all group',
        canInteract && 'cursor-pointer hover:scale-105',
        !canInteract && 'cursor-default opacity-80'
      )}
      title={
        canInteract
          ? isGM
            ? `Post as ${character.displayName}`
            : isSelected
              ? `Click to pass as ${character.displayName}`
              : `Select ${character.displayName}`
          : character.displayName
      }
    >
      {/* Portrait with selection ring and pass overlay */}
      <div className="relative">
        <div
          className={cn(
            'rounded-full p-0.5 transition-all',
            isSelected &&
              'ring-2 ring-gold ring-offset-2 ring-offset-background'
          )}
        >
          <CharacterPortrait
            src={character.avatarUrl}
            name={character.displayName}
            size="lg"
            variant="circle"
            className={cn(
              'border-2',
              isSelected ? 'border-gold' : 'border-border/50'
            )}
          />
        </div>

        {/* Pass state checkmark */}
        {character.passState !== 'none' && (
          <div className="absolute -bottom-1 -right-1">
            <PassCheckmark state={character.passState} />
          </div>
        )}
      </div>

      {/* Name label */}
      <span
        className={cn(
          'text-xs max-w-[60px] truncate text-center',
          isSelected ? 'text-gold font-medium' : 'text-muted-foreground'
        )}
      >
        {character.displayName}
      </span>
    </button>
  )
}

interface AddBubbleProps {
  onClick: () => void
  label: string
}

function AddBubble({ onClick, label }: AddBubbleProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 transition-all cursor-pointer hover:scale-105"
      title={label}
    >
      <div className="h-16 w-16 rounded-full flex items-center justify-center transition-all bg-background/40 backdrop-blur-md border border-border/30 hover:border-gold/50 hover:bg-background/60">
        <Plus className="h-5 w-5 text-muted-foreground" />
      </div>
    </button>
  )
}
