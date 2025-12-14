# 5.2 Phase Components

**Skill**: `state-machine`

## Goal

Create phase indicators, time gate countdown, and phase transition controls.

---

## Design References

- [09-phase-system.md](../../product-design-system/09-phase-system.md) - Complete phase system specs

---

## Overview

Phase components include:
- **PhaseIndicator** - Badge showing current phase
- **TimeGateCountdown** - Visual countdown timer
- **PhaseTransitionButton** - GM control for advancing phase
- **PassButton** - Player pass controls
- **CampaignPassOverview** - Dashboard showing pass states

---

## PhaseIndicator Component

Already created as PhaseBadge. Ensure size variants:

```tsx
<PhaseBadge phase="gm_phase" size="sm" />
<PhaseBadge phase="pc_phase" size="md" />
<PhaseBadge phase="paused" size="md" />
```

---

## TimeGateCountdown Component

```tsx
import { cn } from "@/lib/utils"
import { Clock, AlertTriangle, CheckCircle } from "lucide-react"
import { formatDistanceToNow, differenceInMinutes } from "date-fns"

interface TimeGateCountdownProps {
  expiresAt: Date
  className?: string
}

export function TimeGateCountdown({
  expiresAt,
  className,
}: TimeGateCountdownProps) {
  const now = new Date()
  const minutesRemaining = differenceInMinutes(expiresAt, now)
  const hasExpired = expiresAt < now

  // Determine state
  const state = hasExpired
    ? "expired"
    : minutesRemaining < 60
    ? "urgent"
    : "normal"

  const config = {
    normal: {
      icon: Clock,
      className: "bg-secondary text-foreground",
      progressClassName: "bg-gold",
    },
    urgent: {
      icon: AlertTriangle,
      className: "bg-warning/20 text-warning border-warning/30",
      progressClassName: "bg-warning",
    },
    expired: {
      icon: CheckCircle,
      className: "bg-destructive/20 text-destructive border-destructive/30",
      progressClassName: "bg-destructive",
    },
  }[state]

  const Icon = config.icon

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        config.className,
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">
          {hasExpired
            ? "Time gate expired"
            : `Expires ${formatDistanceToNow(expiresAt, { addSuffix: true })}`}
        </span>
      </div>

      {/* Progress bar */}
      {!hasExpired && (
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all", config.progressClassName)}
            style={{
              width: `${Math.max(0, Math.min(100, minutesRemaining / 60 / 24 * 100))}%`,
            }}
          />
        </div>
      )}
    </div>
  )
}
```

---

## PhaseTransitionButton Component

```tsx
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { ArrowRight, AlertTriangle, Loader2 } from "lucide-react"

interface PhaseTransitionButtonProps {
  currentPhase: "gm_phase" | "pc_phase" | "paused"
  canTransition: boolean
  blockedReason?: string
  isLoading?: boolean
  onTransition: () => void
  onForceTransition: () => void
}

export function PhaseTransitionButton({
  currentPhase,
  canTransition,
  blockedReason,
  isLoading,
  onTransition,
  onForceTransition,
}: PhaseTransitionButtonProps) {
  const nextPhase = currentPhase === "gm_phase" ? "PC Phase" : "GM Phase"

  if (canTransition) {
    return (
      <Button onClick={onTransition} disabled={isLoading}>
        {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        <ArrowRight className="h-4 w-4 mr-2" />
        Enter {nextPhase}
      </Button>
    )
  }

  // Blocked - show with tooltip and force option
  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" disabled className="opacity-50">
            <ArrowRight className="h-4 w-4 mr-2" />
            Enter {nextPhase}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{blockedReason || "Cannot transition phase"}</p>
        </TooltipContent>
      </Tooltip>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm">
            <AlertTriangle className="h-4 w-4 mr-1" />
            Force
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force Phase Transition?</AlertDialogTitle>
            <AlertDialogDescription>
              {blockedReason}. Forcing the transition may cause issues with
              pending actions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onForceTransition}>
              Force Transition
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
```

---

## CampaignPassOverview Component

```tsx
interface CampaignPassOverviewProps {
  characters: Array<{
    id: string
    displayName: string
    passState: "none" | "passed" | "hard_passed"
  }>
}

export function CampaignPassOverview({
  characters,
}: CampaignPassOverviewProps) {
  const totalCharacters = characters.length
  const passedCount = characters.filter(
    (c) => c.passState !== "none"
  ).length
  const percentage = totalCharacters > 0
    ? (passedCount / totalCharacters) * 100
    : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Pass Progress</span>
        <span className="font-medium">
          {passedCount} / {totalCharacters}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-gold transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Character list */}
      <div className="space-y-1">
        {characters.map((character) => (
          <div
            key={character.id}
            className="flex items-center justify-between text-sm"
          >
            <span className="truncate">{character.displayName}</span>
            <PassBadge state={character.passState} size="sm" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Success Criteria

- [ ] PhaseIndicator shows all three states
- [ ] TimeGateCountdown with normal/urgent/expired colors
- [ ] Progress bar shows time remaining
- [ ] PhaseTransitionButton handles blocked state
- [ ] Force transition with confirmation dialog
- [ ] CampaignPassOverview shows progress
