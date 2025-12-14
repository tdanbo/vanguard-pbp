# 3.2 Campaign Header

**Skill**: `shadcn-react`

## Goal

Create the campaign header component with title, badges, and statistics.

---

## Design References

- [06-campaign-view.md](../../product-design-system/06-campaign-view.md) - Lines 46-105 for header specs

---

## Overview

The campaign header displays:
- Campaign title (font-display)
- GM badge (if user is GM)
- Phase indicator badge
- Scene and player counts
- Back navigation

---

## Implementation

### CampaignHeader Component

Create or update `src/components/campaign/CampaignHeader.tsx`:

```tsx
import { Button } from "@/components/ui/button"
import { PhaseBadge, RoleBadge } from "@/components/ui/game-badges"
import { ChevronLeft, Users, BookOpen } from "lucide-react"
import { useNavigate } from "react-router-dom"

interface CampaignHeaderProps {
  campaign: {
    id: string
    title: string
    currentPhase: "gm_phase" | "pc_phase" | "paused"
    sceneCount: number
    memberCount: number
  }
  isGM: boolean
}

export function CampaignHeader({ campaign, isGM }: CampaignHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className="mb-8">
      {/* Back navigation */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2 text-muted-foreground"
        onClick={() => navigate("/campaigns")}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Back to Campaigns
      </Button>

      {/* Title row */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h1 className="font-display text-3xl font-semibold">
          {campaign.title}
        </h1>
        <RoleBadge isGM={isGM} />
        <PhaseBadge phase={campaign.currentPhase} />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-6 text-muted-foreground">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          <span className="text-sm">
            {campaign.sceneCount} {campaign.sceneCount === 1 ? "scene" : "scenes"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span className="text-sm">
            {campaign.memberCount} {campaign.memberCount === 1 ? "player" : "players"}
          </span>
        </div>
      </div>
    </div>
  )
}
```

---

## Header Variations

### Compact Header (for nested pages)

```tsx
export function CampaignHeaderCompact({ campaign }: { campaign: Campaign }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <h1 className="font-display text-2xl font-semibold">
        {campaign.title}
      </h1>
      <PhaseBadge phase={campaign.currentPhase} size="sm" />
    </div>
  )
}
```

### Header with Actions

```tsx
export function CampaignHeaderWithActions({
  campaign,
  isGM,
  onInvite,
}: CampaignHeaderProps & { onInvite: () => void }) {
  return (
    <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
      <div>
        {/* Title and badges */}
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <h1 className="font-display text-3xl font-semibold">
            {campaign.title}
          </h1>
          <RoleBadge isGM={isGM} />
          <PhaseBadge phase={campaign.currentPhase} />
        </div>
        {/* Stats */}
        <div className="flex items-center gap-6 text-muted-foreground text-sm">
          <span>{campaign.sceneCount} scenes</span>
          <span>{campaign.memberCount} players</span>
        </div>
      </div>

      {/* Actions */}
      {isGM && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={onInvite}>
            Invite Players
          </Button>
        </div>
      )}
    </div>
  )
}
```

---

## Styling Details

| Element | Style |
|---------|-------|
| Title | `font-display text-3xl font-semibold` |
| Back link | `text-muted-foreground` with ghost button |
| Stats | `text-sm text-muted-foreground` with icons |
| Badge gap | `gap-3` between badges |
| Section spacing | `mb-8` below header |

---

## Success Criteria

- [ ] Title uses Cormorant Garamond font
- [ ] GM badge displays with crown icon
- [ ] Phase badge shows correct state
- [ ] Stats display scene and player counts
- [ ] Back navigation works
- [ ] Responsive layout wraps on mobile
