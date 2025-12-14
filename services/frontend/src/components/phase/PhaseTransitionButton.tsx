import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ArrowRight, AlertTriangle, Loader2 } from 'lucide-react'
import { useCampaignStore } from '@/stores/campaignStore'
import { useToast } from '@/hooks/use-toast'
import type { PhaseStatus, CampaignPhase } from '@/types'
import { cn } from '@/lib/utils'

interface PhaseTransitionButtonProps {
  campaignId: string
  phaseStatus: PhaseStatus
  isGM: boolean
  className?: string
}

export function PhaseTransitionButton({
  campaignId,
  phaseStatus,
  isGM,
  className,
}: PhaseTransitionButtonProps) {
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [showForceDialog, setShowForceDialog] = useState(false)
  const { transitionPhase, forceTransitionPhase } = useCampaignStore()
  const { toast } = useToast()

  if (!isGM) return null

  const isGMPhase = phaseStatus.currentPhase === 'gm_phase'
  const targetPhase: CampaignPhase = isGMPhase ? 'pc_phase' : 'gm_phase'
  const targetLabel = isGMPhase ? 'PC Phase' : 'GM Phase'

  const handleTransition = async () => {
    setIsTransitioning(true)
    try {
      await transitionPhase(campaignId, targetPhase)
      toast({
        title: 'Phase transitioned',
        description: `Campaign is now in ${targetLabel}`,
      })
    } catch (error) {
      toast({
        title: 'Transition failed',
        description: (error as Error).message,
        variant: 'destructive',
      })
    } finally {
      setIsTransitioning(false)
    }
  }

  const handleForceTransition = async () => {
    setIsTransitioning(true)
    try {
      await forceTransitionPhase(campaignId, targetPhase)
      toast({
        title: 'Phase force transitioned',
        description: `Campaign is now in ${targetLabel}`,
      })
      setShowForceDialog(false)
    } catch (error) {
      toast({
        title: 'Force transition failed',
        description: (error as Error).message,
        variant: 'destructive',
      })
    } finally {
      setIsTransitioning(false)
    }
  }

  // Show blocked state with option to force
  if (!phaseStatus.canTransition && phaseStatus.transitionBlock) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Button variant="outline" disabled className="gap-2">
          <ArrowRight className="h-4 w-4" />
          Go to {targetLabel}
        </Button>
        <p className="text-xs text-muted-foreground">
          Blocked: {phaseStatus.transitionBlock}
        </p>
        <AlertDialog open={showForceDialog} onOpenChange={setShowForceDialog}>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1 text-amber-600">
              <AlertTriangle className="h-3 w-3" />
              Force Transition
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Force Phase Transition?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  You are about to force a phase transition while the following condition is active:
                </p>
                <p className="font-medium text-amber-600">
                  {phaseStatus.transitionBlock}
                </p>
                <p>
                  This may interrupt players who are currently composing posts or have pending actions.
                  Are you sure you want to proceed?
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleForceTransition}
                className="bg-amber-600 hover:bg-amber-700"
                disabled={isTransitioning}
              >
                {isTransitioning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transitioning...
                  </>
                ) : (
                  'Force Transition'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  // Normal transition button
  return (
    <Button
      onClick={handleTransition}
      disabled={isTransitioning || phaseStatus.isPaused}
      className={cn('gap-2', className)}
    >
      {isTransitioning ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Transitioning...
        </>
      ) : (
        <>
          <ArrowRight className="h-4 w-4" />
          Go to {targetLabel}
        </>
      )}
    </Button>
  )
}
