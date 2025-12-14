import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Crown, Users, Pause, Clock } from 'lucide-react'
import type { Campaign } from '@/types'
import { formatDistanceToNow } from 'date-fns'

interface CampaignCardProps {
  campaign: Campaign
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const isGM = campaign.user_role === 'gm'
  const isPaused = campaign.is_paused
  const isGMPhase = campaign.current_phase === 'gm_phase'

  return (
    <Link to={`/campaigns/${campaign.id}`}>
      <Card className="h-full transition-colors hover:bg-accent/50">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-1 text-lg">{campaign.title}</CardTitle>
            <div className="flex shrink-0 gap-1">
              {isGM && (
                <Badge variant="default" className="gap-1">
                  <Crown className="h-3 w-3" />
                  GM
                </Badge>
              )}
              {isPaused && (
                <Badge variant="secondary" className="gap-1">
                  <Pause className="h-3 w-3" />
                  Paused
                </Badge>
              )}
            </div>
          </div>
          <CardDescription className="line-clamp-2">
            {campaign.description || 'No description'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Badge variant={isGMPhase ? 'secondary' : 'default'} className="text-xs">
                {isGMPhase ? 'GM Phase' : 'PC Phase'}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{campaign.scene_count} scenes</span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDistanceToNow(new Date(campaign.updated_at), { addSuffix: true })}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
