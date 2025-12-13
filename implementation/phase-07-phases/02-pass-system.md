# Pass System Implementation

## Overview

The Pass System tracks per-character readiness to end the current phase. Each character has an independent pass state that auto-clears when they post or can be set to "Hard Pass" to persist.

## PRD References

- **Turn Structure**: "Pass vs Hard Pass distinction, auto-clear on post"
- **Core Concepts**: "Per-character pass, not per-user"
- **Technical**: "Pass state reset on phase transition, roll blocking"

## Skill Reference

**state-machine** - Pass state management, auto-clear logic, phase coordination

## Database Schema

```sql
CREATE TABLE character_passes (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  is_passed BOOLEAN NOT NULL DEFAULT false,
  is_hard_pass BOOLEAN NOT NULL DEFAULT false,
  passed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for campaign-wide pass queries
CREATE INDEX idx_character_passes_updated ON character_passes(updated_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER set_character_passes_updated_at
  BEFORE UPDATE ON character_passes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Pass vs Hard Pass

### Regular Pass

- Auto-clears when character posts in **any** scene
- Character receives notifications for new posts
- Indicates "done for now, but might come back"

### Hard Pass

- Does **not** auto-clear on post
- Character **stops receiving** turn notifications
- Must manually un-pass to resume
- Indicates "completely done, don't notify me"

## Pass State Management

### SQL Queries

```sql
-- name: SetCharacterPass :exec
INSERT INTO character_passes (character_id, is_passed, is_hard_pass, passed_at)
VALUES ($1, $2, $3, now())
ON CONFLICT (character_id)
DO UPDATE SET
  is_passed = $2,
  is_hard_pass = $3,
  passed_at = CASE WHEN $2 = true THEN now() ELSE NULL END,
  updated_at = now();

-- name: GetCharacterPass :one
SELECT * FROM character_passes WHERE character_id = $1;

-- name: ClearCharacterPass :exec
UPDATE character_passes
SET is_passed = false, is_hard_pass = false, passed_at = NULL
WHERE character_id = $1;

-- name: GetAllPassesInCampaign :many
SELECT cp.*, c.name as character_name, c.user_id
FROM character_passes cp
JOIN characters c ON c.id = cp.character_id
JOIN scenes s ON s.id = c.scene_id
WHERE s.campaign_id = $1
  AND c.deleted_at IS NULL
  AND c.is_present = true;

-- name: CheckAllCharactersPassed :one
-- Returns true if all active characters have passed
SELECT COUNT(*) = 0 AS all_passed
FROM characters c
JOIN scenes s ON s.id = c.scene_id
LEFT JOIN character_passes cp ON cp.character_id = c.id
WHERE s.campaign_id = $1
  AND c.deleted_at IS NULL
  AND c.is_present = true
  AND (cp.is_passed IS NULL OR cp.is_passed = false);

-- name: ResetAllPassesInCampaign :exec
UPDATE character_passes cp
SET is_passed = false, is_hard_pass = false, passed_at = NULL
FROM characters c
JOIN scenes s ON s.id = c.scene_id
WHERE s.campaign_id = $1
  AND cp.character_id = c.id;
```

### Go Service

```go
// internal/service/pass_service.go
package service

import (
    "context"
    "errors"
    "github.com/google/uuid"
    "vanguard-pbp/internal/db"
)

type PassService struct {
    queries *db.Queries
}

type SetPassRequest struct {
    CharacterID uuid.UUID `json:"character_id"`
    IsHardPass  bool      `json:"is_hard_pass"`
}

func (s *PassService) SetPass(ctx context.Context, req SetPassRequest) error {
    // Verify character exists and belongs to user
    userID := getUserIDFromContext(ctx)
    char, err := s.queries.GetCharacter(ctx, req.CharacterID)
    if err != nil {
        return err
    }
    if char.UserID != userID {
        return errors.New("character does not belong to user")
    }

    // Check for pending rolls (blocks passing)
    hasPendingRolls, err := s.queries.CharacterHasPendingRolls(ctx, req.CharacterID)
    if err != nil {
        return err
    }
    if hasPendingRolls {
        return errors.New("cannot pass with pending rolls")
    }

    // Set pass state
    err = s.queries.SetCharacterPass(ctx, db.SetCharacterPassParams{
        CharacterID: req.CharacterID,
        IsPassed:    true,
        IsHardPass:  req.IsHardPass,
    })
    if err != nil {
        return err
    }

    // Check if all characters have passed
    allPassed, err := s.queries.CheckAllCharactersPassed(ctx, char.CampaignID)
    if err != nil {
        return err
    }

    if allPassed {
        // Notify GM that all players are ready
        s.notifyGMAllPassed(ctx, char.CampaignID)
    }

    return nil
}

func (s *PassService) ClearPass(ctx context.Context, characterID uuid.UUID) error {
    // Verify ownership
    userID := getUserIDFromContext(ctx)
    char, err := s.queries.GetCharacter(ctx, characterID)
    if err != nil {
        return err
    }
    if char.UserID != userID {
        return errors.New("character does not belong to user")
    }

    return s.queries.ClearCharacterPass(ctx, characterID)
}

// Auto-clear pass when character posts (if not hard pass)
func (s *PassService) AutoClearPassOnPost(ctx context.Context, characterID uuid.UUID) error {
    pass, err := s.queries.GetCharacterPass(ctx, characterID)
    if err != nil {
        // No pass state yet
        return nil
    }

    if pass.IsPassed && !pass.IsHardPass {
        // Clear regular pass
        return s.queries.ClearCharacterPass(ctx, characterID)
    }

    // Hard pass or not passed - no action
    return nil
}

func (s *PassService) notifyGMAllPassed(ctx context.Context, campaignID uuid.UUID) {
    // Get GM user ID
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return
    }

    // Create notification
    s.queries.CreateNotification(ctx, db.CreateNotificationParams{
        UserID: campaign.GMID,
        Type:   "all_players_passed",
        Data: map[string]interface{}{
            "campaign_id": campaignID,
        },
    })
}
```

## Post Integration (Auto-Clear)

```go
// internal/service/post_service.go

func (s *PostService) CreatePost(ctx context.Context, req CreatePostRequest) (*db.Post, error) {
    // ... existing post creation logic ...

    post, err := s.queries.CreatePost(ctx, params)
    if err != nil {
        return nil, err
    }

    // Auto-clear pass if not hard pass
    go s.passService.AutoClearPassOnPost(context.Background(), req.CharacterID)

    return &post, nil
}
```

## Roll Blocking

```sql
-- name: CharacterHasPendingRolls :one
SELECT EXISTS (
  SELECT 1
  FROM rolls r
  JOIN posts p ON p.id = r.post_id
  WHERE p.character_id = $1
    AND r.status = 'pending'
) AS has_pending;
```

```go
// internal/service/pass_service.go

func (s *PassService) SetPass(ctx context.Context, req SetPassRequest) error {
    // ... ownership check ...

    // Check for pending rolls (blocks passing)
    hasPendingRolls, err := s.queries.CharacterHasPendingRolls(ctx, req.CharacterID)
    if err != nil {
        return err
    }
    if hasPendingRolls {
        return errors.New("cannot pass with pending rolls - resolve them first")
    }

    // ... proceed with pass ...
}
```

## API Handlers

```go
// internal/handler/pass_handler.go
package handler

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "vanguard-pbp/internal/service"
)

type PassHandler struct {
    passService *service.PassService
}

func (h *PassHandler) SetPass(c *gin.Context) {
    var req service.SetPassRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    err := h.passService.SetPass(c.Request.Context(), req)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "pass set"})
}

func (h *PassHandler) ClearPass(c *gin.Context) {
    characterID, err := uuid.Parse(c.Param("character_id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid character ID"})
        return
    }

    err = h.passService.ClearPass(c.Request.Context(), characterID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "pass cleared"})
}

func (h *PassHandler) GetCampaignPasses(c *gin.Context) {
    campaignID, err := uuid.Parse(c.Param("campaign_id"))
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid campaign ID"})
        return
    }

    passes, err := h.passService.GetAllPassesInCampaign(c.Request.Context(), campaignID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"passes": passes})
}
```

## React UI Components

### Pass Button (Per Character)

```tsx
// src/components/PassButton.tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check } from 'lucide-react';

interface PassButtonProps {
  characterId: string;
  campaignId: string;
}

export function PassButton({ characterId, campaignId }: PassButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isHardPass, setIsHardPass] = useState(false);
  const queryClient = useQueryClient();

  // Get current pass state
  const { data: passState } = useQuery({
    queryKey: ['pass-state', characterId],
    queryFn: () => fetchPassState(characterId),
  });

  // Set pass mutation
  const passMutation = useMutation({
    mutationFn: async (hardPass: boolean) => {
      const res = await fetch('/api/passes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          character_id: characterId,
          is_hard_pass: hardPass,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pass-state', characterId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-passes', campaignId] });
      setIsDialogOpen(false);
    },
  });

  // Clear pass mutation
  const clearPassMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/passes/${characterId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!res.ok) throw new Error('Failed to clear pass');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pass-state', characterId] });
      queryClient.invalidateQueries({ queryKey: ['campaign-passes', campaignId] });
    },
  });

  const handlePass = () => {
    setIsDialogOpen(true);
  };

  const handleConfirmPass = () => {
    passMutation.mutate(isHardPass);
  };

  if (passState?.is_passed) {
    // Character has passed
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => clearPassMutation.mutate()}
          disabled={clearPassMutation.isPending}
          className="gap-2"
        >
          <Check className="w-4 h-4 text-green-600" />
          {passState.is_hard_pass ? 'Hard Passed' : 'Passed'}
        </Button>
        <span className="text-sm text-gray-500">
          {passState.passed_at && `at ${formatTime(passState.passed_at)}`}
        </span>
      </div>
    );
  }

  return (
    <>
      <Button onClick={handlePass}>Pass</Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pass Turn</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Mark your character as done with this phase?
            </p>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="hard-pass"
                checked={isHardPass}
                onCheckedChange={setIsHardPass}
              />
              <Label htmlFor="hard-pass" className="text-sm">
                <strong>Hard Pass</strong> - Don't notify me about new posts
              </Label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmPass}
                disabled={passMutation.isPending}
              >
                {passMutation.isPending ? 'Passing...' : 'Confirm Pass'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

async function fetchPassState(characterId: string) {
  const res = await fetch(`/api/passes/${characterId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString();
}
```

### Campaign Pass Overview (GM View)

```tsx
// src/components/CampaignPassOverview.tsx
import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';

interface CampaignPassOverviewProps {
  campaignId: string;
}

export function CampaignPassOverview({ campaignId }: CampaignPassOverviewProps) {
  const { data: passes } = useQuery({
    queryKey: ['campaign-passes', campaignId],
    queryFn: () => fetchCampaignPasses(campaignId),
    refetchInterval: 5000, // Poll every 5s
  });

  if (!passes || passes.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No active characters in campaign
      </div>
    );
  }

  const passedCount = passes.filter((p: any) => p.is_passed).length;
  const totalCount = passes.length;
  const allPassed = passedCount === totalCount;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Player Status</h3>
        <span className={`text-sm ${allPassed ? 'text-green-600' : 'text-gray-600'}`}>
          {passedCount} / {totalCount} passed
        </span>
      </div>

      <div className="space-y-1">
        {passes.map((pass: any) => (
          <div
            key={pass.character_id}
            className="flex items-center justify-between p-2 bg-gray-50 rounded"
          >
            <span className="text-sm">{pass.character_name}</span>
            {pass.is_passed ? (
              <div className="flex items-center gap-1 text-green-600">
                <Check className="w-4 h-4" />
                <span className="text-xs">
                  {pass.is_hard_pass ? 'Hard Pass' : 'Pass'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-gray-400">
                <X className="w-4 h-4" />
                <span className="text-xs">Active</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {allPassed && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
          All players have passed! You can transition to the next phase.
        </div>
      )}
    </div>
  );
}

async function fetchCampaignPasses(campaignId: string) {
  const res = await fetch(`/api/campaigns/${campaignId}/passes`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch passes');
  const data = await res.json();
  return data.passes;
}

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}
```

## Notification Filtering (Hard Pass)

```go
// internal/service/notification_service.go

func (s *NotificationService) NotifyNewPost(ctx context.Context, postID uuid.UUID, sceneID uuid.UUID) error {
    // Get all witnesses (characters who can see the post)
    witnesses, err := s.queries.GetPostWitnesses(ctx, postID)
    if err != nil {
        return err
    }

    for _, witnessCharID := range witnesses {
        // Check if character has hard passed
        pass, err := s.queries.GetCharacterPass(ctx, witnessCharID)
        if err != nil || (pass.IsPassed && pass.IsHardPass) {
            // Skip notification for hard-passed characters
            continue
        }

        // Get character's user
        char, err := s.queries.GetCharacter(ctx, witnessCharID)
        if err != nil {
            continue
        }

        // Send notification
        err = s.queries.CreateNotification(ctx, db.CreateNotificationParams{
            UserID: char.UserID,
            Type:   "new_post",
            Data: map[string]interface{}{
                "post_id":      postID,
                "scene_id":     sceneID,
                "character_id": witnessCharID,
            },
        })
        // ...
    }

    return nil
}
```

## Edge Cases

### 1. Multi-Character Player

**Scenario**: User has 2 characters, passes one, posts with the other.

**Handling**: Auto-clear only affects the posting character.

```go
// AutoClearPassOnPost clears pass for specific character
func (s *PassService) AutoClearPassOnPost(ctx context.Context, characterID uuid.UUID) error {
    // Only clears pass for this character
    // Other characters owned by same user unaffected
    // ...
}
```

### 2. Pass with Pending Roll

**Scenario**: Character tries to pass but has unresolved roll.

**Handling**: Reject pass with error message.

```go
if hasPendingRolls {
    return errors.New("cannot pass with pending rolls - resolve them first")
}
```

### 3. Orphaned Character Pass

**Scenario**: Character passes, then removed from scene.

**Handling**: Pass state persists but excluded from "all passed" count.

```sql
-- CheckAllCharactersPassed filters to present characters only
WHERE c.is_present = true
```

### 4. Hard Pass Then Post

**Scenario**: Character hard passes, then posts later.

**Handling**: Hard pass persists (no auto-clear).

```go
if pass.IsPassed && !pass.IsHardPass {
    // Only clear regular pass
    return s.queries.ClearCharacterPass(ctx, characterID)
}
// Hard pass not affected
```

### 5. Phase Transition Resets Passes

**Scenario**: All characters passed, GM transitions, passes reset.

**Handling**: This is intended behavior.

```sql
-- ResetAllPassesInCampaign clears all passes on transition
UPDATE character_passes cp
SET is_passed = false, is_hard_pass = false, passed_at = NULL
-- ...
```

### 6. Deleted Character with Pass

**Scenario**: Character deleted while passed.

**Handling**: Cascade delete cleans up pass state.

```sql
CREATE TABLE character_passes (
  character_id UUID PRIMARY KEY
    REFERENCES characters(id) ON DELETE CASCADE
);
```

## Testing Checklist

### Unit Tests

- [ ] Set pass
  - [ ] Regular pass sets `is_passed: true, is_hard_pass: false`
  - [ ] Hard pass sets `is_passed: true, is_hard_pass: true`
  - [ ] Pass blocked if pending rolls
  - [ ] Pass timestamp recorded

- [ ] Clear pass
  - [ ] Clears both regular and hard pass
  - [ ] Only owner can clear
  - [ ] Timestamp cleared

- [ ] Auto-clear
  - [ ] Regular pass clears on post
  - [ ] Hard pass persists on post
  - [ ] No error if no pass state

- [ ] All passed check
  - [ ] Returns true when all passed
  - [ ] Returns false when any not passed
  - [ ] Excludes orphaned characters
  - [ ] Excludes deleted characters

### Integration Tests

- [ ] Pass and post
  - [ ] Character passes
  - [ ] Character posts
  - [ ] Pass auto-clears (regular)
  - [ ] Pass persists (hard)

- [ ] Multi-character
  - [ ] User with 2 characters
  - [ ] Pass Character A
  - [ ] Post with Character B
  - [ ] Only Character B pass clears

- [ ] Notifications
  - [ ] Regular pass receives notifications
  - [ ] Hard pass skips notifications
  - [ ] GM notified when all passed

### E2E Tests

- [ ] Player clicks pass → pass indicator shows
- [ ] Player posts → pass clears (if regular)
- [ ] Player hard passes → posts don't clear pass
- [ ] Player with pending roll → pass button disabled
- [ ] All characters pass → GM sees "ready" message
- [ ] GM transitions → all passes reset

## Verification Steps

1. **Create campaign** with 2 characters (A and B)
2. **Character A clicks Pass** → verify pass indicator
3. **Check GM view** → verify 1/2 passed
4. **Character A posts** → verify pass cleared
5. **Character A clicks Hard Pass** → verify hard pass indicator
6. **Character A posts** → verify hard pass persists
7. **Character B clicks Pass** → verify 2/2 passed
8. **Check GM view** → verify "All passed" message
9. **GM transitions phase** → verify passes reset
10. **Create pending roll for Character A**
11. **Character A clicks Pass** → verify blocked with error

## API Documentation

### POST /api/passes

Set character pass.

**Request**:
```json
{
  "character_id": "uuid",
  "is_hard_pass": false
}
```

**Response**:
```json
{
  "message": "pass set"
}
```

**Error (Pending Rolls)**:
```json
{
  "error": "cannot pass with pending rolls - resolve them first"
}
```

### DELETE /api/passes/:character_id

Clear character pass.

**Response**:
```json
{
  "message": "pass cleared"
}
```

### GET /api/passes/:character_id

Get character pass state.

**Response**:
```json
{
  "character_id": "uuid",
  "is_passed": true,
  "is_hard_pass": false,
  "passed_at": "2025-01-15T10:30:00Z"
}
```

### GET /api/campaigns/:campaign_id/passes

Get all pass states in campaign (GM view).

**Response**:
```json
{
  "passes": [
    {
      "character_id": "uuid",
      "character_name": "Character A",
      "user_id": "user-uuid",
      "is_passed": true,
      "is_hard_pass": false,
      "passed_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

## Performance Considerations

### Real-Time Pass Updates

```tsx
// Subscribe to pass state changes
useEffect(() => {
  const subscription = supabase
    .from(`character_passes:character_id=eq.${characterId}`)
    .on('UPDATE', (payload) => {
      queryClient.setQueryData(['pass-state', characterId], payload.new);
    })
    .subscribe();

  return () => subscription.unsubscribe();
}, [characterId]);
```

### Caching Pass State

```go
// Cache pass state per character (short TTL)
func (c *PassCache) GetCharacterPass(ctx context.Context, charID uuid.UUID) (*db.CharacterPass, error) {
    key := fmt.Sprintf("pass:%s", charID)

    // Try cache (TTL: 30s)
    cached, err := c.redis.Get(ctx, key).Result()
    if err == nil {
        var pass db.CharacterPass
        json.Unmarshal([]byte(cached), &pass)
        return &pass, nil
    }

    // Fetch from DB
    pass, err := c.queries.GetCharacterPass(ctx, charID)
    if err != nil {
        return nil, err
    }

    // Cache (short TTL due to auto-clear)
    c.redis.Set(ctx, key, pass, 30*time.Second)

    return &pass, nil
}
```
