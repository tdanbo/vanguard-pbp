import { useState, useEffect } from 'react'
import { useCampaignStore } from '@/stores/campaignStore'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { PlusCircle, User, Users, Eye, EyeOff } from 'lucide-react'
import { AvatarUploader } from '@/components/image/AvatarUploader'
import { CreateCharacterDialog } from '@/components/character/CreateCharacterDialog'
import { CharacterCardsGrid } from '@/components/character/CharacterCard'
import { EmptyState } from '@/components/ui/empty-state'
import type { Character, CampaignMember, CharacterType, Scene } from '@/types'

interface CharacterManagerProps {
  campaignId: string
  isGM: boolean
  members: CampaignMember[]
  scenes?: Scene[]
  characterTypeFilter?: 'pc' | 'npc'
}

export function CharacterManager({ campaignId, isGM, members, scenes = [], characterTypeFilter }: CharacterManagerProps) {
  const { toast } = useToast()
  const {
    characters,
    fetchCharacters,
    updateCharacter,
    archiveCharacter,
    unarchiveCharacter,
    assignCharacter,
    unassignCharacter,
  } = useCampaignStore()

  const [showArchived, setShowArchived] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null)

  // Form state for edit/assign dialogs
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [characterType, setCharacterType] = useState<CharacterType>('pc')
  const [assignToUser, setAssignToUser] = useState<string>('')

  useEffect(() => {
    fetchCharacters(campaignId).catch((error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to load characters',
        description: error.message,
      })
    })
  }, [campaignId, fetchCharacters, toast])

  const visibleCharacters = characters.filter((c) => {
    if (characterTypeFilter && c.character_type !== characterTypeFilter) return false
    return showArchived || !c.is_archived
  })

  const resetForm = () => {
    setDisplayName('')
    setDescription('')
    setCharacterType(characterTypeFilter || 'pc')
    setAssignToUser('')
  }

  const handleUpdate = async () => {
    if (!selectedCharacter || !displayName.trim()) return

    try {
      await updateCharacter(campaignId, selectedCharacter.id, {
        displayName: displayName.trim(),
        description: description.trim(),
        characterType,
      })
      toast({ title: 'Character updated' })
      setEditDialogOpen(false)
      setSelectedCharacter(null)
      resetForm()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update character',
        description: (error as Error).message,
      })
    }
  }

  const handleArchive = async (character: Character) => {
    try {
      if (character.is_archived) {
        await unarchiveCharacter(campaignId, character.id)
        toast({ title: 'Character restored' })
      } else {
        await archiveCharacter(campaignId, character.id)
        toast({ title: 'Character archived' })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update character',
        description: (error as Error).message,
      })
    }
  }

  const handleAssign = async () => {
    if (!selectedCharacter || !assignToUser) return

    try {
      await assignCharacter(campaignId, selectedCharacter.id, assignToUser)
      toast({ title: 'Character assigned' })
      setAssignDialogOpen(false)
      setSelectedCharacter(null)
      setAssignToUser('')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to assign character',
        description: (error as Error).message,
      })
    }
  }

  const handleUnassign = async (character: Character) => {
    try {
      await unassignCharacter(campaignId, character.id)
      toast({ title: 'Character unassigned' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to unassign character',
        description: (error as Error).message,
      })
    }
  }

  const openEditDialog = (character: Character) => {
    setSelectedCharacter(character)
    setDisplayName(character.display_name)
    setDescription(character.description || '')
    setCharacterType(character.character_type)
    setEditDialogOpen(true)
  }

  const openAssignDialog = (character: Character) => {
    setSelectedCharacter(character)
    setAssignToUser('')
    setAssignDialogOpen(true)
  }

  const playerMembers = members.filter((m) => m.role === 'player')

  // Determine title and counts based on filter
  const filteredCount = visibleCharacters.length
  const typeLabel = characterTypeFilter === 'pc' ? 'PCs' : characterTypeFilter === 'npc' ? 'NPCs' : 'Characters'
  const singularLabel = characterTypeFilter === 'pc' ? 'PC' : characterTypeFilter === 'npc' ? 'NPC' : 'character'

  return (
    <>
      {/* Header with controls - matches Scenes tab pattern */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <p className="text-sm text-muted-foreground">
            {filteredCount} {filteredCount === 1 ? singularLabel : typeLabel.toLowerCase()}
          </p>
          {isGM && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className="text-muted-foreground"
            >
              {showArchived ? (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Hide archived
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Show archived
                </>
              )}
            </Button>
          )}
        </div>
        {isGM && (
          <>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create {characterTypeFilter === 'npc' ? 'NPC' : characterTypeFilter === 'pc' ? 'PC' : 'Character'}
            </Button>
            <CreateCharacterDialog
              open={createDialogOpen}
              onOpenChange={setCreateDialogOpen}
              campaignId={campaignId}
              forceCharacterType={characterTypeFilter}
              showAssignmentOptions
              scenes={scenes}
              members={members}
            />
          </>
        )}
      </div>

      {/* Character grid or empty state */}
      {visibleCharacters.length === 0 ? (
        <EmptyState
          icon={characterTypeFilter === 'pc' ? User : Users}
          title={`No ${typeLabel.toLowerCase()} yet`}
          description={isGM ? `Create your first ${singularLabel} to get started.` : `The GM hasn't created any ${typeLabel.toLowerCase()} yet.`}
        />
      ) : (
        <CharacterCardsGrid
          characters={visibleCharacters}
          isGM={isGM}
          members={members}
          onEdit={openEditDialog}
          onArchive={handleArchive}
          onAssign={openAssignDialog}
          onUnassign={handleUnassign}
        />
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Character</DialogTitle>
            <DialogDescription>Update character details and avatar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedCharacter && (
              <>
                <AvatarUploader
                  campaignId={campaignId}
                  characterId={selectedCharacter.id}
                  currentUrl={selectedCharacter.avatar_url}
                  displayName={selectedCharacter.display_name}
                  onUploadComplete={(url) => {
                    // Update the character in the store with the new avatar URL
                    const updatedCharacter = { ...selectedCharacter, avatar_url: url }
                    setSelectedCharacter(updatedCharacter)
                    fetchCharacters(campaignId)
                  }}
                  onDeleteComplete={() => {
                    const updatedCharacter = { ...selectedCharacter, avatar_url: null }
                    setSelectedCharacter(updatedCharacter)
                    fetchCharacters(campaignId)
                  }}
                />
                <Separator />
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="editDisplayName">Name</Label>
              <Input
                id="editDisplayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Character name"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Character description"
                maxLength={1000}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editCharacterType">Type</Label>
              <Select value={characterType} onValueChange={(v) => setCharacterType(v as CharacterType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pc">PC (Player Character)</SelectItem>
                  <SelectItem value="npc">NPC (Non-Player Character)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!displayName.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Character</DialogTitle>
            <DialogDescription>
              Assign {selectedCharacter?.display_name} to a player.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="assignUser">Select Player</Label>
              <Select value={assignToUser} onValueChange={setAssignToUser}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a player" />
                </SelectTrigger>
                <SelectContent>
                  {playerMembers.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      Player {member.user_id.slice(0, 8)}...
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={!assignToUser}>
              Assign Character
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default CharacterManager
