import { useState } from 'react'
import { Eye, EyeOff, Users, Pencil, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { useCampaignStore } from '@/stores/campaignStore'
import { useToast } from '@/hooks/use-toast'
import type { Character } from '@/types'

interface WitnessPopoverProps {
  witnessIds: string[]
  characters: Character[]
  isGM?: boolean
  postId?: string
  isHidden?: boolean
  onWitnessesUpdated?: () => void
}

export function WitnessPopover({
  witnessIds,
  characters,
  isGM = false,
  postId,
  isHidden = false,
  onWitnessesUpdated,
}: WitnessPopoverProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [localWitnesses, setLocalWitnesses] = useState<string[]>(witnessIds || [])
  const [isSaving, setIsSaving] = useState(false)
  const { updatePostWitnesses } = useCampaignStore()
  const { toast } = useToast()

  // Resolve witness IDs to character objects (guard against null/undefined)
  const safeWitnessIds = witnessIds || []
  const witnesses = safeWitnessIds
    .map((id) => characters.find((c) => c.id === id))
    .filter((c): c is Character => c !== undefined)

  // Group by character type
  const pcs = witnesses.filter((c) => c.character_type === 'pc')
  const npcs = witnesses.filter((c) => c.character_type === 'npc')

  // All scene characters for edit mode
  const allPcs = characters.filter((c) => c.character_type === 'pc')
  const allNpcs = characters.filter((c) => c.character_type === 'npc')

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const witnessCount = witnesses.length

  const handleEditClick = () => {
    // Filter to only include witnesses that are still in the scene
    // (some witnesses may have left since the post was created)
    const sceneCharacterIds = new Set(characters.map((c) => c.id))
    const validWitnesses = safeWitnessIds.filter((id) => sceneCharacterIds.has(id))
    setLocalWitnesses(validWitnesses)
    setIsEditing(true)
  }

  const handleToggleWitness = (characterId: string) => {
    setLocalWitnesses((prev) =>
      prev.includes(characterId)
        ? prev.filter((id) => id !== characterId)
        : [...prev, characterId]
    )
  }

  const handleSave = async () => {
    if (!postId) return

    setIsSaving(true)
    try {
      await updatePostWitnesses(postId, localWitnesses)
      setIsEditing(false)
      onWitnessesUpdated?.()
      toast({ title: 'Witnesses updated' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update witnesses',
        description: (error as Error).message,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setLocalWitnesses([...safeWitnessIds])
    setIsEditing(false)
  }

  return (
    <Popover onOpenChange={(open) => !open && setIsEditing(false)}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground/50 hover:text-muted-foreground"
          aria-label={isHidden ? `Hidden post (${witnessCount} ${witnessCount === 1 ? 'witness' : 'witnesses'})` : `View witnesses (${witnessCount} ${witnessCount === 1 ? 'character' : 'characters'})`}
        >
          {isHidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Witnesses</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {isEditing ? localWitnesses.length : witnessCount}
          </span>
          {isGM && postId && !isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleEditClick}
              title="Edit witnesses"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            {allPcs.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Player Characters</p>
                <div className="space-y-1.5">
                  {allPcs.map((character) => (
                    <WitnessCheckboxRow
                      key={character.id}
                      character={character}
                      checked={localWitnesses.includes(character.id)}
                      onToggle={() => handleToggleWitness(character.id)}
                      getInitials={getInitials}
                    />
                  ))}
                </div>
              </div>
            )}
            {allNpcs.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">NPCs</p>
                <div className="space-y-1.5">
                  {allNpcs.map((character) => (
                    <WitnessCheckboxRow
                      key={character.id}
                      character={character}
                      checked={localWitnesses.includes(character.id)}
                      onToggle={() => handleToggleWitness(character.id)}
                      getInitials={getInitials}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Save
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : witnesses.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No witnesses</p>
        ) : (
          <div className="space-y-3">
            {pcs.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Player Characters</p>
                <div className="space-y-1.5">
                  {pcs.map((character) => (
                    <WitnessRow key={character.id} character={character} getInitials={getInitials} />
                  ))}
                </div>
              </div>
            )}
            {npcs.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">NPCs</p>
                <div className="space-y-1.5">
                  {npcs.map((character) => (
                    <WitnessRow key={character.id} character={character} getInitials={getInitials} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

interface WitnessRowProps {
  character: Character
  getInitials: (name: string) => string
}

function WitnessRow({ character, getInitials }: WitnessRowProps) {
  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-6 w-6">
        <AvatarImage src={character.avatar_url || undefined} />
        <AvatarFallback className="text-[10px]">
          {getInitials(character.display_name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm truncate">{character.display_name}</span>
    </div>
  )
}

interface WitnessCheckboxRowProps {
  character: Character
  checked: boolean
  onToggle: () => void
  getInitials: (name: string) => string
}

function WitnessCheckboxRow({ character, checked, onToggle, getInitials }: WitnessCheckboxRowProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1 py-0.5">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <Avatar className="h-6 w-6">
        <AvatarImage src={character.avatar_url || undefined} />
        <AvatarFallback className="text-[10px]">
          {getInitials(character.display_name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm truncate">{character.display_name}</span>
    </label>
  )
}
