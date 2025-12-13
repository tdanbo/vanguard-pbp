# GM Roll Controls Implementation

## Overview

GMs have special controls over rolls: they can override a player's intention (preserving the original), manually resolve rolls, and view an unresolved rolls dashboard. Pending rolls block phase transitions.

## PRD References

- **Dice Rolling**: "GM intention override, manual resolution, unresolved rolls UI"
- **Turn Structure**: "Roll blocking prevents phase transition, GM resolves for hard-passed players"

## Skill Reference

**dice-roller** - GM override mechanics, manual resolution, roll cleanup workflows

## Database Schema

```sql
CREATE TABLE rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

  -- Roll request
  intention TEXT NOT NULL,
  modifier INT NOT NULL DEFAULT 0,
  dice_count INT NOT NULL DEFAULT 1,

  -- Roll execution
  dice_results INT[] NOT NULL DEFAULT '{}',
  total INT,
  rolled_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'invalidated')),

  -- GM overrides
  original_intention TEXT,           -- Preserved when GM overrides intention
  overridden_by UUID REFERENCES users(id),  -- GM who overrode
  override_reason TEXT,               -- Optional explanation
  override_timestamp TIMESTAMPTZ,

  manual_result INT,                  -- If GM manually resolves (bypasses dice)
  manually_resolved_by UUID REFERENCES users(id),
  manual_resolution_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Intention Override

### Concept

GM can change a player's stated intention after the roll is created. The original intention is preserved for transparency.

**Example**:
- Player selects "Attack"
- GM overrides to "Saving Throw"
- Original intention "Attack" preserved
- Player notified of override

### SQL Queries

```sql
-- name: OverrideRollIntention :one
UPDATE rolls
SET
  original_intention = CASE WHEN original_intention IS NULL THEN intention ELSE original_intention END,
  intention = $2,
  overridden_by = $3,
  override_reason = $4,
  override_timestamp = now(),
  updated_at = now()
WHERE id = $1
RETURNING *;

-- name: GetOverriddenRolls :many
SELECT r.*, c.name as character_name
FROM rolls r
JOIN characters c ON c.id = r.character_id
WHERE r.original_intention IS NOT NULL
ORDER BY r.override_timestamp DESC;
```

### Go Service

```go
// internal/service/roll_service.go

type OverrideIntentionRequest struct {
    RollID         uuid.UUID `json:"roll_id"`
    NewIntention   string    `json:"new_intention"`
    Reason         string    `json:"reason,omitempty"`
}

func (s *RollService) OverrideIntention(ctx context.Context, req OverrideIntentionRequest) (*db.Roll, error) {
    // Verify user is GM
    userID := getUserIDFromContext(ctx)
    isGM, err := s.isUserGMForRoll(ctx, userID, req.RollID)
    if err != nil || !isGM {
        return nil, errors.New("unauthorized: only GM can override intentions")
    }

    // Get roll
    roll, err := s.queries.GetRoll(ctx, req.RollID)
    if err != nil {
        return nil, err
    }

    // Only allow override on pending or completed rolls
    if roll.Status == "invalidated" {
        return nil, errors.New("cannot override invalidated roll")
    }

    // Validate new intention
    if len(req.NewIntention) == 0 {
        return nil, errors.New("new intention cannot be empty")
    }

    // Override intention
    overriddenRoll, err := s.queries.OverrideRollIntention(ctx, db.OverrideRollIntentionParams{
        ID:           req.RollID,
        Intention:    req.NewIntention,
        OverriddenBy: uuid.NullUUID{UUID: userID, Valid: true},
        OverrideReason: sql.NullString{
            String: req.Reason,
            Valid:  len(req.Reason) > 0,
        },
    })
    if err != nil {
        return nil, err
    }

    // Notify player
    s.notifyPlayerOfOverride(ctx, roll.CharacterID, req.RollID, roll.Intention, req.NewIntention, req.Reason)

    return &overriddenRoll, nil
}

func (s *RollService) isUserGMForRoll(ctx context.Context, userID uuid.UUID, rollID uuid.UUID) (bool, error) {
    roll, err := s.queries.GetRoll(ctx, rollID)
    if err != nil {
        return false, err
    }

    campaign, err := s.getCampaignForRoll(ctx, roll.PostID)
    if err != nil {
        return false, err
    }

    return campaign.GMID == userID, nil
}

func (s *RollService) notifyPlayerOfOverride(
    ctx context.Context,
    characterID uuid.UUID,
    rollID uuid.UUID,
    oldIntention string,
    newIntention string,
    reason string,
) {
    // Get character's user
    char, err := s.queries.GetCharacter(ctx, characterID)
    if err != nil {
        return
    }

    // Create notification
    s.queries.CreateNotification(ctx, db.CreateNotificationParams{
        UserID: char.UserID,
        Type:   "roll_intention_overridden",
        Data: map[string]interface{}{
            "roll_id":       rollID,
            "old_intention": oldIntention,
            "new_intention": newIntention,
            "reason":        reason,
        },
    })
}
```

## Manual Resolution

### Concept

GM can manually resolve a roll by specifying the result directly, bypassing dice rolling. This is useful when:
- Player is unavailable (hard passed)
- Roll needs specific narrative outcome
- Technical issue with roll execution

### SQL Queries

```sql
-- name: ManuallyResolveRoll :one
UPDATE rolls
SET
  manual_result = $2,
  manually_resolved_by = $3,
  manual_resolution_reason = $4,
  status = 'completed',
  rolled_at = now(),
  updated_at = now()
WHERE id = $1
RETURNING *;

-- name: GetManuallyResolvedRolls :many
SELECT r.*, c.name as character_name
FROM rolls r
JOIN characters c ON c.id = r.character_id
WHERE r.manual_result IS NOT NULL
ORDER BY r.rolled_at DESC;
```

### Go Service

```go
// internal/service/roll_service.go

type ManualResolveRequest struct {
    RollID  uuid.UUID `json:"roll_id"`
    Result  int       `json:"result"`
    Reason  string    `json:"reason,omitempty"`
}

func (s *RollService) ManuallyResolve(ctx context.Context, req ManualResolveRequest) (*db.Roll, error) {
    // Verify user is GM
    userID := getUserIDFromContext(ctx)
    isGM, err := s.isUserGMForRoll(ctx, userID, req.RollID)
    if err != nil || !isGM {
        return nil, errors.New("unauthorized: only GM can manually resolve rolls")
    }

    // Get roll
    roll, err := s.queries.GetRoll(ctx, req.RollID)
    if err != nil {
        return nil, err
    }

    // Only allow manual resolution on pending rolls
    if roll.Status != "pending" {
        return nil, errors.New("can only manually resolve pending rolls")
    }

    // Manually resolve
    resolvedRoll, err := s.queries.ManuallyResolveRoll(ctx, db.ManuallyResolveRollParams{
        ID:                     req.RollID,
        ManualResult:           sql.NullInt32{Int32: int32(req.Result), Valid: true},
        ManuallyResolvedBy:     uuid.NullUUID{UUID: userID, Valid: true},
        ManualResolutionReason: sql.NullString{String: req.Reason, Valid: len(req.Reason) > 0},
    })
    if err != nil {
        return nil, err
    }

    // Notify player
    s.notifyPlayerOfManualResolution(ctx, roll.CharacterID, req.RollID, req.Result, req.Reason)

    return &resolvedRoll, nil
}

func (s *RollService) notifyPlayerOfManualResolution(
    ctx context.Context,
    characterID uuid.UUID,
    rollID uuid.UUID,
    result int,
    reason string,
) {
    char, err := s.queries.GetCharacter(ctx, characterID)
    if err != nil {
        return
    }

    s.queries.CreateNotification(ctx, db.CreateNotificationParams{
        UserID: char.UserID,
        Type:   "roll_manually_resolved",
        Data: map[string]interface{}{
            "roll_id": rollID,
            "result":  result,
            "reason":  reason,
        },
    })
}
```

## Invalidate Roll

### Concept

GM can invalidate a roll, marking it as obsolete or canceled.

### SQL Query

```sql
-- name: InvalidateRoll :one
UPDATE rolls
SET status = 'invalidated', updated_at = now()
WHERE id = $1
RETURNING *;
```

### Go Service

```go
func (s *RollService) InvalidateRoll(ctx context.Context, rollID uuid.UUID) error {
    // Verify user is GM
    userID := getUserIDFromContext(ctx)
    isGM, err := s.isUserGMForRoll(ctx, userID, rollID)
    if err != nil || !isGM {
        return errors.New("unauthorized: only GM can invalidate rolls")
    }

    // Invalidate
    _, err = s.queries.InvalidateRoll(ctx, rollID)
    return err
}
```

## Unresolved Rolls Dashboard

### Concept

GM dashboard showing all pending rolls across the campaign, with quick-resolve controls.

### SQL Query

```sql
-- name: GetUnresolvedRollsInCampaign :many
SELECT
  r.*,
  c.name as character_name,
  u.name as player_name,
  p.content as post_content,
  s.name as scene_name
FROM rolls r
JOIN characters c ON c.id = r.character_id
JOIN users u ON u.id = c.user_id
JOIN posts p ON p.id = r.post_id
JOIN scenes s ON s.id = p.scene_id
WHERE s.campaign_id = $1
  AND r.status = 'pending'
ORDER BY r.created_at ASC;
```

### React UI Component

```tsx
// src/components/UnresolvedRollsDashboard.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { AlertCircle, Edit, CheckCircle, XCircle } from 'lucide-react';

interface UnresolvedRollsDashboardProps {
  campaignId: string;
}

export function UnresolvedRollsDashboard({ campaignId }: UnresolvedRollsDashboardProps) {
  const queryClient = useQueryClient();
  const [selectedRoll, setSelectedRoll] = useState<any>(null);
  const [action, setAction] = useState<'override' | 'resolve' | null>(null);

  const { data: unresolvedRolls, isLoading } = useQuery({
    queryKey: ['unresolved-rolls', campaignId],
    queryFn: () => fetchUnresolvedRolls(campaignId),
    refetchInterval: 10000, // Poll every 10s
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!unresolvedRolls || unresolvedRolls.length === 0) {
    return (
      <div className="text-center p-8 text-gray-500">
        <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
        <p>All rolls resolved!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded">
        <AlertCircle className="w-5 h-5 text-amber-600" />
        <span className="font-medium text-amber-800">
          {unresolvedRolls.length} pending roll{unresolvedRolls.length !== 1 ? 's' : ''}
        </span>
      </div>

      {unresolvedRolls.map((roll: any) => (
        <div key={roll.id} className="p-4 border rounded space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{roll.character_name}</span>
                <span className="text-gray-500">({roll.player_name})</span>
                <span className="text-sm text-gray-400">in {roll.scene_name}</span>
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {roll.post_content.substring(0, 100)}
                {roll.post_content.length > 100 ? '...' : ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="font-medium">Intention:</span> {roll.intention}
            </div>
            <div>
              <span className="font-medium">Modifier:</span> {roll.modifier > 0 ? '+' : ''}
              {roll.modifier}
            </div>
            <div>
              <span className="font-medium">Dice:</span> {roll.dice_count}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedRoll(roll);
                setAction('override');
              }}
            >
              <Edit className="w-4 h-4 mr-1" />
              Override Intention
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedRoll(roll);
                setAction('resolve');
              }}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Manually Resolve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleInvalidate(roll.id)}
            >
              <XCircle className="w-4 h-4 mr-1" />
              Invalidate
            </Button>
          </div>
        </div>
      ))}

      {/* Override Dialog */}
      {action === 'override' && selectedRoll && (
        <OverrideIntentionDialog
          roll={selectedRoll}
          campaignId={campaignId}
          onClose={() => {
            setSelectedRoll(null);
            setAction(null);
          }}
        />
      )}

      {/* Manual Resolve Dialog */}
      {action === 'resolve' && selectedRoll && (
        <ManualResolveDialog
          roll={selectedRoll}
          campaignId={campaignId}
          onClose={() => {
            setSelectedRoll(null);
            setAction(null);
          }}
        />
      )}
    </div>
  );
}

async function fetchUnresolvedRolls(campaignId: string) {
  const res = await fetch(`/api/campaigns/${campaignId}/rolls/unresolved`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch unresolved rolls');
  return res.json();
}

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}
```

### Override Intention Dialog

```tsx
// src/components/OverrideIntentionDialog.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface OverrideIntentionDialogProps {
  roll: any;
  campaignId: string;
  onClose: () => void;
}

export function OverrideIntentionDialog({ roll, campaignId, onClose }: OverrideIntentionDialogProps) {
  const [newIntention, setNewIntention] = useState(roll.intention);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const overrideMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/rolls/${roll.id}/override-intention`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          roll_id: roll.id,
          new_intention: newIntention,
          reason,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unresolved-rolls', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['rolls'] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override Roll Intention</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Original Intention</Label>
            <div className="mt-1 p-2 bg-gray-100 rounded text-gray-700">
              {roll.intention}
            </div>
          </div>

          <div>
            <Label htmlFor="new-intention">New Intention</Label>
            <Input
              id="new-intention"
              value={newIntention}
              onChange={(e) => setNewIntention(e.target.value)}
              placeholder="Enter new intention"
            />
          </div>

          <div>
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you're overriding..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => overrideMutation.mutate()}
              disabled={!newIntention || overrideMutation.isPending}
            >
              {overrideMutation.isPending ? 'Overriding...' : 'Override Intention'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}
```

### Manual Resolve Dialog

```tsx
// src/components/ManualResolveDialog.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ManualResolveDialogProps {
  roll: any;
  campaignId: string;
  onClose: () => void;
}

export function ManualResolveDialog({ roll, campaignId, onClose }: ManualResolveDialogProps) {
  const [result, setResult] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/rolls/${roll.id}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          roll_id: roll.id,
          result,
          reason,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unresolved-rolls', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['rolls'] });
      onClose();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manually Resolve Roll</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-gray-50 rounded">
            <div className="text-sm text-gray-600">
              <div><strong>Character:</strong> {roll.character_name}</div>
              <div><strong>Intention:</strong> {roll.intention}</div>
              <div><strong>Modifier:</strong> {roll.modifier > 0 ? '+' : ''}{roll.modifier}</div>
            </div>
          </div>

          <div>
            <Label htmlFor="result">Result</Label>
            <Input
              id="result"
              type="number"
              value={result || ''}
              onChange={(e) => setResult(parseInt(e.target.value))}
              placeholder="Enter roll result"
            />
          </div>

          <div>
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you're manually resolving..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => resolveMutation.mutate()}
              disabled={result === null || resolveMutation.isPending}
            >
              {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}
```

## Roll Blocking Phase Transitions

### Concept

Phase transitions are blocked if any pending rolls exist. GM must resolve or invalidate them first.

### SQL Query

```sql
-- name: CountPendingRollsInCampaign :one
SELECT COUNT(*)
FROM rolls r
JOIN posts p ON p.id = r.post_id
JOIN scenes s ON s.id = p.scene_id
WHERE s.campaign_id = $1
  AND r.status = 'pending';
```

### Guard Implementation

```go
// internal/service/phase_service.go

type NoPendingRollsGuard struct {
    queries *db.Queries
}

func (g *NoPendingRollsGuard) Check(ctx context.Context, campaignID uuid.UUID) error {
    count, err := g.queries.CountPendingRollsInCampaign(ctx, campaignID)
    if err != nil {
        return err
    }

    if count > 0 {
        return fmt.Errorf("cannot transition: %d pending roll(s) must be resolved", count)
    }

    return nil
}
```

## Edge Cases

### 1. Override After Roll Executed

**Scenario**: Roll already completed, GM overrides intention.

**Handling**: Allow override (intention is just metadata).

```go
// Override allowed on completed rolls
if roll.Status != "invalidated" {
    // Allow override
}
```

### 2. Multiple Overrides

**Scenario**: GM overrides intention twice.

**Handling**: original_intention preserves first intention, not intermediate.

```sql
-- Only set original_intention if not already set
original_intention = CASE
  WHEN original_intention IS NULL THEN intention
  ELSE original_intention
END
```

### 3. Manual Resolve on Completed Roll

**Scenario**: GM tries to manually resolve already-completed roll.

**Handling**: Reject operation.

```go
if roll.Status != "pending" {
    return errors.New("can only manually resolve pending rolls")
}
```

### 4. Hard-Passed Player with Pending Roll

**Scenario**: Player hard passes, but has pending roll.

**Handling**: Hard pass blocked until roll resolved or GM manually resolves.

```go
// In SetPass
hasPendingRolls, _ := s.queries.CharacterHasPendingRolls(ctx, characterID)
if hasPendingRolls {
    return errors.New("cannot pass with pending rolls - resolve them first")
}
```

### 5. Roll for Deleted Post

**Scenario**: Post deleted, roll orphaned.

**Handling**: Cascade delete roll with post.

```sql
CREATE TABLE rolls (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE
);
```

### 6. GM Leaves Campaign

**Scenario**: GM overrides roll, then leaves campaign.

**Handling**: overridden_by preserved (nullable UUID), historical record remains.

```sql
overridden_by UUID REFERENCES users(id) ON DELETE SET NULL
```

## Testing Checklist

### Unit Tests

- [ ] Intention override
  - [ ] Preserves original intention
  - [ ] Only GM can override
  - [ ] Notifies player
  - [ ] Allows override on completed rolls

- [ ] Manual resolution
  - [ ] Only works on pending rolls
  - [ ] Only GM can resolve
  - [ ] Notifies player
  - [ ] Sets status to completed

- [ ] Roll invalidation
  - [ ] Only GM can invalidate
  - [ ] Sets status to invalidated

- [ ] Pending roll guard
  - [ ] Blocks phase transition
  - [ ] Reports count of pending rolls

### Integration Tests

- [ ] Override workflow
  - [ ] GM overrides → player notified
  - [ ] Multiple overrides preserve first intention
  - [ ] Override persists after roll execution

- [ ] Manual resolve workflow
  - [ ] GM resolves → roll completed
  - [ ] Manual result displayed to players
  - [ ] Phase transition unblocked

- [ ] Unresolved rolls dashboard
  - [ ] Shows all pending rolls
  - [ ] Quick-resolve buttons work
  - [ ] Real-time updates

### E2E Tests

- [ ] Player creates roll → GM sees in dashboard
- [ ] GM overrides intention → player sees override
- [ ] GM manually resolves → result displayed
- [ ] Pending roll blocks phase transition
- [ ] GM resolves all → transition allowed

## Verification Steps

1. **Create roll** as player (pending)
2. **Open GM dashboard** → verify roll appears
3. **Override intention** → verify original preserved
4. **Check player notification** → verify override message
5. **Manually resolve different roll** → verify completed
6. **Check result displayed** to player
7. **Attempt phase transition** → verify blocked
8. **Resolve all pending rolls** → verify transition allowed
9. **Test invalidation** → roll disappears from dashboard

## API Documentation

### POST /api/rolls/:roll_id/override-intention

Override a roll's intention (GM only).

**Request**:
```json
{
  "roll_id": "uuid",
  "new_intention": "Saving Throw",
  "reason": "Actually need a save here"
}
```

**Response**:
```json
{
  "id": "uuid",
  "intention": "Saving Throw",
  "original_intention": "Attack",
  "overridden_by": "gm-uuid",
  "override_reason": "Actually need a save here",
  "override_timestamp": "2025-01-15T10:35:00Z"
}
```

### POST /api/rolls/:roll_id/resolve

Manually resolve a roll (GM only).

**Request**:
```json
{
  "roll_id": "uuid",
  "result": 18,
  "reason": "Player is unavailable (hard passed)"
}
```

**Response**:
```json
{
  "id": "uuid",
  "status": "completed",
  "manual_result": 18,
  "manually_resolved_by": "gm-uuid",
  "manual_resolution_reason": "Player is unavailable (hard passed)",
  "rolled_at": "2025-01-15T10:40:00Z"
}
```

### POST /api/rolls/:roll_id/invalidate

Invalidate a roll (GM only).

**Response**:
```json
{
  "id": "uuid",
  "status": "invalidated"
}
```

### GET /api/campaigns/:campaign_id/rolls/unresolved

Get all unresolved rolls in campaign (GM only).

**Response**:
```json
[
  {
    "id": "roll-uuid",
    "character_name": "Aragorn",
    "player_name": "John",
    "scene_name": "Prancing Pony",
    "post_content": "I try to sneak past the guards...",
    "intention": "Stealth",
    "modifier": 3,
    "dice_count": 1,
    "status": "pending",
    "created_at": "2025-01-15T10:30:00Z"
  }
]
```

## Performance Considerations

### Dashboard Polling

```tsx
// Poll for updates every 10s (not real-time)
const { data } = useQuery({
  queryKey: ['unresolved-rolls', campaignId],
  queryFn: () => fetchUnresolvedRolls(campaignId),
  refetchInterval: 10000,  // 10 seconds
});
```

### Indexing for Dashboard Query

```sql
-- Compound index for unresolved rolls query
CREATE INDEX idx_rolls_campaign_pending
ON rolls (status)
INCLUDE (character_id, post_id, created_at)
WHERE status = 'pending';
```

### Notification Batching

```go
// Don't spam notifications for multiple overrides
// Debounce or batch notifications
```
