import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Users, Search, Loader2 } from 'lucide-react'
import { useCampaignStore } from '@/stores/campaignStore'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { Character } from '@/types'

type CharacterTypeFilter = 'all' | 'pc' | 'npc'

interface CharacterAssignmentWidgetProps {
  campaignId: string
  sceneId: string
  sceneCharacterIds: string[]
  className?: string
  /** Pre-set filter when opened (defaults to 'all') */
  initialFilter?: CharacterTypeFilter
  /** Whether to show the PC/NPC toggle (defaults to true) */
  showFilterToggle?: boolean
  /** Controlled open state */
  open?: boolean
  /** Controlled state callback */
  onOpenChange?: (open: boolean) => void
  /** Hide the trigger button when using controlled mode */
  hideTrigger?: boolean
}

export function CharacterAssignmentWidget({
  campaignId,
  sceneId,
  sceneCharacterIds,
  className,
  initialFilter = 'all',
  showFilterToggle = true,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: CharacterAssignmentWidgetProps) {
  const { toast } = useToast()
  const {
    characters,
    scenes,
    currentCampaign,
    addCharacterToScene,
    removeCharacterFromScene,
  } = useCampaignStore()

  const [internalOpen, setInternalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<CharacterTypeFilter>(initialFilter)

  // Support both controlled and uncontrolled mode
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? controlledOnOpenChange! : setInternalOpen

  // Reset filter to initialFilter when dialog opens
  useEffect(() => {
    if (open) {
      setFilterType(initialFilter)
    }
  }, [open, initialFilter])

  // Access control: only show for GMs during GM phase
  const isGM = currentCampaign?.user_role === 'gm'
  const isGMPhase = currentCampaign?.current_phase === 'gm_phase'
  const isPaused = currentCampaign?.is_paused

  // Filter to non-archived characters
  const availableCharacters = useMemo(
    () => characters.filter((c) => !c.is_archived),
    [characters]
  )

  // Build scene lookup for current assignments (excluding this scene)
  const characterSceneMap = useMemo(() => {
    const map: Record<string, { sceneId: string; sceneTitle: string }> = {}
    scenes.forEach((scene) => {
      scene.character_ids.forEach((charId) => {
        if (scene.id !== sceneId) {
          map[charId] = { sceneId: scene.id, sceneTitle: scene.title }
        }
      })
    })
    return map
  }, [scenes, sceneId])

  // Filter by character type and search
  const filteredCharacters = useMemo(() => {
    let filtered = availableCharacters

    // Filter by character type if not 'all'
    if (filterType !== 'all') {
      filtered = filtered.filter((c) => c.character_type === filterType)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((c) =>
        c.display_name.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [availableCharacters, filterType, searchQuery])

  // Early return AFTER all hooks (skip for controlled mode)
  if (!isControlled && (!isGM || !isGMPhase || isPaused)) return null

  // Toggle character assignment
  const handleToggle = async (character: Character) => {
    const isInScene = sceneCharacterIds.includes(character.id)
    setProcessingId(character.id)

    try {
      if (isInScene) {
        await removeCharacterFromScene(campaignId, sceneId, character.id)
        toast({ title: `${character.display_name} removed from scene` })
      } else {
        await addCharacterToScene(campaignId, sceneId, character.id)
        const wasInOtherScene = characterSceneMap[character.id]
        toast({
          title: `${character.display_name} added to scene`,
          description: wasInOtherScene
            ? `Moved from "${wasInOtherScene.sceneTitle}"`
            : undefined,
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update character',
        description: (error as Error).message,
      })
    } finally {
      setProcessingId(null)
    }
  }

  const characterCount = sceneCharacterIds.length

  // Dynamic dialog title based on filter
  const dialogTitle =
    initialFilter === 'pc'
      ? 'Add PC to Scene'
      : initialFilter === 'npc'
        ? 'Add NPC to Scene'
        : 'Manage Characters'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-10 w-10 rounded-full bg-background/40 backdrop-blur-md border border-border/30',
              className
            )}
            onClick={(e) => e.stopPropagation()}
            aria-label="Manage scene characters"
          >
            <Users className="h-5 w-5" />
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className="max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {characterCount} {characterCount === 1 ? 'character' : 'characters'}{' '}
            in scene
          </p>
        </DialogHeader>

        {/* Filter toggle */}
        {showFilterToggle && (
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={cn(
                'flex-1 px-3 py-1.5 text-sm rounded-md transition-colors',
                filterType === 'all'
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterType('pc')}
              className={cn(
                'flex-1 px-3 py-1.5 text-sm rounded-md transition-colors',
                filterType === 'pc'
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              PCs
            </button>
            <button
              type="button"
              onClick={() => setFilterType('npc')}
              className={cn(
                'flex-1 px-3 py-1.5 text-sm rounded-md transition-colors',
                filterType === 'npc'
                  ? 'bg-background shadow-sm font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              NPCs
            </button>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search characters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-80 overflow-y-auto -mx-6 px-6">
          {filteredCharacters.length === 0 ? (
            <p className="py-8 text-sm text-center text-muted-foreground">
              {searchQuery ? 'No characters found' : 'No characters available'}
            </p>
          ) : (
            <div className="space-y-1">
              {filteredCharacters.map((character) => {
                const isInScene = sceneCharacterIds.includes(character.id)
                const otherScene = characterSceneMap[character.id]
                const isProcessing = processingId === character.id

                return (
                  <CharacterAssignmentItem
                    key={character.id}
                    character={character}
                    isInScene={isInScene}
                    otherSceneName={otherScene?.sceneTitle}
                    isProcessing={isProcessing}
                    onToggle={() => handleToggle(character)}
                  />
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Separate component for each character row
interface CharacterAssignmentItemProps {
  character: Character
  isInScene: boolean
  otherSceneName?: string
  isProcessing: boolean
  onToggle: () => void
}

function CharacterAssignmentItem({
  character,
  isInScene,
  otherSceneName,
  isProcessing,
  onToggle,
}: CharacterAssignmentItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left cursor-pointer',
        isProcessing && 'opacity-50 pointer-events-none'
      )}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onToggle()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      <Checkbox checked={isInScene} className="pointer-events-none h-5 w-5" />

      <Avatar className="h-8 w-8">
        <AvatarImage src={character.avatar_url || undefined} />
        <AvatarFallback className="text-sm">
          {getInitials(character.display_name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{character.display_name}</p>
        {otherSceneName && !isInScene && (
          <p className="text-xs text-muted-foreground truncate">
            In: {otherSceneName}
          </p>
        )}
      </div>

      <Badge variant="secondary" className="text-xs shrink-0">
        {character.character_type.toUpperCase()}
      </Badge>

      {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
    </div>
  )
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 0 || words[0].length === 0) return '?'
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}
