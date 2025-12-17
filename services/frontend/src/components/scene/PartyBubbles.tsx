import { CharacterPortrait } from '@/components/character/CharacterPortrait'
import { PassBadge } from '@/components/ui/game-badges'
import { BookOpen, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PassState, CharacterType } from '@/types'

export interface PartyBubbleCharacter {
  id: string
  displayName: string
  avatarUrl?: string | null
  characterType: CharacterType
  passState: PassState
  isOwnedByUser: boolean
}

interface PartyBubblesProps {
  characters: PartyBubbleCharacter[]
  isGM: boolean
  selectedCharacterId: string | null
  onSelectCharacter: (characterId: string) => void
  onPass: (characterId: string) => void
  onAddNPC?: () => void
  onAddPC?: () => void
}

export function PartyBubbles({
  characters,
  isGM,
  selectedCharacterId,
  onSelectCharacter,
  onPass,
  onAddNPC,
  onAddPC,
}: PartyBubblesProps) {
  const npcs = characters.filter((c) => c.characterType === 'npc')
  const pcs = characters.filter((c) => c.characterType === 'pc')

  const handleBubbleClick = (character: PartyBubbleCharacter) => {
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

  // Show NPC area if: there are NPCs, GM can add NPCs, or GM needs Narrator
  const showNPCArea = npcs.length > 0 || (isGM && onAddNPC) || isGM

  return (
    <>
      {/* NPCs + Narrator on LEFT side */}
      {showNPCArea && (
        <div className="fixed left-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3">
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

          {npcs.map((character) => (
            <CharacterBubble
              key={character.id}
              character={character}
              isSelected={selectedCharacterId === character.id}
              isGM={isGM}
              onClick={() => handleBubbleClick(character)}
            />
          ))}
          {/* Add NPC button (GM only) */}
          {isGM && onAddNPC && (
            <AddNPCBubble onClick={onAddNPC} />
          )}
        </div>
      )}

      {/* PCs on RIGHT side */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-30 flex flex-col items-center gap-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          Party
        </span>

        {/* PC bubbles */}
        {pcs.map((character) => (
          <CharacterBubble
            key={character.id}
            character={character}
            isSelected={selectedCharacterId === character.id}
            isGM={isGM}
            onClick={() => handleBubbleClick(character)}
          />
        ))}

        {/* Add PC button (GM only) */}
        {isGM && onAddPC && (
          <AddPCBubble onClick={onAddPC} />
        )}
      </div>
    </>
  )
}

interface CharacterBubbleProps {
  character: PartyBubbleCharacter
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
  const isPassed = character.passState !== 'none'
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
            isSelected && 'ring-2 ring-gold ring-offset-2 ring-offset-background',
            isPassed && 'opacity-50'
          )}
        >
          <CharacterPortrait
            src={character.avatarUrl}
            name={character.displayName}
            size="md"
            variant="circle"
            className={cn(
              'border-2',
              isSelected ? 'border-gold' : 'border-border/50'
            )}
          />
        </div>

        {/* Pass state badge */}
        {character.passState !== 'none' && (
          <div className="absolute -bottom-1 -right-1">
            <PassBadge state={character.passState} size="sm" />
          </div>
        )}
      </div>

      {/* Name label */}
      <span
        className={cn(
          'text-xs max-w-[60px] truncate text-center',
          isSelected ? 'text-gold font-medium' : 'text-muted-foreground',
          isPassed && 'opacity-50'
        )}
      >
        {character.displayName}
      </span>
    </button>
  )
}

interface NarratorBubbleProps {
  isSelected: boolean
  onClick: () => void
}

function NarratorBubble({ isSelected, onClick }: NarratorBubbleProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 transition-all cursor-pointer hover:scale-105"
      title="Post as Narrator"
    >
      {/* Narrator icon bubble */}
      <div
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center transition-all',
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

interface AddNPCBubbleProps {
  onClick: () => void
}

function AddNPCBubble({ onClick }: AddNPCBubbleProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 transition-all cursor-pointer hover:scale-105"
      title="Add NPC to scene"
    >
      <div className="h-10 w-10 rounded-full flex items-center justify-center transition-all bg-background/40 backdrop-blur-md border border-border/30 hover:border-gold/50 hover:bg-background/60">
        <Plus className="h-5 w-5 text-muted-foreground" />
      </div>
    </button>
  )
}

interface AddPCBubbleProps {
  onClick: () => void
}

function AddPCBubble({ onClick }: AddPCBubbleProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 transition-all cursor-pointer hover:scale-105"
      title="Add PC to scene"
    >
      <div className="h-10 w-10 rounded-full flex items-center justify-center transition-all bg-background/40 backdrop-blur-md border border-border/30 hover:border-gold/50 hover:bg-background/60">
        <Plus className="h-5 w-5 text-muted-foreground" />
      </div>
    </button>
  )
}
