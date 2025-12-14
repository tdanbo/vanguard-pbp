import { Card, CardContent } from "@/components/ui/card"
import { NewBadge } from "@/components/ui/game-badges"
import { Badge } from "@/components/ui/badge"
import { MessageSquare, Archive, Users } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"

interface SceneCardProps {
  scene: {
    id: string
    title: string
    description?: string | null
    header_image_url?: string | null
    post_count?: number
    character_ids: string[]
    is_archived?: boolean
  }
  campaignId: string
  hasUnread?: boolean
  className?: string
}

/**
 * SceneCard - Grid card for scene display
 * Features:
 * - Header image or gradient fallback
 * - Scene title with font-display
 * - Post count and character count
 * - NEW badge for unread content
 * - Interactive hover effect (lift + gold border)
 */
export function SceneCard({
  scene,
  campaignId,
  hasUnread = false,
  className,
}: SceneCardProps) {
  const navigate = useNavigate()
  const isArchived = scene.is_archived

  return (
    <Card
      className={cn(
        "overflow-hidden",
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
          {hasUnread && <NewBadge />}
          {isArchived && (
            <Badge variant="secondary" className="gap-1">
              <Archive className="h-3 w-3" />
              Archived
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <CardContent className="p-4">
        <h3 className="font-display text-lg font-semibold mb-1 line-clamp-1">
          {scene.title}
        </h3>
        {scene.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {scene.description}
          </p>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            <span>
              {scene.post_count ?? 0}{" "}
              {(scene.post_count ?? 0) === 1 ? "post" : "posts"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>
              {scene.character_ids.length}{" "}
              {scene.character_ids.length === 1 ? "character" : "characters"}
            </span>
          </div>
        </div>
      </CardContent>
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
}

export function SceneCardsGrid({
  scenes,
  campaignId,
  className,
}: SceneCardsGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6",
        className
      )}
    >
      {scenes.map((scene) => (
        <SceneCard key={scene.id} scene={scene} campaignId={campaignId} />
      ))}
    </div>
  )
}

export default SceneCard
