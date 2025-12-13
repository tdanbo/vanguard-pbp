# Notification System

## Overview

Implement comprehensive notification triggers and delivery for both players and GMs. Support in-app notifications, email delivery with multiple preference modes, notification history, and badge counts.

## PRD References

- **prd/notifications.md**: Notification triggers, delivery preferences, quiet hours
- **prd/turn-structure.md**: Phase transitions, time gates, pass state
- **prd/core-concepts.md**: Witness-based visibility

## Skills

- **notification-system**: Notification delivery patterns
- **go-api-server**: Backend notification service

## Database Schema

```sql
-- Notification preferences
CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email_preference TEXT NOT NULL DEFAULT 'realtime' CHECK (email_preference IN ('realtime', 'digest_daily', 'digest_weekly', 'off')),
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    quiet_hours_timezone TEXT DEFAULT 'UTC',
    urgent_bypass_quiet BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    is_urgent BOOLEAN NOT NULL DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days')
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_campaign ON notifications(campaign_id, created_at DESC);
CREATE INDEX idx_notifications_expires ON notifications(expires_at);

-- Notification queue (for quiet hours)
CREATE TABLE notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deliver_after TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_notification_queue_deliver ON notification_queue(deliver_after);

-- Email digest tracking
CREATE TABLE email_digests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    digest_type TEXT NOT NULL CHECK (digest_type IN ('daily', 'weekly')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notification_count INT NOT NULL,
    campaign_ids UUID[] NOT NULL
);

CREATE INDEX idx_email_digests_user ON email_digests(user_id, sent_at DESC);
```

## Notification Types

### Player Notifications

```go
// models/notification_types.go
const (
    // Phase notifications
    NotifPCPhaseStarted = "pc_phase_started"

    // Post notifications
    NotifNewPostInScene = "new_post_in_scene"

    // Roll notifications
    NotifRollRequested = "roll_requested"
    NotifIntentionOverridden = "intention_overridden"

    // Character notifications
    NotifCharacterAddedToScene = "character_added_to_scene"

    // Compose notifications
    NotifComposeLockReleased = "compose_lock_released"

    // Time gate notifications
    NotifTimeGateWarning24h = "time_gate_warning_24h"
    NotifTimeGateWarning6h = "time_gate_warning_6h"
    NotifTimeGateWarning1h = "time_gate_warning_1h"

    // Pass state notifications
    NotifPassStateCleared = "pass_state_cleared"

    // GM role notifications
    NotifGMRoleAvailable = "gm_role_available"
)
```

### GM Notifications

```go
const (
    // Pass notifications
    NotifAllCharactersPassed = "all_characters_passed"

    // Time gate notifications
    NotifTimeGateExpired = "time_gate_expired"

    // Post notifications
    NotifHiddenPostSubmitted = "hidden_post_submitted"

    // Player notifications
    NotifPlayerJoined = "player_joined"

    // Roll notifications
    NotifPlayerRollSubmitted = "player_roll_submitted"
    NotifUnresolvedRollsExist = "unresolved_rolls_exist"

    // Campaign limits
    NotifCampaignAtPlayerLimit = "campaign_at_player_limit"
    NotifSceneLimitWarning = "scene_limit_warning"
)
```

## Notification Service

### Core Service

```go
// services/notification_service.go
type NotificationService struct {
    db           *sqlc.Queries
    emailService *EmailService
    supabase     *supabase.Client
}

type CreateNotificationParams struct {
    UserID      uuid.UUID
    CampaignID  uuid.UUID
    CharacterID *uuid.UUID
    Type        string
    Title       string
    Message     string
    Link        *string
    IsUrgent    bool
    Metadata    map[string]interface{}
}

func (s *NotificationService) Create(
    ctx context.Context,
    params CreateNotificationParams,
) (*models.Notification, error) {
    // Create notification
    notification, err := s.db.CreateNotification(ctx, sqlc.CreateNotificationParams{
        UserID:      params.UserID,
        CampaignID:  params.CampaignID,
        CharacterID: params.CharacterID,
        Type:        params.Type,
        Title:       params.Title,
        Message:     params.Message,
        Link:        params.Link,
        IsUrgent:    params.IsUrgent,
        Metadata:    params.Metadata,
    })
    if err != nil {
        return nil, fmt.Errorf("failed to create notification: %w", err)
    }

    // Broadcast in-app notification
    go s.broadcastNotification(ctx, notification)

    // Handle email delivery
    go s.handleEmailDelivery(ctx, notification)

    return notification, nil
}
```

### Email Delivery Logic

```go
func (s *NotificationService) handleEmailDelivery(
    ctx context.Context,
    notification *models.Notification,
) {
    // Get user preferences
    prefs, err := s.db.GetNotificationPreferences(ctx, notification.UserID)
    if err != nil {
        log.Printf("failed to get preferences: %v", err)
        return
    }

    // Check email preference
    switch prefs.EmailPreference {
    case "off":
        return // No email

    case "realtime":
        // Check quiet hours
        if s.isInQuietHours(prefs, notification) {
            s.queueForLater(ctx, notification, prefs)
        } else {
            s.sendImmediateEmail(ctx, notification)
        }

    case "digest_daily", "digest_weekly":
        // Add to digest queue (cron job will send)
        return

    default:
        log.Printf("unknown email preference: %s", prefs.EmailPreference)
    }
}
```

### Quiet Hours Check

```go
func (s *NotificationService) isInQuietHours(
    prefs *models.NotificationPreferences,
    notification *models.Notification,
) bool {
    if !prefs.QuietHoursEnabled {
        return false
    }

    // Urgent notifications can bypass quiet hours
    if notification.IsUrgent && prefs.UrgentBypassQuiet {
        return false
    }

    // Get current time in user's timezone
    loc, err := time.LoadLocation(prefs.QuietHoursTimezone)
    if err != nil {
        loc = time.UTC
    }

    now := time.Now().In(loc)
    currentTime := now.Format("15:04:05")

    start := prefs.QuietHoursStart.Format("15:04:05")
    end := prefs.QuietHoursEnd.Format("15:04:05")

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if start > end {
        return currentTime >= start || currentTime < end
    }

    return currentTime >= start && currentTime < end
}
```

### Queue for Later Delivery

```go
func (s *NotificationService) queueForLater(
    ctx context.Context,
    notification *models.Notification,
    prefs *models.NotificationPreferences,
) error {
    // Calculate delivery time (after quiet hours end)
    deliverAfter := s.calculateDeliveryTime(prefs)

    _, err := s.db.QueueNotification(ctx, sqlc.QueueNotificationParams{
        UserID:         notification.UserID,
        NotificationID: notification.ID,
        DeliverAfter:   deliverAfter,
    })

    return err
}

func (s *NotificationService) calculateDeliveryTime(
    prefs *models.NotificationPreferences,
) time.Time {
    loc, err := time.LoadLocation(prefs.QuietHoursTimezone)
    if err != nil {
        loc = time.UTC
    }

    now := time.Now().In(loc)
    endTime := prefs.QuietHoursEnd

    // Create today's end time
    deliveryTime := time.Date(
        now.Year(), now.Month(), now.Day(),
        endTime.Hour(), endTime.Minute(), endTime.Second(),
        0, loc,
    )

    // If end time already passed today, deliver tomorrow
    if deliveryTime.Before(now) {
        deliveryTime = deliveryTime.Add(24 * time.Hour)
    }

    return deliveryTime
}
```

## Notification Triggers

### PC Phase Started

```go
// services/phase_transition_service.go
func (s *PhaseTransitionService) notifyPCPhaseStarted(
    ctx context.Context,
    campaign *models.Campaign,
) error {
    // Get all PC characters in campaign
    characters, err := s.db.GetPCCharactersInCampaign(ctx, campaign.ID)
    if err != nil {
        return err
    }

    // Notify each player
    for _, char := range characters {
        _, err := s.notificationService.Create(ctx, notification.CreateNotificationParams{
            UserID:      char.UserID,
            CampaignID:  campaign.ID,
            CharacterID: &char.ID,
            Type:        notification.NotifPCPhaseStarted,
            Title:       "Your Turn!",
            Message:     fmt.Sprintf("PC Phase has started in %s", campaign.Name),
            Link:        strPtr(fmt.Sprintf("/campaigns/%s", campaign.ID)),
            IsUrgent:    true,
        })
        if err != nil {
            log.Printf("failed to notify user %s: %v", char.UserID, err)
        }
    }

    return nil
}
```

### New Post in Scene

```go
// services/post_service.go
func (s *PostService) notifyNewPost(
    ctx context.Context,
    post *models.Post,
) error {
    // Get scene info
    scene, err := s.db.GetScene(ctx, post.SceneID)
    if err != nil {
        return err
    }

    // Determine who should be notified based on witness list
    var notifyUserIDs []uuid.UUID

    if post.IsHidden {
        // Notify witnesses only
        for _, witnessID := range post.WitnessList {
            char, err := s.db.GetCharacter(ctx, witnessID)
            if err != nil {
                continue
            }

            // Don't notify the author
            if char.UserID != post.AuthorUserID {
                notifyUserIDs = append(notifyUserIDs, char.UserID)
            }
        }
    } else {
        // Notify all characters in scene
        characters, err := s.db.GetCharactersInScene(ctx, scene.ID)
        if err != nil {
            return err
        }

        for _, char := range characters {
            if char.UserID != post.AuthorUserID {
                notifyUserIDs = append(notifyUserIDs, char.UserID)
            }
        }
    }

    // Send notifications
    for _, userID := range notifyUserIDs {
        _, err := s.notificationService.Create(ctx, notification.CreateNotificationParams{
            UserID:     userID,
            CampaignID: post.CampaignID,
            Type:       notification.NotifNewPostInScene,
            Title:      "New Post",
            Message:    fmt.Sprintf("New post in %s", scene.Name),
            Link:       strPtr(fmt.Sprintf("/campaigns/%s/scenes/%s", post.CampaignID, scene.ID)),
            IsUrgent:   false,
        })
        if err != nil {
            log.Printf("failed to notify user %s: %v", userID, err)
        }
    }

    return nil
}
```

### Time Gate Warnings

```go
// services/time_gate_service.go
func (s *TimeGateService) CheckTimeGateWarnings(ctx context.Context) error {
    // Get all active campaigns with time gates
    campaigns, err := s.db.GetCampaignsWithActiveTimeGates(ctx)
    if err != nil {
        return err
    }

    now := time.Now()

    for _, campaign := range campaigns {
        if campaign.TimeGateExpiry == nil {
            continue
        }

        timeRemaining := campaign.TimeGateExpiry.Sub(now)

        // 24 hour warning
        if timeRemaining > 23*time.Hour && timeRemaining <= 24*time.Hour {
            s.sendTimeGateWarning(ctx, campaign, notification.NotifTimeGateWarning24h, "24 hours")
        }

        // 6 hour warning
        if timeRemaining > 5*time.Hour && timeRemaining <= 6*time.Hour {
            s.sendTimeGateWarning(ctx, campaign, notification.NotifTimeGateWarning6h, "6 hours")
        }

        // 1 hour warning
        if timeRemaining > 0 && timeRemaining <= 1*time.Hour {
            s.sendTimeGateWarning(ctx, campaign, notification.NotifTimeGateWarning1h, "1 hour")
        }
    }

    return nil
}

func (s *TimeGateService) sendTimeGateWarning(
    ctx context.Context,
    campaign *models.Campaign,
    notifType string,
    duration string,
) {
    // Notify GM
    _, err := s.notificationService.Create(ctx, notification.CreateNotificationParams{
        UserID:     campaign.GMID,
        CampaignID: campaign.ID,
        Type:       notifType,
        Title:      "Time Gate Warning",
        Message:    fmt.Sprintf("PC Phase time gate expires in %s", duration),
        Link:       strPtr(fmt.Sprintf("/campaigns/%s", campaign.ID)),
        IsUrgent:   true,
    })
    if err != nil {
        log.Printf("failed to notify GM: %v", err)
    }
}
```

### All Characters Passed

```go
// services/pass_service.go
func (s *PassService) checkAllCharactersPassed(
    ctx context.Context,
    campaignID uuid.UUID,
) error {
    // Get pass state
    passes, err := s.db.GetPassState(ctx, campaignID)
    if err != nil {
        return err
    }

    // Get total PC count
    pcCount, err := s.db.CountPCsInCampaign(ctx, campaignID)
    if err != nil {
        return err
    }

    // Check if all passed
    if len(passes) == int(pcCount) && pcCount > 0 {
        campaign, err := s.db.GetCampaign(ctx, campaignID)
        if err != nil {
            return err
        }

        // Notify GM
        _, err = s.notificationService.Create(ctx, notification.CreateNotificationParams{
            UserID:     campaign.GMID,
            CampaignID: campaign.ID,
            Type:       notification.NotifAllCharactersPassed,
            Title:      "All Characters Passed",
            Message:    "All PC characters have passed. Ready to transition to GM Phase.",
            Link:       strPtr(fmt.Sprintf("/campaigns/%s", campaign.ID)),
            IsUrgent:   true,
        })

        return err
    }

    return nil
}
```

### Hidden Post Submitted

```go
// services/post_service.go
func (s *PostService) notifyGMHiddenPost(
    ctx context.Context,
    post *models.Post,
) error {
    if !post.IsHidden {
        return nil
    }

    campaign, err := s.db.GetCampaign(ctx, post.CampaignID)
    if err != nil {
        return err
    }

    _, err = s.notificationService.Create(ctx, notification.CreateNotificationParams{
        UserID:     campaign.GMID,
        CampaignID: campaign.ID,
        Type:       notification.NotifHiddenPostSubmitted,
        Title:      "Hidden Post Submitted",
        Message:    "A player submitted a hidden post",
        Link:       strPtr(fmt.Sprintf("/campaigns/%s/posts/%s", campaign.ID, post.ID)),
        IsUrgent:   false,
    })

    return err
}
```

## In-App Notification Center

### React Component

```typescript
// components/NotificationCenter.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function NotificationCenter() {
  const queryClient = useQueryClient();

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    refetchInterval: 30000, // Refresh every 30s
  });

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadCount,
    refetchInterval: 30000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries(['notifications']);
      queryClient.invalidateQueries(['notifications', 'unread-count']);
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications?.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              No notifications
            </div>
          ) : (
            notifications?.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={markAsReadMutation.mutate}
              />
            ))
          )}
        </div>
        <div className="border-t px-4 py-2">
          <Button variant="ghost" className="w-full" asChild>
            <Link href="/notifications">View all</Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const handleClick = () => {
    if (!notification.is_read) {
      onMarkRead(notification.id);
    }

    if (notification.link) {
      window.location.href = notification.link;
    }
  };

  return (
    <DropdownMenuItem
      className={cn(
        'px-4 py-3 cursor-pointer',
        !notification.is_read && 'bg-muted'
      )}
      onClick={handleClick}
    >
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">{notification.title}</p>
          {notification.is_urgent && (
            <Badge variant="destructive" className="text-xs">
              Urgent
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
      {!notification.is_read && (
        <div className="w-2 h-2 bg-primary rounded-full ml-2" />
      )}
    </DropdownMenuItem>
  );
}
```

### API Endpoints

```go
// handlers/notification_handler.go
func (h *NotificationHandler) GetNotifications(c *gin.Context) {
    userID := getUserID(c)

    limit := 50
    if l := c.Query("limit"); l != "" {
        if parsed, err := strconv.Atoi(l); err == nil {
            limit = parsed
        }
    }

    offset := 0
    if o := c.Query("offset"); o != "" {
        if parsed, err := strconv.Atoi(o); err == nil {
            offset = parsed
        }
    }

    notifications, err := h.service.GetUserNotifications(c.Request.Context(), userID, limit, offset)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch notifications"})
        return
    }

    c.JSON(http.StatusOK, notifications)
}

func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
    userID := getUserID(c)

    count, err := h.service.GetUnreadCount(c.Request.Context(), userID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch count"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"count": count})
}

func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
    userID := getUserID(c)
    notificationID := c.Param("id")

    err := h.service.MarkAsRead(c.Request.Context(), userID, notificationID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark as read"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *NotificationHandler) MarkAllAsRead(c *gin.Context) {
    userID := getUserID(c)

    err := h.service.MarkAllAsRead(c.Request.Context(), userID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark all as read"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"success": true})
}
```

## Email Digest System

### Daily Digest Cron Job

```go
// cron/email_digest_cron.go
func (c *EmailDigestCron) SendDailyDigests(ctx context.Context) error {
    // Get users with daily digest preference
    users, err := c.db.GetUsersWithDigestPreference(ctx, "digest_daily")
    if err != nil {
        return err
    }

    for _, user := range users {
        // Get unread notifications from last 24 hours
        notifications, err := c.db.GetUnreadNotificationsSince(
            ctx,
            user.ID,
            time.Now().Add(-24*time.Hour),
        )
        if err != nil {
            log.Printf("failed to get notifications for user %s: %v", user.ID, err)
            continue
        }

        if len(notifications) == 0 {
            continue // No notifications to send
        }

        // Group by campaign
        grouped := c.groupByCampaign(notifications)

        // Send digest email
        err = c.emailService.SendDigest(ctx, user, grouped, "daily")
        if err != nil {
            log.Printf("failed to send digest to user %s: %v", user.ID, err)
            continue
        }

        // Record digest sent
        campaignIDs := make([]uuid.UUID, 0, len(grouped))
        for campaignID := range grouped {
            campaignIDs = append(campaignIDs, campaignID)
        }

        _, err = c.db.RecordEmailDigest(ctx, sqlc.RecordEmailDigestParams{
            UserID:            user.ID,
            DigestType:        "daily",
            NotificationCount: int32(len(notifications)),
            CampaignIDs:       campaignIDs,
        })
        if err != nil {
            log.Printf("failed to record digest: %v", err)
        }
    }

    return nil
}

func (c *EmailDigestCron) groupByCampaign(
    notifications []*models.Notification,
) map[uuid.UUID][]*models.Notification {
    grouped := make(map[uuid.UUID][]*models.Notification)

    for _, notif := range notifications {
        grouped[notif.CampaignID] = append(grouped[notif.CampaignID], notif)
    }

    return grouped
}
```

### Digest Email Template

```html
<!-- templates/email/digest.html -->
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; }
        .campaign { margin-bottom: 30px; }
        .notification { padding: 10px; border-left: 3px solid #3b82f6; margin-bottom: 10px; }
        .notification.urgent { border-left-color: #ef4444; }
        .button { display: inline-block; padding: 10px 20px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; }
    </style>
</head>
<body>
    <h1>Your {{.DigestType}} Notification Digest</h1>
    <p>You have {{.TotalCount}} new notifications across {{.CampaignCount}} campaigns.</p>

    {{range .Campaigns}}
    <div class="campaign">
        <h2>{{.Name}}</h2>
        {{range .Notifications}}
        <div class="notification {{if .IsUrgent}}urgent{{end}}">
            <strong>{{.Title}}</strong>
            <p>{{.Message}}</p>
            <small>{{.CreatedAt}}</small>
        </div>
        {{end}}
        <a href="{{.Link}}" class="button">View Campaign</a>
    </div>
    {{end}}

    <hr>
    <p><small>
        You're receiving this because your notification preference is set to "{{.DigestType}} digest".
        <a href="{{.PreferencesLink}}">Change preferences</a>
    </small></p>
</body>
</html>
```

## Notification History Cleanup

### Expiration Cron Job

```go
// cron/notification_cleanup_cron.go
func (c *NotificationCleanupCron) CleanupExpiredNotifications(ctx context.Context) error {
    // Delete notifications older than 90 days
    result, err := c.db.DeleteExpiredNotifications(ctx)
    if err != nil {
        return fmt.Errorf("failed to delete expired notifications: %w", err)
    }

    log.Printf("deleted %d expired notifications", result.RowsAffected())
    return nil
}
```

```sql
-- queries/notifications.sql
-- name: DeleteExpiredNotifications :execresult
DELETE FROM notifications
WHERE expires_at < NOW();
```

## Badge Count Updates

### Real-time Badge Updates

```typescript
// hooks/useNotificationBadge.ts
export function useNotificationBadge(campaignId?: string) {
  const queryClient = useQueryClient();
  const supabase = useSupabaseClient();

  useEffect(() => {
    const channel = supabase
      .channel('notification-updates')
      .on('broadcast', { event: 'new_notification' }, (payload) => {
        const notification = payload.payload as Notification;

        // Update badge count
        queryClient.setQueryData(
          ['notifications', 'unread-count'],
          (old: number | undefined) => (old || 0) + 1
        );

        // If campaign-specific, update that count too
        if (campaignId && notification.campaign_id === campaignId) {
          queryClient.setQueryData(
            ['notifications', 'unread-count', campaignId],
            (old: number | undefined) => (old || 0) + 1
          );
        }

        // Invalidate notification list
        queryClient.invalidateQueries(['notifications']);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [campaignId, queryClient, supabase]);
}
```

## Edge Cases

### 1. Notification During Phase Transition

**Issue**: User receives notification for action in previous phase

**Solution**: Include phase information in notification metadata
```go
metadata := map[string]interface{}{
    "phase": campaign.CurrentPhase,
    "phase_transitioned_at": campaign.PhaseTransitionedAt,
}
```

### 2. Duplicate Notifications

**Issue**: Same event triggers multiple notifications

**Solution**: Deduplicate based on (user_id, type, campaign_id, metadata) within 5 minutes
```go
func (s *NotificationService) isDuplicate(
    ctx context.Context,
    params CreateNotificationParams,
) (bool, error) {
    cutoff := time.Now().Add(-5 * time.Minute)

    existing, err := s.db.FindSimilarNotification(ctx, sqlc.FindSimilarNotificationParams{
        UserID:     params.UserID,
        CampaignID: params.CampaignID,
        Type:       params.Type,
        CreatedAt:  cutoff,
    })

    return existing != nil, err
}
```

### 3. Email Delivery Failure

**Issue**: Email service unavailable

**Solution**: Retry with exponential backoff
```go
func (s *EmailService) SendWithRetry(
    ctx context.Context,
    email *Email,
    maxRetries int,
) error {
    for i := 0; i < maxRetries; i++ {
        err := s.Send(ctx, email)
        if err == nil {
            return nil
        }

        if i < maxRetries-1 {
            backoff := time.Duration(math.Pow(2, float64(i))) * time.Second
            time.Sleep(backoff)
        }
    }

    return fmt.Errorf("failed after %d retries", maxRetries)
}
```

### 4. Timezone Changes

**Issue**: User changes timezone while notifications queued

**Solution**: Recalculate delivery times
```go
func (s *NotificationService) HandleTimezoneChange(
    ctx context.Context,
    userID uuid.UUID,
    newTimezone string,
) error {
    // Get queued notifications
    queued, err := s.db.GetQueuedNotifications(ctx, userID)
    if err != nil {
        return err
    }

    // Recalculate delivery times
    for _, q := range queued {
        newDeliveryTime := s.recalculateDeliveryTime(q, newTimezone)

        _, err := s.db.UpdateQueuedNotificationDeliveryTime(ctx, sqlc.UpdateQueuedNotificationDeliveryTimeParams{
            ID:           q.ID,
            DeliverAfter: newDeliveryTime,
        })
        if err != nil {
            log.Printf("failed to update delivery time: %v", err)
        }
    }

    return nil
}
```

## Testing Checklist

- [ ] PC Phase start notification sent to all PCs
- [ ] New post notification sent to scene participants
- [ ] Hidden post notification sent only to witnesses
- [ ] Roll request notification sent to correct player
- [ ] Time gate warnings sent at 24h, 6h, 1h
- [ ] All characters passed notification sent to GM
- [ ] Compose lock release notification sent
- [ ] In-app notification center displays notifications
- [ ] Badge count updates in real-time
- [ ] Email sent immediately for realtime preference
- [ ] Notifications queued during quiet hours
- [ ] Queued notifications delivered after quiet hours
- [ ] Daily digest sent with correct notifications
- [ ] Weekly digest sent with correct notifications
- [ ] Notification history paginated correctly
- [ ] Expired notifications cleaned up
- [ ] Duplicate notifications prevented
- [ ] Urgent notifications bypass quiet hours (if enabled)
- [ ] Email delivery retries on failure
- [ ] Timezone changes recalculate delivery times

## Verification Steps

1. **PC Phase Notification Test**:
   ```bash
   # Transition to PC Phase
   # Verify all PC players receive notification within 30s
   ```

2. **Quiet Hours Test**:
   ```bash
   # Set quiet hours 22:00-08:00
   # Create notification at 23:00
   # Verify notification queued, not sent
   # Verify notification delivered at 08:00
   ```

3. **Digest Test**:
   ```bash
   # Set preference to daily digest
   # Create multiple notifications throughout day
   # Wait for daily digest cron (or trigger manually)
   # Verify single email with all notifications
   ```

4. **Badge Count Test**:
   ```bash
   # Create notification
   # Verify badge count increments
   # Mark as read
   # Verify badge count decrements
   ```

## Performance Considerations

- Batch notification creation for bulk events
- Index on (user_id, is_read, created_at) for fast queries
- Cache unread counts with 30s TTL
- Limit notification history to 90 days
- Use background jobs for email delivery
- Rate limit notification creation (prevent spam)

## Security Considerations

- Validate user access to campaign before notifying
- Respect witness lists for hidden posts
- Sanitize notification messages (prevent XSS)
- Validate email addresses before sending
- Rate limit notification endpoints
- Audit log for notification preferences changes
