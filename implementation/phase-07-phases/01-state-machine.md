# State Machine Implementation

## Overview

The phase state machine manages the global campaign phase (PC Phase vs GM Phase). All scenes in a campaign share the same phase state, and only the GM can trigger transitions.

## PRD References

- **Turn Structure**: "Global phase synchronization - all scenes same phase"
- **Core Concepts**: "Campaign-level phase state"
- **Technical**: "Atomic transitions with validation guards"

## Skill Reference

**state-machine** - Phase transitions, state validation, global synchronization, persistence

## Phase States

```
┌─────────────┐                    ┌─────────────┐
│             │                    │             │
│  GM Phase   │ ────────────────→  │  PC Phase   │
│             │   GM Transition    │             │
└─────────────┘                    └─────────────┘
       ▲                                  │
       │                                  │
       │           GM Transition          │
       └──────────────────────────────────┘
```

**States**:
- `gm_phase`: GM's turn to post, set scenes, prepare
- `pc_phase`: Players' turn to post, roll dice, respond

**Transitions**:
- `gm_phase → pc_phase`: GM finishes preparation, players take actions
- `pc_phase → gm_phase`: All players passed, GM responds

## Database Schema

```sql
-- Campaigns table with phase state
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gm_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,

  -- Phase state
  current_phase TEXT NOT NULL DEFAULT 'gm_phase'
    CHECK (current_phase IN ('pc_phase', 'gm_phase')),

  -- Time gate configuration
  time_gate_duration INTERVAL,          -- e.g., '2 days'
  time_gate_started_at TIMESTAMPTZ,     -- When current PC phase started

  -- Campaign control
  is_paused BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for phase queries
CREATE INDEX idx_campaigns_phase ON campaigns(current_phase);

-- Trigger to update updated_at
CREATE TRIGGER set_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Phase Transition History (Optional Auditing)

```sql
CREATE TABLE phase_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  from_phase TEXT NOT NULL,
  to_phase TEXT NOT NULL,
  triggered_by UUID NOT NULL REFERENCES users(id),
  transition_reason TEXT,  -- Optional: "all_passed", "gm_manual", "time_expired"
  transition_time TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for history queries
CREATE INDEX idx_phase_transitions_campaign ON phase_transitions(campaign_id, transition_time DESC);
```

## Transition Guards

Before transitioning phases, the system validates several conditions:

### Guards for pc_phase → gm_phase

```go
// internal/service/phase_service.go

type TransitionGuard interface {
    Check(ctx context.Context, campaignID uuid.UUID) error
}

// Guard 1: All characters have passed
type AllPassedGuard struct {
    queries *db.Queries
}

func (g *AllPassedGuard) Check(ctx context.Context, campaignID uuid.UUID) error {
    // Get all non-orphaned characters in campaign
    chars, err := g.queries.GetActiveCharactersInCampaign(ctx, campaignID)
    if err != nil {
        return err
    }

    // Check if all have passed
    for _, char := range chars {
        pass, err := g.queries.GetCharacterPass(ctx, char.ID)
        if err != nil || !pass.IsPassed {
            return fmt.Errorf("character %s has not passed", char.Name)
        }
    }

    return nil
}

// Guard 2: No pending rolls
type NoPendingRollsGuard struct {
    queries *db.Queries
}

func (g *NoPendingRollsGuard) Check(ctx context.Context, campaignID uuid.UUID) error {
    pendingCount, err := g.queries.CountPendingRollsInCampaign(ctx, campaignID)
    if err != nil {
        return err
    }

    if pendingCount > 0 {
        return fmt.Errorf("%d pending rolls must be resolved", pendingCount)
    }

    return nil
}

// Guard 3: No active compose locks
type NoActiveLocksGuard struct {
    queries *db.Queries
}

func (g *NoActiveLocksGuard) Check(ctx context.Context, campaignID uuid.UUID) error {
    locks, err := g.queries.GetActiveLocksInCampaign(ctx, campaignID)
    if err != nil {
        return err
    }

    if len(locks) > 0 {
        return fmt.Errorf("players are still composing posts")
    }

    return nil
}
```

### Guards for gm_phase → pc_phase

```go
// No guards needed for GM → PC transition
// GM can start PC phase at any time
```

## Phase Transition Service

```go
// internal/service/phase_service.go
package service

import (
    "context"
    "database/sql"
    "fmt"
    "github.com/google/uuid"
    "vanguard-pbp/internal/db"
)

type PhaseService struct {
    queries *db.Queries
    txDB    *sql.DB
    guards  map[string][]TransitionGuard
}

func NewPhaseService(queries *db.Queries, txDB *sql.DB) *PhaseService {
    return &PhaseService{
        queries: queries,
        txDB:    txDB,
        guards: map[string][]TransitionGuard{
            "pc_phase->gm_phase": {
                &AllPassedGuard{queries},
                &NoPendingRollsGuard{queries},
                &NoActiveLocksGuard{queries},
            },
            "gm_phase->pc_phase": {
                // No guards
            },
        },
    }
}

type TransitionRequest struct {
    CampaignID uuid.UUID
    ToPhase    string
    TriggeredBy uuid.UUID
}

func (s *PhaseService) TransitionPhase(ctx context.Context, req TransitionRequest) error {
    // Start transaction for atomic transition
    tx, err := s.txDB.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    qtx := s.queries.WithTx(tx)

    // 1. Get current phase
    campaign, err := qtx.GetCampaign(ctx, req.CampaignID)
    if err != nil {
        return err
    }

    fromPhase := campaign.CurrentPhase

    // 2. Validate transition
    if req.ToPhase == fromPhase {
        return fmt.Errorf("already in %s", req.ToPhase)
    }

    transitionKey := fmt.Sprintf("%s->%s", fromPhase, req.ToPhase)
    guards := s.guards[transitionKey]

    for _, guard := range guards {
        if err := guard.Check(ctx, req.CampaignID); err != nil {
            return fmt.Errorf("transition blocked: %w", err)
        }
    }

    // 3. Perform transition
    err = qtx.UpdateCampaignPhase(ctx, db.UpdateCampaignPhaseParams{
        ID:           req.CampaignID,
        CurrentPhase: req.ToPhase,
    })
    if err != nil {
        return err
    }

    // 4. Handle time gate
    if req.ToPhase == "pc_phase" {
        // Start time gate timer
        if campaign.TimeGateDuration != nil {
            err = qtx.StartTimeGate(ctx, req.CampaignID)
            if err != nil {
                return err
            }
        }
    } else {
        // Clear time gate
        err = qtx.ClearTimeGate(ctx, req.CampaignID)
        if err != nil {
            return err
        }
    }

    // 5. Reset all character passes
    err = qtx.ResetAllPassesInCampaign(ctx, req.CampaignID)
    if err != nil {
        return err
    }

    // 6. Record transition history
    err = qtx.RecordPhaseTransition(ctx, db.RecordPhaseTransitionParams{
        CampaignID:  req.CampaignID,
        FromPhase:   fromPhase,
        ToPhase:     req.ToPhase,
        TriggeredBy: req.TriggeredBy,
    })
    if err != nil {
        return err
    }

    // 7. Commit transaction
    if err := tx.Commit(); err != nil {
        return err
    }

    // 8. Send notifications (async, after commit)
    go s.notifyPhaseTransition(context.Background(), req.CampaignID, fromPhase, req.ToPhase)

    return nil
}

func (s *PhaseService) notifyPhaseTransition(ctx context.Context, campaignID uuid.UUID, from, to string) {
    // Notify all campaign members
    members, err := s.queries.GetCampaignMembers(ctx, campaignID)
    if err != nil {
        return
    }

    for _, member := range members {
        // Create notification
        s.queries.CreateNotification(ctx, db.CreateNotificationParams{
            UserID: member.UserID,
            Type:   "phase_transition",
            Data: map[string]interface{}{
                "campaign_id": campaignID,
                "from_phase":  from,
                "to_phase":    to,
            },
        })
    }
}
```

## SQL Queries

```sql
-- name: UpdateCampaignPhase :exec
UPDATE campaigns
SET current_phase = $2, updated_at = now()
WHERE id = $1;

-- name: StartTimeGate :exec
UPDATE campaigns
SET time_gate_started_at = now()
WHERE id = $1;

-- name: ClearTimeGate :exec
UPDATE campaigns
SET time_gate_started_at = NULL
WHERE id = $1;

-- name: GetActiveCharactersInCampaign :many
-- Returns non-orphaned characters in campaign
SELECT c.*
FROM characters c
JOIN scenes s ON s.id = c.scene_id
WHERE s.campaign_id = $1
  AND c.deleted_at IS NULL
  AND c.is_present = true
ORDER BY c.name;

-- name: CountPendingRollsInCampaign :one
SELECT COUNT(*)
FROM rolls r
JOIN posts p ON p.id = r.post_id
JOIN scenes s ON s.id = p.scene_id
WHERE s.campaign_id = $1
  AND r.status = 'pending';

-- name: GetActiveLocksInCampaign :many
SELECT cl.*
FROM compose_locks cl
JOIN scenes s ON s.id = cl.scene_id
WHERE s.campaign_id = $1
  AND cl.expires_at > now();

-- name: ResetAllPassesInCampaign :exec
UPDATE character_passes cp
SET is_passed = false, is_hard_pass = false, passed_at = NULL
FROM characters c
JOIN scenes s ON s.id = c.scene_id
WHERE s.campaign_id = $1
  AND cp.character_id = c.id;

-- name: RecordPhaseTransition :exec
INSERT INTO phase_transitions (
  campaign_id, from_phase, to_phase, triggered_by
) VALUES ($1, $2, $3, $4);
```

## API Handler

```go
// internal/handler/phase_handler.go
package handler

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "vanguard-pbp/internal/service"
)

type PhaseHandler struct {
    phaseService *service.PhaseService
}

type TransitionPhaseRequest struct {
    ToPhase string `json:"to_phase" binding:"required,oneof=pc_phase gm_phase"`
}

func (h *PhaseHandler) TransitionPhase(c *gin.Context) {
    campaignID, err := uuid.Parse(c.Param("campaign_id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid campaign ID"})
        return
    }

    var req TransitionPhaseRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Verify user is GM
    userID := c.GetString("user_id")
    isGM, err := h.phaseService.IsUserGM(c.Request.Context(), userID, campaignID)
    if err != nil || !isGM {
        c.JSON(http.StatusForbidden, gin.H{"error": "only GM can transition phases"})
        return
    }

    // Perform transition
    userUUID, _ := uuid.Parse(userID)
    err = h.phaseService.TransitionPhase(c.Request.Context(), service.TransitionRequest{
        CampaignID:  campaignID,
        ToPhase:     req.ToPhase,
        TriggeredBy: userUUID,
    })
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "phase transition successful"})
}

// Get current phase status
func (h *PhaseHandler) GetPhaseStatus(c *gin.Context) {
    campaignID, err := uuid.Parse(c.Param("campaign_id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid campaign ID"})
        return
    }

    campaign, err := h.phaseService.GetCampaign(c.Request.Context(), campaignID)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "campaign not found"})
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "current_phase": campaign.CurrentPhase,
        "is_paused":     campaign.IsPaused,
        "time_gate_started_at": campaign.TimeGateStartedAt,
    })
}
```

## React UI Components

### Phase Indicator

```tsx
// src/components/PhaseIndicator.tsx
import { useQuery } from '@tanstack/react-query';
import { Clock, User } from 'lucide-react';

interface PhaseIndicatorProps {
  campaignId: string;
}

export function PhaseIndicator({ campaignId }: PhaseIndicatorProps) {
  const { data: phaseStatus } = useQuery({
    queryKey: ['phase-status', campaignId],
    queryFn: () => fetchPhaseStatus(campaignId),
    refetchInterval: 5000, // Poll every 5 seconds
  });

  if (!phaseStatus) return null;

  const isGMPhase = phaseStatus.current_phase === 'gm_phase';

  return (
    <div
      className={`flex items-center gap-2 px-4 py-2 rounded-full ${
        isGMPhase ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
      }`}
    >
      {isGMPhase ? (
        <>
          <User className="w-4 h-4" />
          <span className="font-medium">GM Phase</span>
        </>
      ) : (
        <>
          <Clock className="w-4 h-4" />
          <span className="font-medium">PC Phase</span>
        </>
      )}
    </div>
  );
}

async function fetchPhaseStatus(campaignId: string) {
  const res = await fetch(`/api/campaigns/${campaignId}/phase`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch phase status');
  return res.json();
}

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}
```

### Phase Transition Button (GM Only)

```tsx
// src/components/PhaseTransitionButton.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowRight } from 'lucide-react';

interface PhaseTransitionButtonProps {
  campaignId: string;
  currentPhase: 'gm_phase' | 'pc_phase';
}

export function PhaseTransitionButton({
  campaignId,
  currentPhase,
}: PhaseTransitionButtonProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const transitionMutation = useMutation({
    mutationFn: async (toPhase: string) => {
      const res = await fetch(`/api/campaigns/${campaignId}/phase/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ to_phase: toPhase }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Transition failed');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phase-status', campaignId] });
      toast({
        title: 'Phase Transition',
        description: 'Phase transition successful',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Transition Blocked',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const nextPhase = currentPhase === 'gm_phase' ? 'pc_phase' : 'gm_phase';
  const buttonText = currentPhase === 'gm_phase' ? 'Start PC Phase' : 'Start GM Phase';

  return (
    <Button
      onClick={() => transitionMutation.mutate(nextPhase)}
      disabled={transitionMutation.isPending}
      className="gap-2"
    >
      {buttonText}
      <ArrowRight className="w-4 h-4" />
    </Button>
  );
}

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}
```

### Real-Time Phase Sync

```tsx
// src/hooks/usePhaseSync.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function usePhaseSync(campaignId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to campaign updates
    const subscription = supabase
      .from(`campaigns:id=eq.${campaignId}`)
      .on('UPDATE', (payload) => {
        // Invalidate phase status query
        queryClient.invalidateQueries({
          queryKey: ['phase-status', campaignId],
        });

        // Show toast notification
        const oldPhase = payload.old.current_phase;
        const newPhase = payload.new.current_phase;
        if (oldPhase !== newPhase) {
          // Phase changed!
          queryClient.setQueryData(['phase-status', campaignId], {
            current_phase: newPhase,
          });
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [campaignId, queryClient]);
}
```

## Edge Cases

### 1. Concurrent Transition Attempts

**Scenario**: Two GMs (or GM double-clicks) trigger transitions simultaneously.

**Solution**: Database-level locking ensures only one transition proceeds.

```sql
-- Use SELECT FOR UPDATE to lock campaign row
BEGIN;

SELECT * FROM campaigns WHERE id = $1 FOR UPDATE;

-- Perform transition logic

COMMIT;
```

Alternatively, use optimistic locking:

```sql
UPDATE campaigns
SET current_phase = $2, version = version + 1
WHERE id = $1 AND version = $3;  -- Fails if version changed
```

### 2. Orphaned Characters

**Scenario**: Character with no scene (orphaned) should not block transitions.

**Solution**: Filter orphaned characters in guard checks.

```sql
-- GetActiveCharactersInCampaign already filters:
SELECT c.*
FROM characters c
JOIN scenes s ON s.id = c.scene_id  -- Implicitly excludes orphans
WHERE s.campaign_id = $1
  AND c.is_present = true;
```

### 3. Deleted Characters

**Scenario**: Deleted character still has pass state.

**Solution**: Cascade delete pass state, or filter deleted characters.

```sql
-- Option 1: Cascade delete
CREATE TABLE character_passes (
  character_id UUID PRIMARY KEY
    REFERENCES characters(id) ON DELETE CASCADE
);

-- Option 2: Filter in queries
WHERE c.deleted_at IS NULL
```

### 4. Campaign Paused During Phase

**Scenario**: Campaign paused mid-phase.

**Solution**: Pause flag prevents transitions.

```go
func (g *CampaignNotPausedGuard) Check(ctx context.Context, campaignID uuid.UUID) error {
    campaign, err := g.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return err
    }

    if campaign.IsPaused {
        return fmt.Errorf("campaign is paused")
    }

    return nil
}
```

### 5. No Characters in Campaign

**Scenario**: New campaign with no characters yet.

**Solution**: Allow transition (no characters = all passed).

```go
func (g *AllPassedGuard) Check(ctx context.Context, campaignID uuid.UUID) error {
    chars, err := g.queries.GetActiveCharactersInCampaign(ctx, campaignID)
    if err != nil {
        return err
    }

    if len(chars) == 0 {
        // No characters = allow transition
        return nil
    }

    // Check passes...
}
```

### 6. Partial Real-Time Updates

**Scenario**: Real-time subscription drops, some clients miss phase change.

**Solution**: Clients poll periodically as fallback.

```tsx
const { data } = useQuery({
  queryKey: ['phase-status', campaignId],
  queryFn: () => fetchPhaseStatus(campaignId),
  refetchInterval: 10000,  // Poll every 10s as fallback
});

// Also subscribe to real-time
usePhaseSync(campaignId);
```

## Testing Checklist

### Unit Tests

- [ ] Phase transition validation
  - [ ] GM → PC: No guards block
  - [ ] PC → GM: All guards enforced
  - [ ] Invalid phase rejected
  - [ ] Same phase rejected

- [ ] Guard checks
  - [ ] AllPassedGuard: requires all characters passed
  - [ ] NoPendingRollsGuard: blocks on pending rolls
  - [ ] NoActiveLocksGuard: blocks on compose locks
  - [ ] Orphaned characters excluded

- [ ] State persistence
  - [ ] Phase update atomic
  - [ ] Time gate started on GM → PC
  - [ ] Time gate cleared on PC → GM
  - [ ] Passes reset on transition

### Integration Tests

- [ ] Atomic transitions
  - [ ] Transaction commits or rolls back
  - [ ] No partial state changes
  - [ ] Concurrent transitions handled

- [ ] Notifications
  - [ ] All campaign members notified
  - [ ] Notification data correct

- [ ] Real-time sync
  - [ ] Phase update broadcasts to all clients
  - [ ] Clients receive update < 1s

### E2E Tests

- [ ] GM clicks transition → phase changes
- [ ] Players see phase indicator update
- [ ] Blocked transition shows error message
- [ ] All scenes reflect new phase
- [ ] Pass indicators reset after transition

## Verification Steps

1. **Create test campaign** with 2 characters
2. **Verify initial state**: `gm_phase`
3. **GM transitions to PC phase** → verify success
4. **Verify phase indicator** shows "PC Phase"
5. **Character A passes** → verify pass indicator
6. **GM attempts transition** → verify blocked (Character B not passed)
7. **Character B passes** → verify pass indicator
8. **GM transitions to GM phase** → verify success
9. **Verify passes reset** → all characters unpassed
10. **Test guards**:
    - Create pending roll → verify blocks transition
    - Resolve roll → verify transition allowed
11. **Test real-time sync** → open two browser windows, verify both update

## API Documentation

### POST /api/campaigns/:campaign_id/phase/transition

Transition campaign to next phase (GM only).

**Request**:
```json
{
  "to_phase": "pc_phase"
}
```

**Response (Success)**:
```json
{
  "message": "phase transition successful"
}
```

**Response (Blocked)**:
```json
{
  "error": "transition blocked: 2 pending rolls must be resolved"
}
```

### GET /api/campaigns/:campaign_id/phase

Get current phase status.

**Response**:
```json
{
  "current_phase": "pc_phase",
  "is_paused": false,
  "time_gate_started_at": "2025-01-15T10:00:00Z"
}
```

### GET /api/campaigns/:campaign_id/phase/history

Get phase transition history.

**Response**:
```json
{
  "transitions": [
    {
      "id": "uuid",
      "from_phase": "gm_phase",
      "to_phase": "pc_phase",
      "triggered_by": "gm-user-uuid",
      "transition_time": "2025-01-15T10:00:00Z"
    }
  ]
}
```

## Performance Considerations

### Database Locking

```go
// Use advisory locks for phase transitions
func (s *PhaseService) TransitionPhase(ctx context.Context, req TransitionRequest) error {
    // Acquire advisory lock (campaign-level)
    lockID := int64(req.CampaignID.ID())  // Convert UUID to int64
    _, err := s.db.ExecContext(ctx, "SELECT pg_advisory_xact_lock($1)", lockID)
    if err != nil {
        return err
    }

    // Proceed with transition (lock released on transaction end)
    // ...
}
```

### Notification Batching

```go
// Send notifications asynchronously in batch
func (s *PhaseService) notifyPhaseTransition(ctx context.Context, campaignID uuid.UUID, from, to string) {
    members, _ := s.queries.GetCampaignMembers(ctx, campaignID)

    // Batch insert notifications
    params := make([]db.CreateNotificationParams, len(members))
    for i, member := range members {
        params[i] = db.CreateNotificationParams{
            UserID: member.UserID,
            Type:   "phase_transition",
            Data:   /* ... */,
        }
    }

    s.queries.BatchCreateNotifications(ctx, params)
}
```
