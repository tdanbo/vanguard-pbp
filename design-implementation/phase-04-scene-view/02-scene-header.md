# 4.2 Scene Header

**Skill**: `shadcn-react`

## Goal

Create the scene header with image, gradient overlay, and title.

---

## Design References

- [05-scene-view.md](../../product-design-system/05-scene-view.md) - Lines 89-144 for header specs

---

## Overview

The scene header is the first element in scene view:
- Tall image area (40vh minimum)
- Gradient fade from transparent to background
- Scene title with text-shadow
- Scene description (optional)

---

## Implementation

### SceneHeader Component

Create `src/components/scene/SceneHeader.tsx`:

```tsx
import { cn } from "@/lib/utils"

interface SceneHeaderProps {
  scene: {
    title: string
    description?: string
    headerImageUrl?: string | null
  }
  className?: string
}

export function SceneHeader({ scene, className }: SceneHeaderProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Image or gradient background */}
      <div className="min-h-[40vh] relative">
        {scene.headerImageUrl ? (
          <>
            <img
              src={scene.headerImageUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 scene-gradient" />
          </>
        ) : (
          <div className="absolute inset-0 scene-atmosphere" />
        )}

        {/* Title overlay - positioned at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="scene-title text-white mb-2">
              {scene.title}
            </h1>
            {scene.description && (
              <p className="text-lg text-white/80 max-w-2xl">
                {scene.description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## Styling Details

### Scene Title Class

The `scene-title` utility provides:

```css
.scene-title {
  @apply font-display text-4xl font-semibold tracking-tight;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.8);
}
```

### Scene Gradient Class

The `scene-gradient` utility:

```css
.scene-gradient {
  background: linear-gradient(to bottom, transparent, hsl(var(--background)));
}
```

---

## Header Variants

### Compact Header (for scrolled state)

```tsx
export function SceneHeaderCompact({ scene }: { scene: Scene }) {
  return (
    <div className="bg-panel backdrop-blur-md border-b border-border/50 py-3 px-4">
      <h1 className="font-display text-xl font-semibold">{scene.title}</h1>
    </div>
  )
}
```

### Header with Action

For GM controls:

```tsx
export function SceneHeaderWithAction({
  scene,
  isGM,
  onEdit,
}: SceneHeaderProps & { isGM: boolean; onEdit: () => void }) {
  return (
    <div className="relative min-h-[40vh]">
      {/* ... background ... */}

      <div className="absolute bottom-0 left-0 right-0 p-8">
        <div className="max-w-4xl mx-auto flex justify-between items-end">
          <div>
            <h1 className="scene-title text-white mb-2">{scene.title}</h1>
            <p className="text-lg text-white/80">{scene.description}</p>
          </div>
          {isGM && (
            <Button
              variant="ghost"
              className="bg-panel backdrop-blur-sm"
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

## Scroll Behavior

As user scrolls, header can transition to compact:

```tsx
function SceneView() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 200)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <>
      {isScrolled && (
        <div className="fixed top-0 left-0 right-0 z-40">
          <SceneHeaderCompact scene={scene} />
        </div>
      )}
      <SceneHeader scene={scene} />
      {/* ... posts ... */}
    </>
  )
}
```

---

## Success Criteria

- [ ] Header shows image with gradient overlay
- [ ] Fallback gradient when no image
- [ ] Title uses scene-title class (serif + shadow)
- [ ] Description displays when present
- [ ] Title positioned at bottom of image
- [ ] Gradient fades smoothly into background
