import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
import { Dices, Edit, Check, X, Loader2, AlertTriangle } from 'lucide-react'
import { useRollStore } from '@/stores/rollStore'
import { useToast } from '@/hooks/use-toast'
import type { UnresolvedRoll } from '@/types'

interface RollCardProps {
  roll: UnresolvedRoll
  intentions: string[]
  isGM: boolean
}

export function RollCard({ roll, intentions, isGM }: RollCardProps) {
  const { toast } = useToast()
  const { overrideIntention, manuallyResolve, invalidateRoll, loadingRolls } = useRollStore()

  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false)
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false)
  const [newIntention, setNewIntention] = useState(roll.intention)
  const [overrideReason, setOverrideReason] = useState('')
  const [manualResult, setManualResult] = useState<number>(0)
  const [resolveReason, setResolveReason] = useState('')

  const handleOverride = async () => {
    if (!newIntention || !overrideReason.trim()) {
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
      setOverrideDialogOpen(false)
      setOverrideReason('')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to override',
        description: (error as Error).message,
      })
    }
  }

  const handleResolve = async () => {
    if (!resolveReason.trim()) {
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
      setResolveDialogOpen(false)
      setResolveReason('')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to resolve',
        description: (error as Error).message,
      })
    }
  }

  const handleInvalidate = async () => {
    try {
      await invalidateRoll(roll.id)
      toast({ title: 'Roll invalidated' })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to invalidate',
        description: (error as Error).message,
      })
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dices className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{roll.characterName}</span>
          </div>
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            Pending
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{roll.intention}</p>
            <p className="text-sm text-muted-foreground">{roll.sceneTitle}</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            {roll.diceCount}{roll.diceType}
            {roll.modifier !== 0 && (
              <span className={roll.modifier > 0 ? 'text-green-600' : 'text-red-600'}>
                {roll.modifier > 0 ? '+' : ''}{roll.modifier}
              </span>
            )}
          </div>
        </div>

        {roll.wasOverridden && (
          <div className="flex items-center gap-2 text-xs text-amber-500">
            <AlertTriangle className="h-3 w-3" />
            Intention was overridden (original: {roll.originalIntention})
          </div>
        )}
      </CardContent>

      {isGM && (
        <CardFooter className="flex justify-end gap-2">
          {/* Override Intention Dialog */}
          <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-1" />
                Override
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Override Roll Intention</DialogTitle>
                <DialogDescription>
                  Change the intention for this roll. The original intention will be preserved for reference.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>New Intention</Label>
                  <Select value={newIntention} onValueChange={setNewIntention}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {intentions.map((intention) => (
                        <SelectItem key={intention} value={intention}>
                          {intention}
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOverrideDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleOverride} disabled={loadingRolls}>
                  {loadingRolls && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Override
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Manual Resolve Dialog */}
          <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Check className="h-4 w-4 mr-1" />
                Resolve
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Manually Resolve Roll</DialogTitle>
                <DialogDescription>
                  Set a specific result for this roll instead of letting it roll automatically.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleResolve} disabled={loadingRolls}>
                  {loadingRolls && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Resolve
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Invalidate Button */}
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
        </CardFooter>
      )}
    </Card>
  )
}
