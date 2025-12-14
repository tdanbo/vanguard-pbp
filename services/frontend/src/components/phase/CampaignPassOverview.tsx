import { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Check, Lock, Users, CheckCircle2 } from 'lucide-react'
import { useCampaignStore } from '@/stores/campaignStore'
import type { PassState } from '@/types'
import { cn } from '@/lib/utils'

interface CampaignPassOverviewProps {
  campaignId: string
  isPCPhase: boolean
  className?: string
}

export function CampaignPassOverview({
  campaignId,
  isPCPhase,
  className,
}: CampaignPassOverviewProps) {
  const { passSummary, fetchPassSummary } = useCampaignStore()

  useEffect(() => {
    if (isPCPhase) {
      fetchPassSummary(campaignId)
    }
  }, [campaignId, isPCPhase, fetchPassSummary])

  if (!isPCPhase || !passSummary) {
    return null
  }

  const progressPercent = passSummary.totalCount > 0
    ? (passSummary.passedCount / passSummary.totalCount) * 100
    : 0

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Pass Status
          </CardTitle>
          {passSummary.allPassed && (
            <Badge variant="default" className="gap-1 bg-green-600">
              <CheckCircle2 className="h-3 w-3" />
              All Passed
            </Badge>
          )}
        </div>
        <CardDescription>
          {passSummary.passedCount} of {passSummary.totalCount} characters have passed
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={progressPercent} className="h-2" />

        {passSummary.characters.length > 0 && (
          <div className="space-y-2">
            {passSummary.characters.map((char) => (
              <CharacterPassRow
                key={char.characterId}
                characterName={char.characterName}
                sceneTitle={char.sceneTitle}
                passState={char.passState}
              />
            ))}
          </div>
        )}

        {passSummary.characters.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No characters assigned to scenes yet.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

interface CharacterPassRowProps {
  characterName: string
  sceneTitle: string
  passState: PassState
}

function CharacterPassRow({ characterName, sceneTitle, passState }: CharacterPassRowProps) {
  const isPassed = passState === 'passed' || passState === 'hard_passed'

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border p-2',
        isPassed ? 'bg-muted/50' : 'bg-background'
      )}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">{characterName}</span>
        <span className="text-xs text-muted-foreground">{sceneTitle}</span>
      </div>
      <PassStateBadge state={passState} />
    </div>
  )
}

function PassStateBadge({ state }: { state: PassState }) {
  switch (state) {
    case 'hard_passed':
      return (
        <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
          <Lock className="h-3 w-3" />
          Hard Pass
        </Badge>
      )
    case 'passed':
      return (
        <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          <Check className="h-3 w-3" />
          Passed
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          Waiting
        </Badge>
      )
  }
}
