import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dices, Loader2 } from 'lucide-react'
import { IntentionSelector } from './IntentionSelector'
import { useRollStore } from '@/stores/rollStore'
import { useToast } from '@/hooks/use-toast'
import type { SystemPreset } from '@/types'

interface RollFormProps {
  sceneId: string
  characterId: string
  postId?: string
  systemPreset: SystemPreset
  validDiceTypes?: string[]
  onRollCreated?: () => void
  onCancel?: () => void
}

export function RollForm({
  sceneId,
  characterId,
  postId,
  systemPreset,
  validDiceTypes = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'],
  onRollCreated,
  onCancel,
}: RollFormProps) {
  const { toast } = useToast()
  const { createRoll, loadingRolls } = useRollStore()

  const [intention, setIntention] = useState<string | null>(null)
  const [modifier, setModifier] = useState<number>(0)
  const [diceType, setDiceType] = useState<string>(systemPreset.diceType || 'd20')
  const [diceCount, setDiceCount] = useState<number>(1)

  const handleSubmit = async () => {
    if (!intention) {
      toast({
        variant: 'destructive',
        title: 'Intention required',
        description: 'Please select an intention for your roll.',
      })
      return
    }

    try {
      await createRoll({
        sceneId,
        characterId,
        postId,
        intention,
        modifier: modifier !== 0 ? modifier : undefined,
        diceType: diceType !== systemPreset.diceType ? diceType : undefined,
        diceCount: diceCount !== 1 ? diceCount : undefined,
      })

      toast({
        title: 'Roll created',
        description: 'Your dice roll has been initiated.',
      })

      onRollCreated?.()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to create roll',
        description: (error as Error).message,
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dices className="h-5 w-5" />
          Create Dice Roll
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <IntentionSelector
          intentions={systemPreset.intentions}
          value={intention}
          onChange={setIntention}
          disabled={loadingRolls}
          showNoRoll={false}
        />

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Dice Count</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={diceCount}
              onChange={(e) => setDiceCount(parseInt(e.target.value) || 1)}
              disabled={loadingRolls}
            />
          </div>

          <div className="space-y-2">
            <Label>Dice Type</Label>
            <Select
              value={diceType}
              onValueChange={setDiceType}
              disabled={loadingRolls}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {validDiceTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Modifier</Label>
            <Input
              type="number"
              min={-100}
              max={100}
              value={modifier}
              onChange={(e) => setModifier(parseInt(e.target.value) || 0)}
              disabled={loadingRolls}
            />
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Rolling: {diceCount}{diceType}
          {modifier !== 0 && (
            <span className={modifier > 0 ? 'text-green-600' : 'text-red-600'}>
              {modifier > 0 ? '+' : ''}{modifier}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={loadingRolls}>
            Cancel
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={loadingRolls || !intention} className="ml-auto">
          {loadingRolls ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Dices className="mr-2 h-4 w-4" />
          )}
          Roll Dice
        </Button>
      </CardFooter>
    </Card>
  )
}
