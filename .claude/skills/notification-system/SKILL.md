---
name: notification-system
description: Notification delivery patterns for the Vanguard PBP system. Use this skill when implementing or debugging email notifications (realtime, digest_daily, digest_weekly, off), in-app notifications, quiet hours (timezone-aware queuing), batch/digest logic, notification triggers (phase transitions, posts, rolls, time gates), badge counts, and notification history. Critical for player engagement and GM awareness.
---

# Notification System

## Overview

This skill provides patterns and implementation guidance for the Vanguard PBP notification system, which delivers timely, contextual alerts to players and GMs across multiple channels (in-app, email, future push). The system supports flexible delivery preferences, quiet hours, digest batching, and ensures minimal spoilers while maximizing actionability.

## Core Capabilities

### 1. Notification Channels

#### In-App Notifications
Always-on channel providing real-time feedback within the application.

**Features:**
- Real-time updates via WebSocket
- Badge counts on scenes and campaigns
- Notification center with persistent history
- Immediate delivery (no batching)

**Implementation Pattern:**
```typescript
interface InAppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string;
  campaignId?: string;
  sceneId?: string;
  characterId?: string;
  createdAt: timestamp;
  readAt?: timestamp;
  priority: 'normal' | 'urgent';
}

// Badge count logic
function getUnreadCount(userId: string, scope: 'campaign' | 'scene', scopeId: string): number {
  // Count unread notifications filtered by scope
  return count(notifications where readAt IS NULL AND scope matches scopeId);
}
```

**WebSocket Event:**
```typescript
// Server → Client
{
  type: 'notification.new',
  payload: {
    notification: InAppNotification,
    badgeCounts: {
      campaignId: number,
      sceneId?: number
    }
  }
}
```

#### Email Notifications
User-configurable channel with multiple delivery modes.

**Delivery Modes:**
- `realtime` - Immediate email for each trigger
- `digest_daily` - Single email at user's preferred time
- `digest_weekly` - Single email once per week
- `off` - No email notifications

**User Preferences Schema:**
```typescript
interface NotificationPreferences {
  userId: string;
  emailMode: 'realtime' | 'digest_daily' | 'digest_weekly' | 'off';
  digestTime?: string;          // "09:00" in user's timezone
  digestDay?: number;           // 0-6 for weekly (0 = Sunday)
  timezone: string;             // IANA timezone (e.g., "America/New_York")
  quietHours?: QuietHoursConfig;
}
```

**Email Template Structure:**
```
Subject: [Trigger-specific subject]

[Greeting]

[Primary message with minimal spoilers]
[Actionable instruction]

[CTA Buttons: View Campaign | Direct Link]

--
Campaign: [Campaign Name]
Your Active Characters: [Character 1 (Scene)], [Character 2 (Scene)]

[Unsubscribe/Preferences link]
```

**Digest Email Pattern:**
```
Subject: Daily Digest - [Campaign Name]

You have activity in [N] scenes:

1. [Scene Name]
   - New post from [Character]
   - GM requests a roll
   [View Scene]

2. [Scene Name]
   - PC Phase started
   - 24 hours remaining
   [View Scene]

--
Campaign: [Campaign Name]
```

### 2. Quiet Hours

Timezone-aware notification suppression that queues non-urgent notifications during specified hours.

**Configuration:**
```typescript
interface QuietHoursConfig {
  enabled: boolean;
  startTime: string;           // "22:00" (10 PM)
  endTime: string;             // "08:00" (8 AM)
  daysOfWeek?: number[];       // [0,1,2,3,4,5,6] or subset
  allowUrgent: boolean;        // Override for urgent notifications
}
```

**Implementation Logic:**
```typescript
function shouldQueueDuringQuietHours(
  notification: Notification,
  userPrefs: NotificationPreferences
): boolean {
  if (!userPrefs.quietHours?.enabled) return false;
  if (notification.priority === 'urgent' && userPrefs.quietHours.allowUrgent) {
    return false; // Deliver urgent notifications immediately
  }

  const userNow = DateTime.now().setZone(userPrefs.timezone);
  const dayOfWeek = userNow.weekday % 7; // Convert to 0-6

  // Check if today is included in quiet days
  if (userPrefs.quietHours.daysOfWeek &&
      !userPrefs.quietHours.daysOfWeek.includes(dayOfWeek)) {
    return false;
  }

  const start = DateTime.fromFormat(userPrefs.quietHours.startTime, 'HH:mm', {
    zone: userPrefs.timezone
  });
  const end = DateTime.fromFormat(userPrefs.quietHours.endTime, 'HH:mm', {
    zone: userPrefs.timezone
  });

  // Handle overnight ranges (e.g., 22:00 - 08:00)
  if (end < start) {
    return userNow >= start || userNow < end;
  }

  return userNow >= start && userNow < end;
}
```

**Queue Management:**
```typescript
// Queue notifications during quiet hours
interface QueuedNotification {
  notification: Notification;
  userId: string;
  queuedAt: timestamp;
  deliverAfter: timestamp; // End of quiet hours
}

// Batch delivery when quiet hours end
async function deliverQueuedNotifications(userId: string) {
  const queued = await getQueuedNotifications(userId);

  if (queued.length === 0) return;

  // Batch into single email if multiple queued
  if (queued.length > 1) {
    await sendBatchEmail(userId, queued);
  } else {
    await sendEmail(userId, queued[0].notification);
  }

  await clearQueue(userId);
}
```

**Urgent Notification Override:**
Critical notifications that bypass quiet hours:
- Time gate warning (1 hour remaining)
- Time gate expired
- GM role available (if player has expressed interest)

### 3. Notification Triggers

#### Player Notification Triggers

**Immediate Triggers:**
```typescript
enum PlayerNotificationType {
  PC_PHASE_STARTED = 'pc_phase_started',
  NEW_POST_IN_SCENE = 'new_post_in_scene',
  ROLL_REQUESTED = 'roll_requested',
  INTENTION_OVERRIDDEN = 'intention_overridden',
  CHARACTER_ENTERED_SCENE = 'character_entered_scene',
  COMPOSE_LOCK_RELEASED = 'compose_lock_released',
  TIME_GATE_WARNING = 'time_gate_warning',
  GM_ROLE_AVAILABLE = 'gm_role_available',
  PASS_STATE_CLEARED = 'pass_state_cleared'
}
```

**Trigger Conditions:**

| Trigger | Condition | Priority | Batched? |
|---------|-----------|----------|----------|
| PC Phase started | `campaign.currentPhase` → `'pc_phase'` | Normal | No |
| New post in scene | Post created in scene where user has character | Normal | Yes |
| Roll requested | GM creates roll request for player's character | Normal | No |
| Intention overridden | GM changes `post.intention` after submission | Normal | No |
| Character entered scene | Character added to `scene.characterIds` | Normal | Yes |
| Compose lock released | `scene.composeLock` released and user was waiting | Normal | No |
| Time gate warning | `campaign.timeGateExpiresAt - now() IN (24h, 6h, 1h)` | Urgent (1h) | No |
| GM role available | GM removes self from campaign | Normal | No |
| Pass state cleared | New post in scene where character had `passState = 'pass'` | Normal | Yes |

**Batched Triggers:**
These can be grouped into digest emails:
- Summary of activity in user's scenes
- Recap of completed posts
- Campaign announcements

**Suppressed Notifications:**
Never notify for:
- Posts in scenes where user has no characters (visibility-filtered)
- Hidden posts by other players (only GM and author see these)
- GM-to-GM notes
- Own posts

#### GM Notification Triggers

**Immediate Triggers:**
```typescript
enum GMNotificationType {
  ALL_CHARACTERS_PASSED = 'all_characters_passed',
  TIME_GATE_EXPIRED = 'time_gate_expired',
  HIDDEN_POST_SUBMITTED = 'hidden_post_submitted',
  PLAYER_JOINED = 'player_joined',
  PLAYER_ROLL_SUBMITTED = 'player_roll_submitted',
  UNRESOLVED_ROLLS_EXIST = 'unresolved_rolls_exist',
  CAMPAIGN_AT_PLAYER_LIMIT = 'campaign_at_player_limit',
  SCENE_LIMIT_WARNING = 'scene_limit_warning'
}
```

**Trigger Conditions:**

| Trigger | Condition | Priority | Data Included |
|---------|-----------|----------|---------------|
| All characters passed | All active characters have `passState != null` | Normal | Scene list |
| Time gate expired | `now() >= campaign.timeGateExpiresAt` | Urgent | Remaining unresolved actions |
| Hidden post submitted | `post.hidden = true` created | Normal | Character, scene |
| Player joined | New entry in `campaign.playerIds` | Normal | Player name |
| Player roll submitted | Roll submitted with `rollType = 'player'` | Normal | Character, result, intention |
| Unresolved rolls exist | GM attempts transition with pending rolls | Urgent | Roll count |
| Campaign at player limit | `campaign.playerIds.length >= 50` | Normal | - |
| Scene limit warning | `campaign.sceneCount IN (20, 23, 24)` | Normal | Current count |

### 4. GM Scene Dashboard Notifications

GMs have an always-visible dashboard showing:

```typescript
interface GMDashboard {
  activeScenes: Array<{
    sceneId: string;
    name: string;
    status: 'waiting' | 'active' | 'ready' | 'blocked';
    pendingHiddenPosts: number;
    unresolvedRolls: number;
    characterActivity: Array<{
      characterId: string;
      passState: PassState | null;
      lastPostAt: timestamp;
    }>;
  }>;

  campaignStatus: {
    currentPhase: PhaseState;
    timeRemaining: number | null;  // milliseconds until time gate
    sceneCount: number;            // X/25
    storageUsage: number;          // bytes of 500 MB
    playerCount: number;           // X/50
  };

  actionRequired: Array<{
    type: 'unresolved_rolls' | 'hidden_posts' | 'time_gate_expiring';
    sceneId?: string;
    count?: number;
    expiresAt?: timestamp;
  }>;
}
```

**Dashboard Badge Logic:**
```typescript
function getSceneStatus(scene: Scene, campaign: Campaign): SceneStatus {
  const unresolvedRolls = countUnresolvedRolls(scene.id);
  const allPassed = scene.characterIds.every(cId =>
    getCharacterPassState(cId) !== null
  );

  if (unresolvedRolls > 0) return 'blocked';
  if (campaign.currentPhase === 'gm_phase') return 'waiting';
  if (allPassed) return 'ready';
  return 'active';
}
```

### 5. Notification Content Principles

**Design Principles:**
1. **Minimal spoilers** - Never include post content or hidden information
2. **Actionable** - Clear instruction on what player should do
3. **Linked** - Direct deep link to relevant view
4. **Contextual** - Include scene and campaign name for clarity

**Example Implementations:**

```typescript
// PC Phase Started
{
  title: "PC Phase started",
  message: "The GM has completed their review and opened the PC Phase. You have 24 hours to post.",
  actionUrl: "/campaigns/{campaignId}",
  context: {
    campaign: "Shadows of Eldoria",
    activeCharacters: [
      { name: "Garrett", scene: "The Tavern" },
      { name: "Thorne", scene: "Forest Path" }
    ]
  }
}

// Roll Requested
{
  title: "[GM Name] requests a roll",
  message: "The GM has requested a [Stealth] roll for your character's intention to sneak past the guards.",
  actionUrl: "/campaigns/{campaignId}/scenes/{sceneId}/posts/{postId}",
  context: {
    character: "Garrett",
    scene: "The Tavern",
    campaign: "Shadows of Eldoria"
  }
}

// New Post in Scene
{
  title: "New post in The Tavern",
  message: "Another character has posted in your scene.",
  actionUrl: "/campaigns/{campaignId}/scenes/{sceneId}",
  context: {
    scene: "The Tavern",
    campaign: "Shadows of Eldoria",
    yourCharacters: ["Garrett"]
  }
}

// Time Gate Warning
{
  title: "1 hour remaining",
  message: "The PC Phase will end in 1 hour. Post or pass before time expires.",
  actionUrl: "/campaigns/{campaignId}",
  priority: "urgent",
  context: {
    campaign: "Shadows of Eldoria",
    charactersWithoutAction: ["Garrett", "Thorne"]
  }
}
```

### 6. Badge Count System

**Scene Badges:**
Show unread post count for scenes with user's characters.

```typescript
function getSceneBadgeCount(sceneId: string, userId: string): number {
  const userCharacters = getUserCharactersInScene(sceneId, userId);
  if (userCharacters.length === 0) return 0;

  const lastRead = getLastReadTimestamp(userId, sceneId);

  return countPosts(sceneId, {
    createdAt: { $gt: lastRead },
    authorId: { $ne: userId },  // Exclude own posts
    hidden: false,              // Exclude hidden posts (unless user is GM)
    visibility: 'visible'       // Only count visible posts
  });
}
```

**Campaign Badges:**
Aggregate badge count across all scenes in campaign.

```typescript
function getCampaignBadgeCount(campaignId: string, userId: string): number {
  const scenes = getUserScenesInCampaign(campaignId, userId);
  return scenes.reduce((total, scene) =>
    total + getSceneBadgeCount(scene.id, userId),
    0
  );
}
```

**Badge Update Events:**
```typescript
// Clear badge when user views scene
function markSceneAsRead(sceneId: string, userId: string) {
  updateLastReadTimestamp(userId, sceneId, now());

  // Emit badge update
  emitToUser(userId, {
    type: 'badges.updated',
    payload: {
      sceneId,
      badgeCount: 0,
      campaignBadgeCount: getCampaignBadgeCount(getCampaignId(sceneId), userId)
    }
  });
}
```

### 7. Notification History

In-app notification center maintains persistent history.

**Schema:**
```typescript
interface NotificationHistory {
  notifications: InAppNotification[];
  pagination: {
    total: number;
    unreadCount: number;
    page: number;
    pageSize: number;
  };
}
```

**Operations:**
```typescript
// Fetch notification history
GET /api/notifications?page=1&pageSize=50&filter=unread

// Mark as read
PATCH /api/notifications/{id}/read

// Mark all as read
POST /api/notifications/mark-all-read

// Delete notification
DELETE /api/notifications/{id}
```

**Retention Policy:**
- Keep all notifications for 90 days
- Archive read notifications after 30 days
- Delete archived notifications after 90 days
- Urgent notifications retained for 180 days

## Implementation Checklist

When implementing the notification system:

- [ ] Set up notification tables/collections with proper indexes
- [ ] Implement user preference storage with timezone support
- [ ] Create notification trigger functions for all event types
- [ ] Build quiet hours evaluation logic with timezone handling
- [ ] Implement queuing system for batched/quiet hour notifications
- [ ] Set up cron jobs for digest delivery (daily/weekly)
- [ ] Create email templates (plain text + HTML) for all notification types
- [ ] Implement WebSocket notification delivery for in-app
- [ ] Build notification center UI with history and pagination
- [ ] Implement badge count calculations and real-time updates
- [ ] Add notification preferences UI in user settings
- [ ] Create GM dashboard with scene status aggregation
- [ ] Set up monitoring for notification delivery failures
- [ ] Implement unsubscribe/preference management links in emails
- [ ] Add notification testing tools for development

## Testing Scenarios

**Quiet Hours:**
- Notification generated during quiet hours is queued
- Urgent notification bypasses quiet hours
- Queued notifications delivered as batch when quiet hours end
- Overnight quiet hours (22:00 - 08:00) handled correctly
- Timezone conversion works for users in different zones

**Digest Batching:**
- Daily digest sent at user's preferred time in their timezone
- Weekly digest sent on correct day of week
- Multiple notifications batched into single digest email
- Digest not sent if no notifications queued

**Trigger Accuracy:**
- PC Phase transition triggers campaign-wide notifications
- New post only notifies users with characters in that scene
- Hidden posts only notify GM
- Roll request notifies correct player
- Time gate warnings sent at 24h, 6h, 1h intervals
- All characters passed triggers GM notification

**Badge Counts:**
- Scene badge increments on new post
- Campaign badge reflects sum of scene badges
- Badge clears when scene marked as read
- Own posts don't increment badge
- Hidden posts don't affect non-GM badges

## UI Components

### NotificationCenter Component

Dropdown accessible from header bell icon:

```tsx
function NotificationCenter() {
  const { notifications, unreadCount, isLoading } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <span className="font-semibold">Notifications</span>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarkAllRead}
                className="text-xs"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => openSettings()}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Notification List */}
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={loadMore}
            >
              Load more
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### NotificationItem Component

Individual notification row:

```tsx
interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function NotificationItem({ notification, onMarkRead, onDelete }: NotificationItemProps) {
  const isUnread = !notification.readAt;

  return (
    <div
      className={cn(
        "relative p-3 hover:bg-accent/50 border-b last:border-b-0 group",
        isUnread && "bg-accent/30"
      )}
    >
      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
      )}

      <div className="pl-3">
        {/* Header: Title + Urgent badge */}
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            "text-sm leading-tight",
            isUnread && "font-semibold"
          )}>
            {notification.title}
          </p>
          {notification.isUrgent && (
            <Badge variant="destructive" className="text-xs shrink-0">
              Urgent
            </Badge>
          )}
        </div>

        {/* Body - 2 line clamp */}
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {notification.body}
        </p>

        {/* Timestamp */}
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>

      {/* Hover Actions */}
      <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
        {isUnread && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(notification.id);
            }}
            title="Mark as read"
          >
            <Check className="h-3 w-3" />
          </Button>
        )}
        {notification.link && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            asChild
          >
            <a href={notification.link} target="_blank" rel="noopener" title="Open in new tab">
              <ExternalLink className="h-3 w-3" />
            </a>
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
```

### NotificationSettings Dialog

User preferences for notifications:

```tsx
function NotificationSettings() {
  const { preferences, updatePreferences, isLoading } = useNotificationPreferences();
  const form = useForm<NotificationPreferencesForm>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: preferences,
  });

  return (
    <Dialog>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Notification Settings</DialogTitle>
          <DialogDescription>
            Configure how and when you receive notifications.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* In-App Notifications */}
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">In-App Notifications</h3>
              </div>
              <FormField
                control={form.control}
                name="inAppEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between">
                    <FormLabel className="font-normal">
                      Enable in-app notifications
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </Card>

            {/* Email Notifications */}
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">Email Notifications</h3>
              </div>
              <FormField
                control={form.control}
                name="emailEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between mb-3">
                    <FormLabel className="font-normal">
                      Enable email notifications
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('emailEnabled') && (
                <FormField
                  control={form.control}
                  name="emailFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Delivery frequency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="realtime">Immediately</SelectItem>
                          <SelectItem value="digest_daily">Daily digest</SelectItem>
                          <SelectItem value="digest_weekly">Weekly digest</SelectItem>
                          <SelectItem value="off">Off</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}
            </Card>

            {/* Quiet Hours */}
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Moon className="h-5 w-5 text-muted-foreground" />
                <h3 className="font-medium">Quiet Hours</h3>
              </div>
              <FormField
                control={form.control}
                name="quietHoursEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between mb-3">
                    <FormLabel className="font-normal">
                      Enable quiet hours
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('quietHoursEnabled') && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="quietStart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Start
                          </FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="quietEnd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            End
                          </FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          Timezone
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                            <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                            <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                            <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                            <SelectItem value="UTC">UTC</SelectItem>
                            <SelectItem value="Europe/London">GMT</SelectItem>
                            <SelectItem value="Europe/Paris">CET</SelectItem>
                            <SelectItem value="Asia/Tokyo">JST</SelectItem>
                            <SelectItem value="Australia/Sydney">AEST</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="allowUrgentInQuiet"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between">
                        <FormLabel className="font-normal text-sm">
                          Allow urgent notifications during quiet hours
                        </FormLabel>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </Card>

            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### UnreadBadge Component

For navigation elements showing unread count:

```tsx
function UnreadBadge({ count, max = 99 }: { count: number; max?: number }) {
  if (count === 0) return null;

  return (
    <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-medium">
      {count > max ? `${max}+` : count}
    </span>
  );
}

// Usage in navigation
<Button variant="ghost" className="relative">
  <Bell className="h-5 w-5" />
  <UnreadBadge count={unreadCount} className="absolute -top-1 -right-1" />
</Button>
```

### SceneBadge Component

Shows unread post count on scene cards:

```tsx
function SceneBadge({ sceneId }: { sceneId: string }) {
  const { badgeCount } = useSceneBadge(sceneId);

  if (badgeCount === 0) return null;

  return (
    <Badge className="bg-gold-dim text-foreground text-xs">
      {badgeCount} NEW
    </Badge>
  );
}

// Usage in scene card
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>{scene.title}</CardTitle>
      <SceneBadge sceneId={scene.id} />
    </div>
  </CardHeader>
</Card>
```

### Icons Used

```tsx
import {
  Bell,          // Notifications trigger
  Mail,          // Email settings
  Moon,          // Quiet hours
  Clock,         // Time inputs
  Globe,         // Timezone
  Check,         // Mark as read
  CheckCheck,    // Mark all as read
  Settings,      // Settings button
  Trash2,        // Delete notification
  ExternalLink,  // Open in new tab
  Loader2,       // Loading state
} from "lucide-react";
```
