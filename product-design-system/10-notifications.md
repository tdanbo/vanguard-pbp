# Notifications

This document defines the UI patterns for the notification system in Vanguard PBP.

**Related Components**:
- `src/components/notifications/NotificationCenter.tsx` - Dropdown notification center
- `src/components/notifications/NotificationSettings.tsx` - User preferences dialog

---

## Design Principles

1. **Non-Intrusive** - Notifications should inform, not interrupt
2. **Actionable** - Clear paths to relevant content
3. **Controllable** - Users can customize delivery preferences
4. **Respectful** - Quiet hours and frequency options

---

## Notification Center

The notification center is a dropdown accessible from the header.

### Trigger Button

```tsx
<Button variant="ghost" size="icon" className="relative">
  <Bell className="h-5 w-5" />
  {unreadCount > 0 && (
    <Badge
      variant="destructive"
      className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs"
    >
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
  )}
</Button>
```

### Dropdown Layout

```
┌──────────────────────────────────────────┐
│ Notifications    [Mark all read] [⚙]     │
├──────────────────────────────────────────┤
│ ● New post in "The Tavern"               │
│   Doravar posted a new action            │
│   2 minutes ago                          │
├──────────────────────────────────────────┤
│   Phase transition in Campaign X         │
│   GM Phase has begun                     │
│   1 hour ago                             │
├──────────────────────────────────────────┤
│   [Load more]                            │
└──────────────────────────────────────────┘
```

### Dropdown Header

```tsx
<DropdownMenuLabel className="flex items-center justify-between">
  <span>Notifications</span>
  <div className="flex items-center gap-1">
    {unreadCount > 0 && (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={handleMarkAllAsRead}
      >
        <CheckCheck className="mr-1 h-3 w-3" />
        Mark all read
      </Button>
    )}
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6"
      onClick={onSettingsClick}
    >
      <Settings className="h-3 w-3" />
    </Button>
  </div>
</DropdownMenuLabel>
```

### Notification Item

```tsx
<div
  className={cn(
    'relative flex cursor-pointer items-start gap-3 px-3 py-2 transition-colors hover:bg-accent',
    !notification.is_read && 'bg-accent/50'
  )}
>
  {/* Unread indicator */}
  {!notification.is_read && (
    <div className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
  )}

  <div className="min-w-0 flex-1 pl-2">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', !notification.is_read && 'font-medium')}>
          {notification.title}
        </p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {notification.body}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
      {notification.is_urgent && (
        <Badge variant="destructive" className="shrink-0 text-xs">
          Urgent
        </Badge>
      )}
    </div>
  </div>
</div>
```

### Hover Actions

Actions appear on hover for each notification item:

```tsx
{isHovered && (
  <div className="absolute right-2 top-2 flex items-center gap-1">
    {!notification.is_read && (
      <Button variant="ghost" size="icon" className="h-6 w-6" title="Mark as read">
        <Check className="h-3 w-3" />
      </Button>
    )}
    {notification.link && (
      <Button variant="ghost" size="icon" className="h-6 w-6" title="Open in new tab">
        <ExternalLink className="h-3 w-3" />
      </Button>
    )}
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-destructive hover:text-destructive"
      title="Delete"
    >
      <Trash2 className="h-3 w-3" />
    </Button>
  </div>
)}
```

### Notification Badge (Standalone)

For use in navigation or other locations:

```tsx
export function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null

  return (
    <Badge
      variant="destructive"
      className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs"
    >
      {count > 99 ? '99+' : count}
    </Badge>
  )
}
```

---

## Notification Settings

Settings dialog for controlling notification delivery.

### Layout

```
┌────────────────────────────────────────────────────┐
│ Notification Settings                              │
│ Configure how and when you receive notifications   │
├────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────┐ │
│ │ [Bell] In-App Notifications                    │ │
│ │ Notifications shown within the application     │ │
│ │ Enable in-app notifications        [Toggle]    │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌────────────────────────────────────────────────┐ │
│ │ [Mail] Email Notifications                     │ │
│ │ Receive notifications via email                │ │
│ │ Enable email notifications         [Toggle]    │ │
│ │ Delivery frequency                             │ │
│ │ [Real-time                              ▼]     │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│ ┌────────────────────────────────────────────────┐ │
│ │ [Moon] Quiet Hours                             │ │
│ │ Pause real-time notifications during hours     │ │
│ │ Enable quiet hours                 [Toggle]    │ │
│ │ ┌─────────────┐ ┌─────────────┐               │ │
│ │ │ Start time  │ │ End time    │               │ │
│ │ │   22:00     │ │   08:00     │               │ │
│ │ └─────────────┘ └─────────────┘               │ │
│ │ Timezone                                       │ │
│ │ [Pacific Time (PT)                      ▼]     │ │
│ │ ───────────────────────────────────────────    │ │
│ │ Allow urgent notifications         [Toggle]    │ │
│ │ Urgent notifications during quiet hours        │ │
│ └────────────────────────────────────────────────┘ │
│                                                    │
│                        [Cancel] [Save Settings]    │
└────────────────────────────────────────────────────┘
```

### Settings Cards

Each settings group uses a card layout:

```tsx
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="flex items-center gap-2 text-base">
      <Bell className="h-4 w-4" />
      In-App Notifications
    </CardTitle>
    <CardDescription>
      Notifications shown within the application
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex items-center justify-between">
      <Label htmlFor="in-app-enabled">Enable in-app notifications</Label>
      <Switch
        id="in-app-enabled"
        checked={inAppEnabled}
        onCheckedChange={setInAppEnabled}
      />
    </div>
  </CardContent>
</Card>
```

### Email Frequency Options

```tsx
<Select value={emailFrequency} onValueChange={setEmailFrequency}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="realtime">Real-time</SelectItem>
    <SelectItem value="digest_daily">Daily digest</SelectItem>
    <SelectItem value="digest_weekly">Weekly digest</SelectItem>
    <SelectItem value="off">Off</SelectItem>
  </SelectContent>
</Select>
```

| Option | Description |
|--------|-------------|
| `realtime` | Immediate email delivery |
| `digest_daily` | One summary email per day |
| `digest_weekly` | One summary email per week |
| `off` | No emails (in-app only) |

### Quiet Hours

Time inputs for quiet period:

```tsx
<div className="grid grid-cols-2 gap-4">
  <div className="space-y-2">
    <Label htmlFor="quiet-start" className="flex items-center gap-1">
      <Clock className="h-3 w-3" />
      Start time
    </Label>
    <Input
      id="quiet-start"
      type="time"
      value={quietStart}
      onChange={(e) => setQuietStart(e.target.value)}
    />
  </div>
  <div className="space-y-2">
    <Label htmlFor="quiet-end" className="flex items-center gap-1">
      <Clock className="h-3 w-3" />
      End time
    </Label>
    <Input
      id="quiet-end"
      type="time"
      value={quietEnd}
      onChange={(e) => setQuietEnd(e.target.value)}
    />
  </div>
</div>
```

### Timezone Selection

```tsx
<Select value={timezone} onValueChange={setTimezone}>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="UTC">UTC</SelectItem>
    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
    <SelectItem value="Europe/London">London (GMT)</SelectItem>
    <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
    <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
    <SelectItem value="Australia/Sydney">Sydney (AEST)</SelectItem>
  </SelectContent>
</Select>
```

---

## Icons

| Icon | Usage |
|------|-------|
| `Bell` | Notification trigger, in-app settings |
| `Mail` | Email settings |
| `Moon` | Quiet hours |
| `Clock` | Time inputs |
| `Globe` | Timezone |
| `Check` | Mark as read |
| `CheckCheck` | Mark all as read |
| `Settings` | Settings access |
| `Trash2` | Delete notification |
| `ExternalLink` | Open in new tab |

---

## Loading States

### Notification List Loading

```tsx
{isLoading && notifications.length === 0 ? (
  <div className="space-y-2 p-2">
    {[1, 2, 3].map((i) => (
      <div key={i} className="space-y-1">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    ))}
  </div>
) : ...}
```

### Load More Button

```tsx
{hasMore && (
  <div className="p-2">
    <Button
      variant="ghost"
      size="sm"
      className="w-full"
      onClick={loadMore}
      disabled={isLoading}
    >
      {isLoading ? 'Loading...' : 'Load more'}
    </Button>
  </div>
)}
```

---

## Empty State

```tsx
<div className="p-4 text-center text-sm text-muted-foreground">
  No notifications yet
</div>
```

---

## Visual States

### Unread Notification

```tsx
className={cn(
  'relative px-3 py-2',
  !notification.is_read && 'bg-accent/50'  // Highlighted background
)}

// Unread dot indicator
{!notification.is_read && (
  <div className="absolute left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary" />
)}

// Bold title for unread
<p className={cn('text-sm', !notification.is_read && 'font-medium')}>
  {notification.title}
</p>
```

### Urgent Notification

```tsx
{notification.is_urgent && (
  <Badge variant="destructive" className="shrink-0 text-xs">
    Urgent
  </Badge>
)}
```

---

## Toast Messages

```tsx
// Settings saved
toast({
  title: 'Settings saved',
  description: 'Your notification preferences have been updated.',
})

// Settings error
toast({
  variant: 'destructive',
  title: 'Failed to save settings',
  description: error.message,
})
```

---

## Notification Types

Common notification types in Vanguard PBP:

| Type | Title Example | Description |
|------|---------------|-------------|
| New Post | "New post in [Scene]" | Character posted a new action |
| Phase Transition | "Phase transition in [Campaign]" | GM/PC phase has begun |
| Roll Result | "Roll resolved" | A dice roll has been resolved |
| Time Gate Warning | "Time gate expiring soon" | Phase ending soon |
| Mention | "You were mentioned" | Another player referenced you |
| Turn Available | "Your turn to post" | Character's turn in rotation |

---

## Accessibility

- Badge counts use `aria-label` for screen readers
- Button titles provide context for icon-only buttons
- Focus management in dropdown menu
- Keyboard navigation support via Radix DropdownMenu

```tsx
<Button title="Mark as read">
  <Check className="h-3 w-3" />
</Button>
```
