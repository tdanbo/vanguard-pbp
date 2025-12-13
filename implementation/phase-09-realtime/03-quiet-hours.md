# Quiet Hours

## Overview

Implement timezone-aware quiet hours that allow users to specify periods during which notifications should be queued rather than delivered immediately. Queued notifications are delivered after quiet hours end.

## PRD References

- **prd/notifications.md**: Quiet hours configuration and behavior
- **prd/settings.md**: User notification preferences

## Skills

- **notification-system**: Quiet hours queuing logic
- **go-api-server**: Backend notification queueing

## Database Schema

Already defined in notification_preferences table:

```sql
CREATE TABLE notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email_preference TEXT NOT NULL DEFAULT 'realtime',
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    quiet_hours_timezone TEXT DEFAULT 'UTC',
    urgent_bypass_quiet BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deliver_after TIMESTAMPTZ NOT NULL
);
```

## Quiet Hours Configuration UI

### Settings Component

```typescript
// components/settings/QuietHoursSettings.tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const quietHoursSchema = z.object({
  enabled: z.boolean(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string(),
  urgent_bypass: z.boolean(),
});

type QuietHoursFormData = z.infer<typeof quietHoursSchema>;

export function QuietHoursSettings() {
  const queryClient = useQueryClient();

  const { data: preferences } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPreferences,
  });

  const form = useForm<QuietHoursFormData>({
    resolver: zodResolver(quietHoursSchema),
    defaultValues: {
      enabled: preferences?.quiet_hours_enabled || false,
      start_time: preferences?.quiet_hours_start || '22:00',
      end_time: preferences?.quiet_hours_end || '08:00',
      timezone: preferences?.quiet_hours_timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      urgent_bypass: preferences?.urgent_bypass_quiet || false,
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateQuietHours,
    onSuccess: () => {
      queryClient.invalidateQueries(['notification-preferences']);
      toast.success('Quiet hours updated');
    },
  });

  const onSubmit = (data: QuietHoursFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <div>
                <FormLabel>Enable Quiet Hours</FormLabel>
                <FormDescription>
                  Queue notifications during specified hours instead of sending immediately
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {form.watch('enabled') && (
          <>
            <FormField
              control={form.control}
              name="start_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Time</FormLabel>
                  <FormControl>
                    <input
                      type="time"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    When quiet hours begin
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="end_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Time</FormLabel>
                  <FormControl>
                    <input
                      type="time"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    When quiet hours end
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Timezone for quiet hours calculation
                  </FormDescription>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="urgent_bypass"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <div>
                    <FormLabel>Urgent Notifications Bypass</FormLabel>
                    <FormDescription>
                      Allow urgent notifications to bypass quiet hours
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </>
        )}

        <Button type="submit" disabled={updateMutation.isPending}>
          Save Changes
        </Button>
      </form>
    </Form>
  );
}

// Common timezones
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
  { value: 'Europe/Paris', label: 'Central European Time (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
];
```

### API Endpoint

```go
// handlers/notification_preferences_handler.go
type UpdateQuietHoursRequest struct {
    Enabled      bool   `json:"enabled"`
    StartTime    string `json:"start_time"` // HH:MM format
    EndTime      string `json:"end_time"`   // HH:MM format
    Timezone     string `json:"timezone"`
    UrgentBypass bool   `json:"urgent_bypass"`
}

func (h *NotificationPreferencesHandler) UpdateQuietHours(c *gin.Context) {
    userID := getUserID(c)

    var req UpdateQuietHoursRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
        return
    }

    // Validate timezone
    if _, err := time.LoadLocation(req.Timezone); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid timezone"})
        return
    }

    // Validate time format
    startTime, err := time.Parse("15:04", req.StartTime)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_time format"})
        return
    }

    endTime, err := time.Parse("15:04", req.EndTime)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_time format"})
        return
    }

    err = h.service.UpdateQuietHours(c.Request.Context(), userID, services.UpdateQuietHoursParams{
        Enabled:      req.Enabled,
        StartTime:    startTime,
        EndTime:      endTime,
        Timezone:     req.Timezone,
        UrgentBypass: req.UrgentBypass,
    })
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update quiet hours"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"success": true})
}
```

## Quiet Hours Detection

### Time-in-range Check

```go
// services/quiet_hours_service.go
type QuietHoursService struct {
    db *sqlc.Queries
}

func (s *QuietHoursService) IsInQuietHours(
    ctx context.Context,
    userID uuid.UUID,
    checkTime time.Time,
) (bool, error) {
    prefs, err := s.db.GetNotificationPreferences(ctx, userID)
    if err != nil {
        return false, err
    }

    if !prefs.QuietHoursEnabled {
        return false, nil
    }

    return s.checkQuietHours(prefs, checkTime), nil
}

func (s *QuietHoursService) checkQuietHours(
    prefs *models.NotificationPreferences,
    checkTime time.Time,
) bool {
    // Load timezone
    loc, err := time.LoadLocation(prefs.QuietHoursTimezone)
    if err != nil {
        loc = time.UTC
    }

    // Convert check time to user's timezone
    userTime := checkTime.In(loc)
    currentTimeOfDay := userTime.Format("15:04:05")

    startTime := prefs.QuietHoursStart.Format("15:04:05")
    endTime := prefs.QuietHoursEnd.Format("15:04:05")

    // Handle overnight quiet hours (e.g., 22:00 - 08:00)
    if startTime > endTime {
        // Quiet hours span midnight
        return currentTimeOfDay >= startTime || currentTimeOfDay < endTime
    }

    // Normal quiet hours within same day
    return currentTimeOfDay >= startTime && currentTimeOfDay < endTime
}
```

### Calculate Delivery Time

```go
func (s *QuietHoursService) CalculateDeliveryTime(
    ctx context.Context,
    userID uuid.UUID,
    notificationTime time.Time,
) (time.Time, error) {
    prefs, err := s.db.GetNotificationPreferences(ctx, userID)
    if err != nil {
        return notificationTime, err
    }

    if !prefs.QuietHoursEnabled {
        return notificationTime, nil
    }

    if !s.checkQuietHours(prefs, notificationTime) {
        return notificationTime, nil // Not in quiet hours, deliver immediately
    }

    // Calculate when quiet hours end
    loc, err := time.LoadLocation(prefs.QuietHoursTimezone)
    if err != nil {
        loc = time.UTC
    }

    userTime := notificationTime.In(loc)
    endTime := prefs.QuietHoursEnd

    // Create today's end time
    deliveryTime := time.Date(
        userTime.Year(), userTime.Month(), userTime.Day(),
        endTime.Hour(), endTime.Minute(), endTime.Second(),
        0, loc,
    )

    // If end time already passed today, it means quiet hours started yesterday
    // and will end later today (overnight quiet hours)
    if deliveryTime.Before(userTime) {
        // Check if we're in an overnight quiet hours period
        startTime := prefs.QuietHoursStart

        if startTime.Hour() > endTime.Hour() {
            // Overnight quiet hours, deliver at today's end time
            // (already calculated correctly above)
        } else {
            // Normal quiet hours, but end time passed - deliver tomorrow
            deliveryTime = deliveryTime.Add(24 * time.Hour)
        }
    }

    return deliveryTime.UTC(), nil
}
```

## Notification Queuing

### Queue Notification

```go
// services/notification_service.go
func (s *NotificationService) handleEmailDelivery(
    ctx context.Context,
    notification *models.Notification,
) {
    prefs, err := s.db.GetNotificationPreferences(ctx, notification.UserID)
    if err != nil {
        log.Printf("failed to get preferences: %v", err)
        return
    }

    if prefs.EmailPreference == "off" {
        return
    }

    // Check if in quiet hours
    inQuietHours := s.quietHoursService.IsInQuietHours(
        ctx,
        notification.UserID,
        time.Now(),
    )

    // Check urgent bypass
    if inQuietHours && notification.IsUrgent && prefs.UrgentBypassQuiet {
        // Send immediately despite quiet hours
        s.sendImmediateEmail(ctx, notification)
        return
    }

    if inQuietHours {
        // Queue for later
        deliverAfter, err := s.quietHoursService.CalculateDeliveryTime(
            ctx,
            notification.UserID,
            time.Now(),
        )
        if err != nil {
            log.Printf("failed to calculate delivery time: %v", err)
            return
        }

        _, err = s.db.QueueNotification(ctx, sqlc.QueueNotificationParams{
            UserID:         notification.UserID,
            NotificationID: notification.ID,
            DeliverAfter:   deliverAfter,
        })
        if err != nil {
            log.Printf("failed to queue notification: %v", err)
        }
        return
    }

    // Not in quiet hours, send immediately
    if prefs.EmailPreference == "realtime" {
        s.sendImmediateEmail(ctx, notification)
    }
}
```

## Queued Notification Delivery

### Delivery Cron Job

```go
// cron/queued_notifications_cron.go
type QueuedNotificationsCron struct {
    db           *sqlc.Queries
    emailService *services.EmailService
}

func (c *QueuedNotificationsCron) DeliverQueuedNotifications(ctx context.Context) error {
    // Get notifications ready for delivery
    queued, err := c.db.GetQueuedNotificationsReadyForDelivery(ctx, time.Now())
    if err != nil {
        return fmt.Errorf("failed to get queued notifications: %w", err)
    }

    log.Printf("delivering %d queued notifications", len(queued))

    for _, q := range queued {
        // Send email
        notification, err := c.db.GetNotification(ctx, q.NotificationID)
        if err != nil {
            log.Printf("failed to get notification %s: %v", q.NotificationID, err)
            continue
        }

        err = c.emailService.SendNotificationEmail(ctx, notification)
        if err != nil {
            log.Printf("failed to send email for notification %s: %v", q.NotificationID, err)
            // Don't delete from queue, will retry next run
            continue
        }

        // Remove from queue
        err = c.db.DeleteQueuedNotification(ctx, q.ID)
        if err != nil {
            log.Printf("failed to delete queued notification %s: %v", q.ID, err)
        }
    }

    return nil
}
```

### SQL Query

```sql
-- queries/notification_queue.sql
-- name: GetQueuedNotificationsReadyForDelivery :many
SELECT *
FROM notification_queue
WHERE deliver_after <= $1
ORDER BY deliver_after ASC
LIMIT 100;

-- name: QueueNotification :one
INSERT INTO notification_queue (
    user_id,
    notification_id,
    deliver_after
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: DeleteQueuedNotification :exec
DELETE FROM notification_queue
WHERE id = $1;
```

## Timezone Changes

### Handle Timezone Update

```go
// services/notification_preferences_service.go
func (s *NotificationPreferencesService) UpdateQuietHours(
    ctx context.Context,
    userID uuid.UUID,
    params UpdateQuietHoursParams,
) error {
    // Get current preferences
    current, err := s.db.GetNotificationPreferences(ctx, userID)
    if err != nil {
        return err
    }

    // Update preferences
    _, err = s.db.UpdateQuietHours(ctx, sqlc.UpdateQuietHoursParams{
        UserID:              userID,
        QuietHoursEnabled:   params.Enabled,
        QuietHoursStart:     params.StartTime,
        QuietHoursEnd:       params.EndTime,
        QuietHoursTimezone:  params.Timezone,
        UrgentBypassQuiet:   params.UrgentBypass,
    })
    if err != nil {
        return err
    }

    // If timezone changed, recalculate queued notification delivery times
    if current.QuietHoursTimezone != params.Timezone {
        go s.recalculateQueuedNotifications(context.Background(), userID, params.Timezone)
    }

    return nil
}

func (s *NotificationPreferencesService) recalculateQueuedNotifications(
    ctx context.Context,
    userID uuid.UUID,
    newTimezone string,
) {
    // Get user's queued notifications
    queued, err := s.db.GetUserQueuedNotifications(ctx, userID)
    if err != nil {
        log.Printf("failed to get queued notifications: %v", err)
        return
    }

    for _, q := range queued {
        // Recalculate delivery time with new timezone
        deliverAfter, err := s.quietHoursService.CalculateDeliveryTime(
            ctx,
            userID,
            q.QueuedAt,
        )
        if err != nil {
            log.Printf("failed to recalculate delivery time: %v", err)
            continue
        }

        // Update queued notification
        _, err = s.db.UpdateQueuedNotificationDeliveryTime(ctx, sqlc.UpdateQueuedNotificationDeliveryTimeParams{
            ID:           q.ID,
            DeliverAfter: deliverAfter,
        })
        if err != nil {
            log.Printf("failed to update delivery time: %v", err)
        }
    }

    log.Printf("recalculated %d queued notifications for user %s", len(queued), userID)
}
```

## Visual Indicators

### Show Queued Status

```typescript
// components/NotificationQueuedIndicator.tsx
export function NotificationQueuedIndicator({ userId }: { userId: string }) {
  const { data: queuedCount } = useQuery({
    queryKey: ['notification-queue', userId],
    queryFn: () => fetchQueuedCount(userId),
    refetchInterval: 60000, // Check every minute
  });

  const { data: preferences } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: fetchNotificationPreferences,
  });

  if (!preferences?.quiet_hours_enabled || !queuedCount || queuedCount === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2">
        <Moon className="h-4 w-4 text-blue-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">
            Quiet Hours Active
          </p>
          <p className="text-xs text-blue-700">
            {queuedCount} notification{queuedCount !== 1 ? 's' : ''} queued for delivery
            after {formatTime(preferences.quiet_hours_end)}
          </p>
        </div>
      </div>
    </div>
  );
}
```

## Edge Cases

### 1. Overnight Quiet Hours

**Issue**: Quiet hours span midnight (e.g., 22:00 - 08:00)

**Solution**: Special handling in time comparison
```go
if startTime > endTime {
    // Quiet hours span midnight
    return currentTimeOfDay >= startTime || currentTimeOfDay < endTime
}
```

### 2. Daylight Saving Time Transitions

**Issue**: DST change during quiet hours

**Solution**: Always use timezone-aware calculations
```go
loc, err := time.LoadLocation(prefs.QuietHoursTimezone)
if err != nil {
    loc = time.UTC
}

userTime := checkTime.In(loc) // Handles DST automatically
```

### 3. User Disables Quiet Hours With Queued Notifications

**Issue**: Notifications stuck in queue

**Solution**: Deliver immediately when quiet hours disabled
```go
func (s *NotificationPreferencesService) UpdateQuietHours(
    ctx context.Context,
    userID uuid.UUID,
    params UpdateQuietHoursParams,
) error {
    // ... update preferences ...

    // If disabled, deliver all queued notifications immediately
    if !params.Enabled {
        go s.deliverAllQueuedNotifications(ctx, userID)
    }

    return nil
}

func (s *NotificationPreferencesService) deliverAllQueuedNotifications(
    ctx context.Context,
    userID uuid.UUID,
) {
    queued, err := s.db.GetUserQueuedNotifications(ctx, userID)
    if err != nil {
        log.Printf("failed to get queued notifications: %v", err)
        return
    }

    for _, q := range queued {
        notification, err := s.db.GetNotification(ctx, q.NotificationID)
        if err != nil {
            continue
        }

        // Send immediately
        s.emailService.SendNotificationEmail(ctx, notification)

        // Remove from queue
        s.db.DeleteQueuedNotification(ctx, q.ID)
    }
}
```

### 4. Timezone Not Found

**Issue**: Invalid timezone string

**Solution**: Fallback to UTC
```go
loc, err := time.LoadLocation(prefs.QuietHoursTimezone)
if err != nil {
    log.Printf("invalid timezone %s, using UTC: %v", prefs.QuietHoursTimezone, err)
    loc = time.UTC
}
```

### 5. Urgent Notification During Quiet Hours

**Issue**: Critical notification needs to be sent

**Solution**: Urgent bypass setting
```go
if inQuietHours && notification.IsUrgent && prefs.UrgentBypassQuiet {
    s.sendImmediateEmail(ctx, notification)
    return
}
```

### 6. Queue Growth During Extended Quiet Hours

**Issue**: Too many notifications queued

**Solution**: Batch delivery and limits
```go
const maxQueuedNotifications = 50

func (s *NotificationService) queueForLater(...) error {
    // Check queue size
    queueSize, err := s.db.GetUserQueuedCount(ctx, notification.UserID)
    if err != nil {
        return err
    }

    if queueSize >= maxQueuedNotifications {
        // Force delivery of oldest
        s.deliverOldestQueued(ctx, notification.UserID)
    }

    // Queue notification
    // ...
}
```

## Testing Checklist

- [ ] Quiet hours enabled in settings
- [ ] Notifications queued during quiet hours
- [ ] Notifications delivered after quiet hours end
- [ ] Overnight quiet hours work correctly (22:00-08:00)
- [ ] Timezone selection works
- [ ] Timezone change recalculates delivery times
- [ ] Urgent notifications bypass quiet hours (if enabled)
- [ ] Urgent bypass can be disabled
- [ ] Disabling quiet hours delivers queued notifications
- [ ] DST transitions handled correctly
- [ ] Invalid timezone falls back to UTC
- [ ] Queued notification count displayed
- [ ] Delivery cron job runs on schedule
- [ ] Email delivery retries on failure
- [ ] Queue size limits enforced
- [ ] API validation rejects invalid times
- [ ] API validation rejects invalid timezones

## Verification Steps

1. **Basic Quiet Hours Test**:
   ```bash
   # Set quiet hours 14:00-15:00 (1 hour window for testing)
   # Trigger notification at 14:30
   # Verify notification queued, not sent
   # Wait until 15:01
   # Verify notification delivered
   ```

2. **Overnight Test**:
   ```bash
   # Set quiet hours 23:00-01:00
   # Trigger notification at 23:30
   # Verify queued
   # Wait until 01:01
   # Verify delivered
   ```

3. **Timezone Test**:
   ```bash
   # Set timezone to America/New_York
   # Set quiet hours 22:00-08:00
   # Trigger notification (ensure it's quiet hours in NY)
   # Verify queued
   # Change timezone to America/Los_Angeles
   # Verify delivery time recalculated
   ```

4. **Urgent Bypass Test**:
   ```bash
   # Enable quiet hours and urgent bypass
   # Trigger urgent notification during quiet hours
   # Verify delivered immediately
   # Disable urgent bypass
   # Trigger urgent notification
   # Verify queued
   ```

5. **Disable Test**:
   ```bash
   # Enable quiet hours
   # Queue 3 notifications
   # Disable quiet hours
   # Verify all 3 delivered immediately
   ```

## Performance Considerations

- Index on notification_queue.deliver_after for fast queries
- Batch delivery of queued notifications (100 per run)
- Cache user preferences (5 minute TTL)
- Run delivery cron every 5 minutes
- Limit queue size per user (50 max)
- Clean up old queue entries (24 hours)

## Security Considerations

- Validate timezone input against known timezones
- Rate limit preference updates (prevent abuse)
- Validate time format (HH:MM)
- Ensure queued notifications respect RLS policies
- Audit log for quiet hours changes
- Prevent queue flooding by single user
