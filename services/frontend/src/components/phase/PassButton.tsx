import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Check, ChevronDown, Lock, X, Loader2 } from 'lucide-react'
import { useCampaignStore } from '@/stores/campaignStore'
import { useToast } from '@/hooks/use-toast'
import type { PassState } from '@/types'
import { cn } from '@/lib/utils'

interface PassButtonProps {
  campaignId: string
  sceneId: string
  characterId: string
  currentState: PassState
  characterName: string
  isOwner: boolean
  isGM: boolean
  isPCPhase: boolean
  className?: string
}

export function PassButton({
  campaignId,
  sceneId,
  characterId,
  currentState,
  characterName,
  isOwner,
  isGM,
  isPCPhase,
  className,
}: PassButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { setPass, clearPass } = useCampaignStore()
  const { toast } = useToast()

  // Only allow pass actions during PC phase and by character owner or GM
  const canPass = isPCPhase && (isOwner || isGM)

  if (!canPass) {
    return (
      <PassStateDisplay state={currentState} className={className} />
    )
  }

  const handleSetPass = async (newState: PassState) => {
    setIsLoading(true)
    try {
      if (newState === 'none') {
        await clearPass(campaignId, sceneId, characterId)
        toast({
          title: 'Pass cleared',
          description: `${characterName} is no longer passing`,
        })
      } else {
        await setPass(campaignId, sceneId, characterId, newState)
        toast({
          title: newState === 'hard_passed' ? 'Hard pass set' : 'Pass set',
          description: `${characterName} is now ${newState === 'hard_passed' ? 'hard ' : ''}passing`,
        })
      }
    } catch (error) {
      toast({
        title: 'Failed to update pass',
        description: (error as Error).message,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={currentState === 'none' ? 'outline' : 'secondary'}
          size="sm"
          className={cn('gap-1', className)}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <PassStateIcon state={currentState} />
          )}
          <span className="text-xs">
            {currentState === 'none' ? 'Pass' : currentState === 'hard_passed' ? 'Hard Pass' : 'Passed'}
          </span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleSetPass('none')}
          disabled={currentState === 'none'}
        >
          <X className="mr-2 h-4 w-4" />
          Not Passing
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSetPass('passed')}
          disabled={currentState === 'passed'}
        >
          <Check className="mr-2 h-4 w-4" />
          Pass
          <span className="ml-2 text-xs text-muted-foreground">(cleared on post)</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSetPass('hard_passed')}
          disabled={currentState === 'hard_passed'}
        >
          <Lock className="mr-2 h-4 w-4" />
          Hard Pass
          <span className="ml-2 text-xs text-muted-foreground">(stays until phase end)</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function PassStateIcon({ state }: { state: PassState }) {
  switch (state) {
    case 'passed':
      return <Check className="h-3 w-3" />
    case 'hard_passed':
      return <Lock className="h-3 w-3" />
    default:
      return null
  }
}

function PassStateDisplay({ state, className }: { state: PassState; className?: string }) {
  if (state === 'none') return null

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
        state === 'hard_passed'
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
          : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        className
      )}
    >
      <PassStateIcon state={state} />
      <span>{state === 'hard_passed' ? 'Hard Pass' : 'Passed'}</span>
    </div>
  )
}
