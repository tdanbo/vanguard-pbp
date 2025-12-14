# 2.5 Empty State

**Skill**: `shadcn-react`

## Goal

Create a thematic EmptyState component for lists and content areas with no data.

---

## Design References

- [07-components.md](../../product-design-system/07-components.md) - Lines 587-622 for empty state patterns

---

## Overview

Empty states should feel thematic, not generic. Instead of "No data found", use language that fits the RPG context:

| Context | Generic | Thematic |
|---------|---------|----------|
| No campaigns | "No campaigns" | "Your adventure awaits. Create your first campaign." |
| No scenes | "No scenes" | "The stage is empty. Set the scene for your players." |
| No characters | "No characters" | "No heroes have joined yet." |
| No posts | "No posts" | "The story has not yet begun." |

---

## EmptyState Component

### Create Component File

Create `src/components/ui/EmptyState.tsx`:

```tsx
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      <div className="rounded-full bg-secondary p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="font-display text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
```

---

## Usage Examples

### No Campaigns

```tsx
import { EmptyState } from "@/components/ui/EmptyState"
import { Scroll } from "lucide-react"

<EmptyState
  icon={Scroll}
  title="Your adventure awaits"
  description="Create your first campaign to begin your journey into collaborative storytelling."
  action={{
    label: "Create Campaign",
    onClick: () => setCreateDialogOpen(true),
  }}
/>
```

### No Scenes

```tsx
import { BookOpen } from "lucide-react"

<EmptyState
  icon={BookOpen}
  title="The stage is empty"
  description="Set the scene for your players. Create locations and situations for them to explore."
  action={{
    label: "Create Scene",
    onClick: () => setCreateSceneOpen(true),
  }}
/>
```

### No Characters

```tsx
import { Users } from "lucide-react"

<EmptyState
  icon={Users}
  title="No heroes have joined"
  description="Create characters for your campaign or wait for players to create their own."
  action={{
    label: "Create Character",
    onClick: () => setCreateCharacterOpen(true),
  }}
/>
```

### No Posts (Scene View)

```tsx
import { MessageSquare } from "lucide-react"

<EmptyState
  icon={MessageSquare}
  title="The story has not yet begun"
  description="Be the first to write. Your words will set the tale in motion."
/>
```

### No Notifications

```tsx
import { Bell } from "lucide-react"

<EmptyState
  icon={Bell}
  title="All caught up"
  description="You have no new notifications. Check back after your party has been active."
/>
```

### No Search Results

```tsx
import { Search } from "lucide-react"

<EmptyState
  icon={Search}
  title="No matches found"
  description="Try adjusting your search terms or filters."
/>
```

---

## EmptyState Variants

### Compact Variant

For smaller areas like sidebars:

```tsx
interface EmptyStateProps {
  // ... existing props
  variant?: "default" | "compact"
}

// In component:
const isCompact = variant === "compact"

return (
  <div className={cn(
    "flex flex-col items-center justify-center text-center",
    isCompact ? "py-8 px-2" : "py-16 px-4",
    className
  )}>
    <div className={cn(
      "rounded-full bg-secondary mb-3",
      isCompact ? "p-2" : "p-4"
    )}>
      <Icon className={cn(
        "text-muted-foreground",
        isCompact ? "h-5 w-5" : "h-8 w-8"
      )} />
    </div>
    <h3 className={cn(
      "font-display font-semibold mb-1",
      isCompact ? "text-base" : "text-xl"
    )}>{title}</h3>
    <p className={cn(
      "text-muted-foreground",
      isCompact ? "text-sm" : "text-base",
      "max-w-sm mb-4"
    )}>{description}</p>
    {action && (
      <Button size={isCompact ? "sm" : "default"} onClick={action.onClick}>
        {action.label}
      </Button>
    )}
  </div>
)
```

### Immersive Variant

For scene view with transparent background:

```tsx
<EmptyState
  icon={MessageSquare}
  title="The story has not yet begun"
  description="Be the first to write."
  className="bg-panel backdrop-blur-sm rounded-lg"
/>
```

---

## Thematic Message Guide

| Area | Title | Description |
|------|-------|-------------|
| Campaigns (player) | "Your adventure awaits" | "Join a campaign or create your own..." |
| Campaigns (GM) | "Begin your tale" | "Create your first campaign..." |
| Scenes | "The stage is empty" | "Set the scene for your players..." |
| Characters | "No heroes have joined" | "Create characters or invite players..." |
| Posts | "The story has not yet begun" | "Be the first to write..." |
| Members | "Gathering the party" | "Invite players to join your campaign..." |
| Notifications | "All caught up" | "No new notifications..." |
| Bookmarks | "Nothing saved yet" | "Bookmark important moments..." |
| Search | "No matches found" | "Try different search terms..." |

---

## Success Criteria

- [ ] EmptyState component created
- [ ] Uses font-display for title
- [ ] Icon in circular muted background
- [ ] Optional action button
- [ ] Compact variant for sidebars
- [ ] All empty states use thematic messaging
- [ ] Immersive variant works over scene backgrounds
