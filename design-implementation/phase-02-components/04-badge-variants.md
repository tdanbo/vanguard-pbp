# 2.4 Badge Variants

**Skill**: `shadcn-react`

## Goal

Create badge variants for all game states: phase, role, pass, and roll states.

---

## Design References

- [07-components.md](../../product-design-system/07-components.md) - Lines 419-520 for badge patterns
- [09-phase-system.md](../../product-design-system/09-phase-system.md) - Phase indicator specs
- [08-rolls-system.md](../../product-design-system/08-rolls-system.md) - Roll state specs

---

## Overview

Badges communicate status at a glance. Vanguard needs variants for:

| Category | States |
|----------|--------|
| **Phase** | GM Phase (purple), PC Phase (green), Paused (gray) |
| **Role** | GM (crown), Player |
| **Pass** | None, Passed (soft), Hard Passed |
| **Roll** | Pending, Completed, Invalidated |

---

## Badge Variants Implementation

### Extend Badge Component

Create `src/components/ui/game-badges.tsx`:

```tsx
import { Badge } from "@/components/ui/badge"
import { Crown, User, Clock, Check, X, Dice5, Pause } from "lucide-react"
import { cn } from "@/lib/utils"

// =============== PHASE BADGES ===============

type PhaseType = "gm_phase" | "pc_phase" | "paused"

interface PhaseBadgeProps {
  phase: PhaseType
  size?: "sm" | "md"
}

export function PhaseBadge({ phase, size = "md" }: PhaseBadgeProps) {
  const config = {
    gm_phase: {
      label: "GM Phase",
      className: "bg-gm-phase/20 text-gm-phase border-gm-phase/30",
      icon: Crown,
    },
    pc_phase: {
      label: "PC Phase",
      className: "bg-pc-phase/20 text-pc-phase border-pc-phase/30",
      icon: User,
    },
    paused: {
      label: "Paused",
      className: "bg-muted text-muted-foreground border-border",
      icon: Pause,
    },
  }[phase]

  const Icon = config.icon
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"

  return (
    <Badge variant="outline" className={cn(config.className, sizeClass)}>
      <Icon className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      {config.label}
    </Badge>
  )
}

// =============== ROLE BADGES ===============

interface RoleBadgeProps {
  isGM: boolean
  size?: "sm" | "md"
}

export function RoleBadge({ isGM, size = "sm" }: RoleBadgeProps) {
  if (isGM) {
    return (
      <Badge
        variant="outline"
        className={cn(
          "bg-gold/10 text-gold border-gold/30",
          size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"
        )}
      >
        <Crown className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
        GM
      </Badge>
    )
  }
  return null // Players don't need a badge
}

// =============== PASS STATE BADGES ===============

type PassState = "none" | "passed" | "hard_passed"

interface PassBadgeProps {
  state: PassState
  size?: "sm" | "md"
}

export function PassBadge({ state, size = "sm" }: PassBadgeProps) {
  if (state === "none") return null

  const config = {
    passed: {
      label: "Passed",
      className: "bg-passed/20 text-passed border-passed/30",
    },
    hard_passed: {
      label: "Hard Pass",
      className: "bg-hard-passed/20 text-hard-passed border-hard-passed/30",
    },
  }[state]

  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"

  return (
    <Badge variant="outline" className={cn(config.className, sizeClass)}>
      <Check className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      {config.label}
    </Badge>
  )
}

// =============== ROLL STATE BADGES ===============

type RollState = "pending" | "completed" | "invalidated"

interface RollBadgeProps {
  state: RollState
  result?: number
  size?: "sm" | "md"
}

export function RollBadge({ state, result, size = "sm" }: RollBadgeProps) {
  const config = {
    pending: {
      label: "Roll Pending",
      className: "bg-warning/20 text-warning border-warning/30",
      icon: Clock,
    },
    completed: {
      label: result !== undefined ? `Rolled ${result}` : "Completed",
      className: "bg-success/20 text-success border-success/30",
      icon: Dice5,
    },
    invalidated: {
      label: "Invalidated",
      className: "bg-destructive/20 text-destructive border-destructive/30",
      icon: X,
    },
  }[state]

  const Icon = config.icon
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"

  return (
    <Badge variant="outline" className={cn(config.className, sizeClass)}>
      <Icon className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-4 w-4")} />
      {config.label}
    </Badge>
  )
}

// =============== NEW / UNREAD BADGE ===============

export function NewBadge() {
  return (
    <Badge className="bg-gold text-primary-foreground text-xs px-2 py-0.5">
      NEW
    </Badge>
  )
}

// =============== COUNT BADGE ===============

interface CountBadgeProps {
  count: number
  max?: number
}

export function CountBadge({ count, max = 99 }: CountBadgeProps) {
  if (count === 0) return null

  const display = count > max ? `${max}+` : count

  return (
    <Badge className="bg-destructive text-destructive-foreground text-xs px-1.5 py-0.5 min-w-[20px] text-center">
      {display}
    </Badge>
  )
}
```

### Create Index Export

Add to `src/components/ui/index.ts` or create export:

```tsx
export {
  PhaseBadge,
  RoleBadge,
  PassBadge,
  RollBadge,
  NewBadge,
  CountBadge,
} from "./game-badges"
```

---

## Usage Examples

```tsx
import {
  PhaseBadge,
  RoleBadge,
  PassBadge,
  RollBadge,
  NewBadge,
  CountBadge
} from "@/components/ui/game-badges"

// Campaign header
<div className="flex items-center gap-2">
  <h1>My Campaign</h1>
  <RoleBadge isGM={true} />
  <PhaseBadge phase="pc_phase" />
</div>

// Scene card with new posts
<Card>
  <div className="flex justify-between">
    <span>The Dark Forest</span>
    <NewBadge />
  </div>
</Card>

// Character in roster
<div className="flex items-center gap-2">
  <CharacterPortrait name="Aldric" size="sm" />
  <span>Sir Aldric</span>
  <PassBadge state="passed" />
</div>

// Post with roll
<div className="flex justify-between">
  <span className="character-name">Elena</span>
  <RollBadge state="completed" result={18} />
</div>

// Notification bell
<Button variant="ghost" size="icon" className="relative">
  <Bell className="h-5 w-5" />
  <div className="absolute -top-1 -right-1">
    <CountBadge count={5} />
  </div>
</Button>
```

---

## Badge Styling Reference

| State | Background | Text | Border |
|-------|------------|------|--------|
| GM Phase | `bg-gm-phase/20` | `text-gm-phase` | `border-gm-phase/30` |
| PC Phase | `bg-pc-phase/20` | `text-pc-phase` | `border-pc-phase/30` |
| Paused | `bg-muted` | `text-muted-foreground` | `border-border` |
| GM Role | `bg-gold/10` | `text-gold` | `border-gold/30` |
| Passed | `bg-passed/20` | `text-passed` | `border-passed/30` |
| Hard Pass | `bg-hard-passed/20` | `text-hard-passed` | `border-hard-passed/30` |
| Roll Pending | `bg-warning/20` | `text-warning` | `border-warning/30` |
| Roll Complete | `bg-success/20` | `text-success` | `border-success/30` |
| Roll Invalid | `bg-destructive/20` | `text-destructive` | `border-destructive/30` |

---

## Success Criteria

- [ ] PhaseBadge shows correct colors for GM/PC/Paused
- [ ] RoleBadge displays crown icon for GM
- [ ] PassBadge shows correct state styling
- [ ] RollBadge displays result number when completed
- [ ] NewBadge uses gold background
- [ ] CountBadge truncates at max value
- [ ] All badges have sm and md sizes
