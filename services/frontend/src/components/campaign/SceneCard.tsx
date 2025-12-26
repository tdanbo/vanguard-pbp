import { Card, CardContent } from "@/components/ui/card"
import { NewBadge } from "@/components/ui/game-badges"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Archive } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { CharacterAssignmentWidget } from "@/components/scene/CharacterAssignmentWidget"
import { CharacterBubble } from "@/components/character/CharacterBubble"
import { AddBubble } from "@/components/character/AddBubble"
import { SceneSettingsMenu } from "@/components/scene/SceneSettingsMenu"
import { useCampaignStore } from "@/stores/campaignStore"
import { useMemo, useState } from "react"
import type { CampaignPhase, PassState, Character } from "@/types"

interface SceneCardProps {
  scene: {
    id: string
    title: string
    description?: string | null
    header_image_url?: string | null
    post_count?: number
    character_ids: string[]
    pass_states?: Record<string, PassState>
    is_archived?: boolean
  }
  campaignId: string
  hasUnread?: boolean
  className?: string
  isGM?: boolean
  phase?: CampaignPhase | 'paused'
}

/**
 * SceneCard - Grid card for scene display
 * Features:
 * - Header image or gradient fallback
 * - Scene title with font-display
 * - Character portraits with pass state indicators
 * - Post count
 * - NEW badge for unread content
 * - Interactive hover effect (lift + gold border)
 */
export function SceneCard({
  scene,
  campaignId,
  hasUnread = false,
  className,
  isGM = false,
  phase,
}: SceneCardProps) {
  const navigate = useNavigate()
  const { characters } = useCampaignStore()
  const [assignmentWidgetOpen, setAssignmentWidgetOpen] = useState(false)
  const isArchived = scene.is_archived

  // Get character data for this scene's character IDs
  const sceneCharacters = useMemo(() => {
    return scene.character_ids
      .map(id => characters.find(c => c.id === id))
      .filter(Boolean) as Character[]
  }, [scene.character_ids, characters])

  // Filter to only PCs for the party display
  const pcCharacters = useMemo(() => {
    return sceneCharacters.filter(c => c.character_type === 'pc')
  }, [sceneCharacters])

  return (
    <Card className={cn(
      "bg-card/50 rounded-sm overflow-hidden p-1",
      className
    )}>
      <div className={cn(
        "bg-card rounded-sm overflow-hidden flex flex-col h-full",
        isArchived
          ? "opacity-60 cursor-default"
          : "card-interactive cursor-pointer",
      )}
      onClick={
        isArchived
          ? undefined
          : () => navigate(`/campaigns/${campaignId}/scenes/${scene.id}`)
      }
      >
      {/* Image or gradient header */}
      <div className="aspect-video relative">
        {scene.header_image_url ? (
          <img
            src={scene.header_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full scene-atmosphere" />
        )}
        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 scene-gradient" />

        {/* Badges container */}
        <div className="absolute top-3 right-3 flex gap-2">
          {isGM && phase === 'gm_phase' && (
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <CharacterAssignmentWidget
                campaignId={campaignId}
                sceneId={scene.id}
                sceneCharacterIds={scene.character_ids}
              />
            </div>
          )}
          {hasUnread && <NewBadge />}
          {isArchived && (
            <Badge variant="secondary" className="gap-1">
              <Archive className="h-3 w-3" />
              Archived
            </Badge>
          )}
        </div>
      </div>

      {/* Content - Flex layout with fixed footer */}
      <CardContent className="p-4 flex flex-col h-full">
        {/* Top section - flexible height */}
        <div className="flex-1 min-h-0">
          <h3 className="font-display text-lg font-semibold mb-1 line-clamp-1">
            {scene.title}
          </h3>
          {scene.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {scene.description}
            </p>
          )}
        </div>

        {/* Character Portraits with Pass State (PC Phase) */}
        {phase === 'pc_phase' && pcCharacters.length > 0 && (
          <div className="my-3 py-3 border-t border-b">
            <div className="flex items-center gap-2 flex-wrap">
              {pcCharacters.map(char => {
                const passState = scene.pass_states?.[char.id] ?? 'none'

                return (
                  <CharacterBubble
                    key={char.id}
                    character={{
                      id: char.id,
                      displayName: char.display_name,
                      avatarUrl: char.avatar_url,
                      passState: passState,
                    }}
                    size="sm"
                    showName={false}
                  />
                )
              })}
              {isGM && (
                <AddBubble
                  onClick={(e) => {
                    e.stopPropagation()
                    setAssignmentWidgetOpen(true)
                  }}
                  label="Add character"
                  size="sm"
                />
              )}
            </div>
          </div>
        )}

        {/* Bottom section - fixed position */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            <span>
              {scene.post_count ?? 0}{" "}
              {(scene.post_count ?? 0) === 1 ? "post" : "posts"}
            </span>
          </div>
          {isGM && (
            <div
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <SceneSettingsMenu
                campaignId={campaignId}
                sceneId={scene.id}
                sceneTitle={scene.title}
                isArchived={isArchived ?? false}
              />
            </div>
          )}
        </div>
      </CardContent>
    </div>

    {/* Character assignment modal (controlled) */}
    {isGM && (
      <CharacterAssignmentWidget
        campaignId={campaignId}
        sceneId={scene.id}
        sceneCharacterIds={scene.character_ids}
        open={assignmentWidgetOpen}
        onOpenChange={setAssignmentWidgetOpen}
        hideTrigger={true}
      />
    )}
  </Card>
  )
}

/**
 * SceneCardCompact - Compact card for denser layouts or lists
 */
interface SceneCardCompactProps {
  scene: {
    id: string
    title: string
    header_image_url?: string | null
    post_count?: number
    is_archived?: boolean
  }
  campaignId: string
  hasUnread?: boolean
  className?: string
}

export function SceneCardCompact({
  scene,
  campaignId,
  hasUnread = false,
  className,
}: SceneCardCompactProps) {
  const navigate = useNavigate()
  const isArchived = scene.is_archived

  return (
    <Card
      className={cn(
        isArchived
          ? "opacity-60 cursor-default"
          : "card-interactive cursor-pointer",
        className
      )}
      onClick={
        isArchived
          ? undefined
          : () => navigate(`/campaigns/${campaignId}/scenes/${scene.id}`)
      }
    >
      <CardContent className="p-4 flex gap-4">
        {/* Small thumbnail */}
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
          {scene.header_image_url ? (
            <img
              src={scene.header_image_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full scene-atmosphere" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-display font-semibold truncate">{scene.title}</h3>
            {hasUnread && <NewBadge />}
          </div>
          <p className="text-sm text-muted-foreground">
            {scene.post_count ?? 0} posts
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * SceneCardsGrid - Responsive grid layout for scene cards
 */
interface SceneCardsGridProps {
  scenes: SceneCardProps["scene"][]
  campaignId: string
  className?: string
  isGM?: boolean
  phase?: CampaignPhase | 'paused'
}

export function SceneCardsGrid({
  scenes,
  campaignId,
  className,
  isGM,
  phase,
}: SceneCardsGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6",
        className
      )}
    >
      {scenes.map((scene) => (
        <SceneCard
          key={scene.id}
          scene={scene}
          campaignId={campaignId}
          isGM={isGM}
          phase={phase}
        />
      ))}
    </div>
  )
}

export default SceneCard
