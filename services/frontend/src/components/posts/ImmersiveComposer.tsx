import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Send,
  Lock,
  Unlock,
  Loader2,
  Quote,
  Swords,
  EyeOff,
} from 'lucide-react'
import { useComposeLock } from '@/hooks/useComposeLock'
import { useDraft } from '@/hooks/useDraft'
import { useCampaignStore } from '@/stores/campaignStore'
import { useToast } from '@/hooks/use-toast'
import { LockTimerBar } from '@/components/realtime'
import type { Character, CampaignSettings, PostBlock } from '@/types'

interface ImmersiveComposerProps {
  campaignId: string
  sceneId: string
  character: Character | null
  settings: CampaignSettings
  onPostCreated?: () => void
  isLocked?: boolean
  lockHolder?: string
}

export function ImmersiveComposer({
  campaignId,
  sceneId,
  character,
  settings,
  onPostCreated,
  isLocked: externalLocked = false,
  lockHolder,
}: ImmersiveComposerProps) {
  const { toast } = useToast()
  const { createPost } = useCampaignStore()

  const [mode, setMode] = useState<'narrative' | 'ooc'>('narrative')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Compose lock hook (only if character selected)
  const {
    lockId,
    isLocked: hasLock,
    remainingSeconds,
    acquireLock,
    releaseLock,
    updateHiddenStatus,
    isLoading: lockLoading,
  } = useComposeLock({
    sceneId,
    characterId: character?.id || '',
    onLockLost: () => {
      toast({
        variant: 'destructive',
        title: 'Lock expired',
        description: 'Your compose lock has expired. Please try again.',
      })
    },
    onError: (error) => {
      if (!error.message.includes('LOCK_HELD')) {
        toast({
          variant: 'destructive',
          title: 'Failed to acquire lock',
          description: error.message,
        })
      }
    },
  })

  // Draft hook
  const {
    blocks,
    oocText,
    intention,
    isHidden,
    setBlocks,
    setOocText,
    setIntention,
    setIsHidden,
    deleteDraft,
  } = useDraft({
    sceneId,
    characterId: character?.id || '',
    autoLoad: true,
  })

  // Content derived from mode
  const content = mode === 'narrative' ? blocks[0]?.content || '' : oocText

  // Update hidden status when toggle changes
  useEffect(() => {
    if (lockId) {
      updateHiddenStatus(isHidden)
    }
  }, [isHidden, lockId, updateHiddenStatus])

  const handleContentChange = useCallback(
    (value: string) => {
      if (mode === 'narrative') {
        const newBlock: PostBlock = {
          type: 'action',
          content: value,
          order: 0,
        }
        setBlocks([newBlock])
      } else {
        setOocText(value)
      }
    },
    [mode, setBlocks, setOocText]
  )

  const handleAcquireLock = async () => {
    if (!character) return
    await acquireLock(isHidden)
  }

  const handleSubmit = async () => {
    if (!lockId || !character) {
      toast({
        variant: 'destructive',
        title: 'No lock',
        description: 'You must have an active compose lock to post.',
      })
      return
    }

    // Validate content
    const hasContent = blocks.some((b) => b.content.trim())
    if (!hasContent && !oocText.trim()) {
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
        isHidden,
      })

      // Delete the draft and release the lock
      await deleteDraft()
      await releaseLock()

      toast({ title: 'Post created successfully' })
      onPostCreated?.()

      // Reset local state
      setBlocks([{ type: 'action', content: '', order: 0 }])
      setOocText('')
      setMode('narrative')
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

  // If no character is selected, show minimal UI
  if (!character) {
    return (
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40">
        <div className="max-w-4xl mx-auto">
          <div className="bg-panel backdrop-blur-md rounded-2xl border border-border/50 px-4 py-3 text-center">
            <span className="text-sm text-muted-foreground">
              Select a character to post
            </span>
          </div>
        </div>
      </div>
    )
  }

  // Show locked by other player state
  if (externalLocked && !hasLock) {
    return (
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40">
        <div className="max-w-4xl mx-auto">
          <div className="bg-panel backdrop-blur-md rounded-2xl border border-border/50 px-4 py-3">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Lock className="h-4 w-4" />
              <span className="text-sm">
                {lockHolder
                  ? `${lockHolder} is composing...`
                  : 'Another player is currently posting...'}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-40">
      <div className="max-w-4xl mx-auto">
        <div className="bg-panel backdrop-blur-md rounded-2xl border border-border/50 overflow-hidden">
          {/* Lock timer bar */}
          {hasLock && remainingSeconds > 0 && (
            <LockTimerBar
              timeRemaining={remainingSeconds}
              totalTime={600} // 10 minutes
            />
          )}

          {!hasLock ? (
            // Not locked - show acquire button
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Ready to write as {character.display_name}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcquireLock}
                disabled={lockLoading}
              >
                {lockLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-1" />
                    Take Post
                  </>
                )}
              </Button>
            </div>
          ) : (
            // Has lock - show full composer
            <>
              {/* Mode tabs */}
              <div className="px-4 pt-3">
                <Tabs
                  value={mode}
                  onValueChange={(v) => setMode(v as 'narrative' | 'ooc')}
                >
                  <TabsList className="bg-secondary/50 h-8">
                    <TabsTrigger value="narrative" className="text-xs h-7">
                      Narrative
                    </TabsTrigger>
                    <TabsTrigger value="ooc" className="text-xs h-7">
                      OOC
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Text area */}
              <div className="p-4 pt-2">
                <Textarea
                  placeholder={
                    mode === 'narrative'
                      ? 'Write your action or dialogue...'
                      : 'Out of character message...'
                  }
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="min-h-[80px] bg-transparent border-0 resize-none focus-visible:ring-0 p-0"
                />
              </div>

              {/* Intention selector */}
              {mode === 'narrative' &&
                settings.systemPreset?.intentions?.length > 0 && (
                  <div className="px-4 pb-2">
                    <Select
                      value={intention || 'none'}
                      onValueChange={(v) =>
                        setIntention(v === 'none' ? null : v)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs bg-secondary/50">
                        <SelectValue placeholder="Intention (optional)" />
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

              {/* Toolbar */}
              <div className="px-4 pb-3 flex items-center justify-between">
                {/* Block type buttons */}
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      if (blocks[0]) {
                        setBlocks([{ ...blocks[0], type: 'action' }])
                      }
                    }}
                  >
                    <Swords className="h-4 w-4 mr-1" />
                    Action
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      if (blocks[0]) {
                        setBlocks([{ ...blocks[0], type: 'dialog' }])
                      }
                    }}
                  >
                    <Quote className="h-4 w-4 mr-1" />
                    Dialog
                  </Button>
                  {settings.hiddenPosts && (
                    <Button
                      variant={isHidden ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-8"
                      onClick={() => setIsHidden(!isHidden)}
                    >
                      <EyeOff className="h-4 w-4 mr-1" />
                      Hidden
                    </Button>
                  )}
                </div>

                {/* Release and send */}
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={releaseLock}>
                    <Unlock className="h-4 w-4 mr-1" />
                    Release
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!content.trim() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        Post
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
