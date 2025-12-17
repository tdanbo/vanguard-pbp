import { useState, useCallback, useEffect, useRef } from 'react'
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
  X,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useComposeLock } from '@/hooks/useComposeLock'
import { useDraft } from '@/hooks/useDraft'
import { useCampaignStore } from '@/stores/campaignStore'
import { useToast } from '@/hooks/use-toast'
import { LockTimerBar } from '@/components/realtime'
import type { Character, CampaignSettings, PostBlock, Post } from '@/types'

interface ImmersiveComposerProps {
  campaignId: string
  sceneId: string
  character: Character | null
  isNarrator?: boolean
  settings: CampaignSettings
  onPostCreated?: () => void
  isLocked?: boolean
  lockHolder?: string
  // Edit mode props
  editingPost?: Post | null
  onEditComplete?: () => void
  onEditCancel?: () => void
  // Delete functionality
  isGM?: boolean
  onPostDeleted?: () => void
}

export function ImmersiveComposer({
  campaignId,
  sceneId,
  character,
  isNarrator = false,
  settings,
  onPostCreated,
  isLocked: externalLocked = false,
  lockHolder,
  editingPost,
  onEditComplete,
  onEditCancel,
  isGM = false,
  onPostDeleted,
}: ImmersiveComposerProps) {
  const { toast } = useToast()
  const { createPost, updatePost, deletePost } = useCampaignStore()
  const isEditMode = Boolean(editingPost)

  const [mode, setMode] = useState<'narrative' | 'ooc'>('narrative')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [narratorComposing, setNarratorComposing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const textareaRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map())
  const editInitializedRef = useRef<string | null>(null)

  // Derive the effective character ID for hooks (narrator uses 'narrator' as ID)
  const effectiveCharacterId = isNarrator ? 'narrator' : (character?.id || '')
  const displayName = isNarrator ? 'Narrator' : character?.display_name

  // Compose lock hook (only used for character posts, not narrator)
  const {
    lockId,
    isLocked: hasCharacterLock,
    remainingSeconds,
    acquireLock,
    releaseLock,
    updateHiddenStatus,
    isLoading: lockLoading,
  } = useComposeLock({
    sceneId,
    characterId: isNarrator ? '' : effectiveCharacterId,
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

  const hasLock = isNarrator ? narratorComposing : hasCharacterLock

  // Draft hook - disable autoLoad when editing to prevent overwriting editingPost content
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
    characterId: effectiveCharacterId,
    autoLoad: !isEditMode,
  })

  // Check if there's any content in blocks
  const hasBlockContent = blocks.some((b) => b.content.trim())

  // Populate fields and acquire lock when entering edit mode
  // Use ref to prevent re-initialization when unstable setters change
  useEffect(() => {
    if (editingPost && editInitializedRef.current !== editingPost.id) {
      // Mark as initialized for this post
      editInitializedRef.current = editingPost.id

      setBlocks(editingPost.blocks || [])
      setOocText(editingPost.oocText || '')
      setIntention(editingPost.intention || null)
      setIsHidden(editingPost.isHidden || false)

      // Auto-acquire lock when entering edit mode (only if not already holding a lock)
      const autoAcquireLock = async () => {
        if (editingPost.characterId && !lockId) {
          // Character post - acquire compose lock
          try {
            await acquireLock(editingPost.isHidden || false)
          } catch {
            // Error is handled by onError callback in useComposeLock
          }
        } else if (!editingPost.characterId && !narratorComposing) {
          // Narrator post - just set composing state
          setNarratorComposing(true)
        }
      }
      autoAcquireLock()
    } else if (!editingPost) {
      // Clear initialization tracking when exiting edit mode
      editInitializedRef.current = null
    }
    // Note: We use editingPost?.id to only re-run when editing a different post
    // Setters are intentionally excluded as they are unstable (change on every render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingPost?.id, acquireLock])

  // Update hidden status when toggle changes
  useEffect(() => {
    if (lockId) {
      updateHiddenStatus(isHidden)
    }
  }, [isHidden, lockId, updateHiddenStatus])

  // Add a new block
  const addBlock = useCallback(
    (type: 'action' | 'dialog') => {
      const newBlock: PostBlock = {
        type,
        content: '',
        order: blocks.length,
      }
      const newBlocks = [...blocks, newBlock]
      setBlocks(newBlocks)
      // Focus the new block after render
      setTimeout(() => {
        const textarea = textareaRefs.current.get(blocks.length)
        textarea?.focus()
      }, 0)
    },
    [blocks, setBlocks]
  )

  // Update a specific block's content
  const updateBlock = useCallback(
    (index: number, content: string) => {
      const newBlocks = blocks.map((block, i) =>
        i === index ? { ...block, content } : block
      )
      setBlocks(newBlocks)
    },
    [blocks, setBlocks]
  )

  // Delete a block
  const deleteBlock = useCallback(
    (index: number) => {
      const newBlocks = blocks
        .filter((_, i) => i !== index)
        .map((block, i) => ({ ...block, order: i }))
      setBlocks(newBlocks)
    },
    [blocks, setBlocks]
  )

  const handleAcquireLock = async () => {
    if (!character && !isNarrator) return

    if (isNarrator) {
      setNarratorComposing(true)
    } else {
      await acquireLock(isHidden)
    }
  }

  const handleReleaseLock = async () => {
    if (isNarrator) {
      setNarratorComposing(false)
    } else {
      await releaseLock()
    }
  }

  const handleSubmit = async () => {
    if (!isNarrator && !lockId) {
      toast({
        variant: 'destructive',
        title: 'No lock',
        description: 'You must have an active compose lock to post.',
      })
      return
    }
    if (!character && !isNarrator) {
      return
    }

    // Validate content - need at least one block with content
    const filledBlocks = blocks.filter((b) => b.content.trim())
    if (filledBlocks.length === 0 && !oocText.trim()) {
      toast({
        variant: 'destructive',
        title: 'Empty post',
        description: 'Please add at least one action or dialog block.',
      })
      return
    }

    setIsSubmitting(true)

    try {
      await createPost(campaignId, {
        sceneId,
        characterId: isNarrator ? null : character!.id,
        blocks: filledBlocks,
        oocText: oocText || undefined,
        intention: intention || undefined,
        isHidden,
      })

      await deleteDraft()
      await handleReleaseLock()

      toast({ title: 'Post created successfully' })
      onPostCreated?.()

      // Reset to empty state
      setBlocks([])
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

  const handleUpdate = async () => {
    if (!editingPost) return

    if (!isNarrator && !lockId) {
      toast({
        variant: 'destructive',
        title: 'No lock',
        description: 'You must have an active compose lock to save changes.',
      })
      return
    }

    // Validate content
    const filledBlocks = blocks.filter((b) => b.content.trim())
    if (filledBlocks.length === 0 && !oocText.trim()) {
      toast({
        variant: 'destructive',
        title: 'Empty post',
        description: 'Please add at least one action or dialog block.',
      })
      return
    }

    setIsSubmitting(true)

    try {
      await updatePost(editingPost.id, {
        blocks: filledBlocks,
        oocText: oocText || undefined,
        intention: intention || undefined,
      })

      await handleReleaseLock()

      toast({ title: 'Post updated successfully' })
      editInitializedRef.current = null
      onEditComplete?.()

      // Reset state
      setBlocks([])
      setOocText('')
      setMode('narrative')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to update post',
        description: (error as Error).message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelEdit = async () => {
    editInitializedRef.current = null
    await handleReleaseLock()
    onEditCancel?.()
    // Reset state
    setBlocks([])
    setOocText('')
    setMode('narrative')
  }

  const handleDeletePost = async () => {
    if (!editingPost) return

    setIsDeleting(true)

    try {
      await deletePost(editingPost.id)
      await handleReleaseLock()

      toast({ title: 'Post deleted successfully' })
      setShowDeleteConfirm(false)
      onPostDeleted?.()

      // Reset state
      setBlocks([])
      setOocText('')
      setMode('narrative')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to delete post',
        description: (error as Error).message,
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Can delete if: GM (always), or owner of unlocked post
  const canDelete = isEditMode && (isGM || (editingPost && !editingPost.isLocked))

  // If no character is selected and not narrator mode, show minimal UI
  if (!character && !isNarrator) {
    return (
      <div className="fixed bottom-0 left-0 right-0 p-4 z-40">
        <div className="max-w-5xl mx-auto">
          <div className="bg-card rounded-sm px-4 py-3 text-center">
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
        <div className="max-w-5xl mx-auto">
          <div className="bg-card rounded-sm px-4 py-3">
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
      <div className="max-w-5xl mx-auto">
        <div className="bg-card rounded-sm overflow-hidden">
          {/* Lock timer bar (not shown for narrator mode) */}
          {hasLock && !isNarrator && remainingSeconds > 0 && (
            <LockTimerBar
              timeRemaining={remainingSeconds}
              totalTime={600}
            />
          )}

          {!hasLock ? (
            // Not locked - show acquire button
            <div className="p-4 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {isEditMode ? 'Editing post' : `Ready to write as ${displayName}`}
              </span>
              <div className="flex items-center gap-2">
                {isEditMode && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                )}
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
                      {isEditMode ? 'Edit Post' : 'Take Post'}
                    </>
                  )}
                </Button>
              </div>
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
                  <TabsList className="bg-secondary/30 h-8">
                    <TabsTrigger value="narrative" className="text-xs h-7">
                      Narrative
                    </TabsTrigger>
                    <TabsTrigger value="ooc" className="text-xs h-7">
                      OOC
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Content area */}
              <div className="p-4 pt-2">
                {mode === 'narrative' ? (
                  // Narrative mode - show blocks
                  <div className="space-y-2">
                    {blocks.length === 0 ? (
                      // Empty state - prompt to add block
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        Add an action or dialog block to begin
                      </div>
                    ) : (
                      // Render blocks
                      blocks.map((block, index) => (
                        <div
                          key={index}
                          className="flex items-start gap-2 group"
                        >
                          {/* Block type icon */}
                          <div className="flex-shrink-0 mt-2">
                            {block.type === 'action' ? (
                              <Swords className="h-4 w-4 text-amber-500" />
                            ) : (
                              <Quote className="h-4 w-4 text-blue-400" />
                            )}
                          </div>
                          {/* Block textarea */}
                          <Textarea
                            ref={(el) => {
                              if (el) {
                                textareaRefs.current.set(index, el)
                              } else {
                                textareaRefs.current.delete(index)
                              }
                            }}
                            placeholder={
                              block.type === 'action'
                                ? 'Describe what you do...'
                                : 'Say something...'
                            }
                            value={block.content}
                            onChange={(e) => updateBlock(index, e.target.value)}
                            className="flex-1 min-h-[60px] bg-secondary/30 border-border/50 resize-none text-sm"
                          />
                          {/* Delete button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="flex-shrink-0 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => deleteBlock(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  // OOC mode - simple textarea
                  <Textarea
                    placeholder="Out of character message..."
                    value={oocText}
                    onChange={(e) => setOocText(e.target.value)}
                    className="min-h-[80px] bg-transparent border-0 resize-none focus-visible:ring-0 p-0"
                  />
                )}
              </div>

              {/* Intention selector (only in narrative mode with intentions configured) */}
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
                {/* Add block buttons (only in narrative mode) */}
                <div className="flex gap-1">
                  {mode === 'narrative' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => addBlock('action')}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        <Swords className="h-4 w-4 mr-1" />
                        Action
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => addBlock('dialog')}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        <Quote className="h-4 w-4 mr-1" />
                        Dialog
                      </Button>
                    </>
                  )}
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

                {/* Release/Cancel/Delete and Submit/Save */}
                <div className="flex items-center gap-2">
                  {isEditMode ? (
                    <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={handleReleaseLock}>
                      <Unlock className="h-4 w-4 mr-1" />
                      Release
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={isEditMode ? handleUpdate : handleSubmit}
                    disabled={
                      (mode === 'narrative' && !hasBlockContent) ||
                      (mode === 'ooc' && !oocText.trim()) ||
                      isSubmitting
                    }
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        {isEditMode ? 'Save Changes' : 'Post'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The post will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePost}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
