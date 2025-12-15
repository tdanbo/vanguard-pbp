import { useState, useEffect } from 'react'
import { useCampaignStore } from '@/stores/campaignStore'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import {
  PlusCircle,
  Archive,
  ArchiveRestore,
  AlertCircle,
  Pencil,
  UserPlus,
  UserMinus,
  BookOpen,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react'
import { SceneHeaderUploader } from '@/components/image/SceneHeaderUploader'
import { PostList } from '@/components/posts'
import { PassButton } from '@/components/phase'
import type { Scene, Character, CreateSceneRequest, CampaignPhase, CampaignSettings, PassState } from '@/types'

interface SceneManagerProps {
  campaignId: string
  isGM: boolean
  currentPhase: CampaignPhase
  settings: CampaignSettings
}

export function SceneManager({ campaignId, isGM, currentPhase, settings }: SceneManagerProps) {
  const { toast } = useToast()
  const { user } = useAuthStore()
  const {
    scenes,
    sceneWarning,
    characters,
    fetchScenes,
    fetchCharacters,
    createScene,
    updateScene,
    archiveScene,
    unarchiveScene,
    addCharacterToScene,
    removeCharacterFromScene,
  } = useCampaignStore()

  const [showArchived, setShowArchived] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [addCharacterDialogOpen, setAddCharacterDialogOpen] = useState(false)
  const [selectedScene, setSelectedScene] = useState<Scene | null>(null)
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('')

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    fetchScenes(campaignId).catch((error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to load scenes',
        description: error.message,
      })
    })
    fetchCharacters(campaignId).catch(() => {
      // Characters may already be loaded
    })
  }, [campaignId, fetchScenes, fetchCharacters, toast])

  const visibleScenes = scenes.filter((s) => showArchived || !s.is_archived)
  const activeSceneCount = scenes.filter((s) => !s.is_archived).length

  const resetForm = () => {
    setTitle('')
    setDescription('')
  }

  const handleCreate = async () => {
    if (!title.trim()) return

    try {
      const data: CreateSceneRequest = {
        title: title.trim(),
        description: description.trim(),
      }
      const response = await createScene(campaignId, data)

      if (response.warning) {
        toast({
          title: 'Scene created',
          description: response.warning,
        })
      } else {
        toast({ title: 'Scene created - you can now add a header image' })
      }

      if (response.deletedSceneId) {
        toast({
          variant: 'destructive',
          title: 'Archived scene deleted',
          description: 'The oldest archived scene was automatically deleted to make room.',
        })
      }

      setCreateDialogOpen(false)
      resetForm()

      // Open edit dialog to allow adding header image
      setSelectedScene(response.scene)
      setTitle(response.scene.title)
      setDescription(response.scene.description || '')
      setEditDialogOpen(true)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create scene',
        description: (error as Error).message,
      })
    }
  }

  const handleUpdate = async () => {
    if (!selectedScene || !title.trim()) return

    try {
      await updateScene(campaignId, selectedScene.id, {
        title: title.trim(),
        description: description.trim(),
      })
      toast({ title: 'Scene updated' })
      setEditDialogOpen(false)
      setSelectedScene(null)
      resetForm()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update scene',
        description: (error as Error).message,
      })
    }
  }

  const handleArchive = async (scene: Scene) => {
    try {
      if (scene.is_archived) {
        await unarchiveScene(campaignId, scene.id)
        toast({ title: 'Scene restored' })
      } else {
        await archiveScene(campaignId, scene.id)
        toast({ title: 'Scene archived' })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update scene',
        description: (error as Error).message,
      })
    }
  }

  const handleAddCharacter = async () => {
    if (!selectedScene || !selectedCharacterId) return

    try {
      await addCharacterToScene(campaignId, selectedScene.id, selectedCharacterId)
      toast({ title: 'Character added to scene' })
      setAddCharacterDialogOpen(false)
      setSelectedScene(null)
      setSelectedCharacterId('')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to add character',
        description: (error as Error).message,
      })
    }
  }

  const handleRemoveCharacter = async (sceneId: string, characterId: string) => {
    try {
      await removeCharacterFromScene(campaignId, sceneId, characterId)
      toast({ title: 'Character removed from scene' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to remove character',
        description: (error as Error).message,
      })
    }
  }

  const openEditDialog = (scene: Scene) => {
    setSelectedScene(scene)
    setTitle(scene.title)
    setDescription(scene.description || '')
    setEditDialogOpen(true)
  }

  const openAddCharacterDialog = (scene: Scene) => {
    setSelectedScene(scene)
    setSelectedCharacterId('')
    setAddCharacterDialogOpen(true)
  }

  // Characters not yet in the selected scene
  const availableCharacters = characters.filter(
    (c) => !c.is_archived && selectedScene && !selectedScene.character_ids.includes(c.id)
  )

  const getWarningVariant = () => {
    if (activeSceneCount >= 25) return 'destructive'
    if (activeSceneCount >= 23) return 'default'
    return 'default'
  }

  const canMoveCharacters = isGM && currentPhase === 'gm_phase'

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Scenes</CardTitle>
          <CardDescription>{activeSceneCount} / 25 scenes</CardDescription>
        </div>
        {isGM && (
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Scene
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Scene</DialogTitle>
                <DialogDescription>Add a new scene to the campaign.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="sceneTitle">Title</Label>
                  <Input
                    id="sceneTitle"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Scene title"
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sceneDescription">Description</Label>
                  <Textarea
                    id="sceneDescription"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Scene description (optional)"
                    maxLength={2000}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!title.trim()}>
                  Create Scene
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {sceneWarning && (
          <Alert variant={getWarningVariant()} className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Scene Limit</AlertTitle>
            <AlertDescription>{sceneWarning}</AlertDescription>
          </Alert>
        )}

        {isGM && (
          <div className="mb-4 flex items-center space-x-2">
            <Switch id="showArchivedScenes" checked={showArchived} onCheckedChange={setShowArchived} />
            <Label htmlFor="showArchivedScenes">Show archived scenes</Label>
          </div>
        )}

        {!canMoveCharacters && currentPhase === 'pc_phase' && isGM && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Character movement is only available during GM Phase. Switch to GM Phase to add or remove characters from
              scenes.
            </AlertDescription>
          </Alert>
        )}

        {visibleScenes.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">No scenes yet. Create one to get started.</p>
        ) : (
          <div className="space-y-4">
            {visibleScenes.map((scene) => (
              <SceneCard
                key={scene.id}
                scene={scene}
                characters={characters}
                campaignId={campaignId}
                currentUserId={user?.id || ''}
                isGM={isGM}
                currentPhase={currentPhase}
                settings={settings}
                canMoveCharacters={canMoveCharacters}
                onEdit={() => openEditDialog(scene)}
                onArchive={() => handleArchive(scene)}
                onAddCharacter={() => openAddCharacterDialog(scene)}
                onRemoveCharacter={(characterId) => handleRemoveCharacter(scene.id, characterId)}
              />
            ))}
          </div>
        )}
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Scene</DialogTitle>
            <DialogDescription>Update scene details and header image.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedScene && (
              <>
                <div className="space-y-2">
                  <Label>Header Image</Label>
                  <SceneHeaderUploader
                    campaignId={campaignId}
                    sceneId={selectedScene.id}
                    currentUrl={selectedScene.header_image_url}
                    onUploadComplete={(url) => {
                      const updatedScene = { ...selectedScene, header_image_url: url }
                      setSelectedScene(updatedScene)
                      fetchScenes(campaignId)
                    }}
                    onDeleteComplete={() => {
                      const updatedScene = { ...selectedScene, header_image_url: null }
                      setSelectedScene(updatedScene)
                      fetchScenes(campaignId)
                    }}
                  />
                </div>
                <Separator />
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="editSceneTitle">Title</Label>
              <Input
                id="editSceneTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Scene title"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editSceneDescription">Description</Label>
              <Textarea
                id="editSceneDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scene description"
                maxLength={2000}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={!title.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Character Dialog */}
      <Dialog open={addCharacterDialogOpen} onOpenChange={setAddCharacterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Character to Scene</DialogTitle>
            <DialogDescription>
              Select a character to add to {selectedScene?.title}. Characters can only be in one scene at a time.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {availableCharacters.length === 0 ? (
              <p className="text-center text-muted-foreground">All characters are already assigned to scenes.</p>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="addCharacter">Select Character</Label>
                <Select value={selectedCharacterId} onValueChange={setSelectedCharacterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a character" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCharacters.map((character) => (
                      <SelectItem key={character.id} value={character.id}>
                        {character.display_name} ({character.character_type.toUpperCase()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCharacterDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCharacter} disabled={!selectedCharacterId}>
              Add Character
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

interface SceneCardProps {
  scene: Scene
  characters: Character[]
  campaignId: string
  currentUserId: string
  isGM: boolean
  currentPhase: CampaignPhase
  settings: CampaignSettings
  canMoveCharacters: boolean
  onEdit: () => void
  onArchive: () => void
  onAddCharacter: () => void
  onRemoveCharacter: (characterId: string) => void
}

function SceneCard({
  scene,
  characters,
  campaignId,
  currentUserId,
  isGM,
  currentPhase,
  settings,
  canMoveCharacters,
  onEdit,
  onArchive,
  onAddCharacter,
  onRemoveCharacter,
}: SceneCardProps) {
  const [showPosts, setShowPosts] = useState(false)
  const sceneCharacters = characters.filter((c) => scene.character_ids.includes(c.id))

  return (
    <div className={`rounded-lg border p-4 ${scene.is_archived ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{scene.title}</h3>
              {scene.is_archived && (
                <Badge variant="outline" className="text-xs">
                  Archived
                </Badge>
              )}
            </div>
            {scene.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{scene.description}</p>}
          </div>
        </div>

        {isGM && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1 h-3 w-3" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onArchive}>
              {scene.is_archived ? (
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

      {/* Characters in scene */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-muted-foreground">Characters ({sceneCharacters.length})</h4>
          {canMoveCharacters && !scene.is_archived && (
            <Button variant="ghost" size="sm" onClick={onAddCharacter}>
              <UserPlus className="mr-1 h-3 w-3" />
              Add
            </Button>
          )}
        </div>
        {sceneCharacters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No characters in this scene</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sceneCharacters.map((character) => {
              const passState = (scene.pass_states?.[character.id] || 'none') as PassState
              const isOwner = character.assigned_user_id === currentUserId

              return (
                <div key={character.id} className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm">
                  <span>{character.display_name}</span>
                  <Badge variant="outline" className="ml-1 text-xs">
                    {character.character_type.toUpperCase()}
                  </Badge>
                  {currentPhase === 'pc_phase' && !scene.is_archived && (
                    <PassButton
                      campaignId={campaignId}
                      sceneId={scene.id}
                      characterId={character.id}
                      currentState={passState}
                      characterName={character.display_name}
                      isOwner={isOwner}
                      isGM={isGM}
                      isPCPhase={currentPhase === 'pc_phase'}
                      className="ml-1"
                    />
                  )}
                  {canMoveCharacters && !scene.is_archived && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1"
                      onClick={() => onRemoveCharacter(character.id)}
                    >
                      <UserMinus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Posts toggle */}
      {!scene.is_archived && (
        <div className="mt-4 pt-4 border-t">
          <Button
            variant="ghost"
            className="w-full justify-between"
            onClick={() => setShowPosts(!showPosts)}
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Posts
            </span>
            {showPosts ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>

          {showPosts && (
            <div className="mt-4">
              <PostList
                campaignId={campaignId}
                sceneId={scene.id}
                characters={characters}
                currentUserId={currentUserId}
                isGM={isGM}
                currentPhase={currentPhase}
                settings={settings}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SceneManager
