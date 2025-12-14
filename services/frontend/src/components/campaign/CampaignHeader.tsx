import { Button } from "@/components/ui/button"
import { PhaseBadge, RoleBadge } from "@/components/ui/game-badges"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, BookOpen, Users, Pause } from "lucide-react"
import { useNavigate } from "react-router-dom"
import type { CampaignPhase } from "@/types"

interface CampaignHeaderProps {
  campaign: {
    id: string
    title: string
    description?: string | null
    current_phase: CampaignPhase
    is_paused: boolean
    scene_count: number
  }
  memberCount: number
  isGM: boolean
  backTo?: string
  backLabel?: string
}

export function CampaignHeader({
  campaign,
  memberCount,
  isGM,
  backTo = "/",
  backLabel = "Back to Campaigns",
}: CampaignHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="mb-8">
      {/* Back navigation */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        onClick={() => navigate(backTo)}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {backLabel}
      </Button>

      {/* Title row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
          {campaign.title}
        </h1>
        <RoleBadge isGM={isGM} size="md" />
        {campaign.is_paused ? (
          <Badge variant="secondary" className="gap-1">
            <Pause className="h-3 w-3" />
            Paused
          </Badge>
        ) : (
          <PhaseBadge phase={campaign.current_phase} />
        )}
      </div>

      {/* Description (if present) */}
      {campaign.description && (
        <p className="text-muted-foreground mb-4 max-w-2xl">
          {campaign.description}
        </p>
      )}

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-4 md:gap-6 text-muted-foreground">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          <span className="text-sm">
            {campaign.scene_count} {campaign.scene_count === 1 ? "scene" : "scenes"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span className="text-sm">
            {memberCount} {memberCount === 1 ? "player" : "players"}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * CampaignHeaderCompact - Smaller header for nested pages (settings, etc.)
 */
interface CampaignHeaderCompactProps {
  campaign: {
    id: string
    title: string
    current_phase: CampaignPhase
    is_paused: boolean
  }
  backTo: string
  backLabel?: string
}

export function CampaignHeaderCompact({
  campaign,
  backTo,
  backLabel = "Back to campaign",
}: CampaignHeaderCompactProps) {
  const navigate = useNavigate()

  return (
    <div className="mb-8">
      {/* Back navigation */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        onClick={() => navigate(backTo)}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        {backLabel}
      </Button>

      {/* Title row */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
          {campaign.title}
        </h1>
        {campaign.is_paused ? (
          <Badge variant="secondary" className="gap-1">
            <Pause className="h-3 w-3" />
            Paused
          </Badge>
        ) : (
          <PhaseBadge phase={campaign.current_phase} size="sm" />
        )}
      </div>
    </div>
  )
}

export default CampaignHeader
