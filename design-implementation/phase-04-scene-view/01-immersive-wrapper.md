# 4.1 Immersive Wrapper

**Skill**: `shadcn-react`

## Goal

Create the immersive view wrapper with full-bleed background and minimal UI chrome.

---

## Design References

- [04-view-architecture.md](../../product-design-system/04-view-architecture.md) - Lines 67-103 for immersive patterns
- [05-scene-view.md](../../product-design-system/05-scene-view.md) - Scene view structure

---

## Overview

Immersive views differ from management views:

| Aspect | Management | Immersive |
|--------|------------|-----------|
| Background | Solid `bg-background` | Scene image / gradient |
| Container | Centered, max-width | Full-bleed |
| Chrome | Full navigation | Minimal (back, menu) |
| Panels | Solid `bg-card` | Transparent `bg-panel` |

---

## Implementation

### ImmersiveLayout Component

Create `src/components/layout/ImmersiveLayout.tsx`:

```tsx
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ChevronLeft, MoreHorizontal } from "lucide-react"
import { useNavigate } from "react-router-dom"

interface ImmersiveLayoutProps {
  children: React.ReactNode
  backgroundImage?: string | null
  onBack?: () => void
  backLabel?: string
  menuContent?: React.ReactNode
}

export function ImmersiveLayout({
  children,
  backgroundImage,
  onBack,
  backLabel = "Back",
  menuContent,
}: ImmersiveLayoutProps) {
  const navigate = useNavigate()

  const handleBack = onBack || (() => navigate(-1))

  return (
    <div className="min-h-screen relative">
      {/* Background layer */}
      <div className="fixed inset-0 -z-10">
        {backgroundImage ? (
          <>
            <img
              src={backgroundImage}
              alt=""
              className="w-full h-full object-cover"
            />
            {/* Gradient overlay to fade into background */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
          </>
        ) : (
          <div className="w-full h-full scene-atmosphere" />
        )}
      </div>

      {/* Minimal chrome - floating buttons */}
      <div className="fixed top-4 left-4 right-4 z-50 flex justify-between pointer-events-none">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-panel backdrop-blur-sm border border-border/50 pointer-events-auto"
          onClick={handleBack}
          aria-label={backLabel}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {menuContent && (
          <div className="pointer-events-auto">
            {menuContent}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="relative">
        {children}
      </div>
    </div>
  )
}
```

### Usage

```tsx
import { ImmersiveLayout } from "@/components/layout/ImmersiveLayout"

export function SceneView() {
  return (
    <ImmersiveLayout
      backgroundImage={scene.headerImageUrl}
      onBack={() => navigate(`/campaigns/${campaignId}`)}
      backLabel="Back to campaign"
      menuContent={<SceneMenu scene={scene} />}
    >
      <SceneHeader scene={scene} />
      <PostStream posts={posts} />
      <PostComposer scene={scene} />
    </ImmersiveLayout>
  )
}
```

---

## Scene Menu Component

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Settings, Users, Archive } from "lucide-react"

export function SceneMenu({ scene, isGM }: { scene: Scene; isGM: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full bg-panel backdrop-blur-sm border border-border/50"
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <Users className="h-4 w-4 mr-2" />
          View Roster
        </DropdownMenuItem>
        {isGM && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="h-4 w-4 mr-2" />
              Scene Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Archive className="h-4 w-4 mr-2" />
              Archive Scene
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

## Background Fallback

When no image is set, use atmospheric gradient:

```tsx
{backgroundImage ? (
  <img src={backgroundImage} ... />
) : (
  <div className="w-full h-full scene-atmosphere" />
)}
```

The `scene-atmosphere` class creates:
```css
background: radial-gradient(ellipse at top, hsl(240 5% 12%), hsl(var(--background)));
```

---

## Floating Button Pattern

All chrome uses the floating pattern:

```tsx
<Button
  variant="ghost"
  size="icon"
  className="rounded-full bg-panel backdrop-blur-sm border border-border/50"
>
  <Icon className="h-5 w-5" />
</Button>
```

Key styles:
- `rounded-full` - Circular shape
- `bg-panel` - Semi-transparent background
- `backdrop-blur-sm` - Blur behind button
- `border border-border/50` - Subtle border

---

## Success Criteria

- [ ] Full-bleed background image displays
- [ ] Gradient fades image to background color
- [ ] Fallback gradient shows when no image
- [ ] Back button floats in top-left
- [ ] Menu button floats in top-right
- [ ] Buttons use transparent panel style
- [ ] Content scrolls over background
