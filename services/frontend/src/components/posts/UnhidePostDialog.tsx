import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'
import { api } from '@/lib/api'
import type { Character, Post } from '@/types'

interface UnhidePostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: Post
  sceneCharacters: Character[]
  onUnhidden: (post: Post) => void
}

export function UnhidePostDialog({
  open,
  onOpenChange,
  post,
  sceneCharacters,
  onUnhidden,
}: UnhidePostDialogProps) {
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default to all characters when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedCharacterIds(sceneCharacters.map((c) => c.id))
      setError(null)
    }
  }, [open, sceneCharacters])

  const handleToggleCharacter = (characterId: string) => {
    setSelectedCharacterIds((prev) =>
      prev.includes(characterId)
        ? prev.filter((id) => id !== characterId)
        : [...prev, characterId]
    )
  }

  const handleSelectAll = () => {
    setSelectedCharacterIds(sceneCharacters.map((c) => c.id))
  }

  const handleSelectNone = () => {
    setSelectedCharacterIds([])
  }

  const handleUnhide = async () => {
    if (selectedCharacterIds.length === 0) {
      setError('Select at least one character to witness the post')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const updatedPost = await api<Post>(`/api/v1/posts/${post.id}/unhide`, {
        method: 'POST',
        body: { witnesses: selectedCharacterIds },
      })
      onUnhidden(updatedPost)
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reveal Hidden Post</DialogTitle>
          <DialogDescription>
            Select which characters will be able to see this post once revealed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleSelectNone}>
              Select None
            </Button>
          </div>

          <div className="max-h-[300px] overflow-y-auto space-y-2 border rounded-lg p-3">
            {sceneCharacters.map((character) => (
              <div
                key={character.id}
                className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50"
              >
                <Checkbox
                  id={`char-${character.id}`}
                  checked={selectedCharacterIds.includes(character.id)}
                  onCheckedChange={() => handleToggleCharacter(character.id)}
                />
                <Label
                  htmlFor={`char-${character.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <span className="font-medium">{character.display_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({character.character_type.toUpperCase()})
                  </span>
                </Label>
              </div>
            ))}

            {sceneCharacters.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No characters in this scene
              </p>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            {selectedCharacterIds.length} of {sceneCharacters.length} characters
            selected
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUnhide} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reveal Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
