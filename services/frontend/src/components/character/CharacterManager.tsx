import { useState, useEffect } from 'react'
import { useCampaignStore } from '@/stores/campaignStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { PlusCircle, Archive, ArchiveRestore, User, UserX, Crown, Pencil } from 'lucide-react'
import { AvatarUploader } from '@/components/image/AvatarUploader'
import type { Character, CampaignMember, CreateCharacterRequest, CharacterType } from '@/types'

interface CharacterManagerProps {
  campaignId: string
  isGM: boolean
  members: CampaignMember[]
  characterTypeFilter?: 'pc' | 'npc'
}

export function CharacterManager({ campaignId, isGM, members, characterTypeFilter }: CharacterManagerProps) {
  const { toast } = useToast()
  const {
    characters,
    fetchCharacters,
    createCharacter,
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

  // Form state
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

  const handleCreate = async () => {
    if (!displayName.trim()) return

    try {
      const data: CreateCharacterRequest = {
        displayName: displayName.trim(),
        description: description.trim(),
        characterType,
        assignToUser: assignToUser && assignToUser !== 'unassigned' ? assignToUser : undefined,
      }
      await createCharacter(campaignId, data)
      toast({ title: 'Character created' })
      setCreateDialogOpen(false)
      resetForm()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create character',
        description: (error as Error).message,
      })
    }
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{typeLabel}</CardTitle>
          <CardDescription>{filteredCount} {filteredCount === 1 ? singularLabel : typeLabel.toLowerCase()} in campaign</CardDescription>
        </div>
        {isGM && (
          <Dialog open={createDialogOpen} onOpenChange={(open) => {
            setCreateDialogOpen(open)
            if (open) {
              // Reset form with correct character type when opening
              setCharacterType(characterTypeFilter || 'pc')
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create {characterTypeFilter === 'npc' ? 'NPC' : characterTypeFilter === 'pc' ? 'PC' : 'Character'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create {characterTypeFilter === 'npc' ? 'NPC' : characterTypeFilter === 'pc' ? 'PC' : 'Character'}</DialogTitle>
                <DialogDescription>Add a new {characterTypeFilter === 'npc' ? 'NPC' : characterTypeFilter === 'pc' ? 'PC' : 'character'} to the campaign.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Character name"
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Character description (optional)"
                    maxLength={1000}
                    rows={3}
                  />
                </div>
                {!characterTypeFilter && (
                  <div className="space-y-2">
                    <Label htmlFor="characterType">Type</Label>
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
                )}
                {playerMembers.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="assignTo">Assign to Player (optional)</Label>
                    <Select value={assignToUser} onValueChange={setAssignToUser}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a player" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {playerMembers.map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            Player {member.user_id.slice(0, 8)}...
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!displayName.trim()}>
                  Create Character
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isGM && (
          <div className="mb-4 flex items-center space-x-2">
            <Switch id="showArchived" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="showArchived">Show archived characters</Label>
          </div>
        )}

        {visibleCharacters.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">
            No {typeLabel.toLowerCase()} yet. {isGM ? `Create one to get started.` : `The GM hasn't created any ${typeLabel.toLowerCase()} yet.`}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {visibleCharacters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                isGM={isGM}
                members={members}
                onEdit={() => openEditDialog(character)}
                onArchive={() => handleArchive(character)}
                onAssign={() => openAssignDialog(character)}
                onUnassign={() => handleUnassign(character)}
              />
            ))}
          </div>
        )}
      </CardContent>

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
    </Card>
  )
}

interface CharacterCardProps {
  character: Character
  isGM: boolean
  members: CampaignMember[]
  onEdit: () => void
  onArchive: () => void
  onAssign: () => void
  onUnassign: () => void
}

function CharacterCard({ character, isGM, members, onEdit, onArchive, onAssign, onUnassign }: CharacterCardProps) {
  const assignedMember = members.find((m) => m.user_id === character.assigned_user_id)
  const isOrphaned = !character.assigned_user_id && character.character_type === 'pc'

  return (
    <div
      className={`rounded-lg border p-4 ${character.is_archived ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={character.avatar_url || undefined} alt={character.display_name} />
          <AvatarFallback>{character.display_name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold truncate">{character.display_name}</h3>
            <Badge variant={character.character_type === 'pc' ? 'default' : 'secondary'} className="text-xs">
              {character.character_type.toUpperCase()}
            </Badge>
            {character.is_archived && (
              <Badge variant="outline" className="text-xs">
                Archived
              </Badge>
            )}
            {isOrphaned && (
              <Badge variant="destructive" className="text-xs">
                Orphaned
              </Badge>
            )}
          </div>
          {character.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{character.description}</p>
          )}
          {assignedMember && (
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              {assignedMember.role === 'gm' ? (
                <Crown className="h-3 w-3" />
              ) : (
                <User className="h-3 w-3" />
              )}
              <span>
                Assigned to {assignedMember.role === 'gm' ? 'GM' : `Player ${assignedMember.user_id.slice(0, 8)}...`}
              </span>
            </div>
          )}
        </div>
      </div>

      {isGM && (
        <div className="mt-4 flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </Button>
          {character.assigned_user_id ? (
            <Button variant="outline" size="sm" onClick={onUnassign}>
              <UserX className="mr-1 h-3 w-3" />
              Unassign
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onAssign}>
              <User className="mr-1 h-3 w-3" />
              Assign
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onArchive}>
            {character.is_archived ? (
              <>
                <ArchiveRestore className="mr-1 h-3 w-3" />
                Restore
              </>
            ) : (
              <>
                <Archive className="mr-1 h-3 w-3" />
                Archive
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

export default CharacterManager
