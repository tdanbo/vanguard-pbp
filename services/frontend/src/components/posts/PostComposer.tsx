import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Plus,
  Send,
  X,
  Clock,
  AlertCircle,
  Loader2,
  EyeOff,
  Save,
} from 'lucide-react'
import { PostBlockEditor } from './PostBlock'
import { HiddenPostToggle } from './HiddenPostToggle'
import { useComposeLock } from '@/hooks/useComposeLock'
import { useDraft } from '@/hooks/useDraft'
import { useCampaignStore } from '@/stores/campaignStore'
import { useToast } from '@/hooks/use-toast'
import type { PostBlock, Character, CampaignSettings } from '@/types'

interface PostComposerProps {
  campaignId: string
  sceneId: string
  character: Character
  settings: CampaignSettings
  onClose: () => void
  onPostCreated: () => void
}

export function PostComposer({
  campaignId,
  sceneId,
  character,
  settings,
  onClose,
  onPostCreated,
}: PostComposerProps) {
  const { toast } = useToast()
  const { createPost } = useCampaignStore()

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Compose lock hook
  const {
    lockId,
    isLocked,
    remainingSeconds,
    acquireLock,
    releaseLock,
    updateHiddenStatus,
    isLoading: lockLoading,
    error: lockError,
  } = useComposeLock({
    sceneId,
    characterId: character.id,
    onLockLost: () => {
      toast({
        variant: 'destructive',
        title: 'Lock expired',
        description: 'Your compose lock has expired. Please try again.',
      })
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to acquire lock',
        description: error.message,
      })
    },
  })

  // Draft hook
  const {
    blocks,
    oocText,
    intention,
    modifier,
    isHidden,
    isSaving,
    setBlocks,
    setOocText,
    setIntention,
    // setModifier is available but not used in this initial implementation
    setIsHidden,
    deleteDraft,
  } = useDraft({
    sceneId,
    characterId: character.id,
    autoLoad: true,
  })

  // Acquire lock on mount
  useEffect(() => {
    acquireLock(isHidden)
    return () => {
      releaseLock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update hidden status when toggle changes
  useEffect(() => {
    if (lockId) {
      updateHiddenStatus(isHidden)
    }
  }, [isHidden, lockId, updateHiddenStatus])

  const handleAddBlock = useCallback(() => {
    const newBlock: PostBlock = {
      type: 'action',
      content: '',
      order: blocks.length,
    }
    setBlocks([...blocks, newBlock])
  }, [blocks, setBlocks])

  const handleBlockChange = useCallback(
    (index: number, updatedBlock: PostBlock) => {
      const newBlocks = [...blocks]
      newBlocks[index] = updatedBlock
      setBlocks(newBlocks)
    },
    [blocks, setBlocks]
  )

  const handleRemoveBlock = useCallback(
    (index: number) => {
      const newBlocks = blocks.filter((_, i) => i !== index)
      // Update order numbers
      const reorderedBlocks = newBlocks.map((block, i) => ({
        ...block,
        order: i,
      }))
      setBlocks(reorderedBlocks)
    },
    [blocks, setBlocks]
  )

  const handleSubmit = async (hidden: boolean = false) => {
    if (!lockId) {
      toast({
        variant: 'destructive',
        title: 'No lock',
        description: 'You must have an active compose lock to post.',
      })
      return
    }

    // Validate at least one block has content
    const hasContent = blocks.some((b) => b.content.trim())
    if (!hasContent) {
      toast({
        variant: 'destructive',
        title: 'Empty post',
        description: 'Please add some content before posting.',
      })
      return
    }

    setIsSubmitting(true)

    try {
      await createPost(campaignId, {
        sceneId,
        characterId: character.id,
        blocks: blocks.filter((b) => b.content.trim()),
        oocText: oocText || undefined,
        intention: intention || undefined,
        modifier: modifier ?? undefined,
        isHidden: hidden,
      })

      // Delete the draft after successful post
      await deleteDraft()

      // Release the lock
      await releaseLock()

      toast({ title: 'Post created successfully' })
      onPostCreated()
      onClose()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create post',
        description: (error as Error).message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async () => {
    await releaseLock()
    onClose()
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Loading state while acquiring lock
  if (lockLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Acquiring compose lock...</span>
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (lockError && !isLocked) {
    return (
      <Card>
        <CardContent className="py-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {lockError.includes('LOCK_HELD')
                ? 'Another player is currently composing a post. Please wait and try again.'
                : lockError}
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-lg">Compose Post</CardTitle>
          <Badge variant="outline">{character.display_name}</Badge>
          {isSaving && (
            <Badge variant="secondary" className="gap-1">
              <Save className="h-3 w-3" />
              Saving...
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={remainingSeconds < 120 ? 'destructive' : 'secondary'} className="gap-1">
            <Clock className="h-3 w-3" />
            {formatTime(remainingSeconds)}
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Post blocks */}
        <div className="space-y-3">
          {blocks.map((block, index) => (
            <PostBlockEditor
              key={index}
              block={block}
              index={index}
              onChange={(updated) => handleBlockChange(index, updated)}
              onRemove={() => handleRemoveBlock(index)}
              canMoveUp={index > 0}
              canMoveDown={index < blocks.length - 1}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleAddBlock}
          className="w-full"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Block
        </Button>

        {/* Intention selector (for dice rolling) */}
        {settings.systemPreset?.intentions?.length > 0 && (
          <div className="space-y-2">
            <Label>Intention (for dice roll)</Label>
            <Select
              value={intention || 'none'}
              onValueChange={(v) => setIntention(v === 'none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select intention (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No roll</SelectItem>
                {settings.systemPreset.intentions.map((int) => (
                  <SelectItem key={int} value={int}>
                    {int}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* OOC text */}
        <div className="space-y-2">
          <Label htmlFor="oocText">Out of Character (optional)</Label>
          <Textarea
            id="oocText"
            value={oocText}
            onChange={(e) => setOocText(e.target.value)}
            placeholder="Add any OOC notes or comments..."
            className="min-h-[60px]"
          />
        </div>

        {/* Hidden post toggle */}
        {settings.hiddenPosts && (
          <HiddenPostToggle
            isHidden={isHidden}
            onChange={setIsHidden}
            disabled={isSubmitting}
          />
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button
          onClick={() => handleSubmit(isHidden)}
          disabled={isSubmitting || !isLocked}
          variant={isHidden ? 'default' : 'default'}
          className={isHidden ? 'bg-amber-600 hover:bg-amber-700' : ''}
        >
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : isHidden ? (
            <EyeOff className="mr-2 h-4 w-4" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {isHidden ? 'Submit Hidden Post' : 'Submit Post'}
        </Button>
      </CardFooter>
    </Card>
  )
}
