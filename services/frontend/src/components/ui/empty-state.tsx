import { cn } from "@/lib/utils"
import {
  type LucideIcon,
  Scroll,
  BookOpen,
  Users,
  MessageSquare,
  Bell,
  Search,
  UserPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
  variant?: "default" | "compact"
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
  className,
}: EmptyStateProps) {
  const isCompact = variant === "compact"

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        isCompact ? "py-8 px-2" : "py-16 px-4",
        className
      )}
    >
      <div
        className={cn(
          "rounded-full bg-secondary mb-3",
          isCompact ? "p-2" : "p-4"
        )}
      >
        <Icon
          className={cn(
            "text-muted-foreground",
            isCompact ? "h-5 w-5" : "h-8 w-8"
          )}
        />
      </div>
      <h3
        className={cn(
          "font-display font-semibold mb-1",
          isCompact ? "text-base" : "text-xl"
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          "text-muted-foreground max-w-sm",
          isCompact ? "text-sm mb-4" : "text-base mb-6"
        )}
      >
        {description}
      </p>
      {action && (
        <Button size={isCompact ? "sm" : "default"} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

// =============== PRESET EMPTY STATES ===============

// These are convenience wrappers with thematic messaging

interface PresetEmptyStateProps {
  onAction?: () => void
  className?: string
  variant?: "default" | "compact"
}

export function EmptyCampaigns({
  onAction,
  className,
  variant,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={Scroll}
      title="Your adventure awaits"
      description="Create your first campaign to begin your journey into collaborative storytelling."
      action={
        onAction
          ? {
              label: "Create Campaign",
              onClick: onAction,
            }
          : undefined
      }
      variant={variant}
      className={className}
    />
  )
}

export function EmptyScenes({
  onAction,
  className,
  variant,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={BookOpen}
      title="The stage is empty"
      description="Set the scene for your players. Create locations and situations for them to explore."
      action={
        onAction
          ? {
              label: "Create Scene",
              onClick: onAction,
            }
          : undefined
      }
      variant={variant}
      className={className}
    />
  )
}

export function EmptyCharacters({
  onAction,
  className,
  variant,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={Users}
      title="No heroes have joined"
      description="Create characters for your campaign or wait for players to create their own."
      action={
        onAction
          ? {
              label: "Create Character",
              onClick: onAction,
            }
          : undefined
      }
      variant={variant}
      className={className}
    />
  )
}

export function EmptyPosts({ className, variant }: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={MessageSquare}
      title="The story has not yet begun"
      description="Be the first to write. Your words will set the tale in motion."
      variant={variant}
      className={className}
    />
  )
}

export function EmptyNotifications({
  className,
  variant,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={Bell}
      title="All caught up"
      description="You have no new notifications. Check back after your party has been active."
      variant={variant}
      className={className}
    />
  )
}

export function EmptySearchResults({
  className,
  variant,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={Search}
      title="No matches found"
      description="Try adjusting your search terms or filters."
      variant={variant}
      className={className}
    />
  )
}

export function EmptyMembers({
  onAction,
  className,
  variant,
}: PresetEmptyStateProps) {
  return (
    <EmptyState
      icon={UserPlus}
      title="Gathering the party"
      description="Invite players to join your campaign and begin the adventure together."
      action={
        onAction
          ? {
              label: "Invite Players",
              onClick: onAction,
            }
          : undefined
      }
      variant={variant}
      className={className}
    />
  )
}
