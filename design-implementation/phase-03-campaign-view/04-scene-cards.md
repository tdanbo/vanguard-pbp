# 3.4 Scene Cards

**Skill**: `shadcn-react`

## Goal

Create scene cards with images, hover effects, and status indicators.

---

## Design References

- [06-campaign-view.md](../../product-design-system/06-campaign-view.md) - Lines 140-218 for scene card specs

---

## Overview

Scene cards display:
- Header image (or gradient fallback)
- Scene title
- Post count and status
- NEW badge for unread content
- Interactive hover effect

---

## Implementation

### SceneCard Component

Create `src/components/campaign/SceneCard.tsx`:

```tsx
import { Card, CardContent } from "@/components/ui/card"
import { NewBadge } from "@/components/ui/game-badges"
import { MessageSquare } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"

interface SceneCardProps {
  scene: {
    id: string
    title: string
    description?: string
    headerImageUrl?: string | null
    postCount: number
    hasUnread?: boolean
  }
  campaignId: string
}

export function SceneCard({ scene, campaignId }: SceneCardProps) {
  const navigate = useNavigate()

  return (
    <Card
      className="card-interactive cursor-pointer overflow-hidden"
      onClick={() => navigate(`/campaigns/${campaignId}/scenes/${scene.id}`)}
    >
      {/* Image or gradient header */}
      <div className="aspect-video relative">
        {scene.headerImageUrl ? (
          <img
            src={scene.headerImageUrl}
            alt={scene.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full scene-atmosphere" />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 scene-gradient" />

        {/* Unread badge */}
        {scene.hasUnread && (
          <div className="absolute top-3 right-3">
            <NewBadge />
          </div>
        )}
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          <span>
            {scene.postCount} {scene.postCount === 1 ? "post" : "posts"}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Scene Cards Grid

```tsx
import { SceneCard } from "@/components/campaign/SceneCard"

function ScenesGrid({ scenes, campaignId }: ScenesGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {scenes.map((scene) => (
        <SceneCard
          key={scene.id}
          scene={scene}
          campaignId={campaignId}
        />
      ))}
    </div>
  )
}
```

---

## Compact Scene Card (Alternative)

For denser layouts:

```tsx
export function SceneCardCompact({ scene, campaignId }: SceneCardProps) {
  return (
    <Card
      className="card-interactive cursor-pointer"
      onClick={() => navigate(`/campaigns/${campaignId}/scenes/${scene.id}`)}
    >
      <CardContent className="p-4 flex gap-4">
        {/* Small thumbnail */}
        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
          {scene.headerImageUrl ? (
            <img
              src={scene.headerImageUrl}
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
            <h3 className="font-display font-semibold truncate">
              {scene.title}
            </h3>
            {scene.hasUnread && <NewBadge />}
          </div>
          <p className="text-sm text-muted-foreground">
            {scene.postCount} posts
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## Hover Effect Details

The `card-interactive` class provides:

```css
.card-interactive {
  @apply transition-all duration-200;
}
.card-interactive:hover {
  @apply -translate-y-0.5;
  border-color: hsl(var(--gold-dim));
  box-shadow: 0 10px 15px rgba(0, 0, 0, 0.5);
}
```

---

## Scene Card States

| State | Visual Treatment |
|-------|------------------|
| Default | Standard card styling |
| Unread | NEW badge in corner |
| Hovered | Lift, gold border, shadow |
| Archived | Lower opacity, no hover |

### Archived Scene Card

```tsx
<Card
  className={cn(
    "overflow-hidden",
    scene.isArchived
      ? "opacity-60 cursor-default"
      : "card-interactive cursor-pointer"
  )}
  onClick={scene.isArchived ? undefined : handleClick}
>
  {/* ... */}
</Card>
```

---

## Success Criteria

- [ ] Scene cards display image or gradient fallback
- [ ] Title uses font-display
- [ ] Post count displays with icon
- [ ] NEW badge shows for unread scenes
- [ ] Hover lifts card with gold border
- [ ] Grid is responsive (1/2/3 columns)
- [ ] Cards navigate to scene view on click
