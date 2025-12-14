# 4.4 Composer

**Skill**: `shadcn-react`, `compose-lock`

## Goal

Create the messenger-style composer fixed at the bottom of the scene view.

---

## Design References

- [05-scene-view.md](../../product-design-system/05-scene-view.md) - Lines 324-630 for composer specs
- [12-real-time-indicators.md](../../product-design-system/12-real-time-indicators.md) - Lock timer bar

---

## Overview

The composer is the player's voice in the scene:
- Fixed to bottom like modern messengers
- Rounded rectangle with transparent background
- Mode toggle (Narrative/OOC)
- Inline blocks for action/dialog
- Lock timer as progress bar
- Send button

---

## Implementation

### PostComposer Component

Create or update `src/components/posts/PostComposer.tsx`:

```tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Send, Lock, Unlock, Loader2, Quote, Swords } from "lucide-react"
import { cn } from "@/lib/utils"
import { useComposeLock } from "@/hooks/useComposeLock"

interface PostComposerProps {
  sceneId: string
  characterId: string
  onSubmit: (content: string, oocContent?: string) => Promise<void>
}

export function PostComposer({
  sceneId,
  characterId,
  onSubmit,
}: PostComposerProps) {
  const [mode, setMode] = useState<"narrative" | "ooc">("narrative")
  const [content, setContent] = useState("")
  const [oocContent, setOocContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    hasLock,
    isAcquiring,
    timeRemaining,
    acquireLock,
    releaseLock,
  } = useComposeLock(sceneId, characterId)

  async function handleSubmit() {
    if (!content.trim()) return

    setIsSubmitting(true)
    try {
      await onSubmit(content, oocContent || undefined)
      setContent("")
      setOocContent("")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-40">
      <div className="max-w-4xl mx-auto">
        <div className="bg-panel backdrop-blur-md rounded-2xl border border-border/50 overflow-hidden">
          {/* Lock timer bar */}
          {hasLock && timeRemaining && (
            <LockTimerBar
              timeRemaining={timeRemaining}
              totalTime={600} // 10 minutes
            />
          )}

          {/* Mode tabs */}
          <div className="px-4 pt-3">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "narrative" | "ooc")}>
              <TabsList className="bg-secondary/50 h-8">
                <TabsTrigger value="narrative" className="text-xs h-7">
                  Narrative
                </TabsTrigger>
                <TabsTrigger value="ooc" className="text-xs h-7">
                  OOC
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Text area */}
          <div className="p-4 pt-2">
            <Textarea
              placeholder={
                mode === "narrative"
                  ? "Write your action or dialogue..."
                  : "Out of character message..."
              }
              value={mode === "narrative" ? content : oocContent}
              onChange={(e) =>
                mode === "narrative"
                  ? setContent(e.target.value)
                  : setOocContent(e.target.value)
              }
              className="min-h-[80px] bg-transparent border-0 resize-none focus-visible:ring-0 p-0"
              disabled={!hasLock}
            />
          </div>

          {/* Toolbar */}
          <div className="px-4 pb-3 flex items-center justify-between">
            {/* Block type buttons */}
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                disabled={!hasLock}
              >
                <Swords className="h-4 w-4 mr-1" />
                Action
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                disabled={!hasLock}
              >
                <Quote className="h-4 w-4 mr-1" />
                Dialog
              </Button>
            </div>

            {/* Lock and send */}
            <div className="flex items-center gap-2">
              {!hasLock ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={acquireLock}
                  disabled={isAcquiring}
                >
                  {isAcquiring ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-1" />
                      Take Post
                    </>
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={releaseLock}
                  >
                    <Unlock className="h-4 w-4 mr-1" />
                    Release
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={!content.trim() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1" />
                        Post
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

### LockTimerBar Component

```tsx
interface LockTimerBarProps {
  timeRemaining: number // seconds
  totalTime: number // seconds
}

export function LockTimerBar({ timeRemaining, totalTime }: LockTimerBarProps) {
  const percentage = (timeRemaining / totalTime) * 100
  const isUrgent = timeRemaining < 60 // Last minute

  return (
    <div className="h-1 bg-secondary">
      <div
        className={cn(
          "h-full transition-all duration-1000",
          isUrgent ? "bg-warning" : "bg-gold"
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
```

---

## Composer States

| State | Display |
|-------|---------|
| No lock | "Take Post" button only |
| Acquiring | Spinner in button |
| Has lock | Full composer with timer |
| Submitting | Spinner on Post button |
| Locked by other | Disabled, show who has lock |

### Locked by Other Player

```tsx
{otherPlayerLock && (
  <div className="px-4 py-3 flex items-center justify-center gap-2 text-muted-foreground">
    <Lock className="h-4 w-4" />
    <span className="text-sm">
      {otherPlayerLock.characterName} is composing...
    </span>
  </div>
)}
```

---

## Mobile Considerations

On mobile, composer should:
- Adjust for virtual keyboard
- Remain accessible while scrolling
- Have touch-friendly button sizes

```tsx
// Detect mobile keyboard
useEffect(() => {
  if (isMobile) {
    const handleResize = () => {
      // Adjust composer position when keyboard appears
    }
    window.visualViewport?.addEventListener("resize", handleResize)
    return () => window.visualViewport?.removeEventListener("resize", handleResize)
  }
}, [isMobile])
```

---

## Success Criteria

- [ ] Composer fixed at bottom of viewport
- [ ] Rounded transparent panel styling
- [ ] Mode tabs switch between Narrative/OOC
- [ ] Lock timer shows as progress bar
- [ ] Take Post button acquires lock
- [ ] Release button gives up lock
- [ ] Post button submits content
- [ ] Disabled state when another player has lock
