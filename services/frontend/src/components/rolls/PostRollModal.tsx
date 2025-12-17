import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dices,
  Lock,
  Loader2,
  Edit,
  Check,
  X,
  AlertTriangle,
} from 'lucide-react'
import { useRollStore } from '@/stores/rollStore'
import { useToast } from '@/hooks/use-toast'
import { RollDisplay } from './RollDisplay'
import type { Post, Roll, SystemPreset } from '@/types'

interface PostRollModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  post: Post
  roll?: Roll | null
  isOwner: boolean
  isGM: boolean
  systemPreset: SystemPreset
  sceneId: string
  onRollCompleted?: () => void
}

export function PostRollModal({
  open,
  onOpenChange,
  post,
  roll,
  isOwner,
  isGM,
  systemPreset,
  sceneId,
  onRollCompleted,
}: PostRollModalProps) {
  const { toast } = useToast()
  const {
    createRoll,
    overrideIntention,
    manuallyResolve,
    invalidateRoll,
    loadingRolls,
  } = useRollStore()

  // Local state for GM actions
  const [showOverrideForm, setShowOverrideForm] = useState(false)
  const [showResolveForm, setShowResolveForm] = useState(false)
  const [newIntention, setNewIntention] = useState(roll?.intention || post.intention || '')
  const [overrideReason, setOverrideReason] = useState('')
  const [manualResult, setManualResult] = useState<number>(0)
  const [resolveReason, setResolveReason] = useState('')

  const intention = roll?.intention || post.intention
  const status = roll?.status || 'pending'
  const isPending = status === 'pending'
  const isCompleted = status === 'completed'
  const isInvalidated = status === 'invalidated'

  // Handle executing a roll (creating it if needed)
  const handleExecuteRoll = async () => {
    if (!post.characterId || !intention) return

    try {
      await createRoll({
        postId: post.id,
        sceneId: sceneId,
        characterId: post.characterId,
        intention: intention,
        modifier: post.modifier || 0,
        diceType: systemPreset.diceType,
        diceCount: 1,
      })
      toast({ title: 'Roll executed successfully' })
      onRollCompleted?.()
      onOpenChange(false)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to execute roll',
        description: (error as Error).message,
      })
    }
  }

  // Handle override
  const handleOverride = async () => {
    if (!roll || !newIntention || !overrideReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing fields',
        description: 'Please provide both a new intention and reason.',
      })
      return
    }

    try {
      await overrideIntention(roll.id, {
        newIntention,
        reason: overrideReason,
      })
      toast({ title: 'Intention overridden' })
      setShowOverrideForm(false)
      setOverrideReason('')
      onRollCompleted?.()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to override',
        description: (error as Error).message,
      })
    }
  }

  // Handle manual resolve
  const handleResolve = async () => {
    if (!roll || !resolveReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing reason',
        description: 'Please provide a reason for manual resolution.',
      })
      return
    }

    try {
      await manuallyResolve(roll.id, {
        result: manualResult,
        reason: resolveReason,
      })
      toast({ title: 'Roll resolved manually' })
      setShowResolveForm(false)
      setResolveReason('')
      onRollCompleted?.()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to resolve',
        description: (error as Error).message,
      })
    }
  }

  // Handle invalidate
  const handleInvalidate = async () => {
    if (!roll) return

    try {
      await invalidateRoll(roll.id)
      toast({ title: 'Roll invalidated' })
      onRollCompleted?.()
      onOpenChange(false)
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to invalidate',
        description: (error as Error).message,
      })
    }
  }

  // Render title based on status
  const getTitle = () => {
    if (isCompleted) return 'Roll Result'
    if (isInvalidated) return 'Invalidated Roll'
    return 'Execute Roll'
  }

  // Render description based on status
  const getDescription = () => {
    if (isCompleted) return `${intention} roll completed`
    if (isInvalidated) return `${intention} roll was invalidated`
    return `${intention} roll for ${post.characterName || 'this post'}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dices className="h-5 w-5" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Show roll display if we have a roll */}
          {roll && <RollDisplay roll={roll} compact={false} />}

          {/* No roll yet, show intention and execute button */}
          {!roll && intention && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">{intention}</span>
                <span className="text-sm text-muted-foreground">
                  1{systemPreset.diceType}
                  {post.modifier !== null && post.modifier !== 0 && (
                    <span
                      className={
                        post.modifier > 0 ? 'text-green-600' : 'text-red-600'
                      }
                    >
                      {post.modifier > 0 ? '+' : ''}
                      {post.modifier}
                    </span>
                  )}
                </span>
              </div>
              <Badge
                variant="outline"
                className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
              >
                Pending
              </Badge>
            </div>
          )}

          {/* Completed roll notice */}
          {isCompleted && (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription>
                This roll has been completed. The post is now locked and cannot
                be edited.
              </AlertDescription>
            </Alert>
          )}

          {/* Override form (GM only) */}
          {showOverrideForm && roll && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label>New Intention</Label>
                <Select value={newIntention} onValueChange={setNewIntention}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {systemPreset.intentions.map((intent) => (
                      <SelectItem key={intent} value={intent}>
                        {intent}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why you're overriding this intention..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowOverrideForm(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleOverride} disabled={loadingRolls}>
                  {loadingRolls && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Override
                </Button>
              </div>
            </div>
          )}

          {/* Manual resolve form (GM only) */}
          {showResolveForm && roll && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label>Result Value</Label>
                <Input
                  type="number"
                  value={manualResult}
                  onChange={(e) => setManualResult(parseInt(e.target.value) || 0)}
                  placeholder="Enter the result value"
                />
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={resolveReason}
                  onChange={(e) => setResolveReason(e.target.value)}
                  placeholder="Explain why you're manually resolving this roll..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowResolveForm(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleResolve} disabled={loadingRolls}>
                  {loadingRolls && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Resolve
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Execute button for pending rolls */}
          {isPending && !roll && isOwner && !showOverrideForm && !showResolveForm && (
            <Button
              onClick={handleExecuteRoll}
              disabled={loadingRolls}
              className="w-full sm:w-auto"
            >
              {loadingRolls && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Dices className="h-4 w-4 mr-2" />
              Roll 1{systemPreset.diceType}
              {post.modifier !== null && post.modifier !== 0 && (
                <span>
                  {post.modifier > 0 ? '+' : ''}
                  {post.modifier}
                </span>
              )}
            </Button>
          )}

          {/* GM actions for pending rolls */}
          {isPending && roll && isGM && !showOverrideForm && !showResolveForm && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowOverrideForm(true)}
              >
                <Edit className="h-4 w-4 mr-1" />
                Override
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResolveForm(true)}
              >
                <Check className="h-4 w-4 mr-1" />
                Resolve Manually
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleInvalidate}
                disabled={loadingRolls}
              >
                {loadingRolls ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-1" />
                )}
                Invalidate
              </Button>
            </>
          )}

          {/* GM can invalidate completed rolls too (rare) */}
          {isCompleted && isGM && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleInvalidate}
              disabled={loadingRolls}
            >
              {loadingRolls ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-1" />
              )}
              Invalidate Roll
            </Button>
          )}

          {/* Close button */}
          {(isCompleted || isInvalidated || (!isOwner && !isGM)) && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
