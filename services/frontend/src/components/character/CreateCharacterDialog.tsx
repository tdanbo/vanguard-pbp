import { useState, useRef } from 'react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Upload, X } from 'lucide-react'
import { useCampaignStore } from '@/stores/campaignStore'
import { useToast } from '@/hooks/use-toast'
import { apiUpload, APIError } from '@/lib/api'
import type { CharacterType, CampaignMember, Scene } from '@/types'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

interface CreateCharacterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignId: string
  // Optional - if provided, auto-assigns to this scene after creation
  sceneId?: string
  sceneName?: string
  // Optional - force character type (hides selector when set)
  forceCharacterType?: CharacterType
  // Optional - show scene/user assignment dropdowns
  showAssignmentOptions?: boolean
  // Optional - available scenes for assignment dropdown
  scenes?: Scene[]
  // Optional - available members for user assignment
  members?: CampaignMember[]
}

export function CreateCharacterDialog({
  open,
  onOpenChange,
  campaignId,
  sceneId,
  sceneName,
  forceCharacterType,
  showAssignmentOptions = false,
  scenes = [],
  members = [],
}: CreateCharacterDialogProps) {
  const { toast } = useToast()
  const { createCharacter, addCharacterToScene, fetchCharacters } = useCampaignStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [characterType, setCharacterType] = useState<CharacterType>(forceCharacterType || 'pc')
  const [assignToScene, setAssignToScene] = useState<string>('')
  const [assignToUser, setAssignToUser] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const effectiveCharacterType = forceCharacterType || characterType
  const activeScenes = scenes.filter((s) => !s.is_archived)
  const playerMembers = members.filter((m) => m.role === 'player')

  // Determine labels based on character type
  const typeLabel = effectiveCharacterType === 'pc' ? 'PC' : 'NPC'

  const resetForm = () => {
    setDisplayName('')
    setDescription('')
    setCharacterType(forceCharacterType || 'pc')
    setAssignToScene('')
    setAssignToUser('')
    setAvatarFile(null)
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
    }
    setAvatarPreview(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input
    e.target.value = ''

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Maximum file size is 20MB.',
      })
      return
    }

    // Validate type
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Invalid format',
        description: 'Only PNG, JPG, and WebP images are allowed.',
      })
      return
    }

    // Clear previous preview
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
    }

    setAvatarFile(file)
    setAvatarPreview(URL.createObjectURL(file))
  }

  const clearAvatar = () => {
    setAvatarFile(null)
    if (avatarPreview) {
      URL.revokeObjectURL(avatarPreview)
    }
    setAvatarPreview(null)
  }

  const handleCreate = async () => {
    if (!displayName.trim()) return

    setIsCreating(true)
    try {
      // Create the character
      const character = await createCharacter(campaignId, {
        displayName: displayName.trim(),
        description: description.trim() || undefined,
        characterType: effectiveCharacterType,
        assignToUser: assignToUser && assignToUser !== 'unassigned' ? assignToUser : undefined,
      })

      if (!character) {
        throw new Error('Failed to create character')
      }

      // Upload avatar if one was selected
      if (avatarFile) {
        try {
          await apiUpload<{ url: string }>(
            `/api/v1/campaigns/${campaignId}/characters/${character.id}/avatar`,
            avatarFile
          )
          // Refresh characters to get updated avatar URL
          await fetchCharacters(campaignId)
        } catch (avatarError) {
          // Character created but avatar upload failed
          if (avatarError instanceof APIError && avatarError.code === 'STORAGE_LIMIT_REACHED') {
            toast({
              variant: 'destructive',
              title: `${typeLabel} created but avatar upload failed`,
              description: 'Campaign has reached the 500MB storage limit.',
            })
          } else {
            toast({
              variant: 'destructive',
              title: `${typeLabel} created but avatar upload failed`,
              description: (avatarError as Error).message,
            })
          }
          // Continue - character was still created
        }
      }

      // Determine which scene to add to (auto-assign sceneId takes priority)
      const targetSceneId = sceneId || (assignToScene && assignToScene !== 'none' ? assignToScene : null)

      if (targetSceneId) {
        try {
          await addCharacterToScene(campaignId, targetSceneId, character.id)
        } catch (sceneError) {
          toast({
            variant: 'destructive',
            title: `${typeLabel} created but scene assignment failed`,
            description: (sceneError as Error).message,
          })
          onOpenChange(false)
          resetForm()
          return
        }
      }

      // Success message varies based on context
      const successMessage = sceneId
        ? `${typeLabel} created and added to scene`
        : `${typeLabel} created`

      toast({ title: successMessage })
      onOpenChange(false)
      resetForm()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: `Failed to create ${typeLabel}`,
        description: (error as Error).message,
      })
    } finally {
      setIsCreating(false)
    }
  }

  // Dialog description varies based on context
  const dialogDescription = sceneName
    ? `Add a new ${typeLabel} to "${sceneName}"`
    : `Add a new ${typeLabel} to the campaign.`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={sceneId && !showAssignmentOptions ? 'max-w-sm' : undefined}>
        <DialogHeader>
          <DialogTitle>Create {typeLabel}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Avatar picker */}
          <div className="space-y-2">
            <Label>Portrait (optional)</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarPreview || undefined} alt="Character avatar" />
                <AvatarFallback className="text-xl">
                  {displayName ? displayName.charAt(0).toUpperCase() : '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCreating}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {avatarPreview ? 'Change' : 'Upload'}
                </Button>
                {avatarPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={clearAvatar}
                    disabled={isCreating}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG, or WebP. Max 20MB.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={`${typeLabel} name`}
              maxLength={100}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description{showAssignmentOptions ? '' : ' (optional)'}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={showAssignmentOptions ? 'Character description (optional)' : 'Brief description'}
              maxLength={showAssignmentOptions ? 1000 : 500}
              rows={showAssignmentOptions ? 3 : 2}
            />
          </div>

          {/* Character type selector - only shown when not forced */}
          {!forceCharacterType && (
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

          {/* Scene assignment - only when showAssignmentOptions and not auto-assigning */}
          {showAssignmentOptions && !sceneId && activeScenes.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="assignToScene">Assign to Scene (optional)</Label>
              <Select value={assignToScene} onValueChange={setAssignToScene}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a scene" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No scene</SelectItem>
                  {activeScenes.map((scene) => (
                    <SelectItem key={scene.id} value={scene.id}>
                      {scene.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* User assignment - only when showAssignmentOptions and players exist */}
          {showAssignmentOptions && playerMembers.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="assignToUser">Assign to Player (optional)</Label>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!displayName.trim() || isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              `Create ${typeLabel}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
