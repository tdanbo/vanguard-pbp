# Time Gate Expiration Implementation Plan

## Overview

This plan addresses the incomplete implementation of time gate expiration handling. Currently, when the time gate expires:
1. Characters are NOT auto-passed (they should be)
2. Players CAN still post (they shouldn't)
3. UI shows "Expired" text but doesn't lock controls

### PRD Requirements (from `prd/turn-structure.md`)

When the time gate expires during PC Phase:
1. Phase enters "expired" state (no auto-transition)
2. All characters who haven't passed are auto-passed
3. Players see: "Phase expired. Waiting for GM to transition."
4. Players cannot post but can read existing posts
5. GM sees: "Phase transition available" button (if all rolls resolved)
6. GM clicks button to manually transition to GM Phase

### Design Decision: Lazy Evaluation

Instead of a background job, we use **lazy evaluation**:
- Frontend already tracks expiration time via countdown
- Backend checks expiration on every relevant API call
- Auto-pass triggers on first API interaction after expiration
- This is simpler and guarantees consistency

---

## Phase 1: Backend - PhaseStatus API Enhancement

### Goal
Add `isExpired` field to the PhaseStatus API response so frontend has a single source of truth.

### Files to Modify

**`services/backend/internal/service/phase.go`**

1. Update `PhaseStatus` struct (line 65-76):
```go
type PhaseStatus struct {
    CurrentPhase    string     `json:"currentPhase"`
    StartedAt       *time.Time `json:"startedAt,omitempty"`
    ExpiresAt       *time.Time `json:"expiresAt,omitempty"`
    IsPaused        bool       `json:"isPaused"`
    IsExpired       bool       `json:"isExpired"`       // NEW
    TimeGatePreset  string     `json:"timeGatePreset,omitempty"`
    PassedCount     int64      `json:"passedCount"`
    TotalCount      int64      `json:"totalCount"`
    AllPassed       bool       `json:"allPassed"`
    CanTransition   bool       `json:"canTransition"`
    TransitionBlock string     `json:"transitionBlock,omitempty"`
}
```

2. Calculate `IsExpired` in `GetPhaseStatus()` (after line 171):
```go
// Check if time gate has expired
if status.CurrentPhase == PhasePCPhase && status.ExpiresAt != nil {
    status.IsExpired = time.Now().After(*status.ExpiresAt)
}

// When expired, GM can transition (all chars effectively passed)
if status.IsExpired && status.CurrentPhase == PhasePCPhase {
    // Update transition logic - expired means can transition
    if canTransition == false && transitionBlock == "Not all characters have passed" {
        status.CanTransition = true
        status.TransitionBlock = ""
    }
}
```

### Testing
- [ ] API returns `isExpired: true` when `current_phase_expires_at` is in the past
- [ ] API returns `isExpired: false` during GM phase
- [ ] API returns `canTransition: true` when expired (assuming no pending rolls)

---

## Phase 2: Backend - Auto-Pass Function

### Goal
Create a function that marks all unpassed PC characters as "passed" when the time gate expires.

### Files to Modify

**`services/backend/internal/service/pass.go`**

Add new function after existing pass functions:

```go
// AutoPassAllCharacters sets all unpassed PCs in the campaign to "passed" state.
// Called lazily when time gate has expired and a user interacts with the system.
func (s *PassService) AutoPassAllCharacters(ctx context.Context, campaignID pgtype.UUID) error {
    // Get all active scenes in campaign with their pass states
    scenes, err := s.queries.GetAllScenesInCampaign(ctx, campaignID)
    if err != nil {
        return err
    }

    for _, scene := range scenes {
        // Skip archived scenes
        if scene.Status == generated.SceneStatusArchived {
            continue
        }

        // Parse existing pass states
        var passStates map[string]string
        if err := json.Unmarshal(scene.PassStates, &passStates); err != nil {
            passStates = make(map[string]string)
        }

        // Get characters in this scene
        chars, err := s.queries.GetSceneCharacters(ctx, scene.ID)
        if err != nil {
            continue
        }

        needsUpdate := false
        for _, char := range chars {
            // Only auto-pass PCs, not NPCs
            if char.CharacterType != generated.CharacterTypePc {
                continue
            }

            charIDStr := char.ID.String() // or use formatPgtypeUUID helper
            currentState := passStates[charIDStr]

            // If not already passed or hard_passed, mark as passed
            if currentState != PassStatePassed && currentState != PassStateHardPassed {
                passStates[charIDStr] = PassStatePassed
                needsUpdate = true
            }
        }

        if needsUpdate {
            passStatesJSON, _ := json.Marshal(passStates)
            _, err := s.queries.UpdateScenePassStates(ctx, generated.UpdateScenePassStatesParams{
                ID:         scene.ID,
                PassStates: passStatesJSON,
            })
            if err != nil {
                // Log but continue - best effort
                continue
            }
        }
    }

    return nil
}
```

### Database Query (if needed)

**`services/backend/db/queries/scenes.sql`**

May need to add if not exists:
```sql
-- name: GetAllScenesInCampaign :many
SELECT * FROM scenes
WHERE campaign_id = $1
ORDER BY created_at;
```

### Testing
- [ ] Function marks all unpassed PCs as "passed"
- [ ] NPCs are not affected
- [ ] Already passed/hard_passed characters unchanged
- [ ] Works across multiple scenes

---

## Phase 3: Backend - Block Posting When Expired

### Goal
Prevent players from acquiring compose locks or creating posts when time gate has expired.

### Files to Modify

**`services/backend/internal/service/compose.go`**

1. Add error constant (around line 27):
```go
var (
    // ... existing errors
    ErrTimeGateExpired = errors.New("time gate has expired, cannot compose posts")
)
```

2. Add expiration check in `AcquireLock()` (after line 77, after getting sceneWithCampaign):
```go
// Check if time gate has expired (lazy processing)
if sceneWithCampaign.CurrentPhase == generated.CampaignPhasePcPhase {
    if sceneWithCampaign.CurrentPhaseExpiresAt.Valid &&
       time.Now().After(sceneWithCampaign.CurrentPhaseExpiresAt.Time) {
        // Time gate expired - auto-pass all characters
        passSvc := NewPassService(s.pool)
        if passErr := passSvc.AutoPassAllCharacters(ctx, sceneWithCampaign.CampaignID); passErr != nil {
            // Log error but continue - auto-pass is best-effort
        }

        // Block lock acquisition for players (GMs can still compose)
        if !isGM {
            return nil, ErrTimeGateExpired
        }
    }
}
```

**`services/backend/internal/service/post.go`**

1. Add error constant (if not shared from compose.go):
```go
var ErrTimeGateExpired = errors.New("time gate has expired, cannot create posts")
```

2. Add same expiration check in `CreatePost()` (around line 122):
```go
// Check if time gate has expired
if !isGM && sceneWithCampaign.CurrentPhase == generated.CampaignPhasePcPhase {
    if sceneWithCampaign.CurrentPhaseExpiresAt.Valid &&
       time.Now().After(sceneWithCampaign.CurrentPhaseExpiresAt.Time) {
        return nil, ErrTimeGateExpired
    }
}
```

### Ensure Query Returns Expiration Time

**`services/backend/db/queries/scenes.sql`**

Verify `GetSceneWithCampaign` includes `current_phase_expires_at`:
```sql
-- name: GetSceneWithCampaign :one
SELECT
    s.*,
    c.current_phase,
    c.current_phase_expires_at,  -- Must include this
    c.owner_id AS campaign_owner_id
FROM scenes s
INNER JOIN campaigns c ON s.campaign_id = c.id
WHERE s.id = $1;
```

Then regenerate: `make backend-sqlc` or `sqlc generate`

### Testing
- [ ] Player attempting lock acquisition after expiration gets 403 error
- [ ] Player attempting post creation after expiration gets 403 error
- [ ] GM can still acquire lock and post after expiration
- [ ] Auto-pass is triggered on first blocked request

---

## Phase 4: Backend - Error Handling in Handlers

### Goal
Return proper HTTP error codes and messages for the time gate expired error.

### Files to Modify

**`services/backend/internal/handlers/compose.go`**

In the error handling switch (around where other errors are handled):
```go
case errors.Is(err, service.ErrTimeGateExpired):
    c.JSON(http.StatusForbidden, gin.H{
        "error":   "TIME_GATE_EXPIRED",
        "message": "Time gate has expired. Waiting for GM to transition phase.",
    })
    return
```

**`services/backend/internal/handlers/posts.go`**

Same error handling pattern.

### Testing
- [ ] HTTP 403 returned with error code "TIME_GATE_EXPIRED"
- [ ] Error message is user-friendly

---

## Phase 5: Frontend - Type Updates

### Goal
Update TypeScript types to include the new `isExpired` field.

### Files to Modify

**`services/frontend/src/types/index.ts`**

Update `PhaseStatus` interface:
```typescript
export interface PhaseStatus {
  currentPhase: CampaignPhase
  startedAt: string | null
  expiresAt: string | null
  isPaused: boolean
  isExpired: boolean  // NEW FIELD
  timeGatePreset: string | null
  passedCount: number
  totalCount: number
  allPassed: boolean
  canTransition: boolean
  transitionBlock: string | null
}
```

### Testing
- [ ] TypeScript compiles without errors
- [ ] `phaseStatus.isExpired` is accessible in components

---

## Phase 6: Frontend - SceneView Integration

### Goal
Pass expiration state from SceneView to child components.

### Files to Modify

**`services/frontend/src/pages/scenes/SceneView.tsx`**

1. Extract `isExpired` from phase status (around line 53):
```typescript
const isPhaseExpired = phaseStatus?.isExpired ?? false;
```

2. Pass to ImmersiveComposer:
```tsx
<ImmersiveComposer
    campaignId={campaignId}
    sceneId={sceneId}
    character={selectedCharacter}
    // ... other props
    isExpired={isPhaseExpired}  // NEW PROP
/>
```

3. Pass to UnifiedHeader:
```tsx
<UnifiedHeader
    // ... other props
    isExpired={isPhaseExpired}  // NEW PROP
/>
```

### Testing
- [ ] `isExpired` prop flows to child components

---

## Phase 7: Frontend - ImmersiveComposer UI Lock

### Goal
Disable posting controls when time gate has expired.

### Files to Modify

**`services/frontend/src/components/posts/ImmersiveComposer.tsx`**

1. Add prop to interface (line 43):
```typescript
interface ImmersiveComposerProps {
    // ... existing props
    isExpired?: boolean;  // NEW
}
```

2. Destructure in component (line 64):
```typescript
export function ImmersiveComposer({
    // ... existing props
    isExpired = false,
}: ImmersiveComposerProps) {
```

3. Update the "no lock" state render (around line 457-530):
```tsx
// Check if expired for non-GMs
const isLockedByExpiration = isExpired && !isGM;

if (!hasLock) {
    return (
        <div className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                {/* Character portrait */}
                <span className="text-sm text-muted-foreground">
                    {isLockedByExpiration
                        ? "Phase expired. Waiting for GM to transition."
                        : /* existing text */}
                </span>
            </div>
            <div className="flex items-center gap-2">
                {/* Only show controls if not expired */}
                {!isLockedByExpiration && (
                    <>
                        {/* Pass button */}
                        {!isEditMode && !isNarrator && character &&
                         character.character_type === 'pc' &&
                         currentPhase === "pc_phase" && (
                            <PassButton ... />
                        )}

                        {/* Take Turn button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAcquireLock}
                            disabled={lockLoading}
                        >
                            {/* ... */}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
```

### Testing
- [ ] "Take Turn" button hidden when expired (for players)
- [ ] "Pass" dropdown hidden when expired
- [ ] Expired message shown instead
- [ ] GM still sees controls when expired

---

## Phase 8: Frontend - UnifiedHeader Messaging

### Goal
Show clear expired state in the header.

### Files to Modify

**`services/frontend/src/components/phase/UnifiedHeader.tsx`**

1. Add prop to interface:
```typescript
interface UnifiedHeaderProps {
    // ... existing props
    isExpired?: boolean;  // NEW
}
```

2. Update time display (around line 188):
```tsx
{hasTimeGate ? (
    <div className={cn(
        'flex items-center gap-1.5 text-xs',
        isExpired
            ? 'text-red-500 font-medium'
            : isUrgent
                ? 'text-amber-500'
                : 'text-muted-foreground'
    )}>
        <Clock className="h-3 w-3" />
        <span>
            {isExpired
                ? 'Phase expired. Waiting for GM to transition.'
                : `Time to next phase: ${timeLeft}`}
        </span>
    </div>
) : (
    <div />
)}
```

### Testing
- [ ] Red "Phase expired" message shows when expired
- [ ] Normal countdown shows when not expired

---

## Phase 9: Frontend - Error Handling

### Goal
Handle the TIME_GATE_EXPIRED error gracefully in the UI.

### Files to Modify

**`services/frontend/src/hooks/useComposeLock.ts`**

In the lock acquisition error handling:
```typescript
try {
    // ... acquire lock
} catch (error) {
    if (error.response?.data?.error === 'TIME_GATE_EXPIRED') {
        toast({
            variant: 'destructive',
            title: 'Time gate expired',
            description: 'The phase has expired. Waiting for GM to transition.',
        });
        // Optionally trigger a refetch of phase status
        return;
    }
    // ... other error handling
}
```

### Testing
- [ ] Toast notification appears on TIME_GATE_EXPIRED error
- [ ] No crash or unhandled error state

---

## Verification Checklist

### Backend Verification
- [ ] `GET /api/campaigns/:id/phase` returns `isExpired: true` when time gate passed
- [ ] `POST /api/scenes/:id/compose/lock` returns 403 for players when expired
- [ ] `POST /api/scenes/:id/posts` returns 403 for players when expired
- [ ] Characters are auto-passed after first API call when expired
- [ ] GM can still post when expired

### Frontend Verification
- [ ] Player sees "Phase expired" message instead of Take Turn button
- [ ] Player cannot click any posting controls when expired
- [ ] Header shows red "Phase expired" text
- [ ] GM still has full controls when expired
- [ ] Error toast appears if backend rejects request

### Integration Verification
- [ ] Set `current_phase_expires_at` to past manually in database
- [ ] Load scene as player - should show expired state
- [ ] Load scene as GM - should still have controls
- [ ] GM transitions to GM phase successfully
- [ ] New PC phase starts fresh with new time gate

---

## Rollback Plan

If issues arise, the changes can be rolled back by:
1. Removing the `isExpired` field from PhaseStatus (backend + frontend)
2. Removing the expiration checks from compose.go and post.go
3. Removing the AutoPassAllCharacters function

No database migrations are required for this feature.
