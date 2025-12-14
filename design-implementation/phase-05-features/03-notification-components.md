# 5.3 Notification Components

**Skill**: `notification-system`

## Goal

Create the notification center dropdown and settings dialog.

---

## Design References

- [10-notifications.md](../../product-design-system/10-notifications.md) - Complete notification specs

---

## Overview

Notification components include:
- **NotificationCenter** - Dropdown with notification list
- **NotificationItem** - Individual notification row
- **NotificationSettings** - Preferences dialog

---

## NotificationCenter Component

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Bell, Settings } from "lucide-react"
import { CountBadge } from "@/components/ui/game-badges"
import { ScrollArea } from "@/components/ui/scroll-area"

interface NotificationCenterProps {
  notifications: Notification[]
  unreadCount: number
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onOpenSettings: () => void
}

export function NotificationCenter({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onOpenSettings,
}: NotificationCenterProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1">
              <CountBadge count={unreadCount} />
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold">Notifications</h4>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onMarkAllRead}
              >
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onOpenSettings}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* List */}
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">All caught up</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkRead={() => onMarkRead(notification.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

---

## NotificationItem Component

```tsx
import { formatRelativeTime } from "@/lib/utils"
import { cn } from "@/lib/utils"
import {
  MessageSquare,
  Users,
  Clock,
  Dice5,
  AlertTriangle,
} from "lucide-react"

interface NotificationItemProps {
  notification: {
    id: string
    type: "new_post" | "phase_change" | "roll_request" | "mention" | "system"
    title: string
    body: string
    isRead: boolean
    createdAt: string
    actionUrl?: string
  }
  onMarkRead: () => void
}

const iconMap = {
  new_post: MessageSquare,
  phase_change: Clock,
  roll_request: Dice5,
  mention: Users,
  system: AlertTriangle,
}

export function NotificationItem({
  notification,
  onMarkRead,
}: NotificationItemProps) {
  const Icon = iconMap[notification.type]

  return (
    <div
      className={cn(
        "px-4 py-3 hover:bg-secondary/50 cursor-pointer",
        !notification.isRead && "bg-gold/5"
      )}
      onClick={onMarkRead}
    >
      <div className="flex gap-3">
        {/* Unread indicator */}
        <div className="flex-shrink-0 pt-1">
          {!notification.isRead && (
            <div className="w-2 h-2 rounded-full bg-gold" />
          )}
        </div>

        {/* Icon */}
        <div className="flex-shrink-0">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{notification.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {notification.body}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatRelativeTime(notification.createdAt)}
          </p>
        </div>
      </div>
    </div>
  )
}
```

---

## NotificationSettings Component

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

interface NotificationSettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: NotificationPreferences
  onSave: (settings: NotificationPreferences) => void
}

export function NotificationSettings({
  open,
  onOpenChange,
  settings,
  onSave,
}: NotificationSettingsProps) {
  const [localSettings, setLocalSettings] = useState(settings)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">
            Notification Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* In-app notifications */}
          <div>
            <h4 className="font-medium mb-3">In-App Notifications</h4>
            <div className="space-y-3">
              <SettingRow
                label="New posts"
                checked={localSettings.inApp.newPosts}
                onChange={(v) =>
                  setLocalSettings({
                    ...localSettings,
                    inApp: { ...localSettings.inApp, newPosts: v },
                  })
                }
              />
              <SettingRow
                label="Phase changes"
                checked={localSettings.inApp.phaseChanges}
                onChange={(v) =>
                  setLocalSettings({
                    ...localSettings,
                    inApp: { ...localSettings.inApp, phaseChanges: v },
                  })
                }
              />
              <SettingRow
                label="Roll requests"
                checked={localSettings.inApp.rollRequests}
                onChange={(v) =>
                  setLocalSettings({
                    ...localSettings,
                    inApp: { ...localSettings.inApp, rollRequests: v },
                  })
                }
              />
            </div>
          </div>

          {/* Email notifications */}
          <div>
            <h4 className="font-medium mb-3">Email Notifications</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Email frequency</Label>
                <Select
                  value={localSettings.emailFrequency}
                  onValueChange={(v) =>
                    setLocalSettings({
                      ...localSettings,
                      emailFrequency: v as any,
                    })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realtime">Realtime</SelectItem>
                    <SelectItem value="daily">Daily digest</SelectItem>
                    <SelectItem value="weekly">Weekly digest</SelectItem>
                    <SelectItem value="off">Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Quiet hours */}
          <div>
            <h4 className="font-medium mb-3">Quiet Hours</h4>
            <SettingRow
              label="Enable quiet hours"
              checked={localSettings.quietHours.enabled}
              onChange={(v) =>
                setLocalSettings({
                  ...localSettings,
                  quietHours: { ...localSettings.quietHours, enabled: v },
                })
              }
            />
            {/* Time pickers would go here */}
          </div>

          <Button className="w-full" onClick={() => onSave(localSettings)}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SettingRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
```

---

## Success Criteria

- [ ] NotificationCenter dropdown with badge count
- [ ] Notification items show unread indicator
- [ ] Mark read/all read functionality
- [ ] NotificationSettings dialog complete
- [ ] Email frequency selector works
- [ ] Quiet hours toggle available
