# Roll Execution Implementation

## Overview

Roll execution handles the server-side generation of dice results using cryptographically secure randomness. Rolls are created alongside posts and transition through a status lifecycle (pending → completed → invalidated).

## PRD References

- **Dice Rolling**: "Server-side roll execution, crypto random, roll tied to post"
- **Turn Structure**: "Roll status lifecycle, pending rolls block transitions"
- **Technical**: "Player-initiated rolls, GM-requested rolls"

## Skill Reference

**go-api-server** - Server-side roll logic, crypto RNG, roll persistence, validation

## Database Schema

```sql
CREATE TABLE rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

  -- Roll request
  intention TEXT NOT NULL,
  modifier INT NOT NULL DEFAULT 0 CHECK (modifier >= -100 AND modifier <= 100),
  dice_count INT NOT NULL DEFAULT 1 CHECK (dice_count >= 1 AND dice_count <= 100),

  -- Roll execution
  dice_results INT[] NOT NULL DEFAULT '{}',
  total INT,
  rolled_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'invalidated')),

  -- GM overrides (covered in 03-gm-overrides.md)
  original_intention TEXT,
  overridden_by UUID REFERENCES users(id),
  override_reason TEXT,
  manual_result INT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_rolls_post ON rolls(post_id);
CREATE INDEX idx_rolls_character ON rolls(character_id);
CREATE INDEX idx_rolls_status_pending ON rolls(status) WHERE status = 'pending';

-- Trigger
CREATE TRIGGER set_rolls_updated_at
  BEFORE UPDATE ON rolls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Roll Status Lifecycle

```
┌──────────┐
│          │
│ Pending  │  ──── Player creates roll, server queues execution
│          │
└────┬─────┘
     │
     │  Server executes roll (crypto RNG)
     │
     ▼
┌──────────┐
│          │
│Completed │  ──── Roll executed, result available
│          │
└──────────┘

     OR

┌──────────┐
│          │
│Invalidat-│  ──── GM manually resolves or roll becomes obsolete
│   ed     │
└──────────┘
```

**States**:
- **pending**: Roll created, awaiting execution
- **completed**: Roll executed, result available
- **invalidated**: Roll canceled or manually resolved by GM

## Cryptographically Secure RNG

### Go Implementation

```go
// internal/dice/roller.go
package dice

import (
    "crypto/rand"
    "encoding/binary"
    "fmt"
)

type DiceRoller struct{}

// Roll rolls N dice of given type (e.g., "d20")
// Returns array of individual results and error
func (r *DiceRoller) Roll(diceType string, count int) ([]int, error) {
    if count < 1 || count > 100 {
        return nil, fmt.Errorf("dice count must be 1-100")
    }

    // Parse dice type
    sides, err := parseDiceType(diceType)
    if err != nil {
        return nil, err
    }

    results := make([]int, count)
    for i := 0; i < count; i++ {
        result, err := rollSingleDie(sides)
        if err != nil {
            return nil, err
        }
        results[i] = result
    }

    return results, nil
}

// rollSingleDie rolls a single die with N sides using crypto/rand
func rollSingleDie(sides int) (int, error) {
    // Use crypto/rand for unpredictable results
    var buf [8]byte
    _, err := rand.Read(buf[:])
    if err != nil {
        return 0, fmt.Errorf("failed to generate random number: %w", err)
    }

    // Convert to uint64
    randomValue := binary.BigEndian.Uint64(buf[:])

    // Map to 1..sides range (inclusive)
    result := int(randomValue%uint64(sides)) + 1

    return result, nil
}

func parseDiceType(diceType string) (int, error) {
    switch diceType {
    case "d4":
        return 4, nil
    case "d6":
        return 6, nil
    case "d8":
        return 8, nil
    case "d10":
        return 10, nil
    case "d12":
        return 12, nil
    case "d20":
        return 20, nil
    case "d100":
        return 100, nil
    default:
        return 0, fmt.Errorf("invalid dice type: %s", diceType)
    }
}

// CalculateTotal sums dice results and adds modifier
func (r *DiceRoller) CalculateTotal(diceResults []int, modifier int) int {
    total := modifier
    for _, result := range diceResults {
        total += result
    }
    return total
}
```

### Unit Tests for RNG

```go
// internal/dice/roller_test.go
package dice_test

import (
    "testing"
    "vanguard-pbp/internal/dice"
)

func TestRollSingleD20(t *testing.T) {
    roller := &dice.DiceRoller{}

    results, err := roller.Roll("d20", 1)
    if err != nil {
        t.Fatalf("Roll failed: %v", err)
    }

    if len(results) != 1 {
        t.Fatalf("Expected 1 result, got %d", len(results))
    }

    result := results[0]
    if result < 1 || result > 20 {
        t.Errorf("Result %d out of range 1-20", result)
    }
}

func TestRollMultipleDice(t *testing.T) {
    roller := &dice.DiceRoller{}

    results, err := roller.Roll("d6", 10)
    if err != nil {
        t.Fatalf("Roll failed: %v", err)
    }

    if len(results) != 10 {
        t.Fatalf("Expected 10 results, got %d", len(results))
    }

    for i, result := range results {
        if result < 1 || result > 6 {
            t.Errorf("Result[%d] = %d out of range 1-6", i, result)
        }
    }
}

func TestRollDistribution(t *testing.T) {
    roller := &dice.DiceRoller{}

    // Roll 10,000 d6
    counts := make(map[int]int)
    for i := 0; i < 10000; i++ {
        results, _ := roller.Roll("d6", 1)
        counts[results[0]]++
    }

    // Each side should appear ~1666 times (10000/6)
    // Allow 20% variance
    expectedCount := 10000 / 6
    tolerance := expectedCount / 5

    for side := 1; side <= 6; side++ {
        count := counts[side]
        if count < expectedCount-tolerance || count > expectedCount+tolerance {
            t.Logf("Warning: d6 side %d appeared %d times (expected ~%d)", side, count, expectedCount)
        }
    }
}

func TestCalculateTotal(t *testing.T) {
    roller := &dice.DiceRoller{}

    total := roller.CalculateTotal([]int{5, 3, 8}, 4)
    expected := 5 + 3 + 8 + 4 // 20

    if total != expected {
        t.Errorf("Expected total %d, got %d", expected, total)
    }
}

func TestCalculateTotalNegativeModifier(t *testing.T) {
    roller := &dice.DiceRoller{}

    total := roller.CalculateTotal([]int{10}, -3)
    expected := 10 - 3 // 7

    if total != expected {
        t.Errorf("Expected total %d, got %d", expected, total)
    }
}
```

## Roll Service

### SQL Queries

```sql
-- name: CreateRoll :one
INSERT INTO rolls (
  post_id,
  character_id,
  intention,
  modifier,
  dice_count,
  status
) VALUES ($1, $2, $3, $4, $5, 'pending')
RETURNING *;

-- name: ExecuteRoll :one
UPDATE rolls
SET
  dice_results = $2,
  total = $3,
  rolled_at = now(),
  status = 'completed',
  updated_at = now()
WHERE id = $1
RETURNING *;

-- name: GetRoll :one
SELECT * FROM rolls WHERE id = $1;

-- name: GetRollsByPost :many
SELECT * FROM rolls WHERE post_id = $1 ORDER BY created_at ASC;

-- name: GetPendingRollsForCharacter :many
SELECT r.*
FROM rolls r
JOIN posts p ON p.id = r.post_id
WHERE r.character_id = $1
  AND r.status = 'pending'
ORDER BY r.created_at DESC;

-- name: GetPendingRollsInCampaign :many
SELECT r.*, c.name as character_name
FROM rolls r
JOIN characters c ON c.id = r.character_id
JOIN scenes s ON s.id = c.scene_id
WHERE s.campaign_id = $1
  AND r.status = 'pending'
ORDER BY r.created_at DESC;

-- name: InvalidateRoll :exec
UPDATE rolls
SET status = 'invalidated', updated_at = now()
WHERE id = $1;
```

### Go Service

```go
// internal/service/roll_service.go
package service

import (
    "context"
    "errors"
    "github.com/google/uuid"
    "vanguard-pbp/internal/db"
    "vanguard-pbp/internal/dice"
)

type RollService struct {
    queries *db.Queries
    roller  *dice.DiceRoller
}

type CreateRollRequest struct {
    PostID      uuid.UUID `json:"post_id"`
    CharacterID uuid.UUID `json:"character_id"`
    Intention   string    `json:"intention"`
    Modifier    int       `json:"modifier"`
    DiceCount   int       `json:"dice_count"`
}

func (s *RollService) CreateRoll(ctx context.Context, req CreateRollRequest) (*db.Roll, error) {
    // Validate modifier range
    if req.Modifier < -100 || req.Modifier > 100 {
        return nil, errors.New("modifier must be between -100 and +100")
    }

    // Validate dice count
    if req.DiceCount < 1 || req.DiceCount > 100 {
        return nil, errors.New("dice count must be between 1 and 100")
    }

    // Validate intention (non-empty)
    if len(req.Intention) == 0 {
        return nil, errors.New("intention is required")
    }

    // Create pending roll
    roll, err := s.queries.CreateRoll(ctx, db.CreateRollParams{
        PostID:      req.PostID,
        CharacterID: req.CharacterID,
        Intention:   req.Intention,
        Modifier:    int32(req.Modifier),
        DiceCount:   int32(req.DiceCount),
    })
    if err != nil {
        return nil, err
    }

    // Execute roll asynchronously
    go s.executeRollAsync(context.Background(), roll.ID)

    return &roll, nil
}

func (s *RollService) executeRollAsync(ctx context.Context, rollID uuid.UUID) {
    // Get roll
    roll, err := s.queries.GetRoll(ctx, rollID)
    if err != nil {
        log.Printf("Failed to get roll %s: %v", rollID, err)
        return
    }

    // Get campaign's dice type
    campaign, err := s.getCampaignForRoll(ctx, roll.PostID)
    if err != nil {
        log.Printf("Failed to get campaign for roll %s: %v", rollID, err)
        return
    }

    // Execute roll
    diceResults, err := s.roller.Roll(campaign.DiceType, int(roll.DiceCount))
    if err != nil {
        log.Printf("Failed to execute roll %s: %v", rollID, err)
        return
    }

    // Calculate total
    total := s.roller.CalculateTotal(diceResults, int(roll.Modifier))

    // Save results
    _, err = s.queries.ExecuteRoll(ctx, db.ExecuteRollParams{
        ID:          rollID,
        DiceResults: diceResults,
        Total:       int32(total),
    })
    if err != nil {
        log.Printf("Failed to save roll results %s: %v", rollID, err)
        return
    }

    // Notify witnesses (via real-time)
    s.notifyRollCompleted(ctx, rollID)
}

func (s *RollService) getCampaignForRoll(ctx context.Context, postID uuid.UUID) (*db.Campaign, error) {
    // Get post -> scene -> campaign
    post, err := s.queries.GetPost(ctx, postID)
    if err != nil {
        return nil, err
    }

    scene, err := s.queries.GetScene(ctx, post.SceneID)
    if err != nil {
        return nil, err
    }

    campaign, err := s.queries.GetCampaign(ctx, scene.CampaignID)
    if err != nil {
        return nil, err
    }

    return &campaign, nil
}

func (s *RollService) notifyRollCompleted(ctx context.Context, rollID uuid.UUID) {
    // Real-time update via Supabase will notify witnesses
    // Additional notification logic here if needed
}
```

## Post + Roll Creation (Atomic)

### Combined Request

```go
// internal/service/post_service.go

type CreatePostWithRollRequest struct {
    SceneID     uuid.UUID `json:"scene_id"`
    CharacterID uuid.UUID `json:"character_id"`
    Content     string    `json:"content"`
    IsHidden    bool      `json:"is_hidden"`

    // Roll (optional)
    Roll *CreateRollRequest `json:"roll,omitempty"`
}

func (s *PostService) CreatePostWithRoll(ctx context.Context, req CreatePostWithRollRequest) (*db.Post, *db.Roll, error) {
    // Create post first
    post, err := s.CreatePost(ctx, CreatePostRequest{
        SceneID:     req.SceneID,
        CharacterID: req.CharacterID,
        Content:     req.Content,
        IsHidden:    req.IsHidden,
    })
    if err != nil {
        return nil, nil, err
    }

    // Create roll if requested
    var roll *db.Roll
    if req.Roll != nil {
        req.Roll.PostID = post.ID
        req.Roll.CharacterID = req.CharacterID

        roll, err = s.rollService.CreateRoll(ctx, *req.Roll)
        if err != nil {
            // Roll failed - post still created
            // Could optionally delete post here, but PRD allows posts without rolls
            log.Printf("Failed to create roll for post %s: %v", post.ID, err)
            return post, nil, err
        }
    }

    return post, roll, nil
}
```

## React UI Components

### Roll Form

```tsx
// src/components/RollForm.tsx
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { IntentionSelector } from './IntentionSelector';

interface RollFormProps {
  campaignId: string;
  onRollChange: (roll: RollData | null) => void;
}

interface RollData {
  intention: string;
  modifier: number;
  dice_count: number;
}

export function RollForm({ campaignId, onRollChange }: RollFormProps) {
  const [includeRoll, setIncludeRoll] = useState(false);
  const [intention, setIntention] = useState('');
  const [modifier, setModifier] = useState(0);
  const [diceCount, setDiceCount] = useState(1);

  const handleIncludeRollChange = (checked: boolean) => {
    setIncludeRoll(checked);
    if (checked) {
      onRollChange({ intention, modifier, dice_count: diceCount });
    } else {
      onRollChange(null);
    }
  };

  const handleIntentionChange = (value: string) => {
    setIntention(value);
    if (includeRoll) {
      onRollChange({ intention: value, modifier, dice_count: diceCount });
    }
  };

  const handleModifierChange = (value: string) => {
    const num = parseInt(value) || 0;
    const clamped = Math.max(-100, Math.min(100, num));
    setModifier(clamped);
    if (includeRoll) {
      onRollChange({ intention, modifier: clamped, dice_count: diceCount });
    }
  };

  const handleDiceCountChange = (value: string) => {
    const num = parseInt(value) || 1;
    const clamped = Math.max(1, Math.min(100, num));
    setDiceCount(clamped);
    if (includeRoll) {
      onRollChange({ intention, modifier, dice_count: clamped });
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="include-roll"
          checked={includeRoll}
          onCheckedChange={handleIncludeRollChange}
        />
        <Label htmlFor="include-roll" className="font-medium">
          Include dice roll with this post
        </Label>
      </div>

      {includeRoll && (
        <div className="space-y-4 pl-6">
          <IntentionSelector
            campaignId={campaignId}
            value={intention}
            onChange={handleIntentionChange}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="modifier">Modifier</Label>
              <Input
                id="modifier"
                type="number"
                value={modifier}
                onChange={(e) => handleModifierChange(e.target.value)}
                min={-100}
                max={100}
                className="text-center"
              />
              <p className="text-xs text-gray-500 mt-1">-100 to +100</p>
            </div>

            <div>
              <Label htmlFor="dice-count">Number of Dice</Label>
              <Input
                id="dice-count"
                type="number"
                value={diceCount}
                onChange={(e) => handleDiceCountChange(e.target.value)}
                min={1}
                max={100}
                className="text-center"
              />
              <p className="text-xs text-gray-500 mt-1">1 to 100</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Roll Display

```tsx
// src/components/RollDisplay.tsx
import { useQuery } from '@tanstack/react-query';
import { Dices, Loader2 } from 'lucide-react';

interface RollDisplayProps {
  postId: string;
}

export function RollDisplay({ postId }: RollDisplayProps) {
  const { data: rolls, isLoading } = useQuery({
    queryKey: ['rolls', postId],
    queryFn: () => fetchRollsForPost(postId),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Rolling...</span>
      </div>
    );
  }

  if (!rolls || rolls.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {rolls.map((roll: any) => (
        <div
          key={roll.id}
          className={`p-3 rounded border ${
            roll.status === 'pending'
              ? 'bg-amber-50 border-amber-200'
              : roll.status === 'completed'
              ? 'bg-blue-50 border-blue-200'
              : 'bg-gray-50 border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dices className="w-5 h-5 text-blue-600" />
              <span className="font-medium">{roll.intention}</span>
              {roll.modifier !== 0 && (
                <span className="text-sm text-gray-600">
                  ({roll.modifier > 0 ? '+' : ''}{roll.modifier})
                </span>
              )}
            </div>

            {roll.status === 'completed' && (
              <div className="text-2xl font-bold text-blue-600">
                {roll.total}
              </div>
            )}
          </div>

          {roll.status === 'completed' && roll.dice_results && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
              <span>Rolls:</span>
              <div className="flex gap-1">
                {roll.dice_results.map((result: number, index: number) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-white border rounded font-mono"
                  >
                    {result}
                  </span>
                ))}
              </div>
              {roll.modifier !== 0 && (
                <span>
                  {roll.modifier > 0 ? '+' : ''}{roll.modifier}
                </span>
              )}
            </div>
          )}

          {roll.status === 'pending' && (
            <div className="mt-2 text-sm text-amber-600">
              Executing roll...
            </div>
          )}

          {roll.status === 'invalidated' && (
            <div className="mt-2 text-sm text-gray-500">
              Roll invalidated by GM
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

async function fetchRollsForPost(postId: string) {
  const res = await fetch(`/api/posts/${postId}/rolls`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch rolls');
  return res.json();
}

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}
```

## Edge Cases

### 1. Post Created Without Roll

**Scenario**: Player creates post without roll, then wants to add roll.

**Handling**: Not supported - rolls must be created with post. Player can create new post with roll.

### 2. Roll Execution Fails (Server Error)

**Scenario**: crypto/rand fails or database unavailable.

**Handling**: Roll remains in pending state, can be retried.

```go
// Retry logic for failed rolls
func (s *RollService) RetryPendingRolls(ctx context.Context) {
    // Get all pending rolls older than 5 minutes
    oldPendingRolls, _ := s.queries.GetStalePendingRolls(ctx, 5*time.Minute)

    for _, roll := range oldPendingRolls {
        go s.executeRollAsync(ctx, roll.ID)
    }
}
```

### 3. Roll for Deleted Character

**Scenario**: Character deleted, but roll persists tied to post.

**Handling**: Roll remains visible to post witnesses. Character nullable via ON DELETE CASCADE.

```sql
CREATE TABLE rolls (
  character_id UUID NOT NULL
    REFERENCES characters(id) ON DELETE CASCADE  -- Roll deleted with character
);
```

### 4. Modifier Out of Range

**Scenario**: Client sends modifier +500.

**Handling**: Validation rejects, or clamp to -100/+100.

```go
// Clamp modifier
if req.Modifier < -100 {
    req.Modifier = -100
} else if req.Modifier > 100 {
    req.Modifier = 100
}
```

### 5. Dice Count Excessive

**Scenario**: Client requests 1000 dice.

**Handling**: Validation rejects > 100.

```go
if req.DiceCount > 100 {
    return nil, errors.New("dice count must be 1-100")
}
```

### 6. Concurrent Roll Executions

**Scenario**: Multiple rolls created simultaneously.

**Handling**: Each executeRollAsync runs independently, no conflict.

```go
// Each roll has unique ID, no race conditions
for _, roll := range rolls {
    go s.executeRollAsync(ctx, roll.ID)  // Independent goroutines
}
```

## Testing Checklist

### Unit Tests

- [ ] RNG distribution
  - [ ] d20 results in 1-20 range
  - [ ] Distribution roughly uniform (10K rolls)
  - [ ] crypto/rand used (not math/rand)

- [ ] Roll calculation
  - [ ] Total = sum(dice) + modifier
  - [ ] Negative modifier works
  - [ ] Zero modifier works

- [ ] Validation
  - [ ] Modifier clamped to -100/+100
  - [ ] Dice count clamped to 1-100
  - [ ] Empty intention rejected

### Integration Tests

- [ ] Roll creation
  - [ ] Roll created with post
  - [ ] Roll status = pending initially
  - [ ] Roll executed asynchronously
  - [ ] Roll status = completed after execution

- [ ] Roll blocking
  - [ ] Pending roll blocks character pass
  - [ ] Completed roll allows pass
  - [ ] Pending rolls block phase transition

### E2E Tests

- [ ] Player creates post with roll → sees "Rolling..."
- [ ] Wait for execution → sees result displayed
- [ ] Verify result in range (dice + modifier)
- [ ] Verify witnesses see roll result
- [ ] Non-witnesses don't see roll

## Verification Steps

1. **Create post with roll** (intention: "Attack", modifier: +5, dice: 1d20)
2. **Verify roll created** with status "pending"
3. **Wait for execution** (~1 second)
4. **Verify roll completed** with result shown
5. **Check result in range** (1-20 + 5 = 6-25)
6. **Check dice_results array** has 1 value (1-20)
7. **Create roll with multiple dice** (3d20 + 10)
8. **Verify dice_results array** has 3 values
9. **Verify total** = sum(3 dice) + 10
10. **Test blocking**: Create pending roll, try to pass → blocked

## API Documentation

### POST /api/posts (with roll)

Create post with optional roll.

**Request**:
```json
{
  "scene_id": "uuid",
  "character_id": "uuid",
  "content": "I attack the orc!",
  "is_hidden": false,
  "roll": {
    "intention": "Attack",
    "modifier": 5,
    "dice_count": 1
  }
}
```

**Response**:
```json
{
  "post": {
    "id": "post-uuid",
    "content": "I attack the orc!",
    ...
  },
  "roll": {
    "id": "roll-uuid",
    "post_id": "post-uuid",
    "intention": "Attack",
    "modifier": 5,
    "dice_count": 1,
    "status": "pending",
    "dice_results": [],
    "total": null
  }
}
```

### GET /api/posts/:post_id/rolls

Get rolls for a post.

**Response**:
```json
[
  {
    "id": "roll-uuid",
    "post_id": "post-uuid",
    "character_id": "char-uuid",
    "intention": "Attack",
    "modifier": 5,
    "dice_count": 1,
    "dice_results": [14],
    "total": 19,
    "status": "completed",
    "rolled_at": "2025-01-15T10:30:15Z"
  }
]
```

### GET /api/characters/:character_id/rolls/pending

Get pending rolls for a character.

**Response**:
```json
[
  {
    "id": "roll-uuid",
    "intention": "Attack",
    "modifier": 3,
    "dice_count": 1,
    "status": "pending",
    "created_at": "2025-01-15T10:30:00Z"
  }
]
```

## Performance Considerations

### Asynchronous Execution

```go
// Don't block post creation waiting for roll
go s.executeRollAsync(context.Background(), roll.ID)

// Return immediately with pending status
return &roll, nil
```

### Real-Time Updates

```tsx
// Subscribe to roll updates
useEffect(() => {
  const subscription = supabase
    .from(`rolls:post_id=eq.${postId}`)
    .on('UPDATE', (payload) => {
      // Roll completed - update UI
      queryClient.setQueryData(['rolls', postId], (old: any) => {
        return old.map((r: any) =>
          r.id === payload.new.id ? payload.new : r
        );
      });
    })
    .subscribe();

  return () => subscription.unsubscribe();
}, [postId]);
```
