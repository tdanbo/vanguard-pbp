import { Badge } from "@/components/ui/badge"
import { Crown, User, Clock, Check, CheckCheck, X, Dice5, Pause } from "lucide-react"
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
  if (!isGM) return null

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

// =============== PASS CHECKMARK (Icon Only) ===============

interface PassCheckmarkProps {
  state: PassState
  size?: "sm" | "md" | "lg"
}

const checkmarkSizes = {
  sm: { container: "w-4 h-4", icon: "h-2.5 w-2.5" },
  md: { container: "w-5 h-5", icon: "h-3 w-3" },
  lg: { container: "w-5 h-5", icon: "h-3 w-3" },
}

export function PassCheckmark({ state, size = "lg" }: PassCheckmarkProps) {
  if (state === "none") return null

  const Icon = state === "hard_passed" ? CheckCheck : Check
  const sizeConfig = checkmarkSizes[size]

  return (
    <div className={cn(sizeConfig.container, "rounded-full bg-green-500 flex items-center justify-center")}>
      <Icon className={cn(sizeConfig.icon, "text-white")} />
    </div>
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

// =============== EXPORTS ===============

export type { PhaseType, PassState, RollState }
