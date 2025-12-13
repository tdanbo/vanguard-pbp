# Time Gates Implementation

## Overview

Time Gates are configurable countdown timers that start when the GM transitions to PC Phase. When the timer expires, all non-passed characters are auto-passed, but the phase does NOT auto-transition.

## PRD References

- **Turn Structure**: "Time gate presets (24h, 2d, 3d, 4d, 5d), auto-pass on expiration"
- **Notifications**: "Warning notifications at 24h, 6h, 1h remaining"
- **Technical**: "Campaign pause freezes timer, atomic witness transaction"

## Skill Reference

**notification-system** - Time-based notifications, countdown warnings, digest timing

## Database Schema

```sql
-- Campaigns table with time gate fields
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gm_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,

  -- Phase state
  current_phase TEXT NOT NULL DEFAULT 'gm_phase',

  -- Time gate configuration
  time_gate_duration INTERVAL,        -- e.g., '2 days', '24 hours'
  time_gate_started_at TIMESTAMPTZ,   -- When current PC phase started
  time_gate_paused_at TIMESTAMPTZ,    -- When campaign was paused
  time_gate_elapsed INTERVAL,         -- Accumulated elapsed time before pause

  -- Campaign control
  is_paused BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Time Gate Presets

### Preset Configuration

```go
// internal/service/campaign_service.go

var TimeGatePresets = map[string]time.Duration{
    "24h": 24 * time.Hour,
    "2d":  48 * time.Hour,
    "3d":  72 * time.Hour,
    "4d":  96 * time.Hour,
    "5d":  120 * time.Hour,
    "none": 0,  // No time gate
}

type SetTimeGateRequest struct {
    CampaignID uuid.UUID `json:"campaign_id"`
    Preset     string    `json:"preset"`  // "24h", "2d", "3d", "4d", "5d", "none"
}

func (s *CampaignService) SetTimeGate(ctx context.Context, req SetTimeGateRequest) error {
    // Verify user is GM
    isGM, err := s.queries.IsUserGMOfCampaign(ctx, getUserIDFromContext(ctx), req.CampaignID)
    if err != nil || !isGM {
        return errors.New("unauthorized: only GM can configure time gates")
    }

    // Get duration from preset
    duration, ok := TimeGatePresets[req.Preset]
    if !ok {
        return fmt.Errorf("invalid preset: %s", req.Preset)
    }

    // Update campaign
    var durationPtr *time.Duration
    if duration > 0 {
        durationPtr = &duration
    }

    err = s.queries.SetCampaignTimeGate(ctx, db.SetCampaignTimeGateParams{
        ID:               req.CampaignID,
        TimeGateDuration: durationPtr,
    })
    if err != nil {
        return err
    }

    return nil
}
```

### SQL Queries

```sql
-- name: SetCampaignTimeGate :exec
UPDATE campaigns
SET time_gate_duration = $2, updated_at = now()
WHERE id = $1;

-- name: StartTimeGate :exec
UPDATE campaigns
SET time_gate_started_at = now(),
    time_gate_elapsed = '0 seconds'::interval,
    time_gate_paused_at = NULL,
    updated_at = now()
WHERE id = $1;

-- name: ClearTimeGate :exec
UPDATE campaigns
SET time_gate_started_at = NULL,
    time_gate_paused_at = NULL,
    time_gate_elapsed = NULL,
    updated_at = now()
WHERE id = $1;

-- name: PauseTimeGate :exec
UPDATE campaigns
SET time_gate_paused_at = now(),
    time_gate_elapsed = COALESCE(time_gate_elapsed, '0 seconds'::interval) +
                        (now() - time_gate_started_at),
    updated_at = now()
WHERE id = $1;

-- name: ResumeTimeGate :exec
UPDATE campaigns
SET time_gate_started_at = now(),
    time_gate_paused_at = NULL,
    updated_at = now()
WHERE id = $1;

-- name: GetTimeGateStatus :one
SELECT
  time_gate_duration,
  time_gate_started_at,
  time_gate_paused_at,
  time_gate_elapsed,
  is_paused
FROM campaigns
WHERE id = $1;
```

## Timer Calculation

### Go Service

```go
// internal/service/timegate_service.go
package service

import (
    "context"
    "time"
    "github.com/google/uuid"
    "vanguard-pbp/internal/db"
)

type TimeGateService struct {
    queries *db.Queries
}

type TimeGateStatus struct {
    Duration       time.Duration  `json:"duration"`        // Total duration
    Elapsed        time.Duration  `json:"elapsed"`         // Time elapsed
    Remaining      time.Duration  `json:"remaining"`       // Time remaining
    IsExpired      bool           `json:"is_expired"`
    IsPaused       bool           `json:"is_paused"`
    ExpiresAt      *time.Time     `json:"expires_at"`      // Projected expiration time
}

func (s *TimeGateService) GetStatus(ctx context.Context, campaignID uuid.UUID) (*TimeGateStatus, error) {
    status, err := s.queries.GetTimeGateStatus(ctx, campaignID)
    if err != nil {
        return nil, err
    }

    // No time gate configured
    if status.TimeGateDuration == nil {
        return &TimeGateStatus{
            Duration:  0,
            Elapsed:   0,
            Remaining: 0,
            IsExpired: false,
            IsPaused:  false,
        }, nil
    }

    duration := *status.TimeGateDuration

    // Campaign is paused
    if status.IsPaused {
        elapsed := status.TimeGateElapsed
        remaining := duration - elapsed

        return &TimeGateStatus{
            Duration:  duration,
            Elapsed:   elapsed,
            Remaining: remaining,
            IsExpired: remaining <= 0,
            IsPaused:  true,
            ExpiresAt: nil,  // No projected time while paused
        }, nil
    }

    // Campaign is active
    if status.TimeGateStartedAt == nil {
        // Time gate not started (GM phase)
        return &TimeGateStatus{
            Duration:  duration,
            Elapsed:   0,
            Remaining: duration,
            IsExpired: false,
            IsPaused:  false,
        }, nil
    }

    // Calculate elapsed time
    startedAt := *status.TimeGateStartedAt
    previousElapsed := status.TimeGateElapsed
    if previousElapsed == nil {
        previousElapsed = new(time.Duration)
    }

    currentElapsed := *previousElapsed + time.Since(startedAt)
    remaining := duration - currentElapsed
    isExpired := remaining <= 0

    expiresAt := startedAt.Add(duration - *previousElapsed)

    return &TimeGateStatus{
        Duration:  duration,
        Elapsed:   currentElapsed,
        Remaining: max(0, remaining),
        IsExpired: isExpired,
        IsPaused:  false,
        ExpiresAt: &expiresAt,
    }, nil
}

func max(a, b time.Duration) time.Duration {
    if a > b {
        return a
    }
    return b
}
```

## Auto-Pass on Expiration

### Background Worker

```go
// internal/worker/timegate_worker.go
package worker

import (
    "context"
    "log"
    "time"
    "vanguard-pbp/internal/service"
)

type TimeGateWorker struct {
    campaignService *service.CampaignService
    passService     *service.PassService
    timeGateService *service.TimeGateService
}

func (w *TimeGateWorker) Start(ctx context.Context) {
    ticker := time.NewTicker(1 * time.Minute)  // Check every minute
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            w.checkExpiredTimeGates(ctx)
        }
    }
}

func (w *TimeGateWorker) checkExpiredTimeGates(ctx context.Context) {
    // Get all campaigns in PC phase with time gates
    campaigns, err := w.campaignService.GetCampaignsWithActiveTimeGates(ctx)
    if err != nil {
        log.Printf("Error fetching campaigns: %v", err)
        return
    }

    for _, campaign := range campaigns {
        status, err := w.timeGateService.GetStatus(ctx, campaign.ID)
        if err != nil {
            log.Printf("Error getting time gate status for campaign %s: %v", campaign.ID, err)
            continue
        }

        if status.IsExpired && !status.IsPaused {
            // Time gate expired - auto-pass all non-passed characters
            err := w.autoPassAllCharacters(ctx, campaign.ID)
            if err != nil {
                log.Printf("Error auto-passing characters in campaign %s: %v", campaign.ID, err)
                continue
            }

            // Notify GM
            w.notifyGMTimeExpired(ctx, campaign.ID)
        }
    }
}

func (w *TimeGateWorker) autoPassAllCharacters(ctx context.Context, campaignID uuid.UUID) error {
    // Get all non-passed characters
    characters, err := w.campaignService.GetActiveCharactersInCampaign(ctx, campaignID)
    if err != nil {
        return err
    }

    for _, char := range characters {
        // Check if already passed
        pass, _ := w.passService.GetCharacterPass(ctx, char.ID)
        if pass != nil && pass.IsPassed {
            continue
        }

        // Auto-pass (regular pass, not hard pass)
        err := w.passService.SetPassInternal(ctx, char.ID, false)
        if err != nil {
            log.Printf("Error auto-passing character %s: %v", char.ID, err)
        }
    }

    return nil
}

func (w *TimeGateWorker) notifyGMTimeExpired(ctx context.Context, campaignID uuid.UUID) {
    // Notify GM that time gate has expired
    // ...
}
```

### SQL Query

```sql
-- name: GetCampaignsWithActiveTimeGates :many
SELECT *
FROM campaigns
WHERE current_phase = 'pc_phase'
  AND time_gate_duration IS NOT NULL
  AND time_gate_started_at IS NOT NULL
  AND is_paused = false;
```

## Warning Notifications

### Notification Schedule

- **24 hours remaining**: "24 hours left in PC phase"
- **6 hours remaining**: "6 hours left in PC phase"
- **1 hour remaining**: "1 hour left in PC phase"
- **Expired**: "Phase time limit expired. Waiting for GM."

### Notification Worker

```go
// internal/worker/timegate_notifications.go

type TimeGateNotificationWorker struct {
    queries             *db.Queries
    notificationService *service.NotificationService
    timeGateService     *service.TimeGateService
}

type NotificationThreshold struct {
    Name     string
    Duration time.Duration
}

var Thresholds = []NotificationThreshold{
    {"24h_remaining", 24 * time.Hour},
    {"6h_remaining", 6 * time.Hour},
    {"1h_remaining", 1 * time.Hour},
}

func (w *TimeGateNotificationWorker) Start(ctx context.Context) {
    ticker := time.NewTicker(5 * time.Minute)  // Check every 5 minutes
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            w.checkThresholds(ctx)
        }
    }
}

func (w *TimeGateNotificationWorker) checkThresholds(ctx context.Context) {
    campaigns, _ := w.queries.GetCampaignsWithActiveTimeGates(ctx)

    for _, campaign := range campaigns {
        status, _ := w.timeGateService.GetStatus(ctx, campaign.ID)
        if status == nil {
            continue
        }

        for _, threshold := range Thresholds {
            // Check if we're crossing this threshold
            if status.Remaining < threshold.Duration &&
               status.Remaining > threshold.Duration-5*time.Minute {
                // Send notification
                w.sendThresholdNotification(ctx, campaign.ID, threshold.Name, status.Remaining)
            }
        }
    }
}

func (w *TimeGateNotificationWorker) sendThresholdNotification(
    ctx context.Context,
    campaignID uuid.UUID,
    thresholdName string,
    remaining time.Duration,
) {
    // Get all campaign members (non-hard-passed)
    members, _ := w.queries.GetCampaignMembersToNotify(ctx, campaignID)

    for _, member := range members {
        w.notificationService.CreateNotification(ctx, service.CreateNotificationParams{
            UserID: member.UserID,
            Type:   "time_gate_warning",
            Data: map[string]interface{}{
                "campaign_id": campaignID,
                "threshold":   thresholdName,
                "remaining":   remaining.String(),
            },
        })
    }
}
```

## Campaign Pause

### Pause Logic

When campaign is paused:
1. Record current elapsed time
2. Set `time_gate_paused_at`
3. Stop timer

When campaign is resumed:
1. Reset `time_gate_started_at` to now
2. Clear `time_gate_paused_at`
3. Preserve `time_gate_elapsed`

### Go Service

```go
// internal/service/campaign_service.go

func (s *CampaignService) PauseCampaign(ctx context.Context, campaignID uuid.UUID) error {
    // Verify user is GM
    userID := getUserIDFromContext(ctx)
    isGM, err := s.queries.IsUserGMOfCampaign(ctx, userID, campaignID)
    if err != nil || !isGM {
        return errors.New("unauthorized")
    }

    // Pause time gate
    err = s.queries.PauseTimeGate(ctx, campaignID)
    if err != nil {
        return err
    }

    // Set campaign paused
    err = s.queries.SetCampaignPaused(ctx, db.SetCampaignPausedParams{
        ID:       campaignID,
        IsPaused: true,
    })
    if err != nil {
        return err
    }

    return nil
}

func (s *CampaignService) ResumeCampaign(ctx context.Context, campaignID uuid.UUID) error {
    // Verify user is GM
    userID := getUserIDFromContext(ctx)
    isGM, err := s.queries.IsUserGMOfCampaign(ctx, userID, campaignID)
    if err != nil || !isGM {
        return errors.New("unauthorized")
    }

    // Resume time gate
    err = s.queries.ResumeTimeGate(ctx, campaignID)
    if err != nil {
        return err
    }

    // Set campaign unpaused
    err = s.queries.SetCampaignPaused(ctx, db.SetCampaignPausedParams{
        ID:       campaignID,
        IsPaused: false,
    })
    if err != nil {
        return err
    }

    return nil
}
```

## React UI Components

### Time Gate Countdown

```tsx
// src/components/TimeGateCountdown.tsx
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Clock, Pause } from 'lucide-react';

interface TimeGateCountdownProps {
  campaignId: string;
}

export function TimeGateCountdown({ campaignId }: TimeGateCountdownProps) {
  const [now, setNow] = useState(Date.now());

  // Update every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: status } = useQuery({
    queryKey: ['timegate-status', campaignId],
    queryFn: () => fetchTimeGateStatus(campaignId),
    refetchInterval: 60000, // Refetch every minute
  });

  if (!status || !status.duration) {
    return null; // No time gate configured
  }

  if (status.is_paused) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded">
        <Pause className="w-4 h-4 text-gray-600" />
        <span className="text-sm text-gray-700">
          Campaign paused - {formatDuration(status.remaining)} remaining
        </span>
      </div>
    );
  }

  if (status.is_expired) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-red-100 rounded">
        <Clock className="w-4 h-4 text-red-600" />
        <span className="text-sm text-red-800">
          Phase expired. Waiting for GM.
        </span>
      </div>
    );
  }

  // Calculate live remaining time
  const expiresAt = new Date(status.expires_at);
  const remaining = Math.max(0, expiresAt.getTime() - now);

  const urgency = getUrgency(remaining, status.duration);

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded ${urgency.className}`}>
      <Clock className={`w-4 h-4 ${urgency.iconClass}`} />
      <span className={`text-sm ${urgency.textClass}`}>
        {formatDuration(remaining)} remaining
      </span>
    </div>
  );
}

function getUrgency(remaining: number, total: number) {
  const ratio = remaining / total;

  if (ratio < 0.05) {
    // < 5% remaining - urgent
    return {
      className: 'bg-red-100',
      iconClass: 'text-red-600',
      textClass: 'text-red-800 font-medium',
    };
  } else if (ratio < 0.25) {
    // < 25% remaining - warning
    return {
      className: 'bg-amber-100',
      iconClass: 'text-amber-600',
      textClass: 'text-amber-800',
    };
  } else {
    // Normal
    return {
      className: 'bg-blue-100',
      iconClass: 'text-blue-600',
      textClass: 'text-blue-800',
    };
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

async function fetchTimeGateStatus(campaignId: string) {
  const res = await fetch(`/api/campaigns/${campaignId}/timegate`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch time gate status');
  return res.json();
}

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}
```

### Time Gate Configuration (GM)

```tsx
// src/components/TimeGateConfig.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TimeGateConfigProps {
  campaignId: string;
  currentPreset: string;
}

export function TimeGateConfig({ campaignId, currentPreset }: TimeGateConfigProps) {
  const [preset, setPreset] = useState(currentPreset);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (newPreset: string) => {
      const res = await fetch(`/api/campaigns/${campaignId}/timegate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ preset: newPreset }),
      });
      if (!res.ok) throw new Error('Failed to update time gate');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaignId] });
    },
  });

  const handleSave = () => {
    updateMutation.mutate(preset);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">
          PC Phase Time Limit
        </label>
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No time limit</SelectItem>
            <SelectItem value="24h">24 hours</SelectItem>
            <SelectItem value="2d">2 days</SelectItem>
            <SelectItem value="3d">3 days</SelectItem>
            <SelectItem value="4d">4 days</SelectItem>
            <SelectItem value="5d">5 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-gray-600">
        When the time limit expires, all players will be auto-passed.
        You will still need to manually transition to GM phase.
      </p>

      <Button
        onClick={handleSave}
        disabled={updateMutation.isPending || preset === currentPreset}
      >
        {updateMutation.isPending ? 'Saving...' : 'Save'}
      </Button>
    </div>
  );
}

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}
```

## Edge Cases

### 1. Campaign Paused Mid-Timer

**Scenario**: Timer at 12h remaining, campaign paused for 3 days, then resumed.

**Handling**: Timer resumes with 12h remaining.

```sql
-- Pause captures elapsed time
UPDATE campaigns
SET time_gate_elapsed = time_gate_elapsed + (now() - time_gate_started_at)
-- ...

-- Resume starts fresh timer with preserved elapsed
UPDATE campaigns
SET time_gate_started_at = now()
-- elapsed preserved
```

### 2. Time Gate Changed Mid-Phase

**Scenario**: Timer running with 2d limit, GM changes to 3d.

**Handling**: New duration applies immediately, timer recalculates.

```go
// Changing time_gate_duration while timer is active
// Elapsed time preserved, new deadline calculated
newDeadline = startedAt + elapsed + newDuration
```

### 3. All Characters Passed Before Expiration

**Scenario**: Timer has 6h remaining, but all characters already passed.

**Handling**: No auto-pass needed. Timer continues for UI display.

```go
// Auto-pass worker checks if already passed
if pass != nil && pass.IsPassed {
    continue  // Skip already-passed characters
}
```

### 4. No Characters in Campaign

**Scenario**: New campaign with no characters, time gate expires.

**Handling**: No auto-pass needed. GM can transition normally.

```go
// Auto-pass gets empty character list
characters, _ := w.campaignService.GetActiveCharactersInCampaign(ctx, campaignID)
if len(characters) == 0 {
    // No action needed
    return nil
}
```

### 5. Expired Timer, New Character Joins

**Scenario**: Timer expired, all auto-passed. New character joins scene.

**Handling**: New character not auto-passed (didn't exist when timer expired).

```go
// Auto-pass is one-time event at expiration
// New characters after expiration are not affected
```

### 6. Phase Transition Clears Timer

**Scenario**: GM transitions phase, timer resets.

**Handling**: Intended behavior.

```sql
-- ClearTimeGate called on PC → GM transition
UPDATE campaigns
SET time_gate_started_at = NULL,
    time_gate_elapsed = NULL
-- ...

-- StartTimeGate called on GM → PC transition
UPDATE campaigns
SET time_gate_started_at = now(),
    time_gate_elapsed = '0 seconds'::interval
-- ...
```

## Testing Checklist

### Unit Tests

- [ ] Time gate calculation
  - [ ] Elapsed = current time - started time + previous elapsed
  - [ ] Remaining = duration - elapsed
  - [ ] Expired when remaining <= 0
  - [ ] Paused preserves elapsed time

- [ ] Auto-pass on expiration
  - [ ] All non-passed characters auto-passed
  - [ ] Already-passed characters skipped
  - [ ] Auto-pass creates regular pass (not hard pass)

- [ ] Warning notifications
  - [ ] 24h warning sent correctly
  - [ ] 6h warning sent correctly
  - [ ] 1h warning sent correctly
  - [ ] No duplicate notifications

### Integration Tests

- [ ] Phase transition
  - [ ] GM → PC starts timer
  - [ ] PC → GM clears timer
  - [ ] Timer persists across server restarts

- [ ] Campaign pause
  - [ ] Pause captures elapsed time
  - [ ] Resume continues from elapsed
  - [ ] Multiple pause/resume cycles accumulate correctly

- [ ] Configuration
  - [ ] GM sets time gate preset
  - [ ] Duration applied to campaign
  - [ ] Changing preset mid-phase works

### E2E Tests

- [ ] Set time gate to 24h → verify countdown displays
- [ ] Wait for warning threshold → verify notification received
- [ ] Timer expires → verify all characters auto-passed
- [ ] GM transitions → verify timer resets
- [ ] Pause campaign → verify timer frozen
- [ ] Resume campaign → verify timer continues

## Verification Steps

1. **Create campaign** with 2 characters
2. **GM sets time gate** to 24h
3. **GM transitions to PC phase** → timer starts
4. **Verify countdown** shows ~24h remaining
5. **Pause campaign** → verify timer frozen
6. **Wait 1 minute** (real time)
7. **Resume campaign** → verify remaining time unchanged
8. **Manually set timer to 30 minutes** (for testing)
9. **Wait for expiration** → verify auto-pass
10. **Check characters** → both passed automatically
11. **Check GM notification** → "time expired" message
12. **GM transitions** → verify timer cleared

## API Documentation

### GET /api/campaigns/:campaign_id/timegate

Get time gate status.

**Response**:
```json
{
  "duration": 172800000,
  "elapsed": 86400000,
  "remaining": 86400000,
  "is_expired": false,
  "is_paused": false,
  "expires_at": "2025-01-17T10:00:00Z"
}
```

### PUT /api/campaigns/:campaign_id/timegate

Configure time gate preset (GM only).

**Request**:
```json
{
  "preset": "2d"
}
```

**Response**:
```json
{
  "message": "time gate updated"
}
```

### POST /api/campaigns/:campaign_id/pause

Pause campaign (GM only).

**Response**:
```json
{
  "message": "campaign paused"
}
```

### POST /api/campaigns/:campaign_id/resume

Resume campaign (GM only).

**Response**:
```json
{
  "message": "campaign resumed"
}
```

## Performance Considerations

### Worker Intervals

```go
// Balance between responsiveness and load
TimeGateWorker.ticker = 1 * time.Minute     // Check expiration every minute
NotificationWorker.ticker = 5 * time.Minute // Check thresholds every 5 minutes
```

### Database Queries

```sql
-- Index for worker queries
CREATE INDEX idx_campaigns_active_timegate
ON campaigns(current_phase, time_gate_started_at)
WHERE time_gate_duration IS NOT NULL AND is_paused = false;
```

### Notification Deduplication

```go
// Track sent notifications to avoid duplicates
type NotificationTracker struct {
    redis *redis.Client
}

func (t *NotificationTracker) ShouldNotify(campaignID uuid.UUID, threshold string) bool {
    key := fmt.Sprintf("timegate_notif:%s:%s", campaignID, threshold)

    // Check if already notified for this threshold
    exists, _ := t.redis.Exists(context.Background(), key).Result()
    if exists > 0 {
        return false
    }

    // Mark as notified (TTL: 1 hour)
    t.redis.Set(context.Background(), key, "1", time.Hour)
    return true
}
```
