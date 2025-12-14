import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dices, AlertCircle } from 'lucide-react'
import { RollCard } from './RollCard'
import { useRollStore } from '@/stores/rollStore'
import type { SystemPreset } from '@/types'

interface UnresolvedRollsDashboardProps {
  campaignId: string
  systemPreset: SystemPreset
  isGM: boolean
}

export function UnresolvedRollsDashboard({
  campaignId,
  systemPreset,
  isGM,
}: UnresolvedRollsDashboardProps) {
  const {
    unresolvedRolls,
    loadingUnresolvedRolls,
    error,
    getUnresolvedRollsInCampaign,
  } = useRollStore()

  useEffect(() => {
    getUnresolvedRollsInCampaign(campaignId)
  }, [campaignId, getUnresolvedRollsInCampaign])

  if (loadingUnresolvedRolls) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dices className="h-5 w-5" />
            Pending Rolls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dices className="h-5 w-5" />
            Pending Rolls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>Failed to load pending rolls</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Dices className="h-5 w-5" />
            Pending Rolls
          </CardTitle>
          {unresolvedRolls.length > 0 && (
            <Badge variant="secondary">{unresolvedRolls.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {unresolvedRolls.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No pending rolls
          </p>
        ) : (
          <div className="space-y-4">
            {unresolvedRolls.map((roll) => (
              <RollCard
                key={roll.id}
                roll={roll}
                intentions={systemPreset.intentions}
                isGM={isGM}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
