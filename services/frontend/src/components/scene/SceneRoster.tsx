import { CharacterPortrait } from '@/components/character/CharacterPortrait'
import { PassBadge } from '@/components/ui/game-badges'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChevronDown, Plus, Crown, Users, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CampaignPhase, PassState } from '@/types'

interface SceneRosterCharacter {
  id: string
  displayName: string
  avatarUrl?: string | null
  passState: PassState
  isOwnedByUser: boolean
}

interface SceneRosterProps {
  phase: CampaignPhase | 'paused'
  characters: SceneRosterCharacter[]
  isGM: boolean
  onPass?: (characterId: string, state: 'passed' | 'hard_passed') => void
  onClearPass?: (characterId: string) => void
  onAddCharacter?: () => void
}

export function SceneRoster({
  phase,
  characters,
  isGM,
  onPass,
  onClearPass,
  onAddCharacter,
}: SceneRosterProps) {
  return (
    <div className="bg-panel backdrop-blur-md rounded-lg border border-border/50 overflow-hidden">
      {/* Phase banner */}
      <PhaseBanner phase={phase} />

      {/* Character list */}
      <div className="p-2 space-y-1">
        {characters.map((character) => (
          <CharacterRow
            key={character.id}
            character={character}
            isGM={isGM}
            onPass={onPass}
            onClearPass={onClearPass}
          />
        ))}
        {characters.length === 0 && (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No characters in scene
          </div>
        )}
      </div>

      {/* GM controls */}
      {isGM && onAddCharacter && (
        <div className="p-2 border-t border-border/30">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={onAddCharacter}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Character
          </Button>
        </div>
      )}
    </div>
  )
}

interface PhaseBannerProps {
  phase: CampaignPhase | 'paused'
}

function PhaseBanner({ phase }: PhaseBannerProps) {
  const config = {
    gm_phase: {
      label: 'GM Phase',
      className: 'bg-gm-phase text-white',
      icon: Crown,
    },
    pc_phase: {
      label: 'PC Phase',
      className: 'bg-pc-phase text-white',
      icon: Users,
    },
    paused: {
      label: 'Paused',
      className: 'bg-muted text-muted-foreground',
      icon: Pause,
    },
  }[phase]

  const Icon = config.icon

  return (
    <div className={cn('px-4 py-2 text-center font-medium flex items-center justify-center gap-2', config.className)}>
      <Icon className="h-4 w-4" />
      {config.label}
    </div>
  )
}

interface CharacterRowProps {
  character: SceneRosterCharacter
  isGM: boolean
  onPass?: (characterId: string, state: 'passed' | 'hard_passed') => void
  onClearPass?: (characterId: string) => void
}

function CharacterRow({
  character,
  isGM,
  onPass,
  onClearPass,
}: CharacterRowProps) {
  const canControl = character.isOwnedByUser || isGM

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50">
      {/* Portrait with pass overlay */}
      <div className="relative">
        <CharacterPortrait
          src={character.avatarUrl}
          name={character.displayName}
          size="sm"
        />
        {character.passState !== 'none' && (
          <div className="absolute -bottom-1 -right-1">
            <PassBadge state={character.passState} size="sm" />
          </div>
        )}
      </div>

      {/* Name */}
      <span className="flex-1 font-medium truncate text-sm">
        {character.displayName}
      </span>

      {/* Pass controls */}
      {canControl && onPass && onClearPass && (
        <PassDropdown
          passState={character.passState}
          onPass={(state) => onPass(character.id, state)}
          onClear={() => onClearPass(character.id)}
        />
      )}
    </div>
  )
}

interface PassDropdownProps {
  passState: PassState
  onPass: (state: 'passed' | 'hard_passed') => void
  onClear: () => void
}

function PassDropdown({ passState, onPass, onClear }: PassDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2">
          {passState === 'none' ? 'Pass' : 'Change'}
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onPass('passed')}>
          Pass (soft)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPass('hard_passed')}>
          Hard Pass
        </DropdownMenuItem>
        {passState !== 'none' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onClear}>Clear Pass</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Export types for convenience
export type { SceneRosterCharacter }
