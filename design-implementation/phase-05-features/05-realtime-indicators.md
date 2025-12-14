# 5.5 Real-time Indicators

**Skill**: `real-time-sync`, `compose-lock`

## Goal

Create real-time indicator components for compose locks, typing, and connection status.

---

## Design References

- [12-real-time-indicators.md](../../product-design-system/12-real-time-indicators.md) - Complete real-time specs

---

## Overview

Real-time indicators include:
- **LockTimerBar** - Slim progress bar for compose lock
- **TypingIndicator** - Bouncing dots animation
- **DraftSaveIndicator** - Save status badge
- **ConnectionStatus** - Connection state banner

---

## LockTimerBar Component

Already created in Phase 4. Key points:
- Slim progress bar (not text badge)
- Gold for normal, warning for <1 minute
- Positioned at top of composer

```tsx
<LockTimerBar timeRemaining={timeRemaining} totalTime={600} />
```

---

## TypingIndicator Component

```tsx
import { cn } from "@/lib/utils"

interface TypingIndicatorProps {
  users: Array<{ name: string }>
  className?: string
}

export function TypingIndicator({ users, className }: TypingIndicatorProps) {
  if (users.length === 0) return null

  const text =
    users.length === 1
      ? `${users[0].name} is typing...`
      : users.length === 2
      ? `${users[0].name} and ${users[1].name} are typing...`
      : `${users[0].name} and ${users.length - 1} others are typing...`

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground",
        className
      )}
    >
      <BouncingDots />
      <span>{text}</span>
    </div>
  )
}

function BouncingDots() {
  return (
    <div className="flex gap-1">
      <span
        className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: "0ms" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce"
        style={{ animationDelay: "300ms" }}
      />
    </div>
  )
}
```

---

## DraftSaveIndicator Component

```tsx
import { Check, Cloud, CloudOff, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type SaveState = "saved" | "saving" | "unsaved" | "error"

interface DraftSaveIndicatorProps {
  state: SaveState
  className?: string
}

export function DraftSaveIndicator({
  state,
  className,
}: DraftSaveIndicatorProps) {
  const config = {
    saved: {
      icon: Check,
      text: "Saved",
      className: "text-success",
    },
    saving: {
      icon: Loader2,
      text: "Saving...",
      className: "text-muted-foreground",
      iconClassName: "animate-spin",
    },
    unsaved: {
      icon: Cloud,
      text: "Unsaved",
      className: "text-muted-foreground",
    },
    error: {
      icon: CloudOff,
      text: "Save failed",
      className: "text-destructive",
    },
  }[state]

  const Icon = config.icon

  return (
    <div className={cn("flex items-center gap-1 text-xs", config.className, className)}>
      <Icon className={cn("h-3 w-3", (config as any).iconClassName)} />
      <span>{config.text}</span>
    </div>
  )
}
```

---

## ConnectionStatus Component

```tsx
import { Wifi, WifiOff } from "lucide-react"
import { cn } from "@/lib/utils"

type ConnectionState = "connected" | "connecting" | "disconnected"

interface ConnectionStatusProps {
  state: ConnectionState
}

export function ConnectionStatus({ state }: ConnectionStatusProps) {
  if (state === "connected") return null

  const config = {
    connecting: {
      icon: Wifi,
      text: "Reconnecting...",
      className: "bg-warning/10 text-warning border-warning/30",
    },
    disconnected: {
      icon: WifiOff,
      text: "Connection lost. Retrying...",
      className: "bg-destructive/10 text-destructive border-destructive/30",
    },
  }[state]

  const Icon = config.icon

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm border-b flex items-center justify-center gap-2",
        config.className
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{config.text}</span>
    </div>
  )
}
```

---

## Lock Lost Toast

When compose lock is lost:

```tsx
import { toast } from "@/components/ui/use-toast"

function handleLockLost() {
  toast({
    variant: "destructive",
    title: "Lock expired",
    description: "Your compose lock has expired. Please re-acquire to continue.",
  })
}
```

---

## LockHolder Indicator

Shows who currently holds the lock:

```tsx
interface LockHolderProps {
  holder: {
    characterName: string
    userName: string
  }
}

export function LockHolderIndicator({ holder }: LockHolderProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-3">
      <Lock className="h-4 w-4" />
      <span>
        <span className="font-medium">{holder.characterName}</span>
        {" is composing..."}
      </span>
    </div>
  )
}
```

---

## Usage in Composer

```tsx
function PostComposer() {
  const { hasLock, timeRemaining, lockHolder } = useComposeLock()
  const { saveState } = useDraft()

  return (
    <div className="...">
      {/* Lock timer at top */}
      {hasLock && timeRemaining && (
        <LockTimerBar timeRemaining={timeRemaining} totalTime={600} />
      )}

      {/* Lock holder when someone else has it */}
      {!hasLock && lockHolder && (
        <LockHolderIndicator holder={lockHolder} />
      )}

      {/* Draft save indicator */}
      <div className="absolute top-2 right-2">
        <DraftSaveIndicator state={saveState} />
      </div>

      {/* ... rest of composer ... */}
    </div>
  )
}
```

---

## Success Criteria

- [ ] LockTimerBar shows as slim progress bar
- [ ] Color changes to warning when time is low
- [ ] TypingIndicator with bouncing dots
- [ ] Multiple users handled in typing text
- [ ] DraftSaveIndicator shows save states
- [ ] ConnectionStatus banner for disconnection
- [ ] Lock lost toast notification
