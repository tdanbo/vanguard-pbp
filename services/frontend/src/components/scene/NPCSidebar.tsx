import { CharacterBubble, type CharacterBubbleCharacter } from '@/components/character/CharacterBubble'
import { AddBubble } from '@/components/character/AddBubble'
import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PassState } from '@/types'

export interface NPCSidebarCharacter {
  id: string
  displayName: string
  avatarUrl?: string | null
  passState: PassState
  isOwnedByUser: boolean
}

interface NPCSidebarProps {
  characters: NPCSidebarCharacter[]
  isGM: boolean
  selectedCharacterId: string | null
  onSelectCharacter: (characterId: string) => void
  onPass: (characterId: string) => void
  onAddNPC?: () => void
}

export function NPCSidebar({
  characters,
  isGM,
  selectedCharacterId,
  onSelectCharacter,
  onPass,
  onAddNPC,
}: NPCSidebarProps) {
  const handleBubbleClick = (character: NPCSidebarCharacter) => {
    // GM clicks any character to select for posting
    if (isGM) {
      onSelectCharacter(character.id)
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

  // Show NPC area if: there are visible NPCs, GM can add NPCs, or GM needs Narrator
  const showNPCArea = visibleCharacters.length > 0 || (isGM && onAddNPC) || isGM

  if (!showNPCArea) return null

  const getTitle = (character: NPCSidebarCharacter, isSelected: boolean) => {
    const canInteract = isGM || character.isOwnedByUser
    if (!canInteract) return character.displayName
    if (isGM) return `Post as ${character.displayName}`
    return isSelected
      ? `Click to pass as ${character.displayName}`
      : `Select ${character.displayName}`
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
        NPCs
      </span>

      {/* Narrator bubble (GM only) - at top of NPC list */}
      {isGM && (
        <NarratorBubble
          isSelected={selectedCharacterId === 'narrator'}
          onClick={() => onSelectCharacter('narrator')}
        />
      )}

      {visibleCharacters.map((character) => {
        const isSelected = selectedCharacterId === character.id
        const canInteract = isGM || character.isOwnedByUser

        return (
          <CharacterBubble
            key={character.id}
            character={character as CharacterBubbleCharacter}
            size="lg"
            isSelected={isSelected}
            showName={true}
            onClick={() => handleBubbleClick(character)}
            disabled={!canInteract}
            title={getTitle(character, isSelected)}
          />
        )
      })}

      {/* Add NPC button (GM only) */}
      {isGM && onAddNPC && <AddBubble onClick={() => onAddNPC()} label="Add NPC" size="lg" />}
    </div>
  )
}

interface NarratorBubbleProps {
  isSelected: boolean
  onClick: () => void
}

function NarratorBubble({ isSelected, onClick }: NarratorBubbleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1 transition-all cursor-pointer hover:scale-105"
      title="Post as Narrator"
    >
      {/* Narrator icon bubble */}
      <div
        className={cn(
          'w-16 h-16 rounded-full flex items-center justify-center transition-all',
          'bg-gradient-to-br from-amber-900 to-amber-700 border-2',
          isSelected
            ? 'border-gold ring-2 ring-gold ring-offset-2 ring-offset-background'
            : 'border-border/50'
        )}
      >
        <BookOpen className="h-5 w-5 text-white/90" />
      </div>

      {/* Name label */}
      <span
        className={cn(
          'text-xs',
          isSelected ? 'text-gold font-medium' : 'text-muted-foreground'
        )}
      >
        Narrator
      </span>
    </button>
  )
}
