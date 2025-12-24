import { CharacterBubble, type CharacterBubbleCharacter } from '@/components/character/CharacterBubble'
import { AddBubble } from '@/components/character/AddBubble'
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
  isExpired?: boolean
}

export function PartySidebar({
  characters,
  isGM,
  selectedCharacterId,
  onSelectCharacter,
  onPass,
  onAddPC,
  isExpired = false,
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

    // Block pass actions for non-GM when time gate expired
    if (isExpired) {
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

  const getTitle = (character: PartySidebarCharacter, isSelected: boolean) => {
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
        Party
      </span>

      {/* PC bubbles */}
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
            disabled={!canInteract || (isExpired && !isGM)}
            title={getTitle(character, isSelected)}
          />
        )
      })}

      {/* Add PC button (GM only) */}
      {isGM && onAddPC && <AddBubble onClick={() => onAddPC()} label="Add PC" size="lg" />}
    </div>
  )
}
