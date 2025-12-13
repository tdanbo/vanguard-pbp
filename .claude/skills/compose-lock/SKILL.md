---
name: compose-lock
description: Distributed locking system for sequential post composition in Vanguard PBP. Use this skill when implementing or debugging lock acquisition, heartbeat mechanisms, timeout handling, rate limiting, lock release patterns, or conflict resolution. Critical for preventing race conditions during post composition and maintaining action ordering within scenes.
---

# Compose Lock

## Overview

The compose lock system ensures sequential post composition within each scene by implementing a distributed locking mechanism with heartbeat-based timeout detection. Players acquire character-scoped locks, maintain them via keystroke heartbeats, and release them gracefully on post submission or automatically after 10 minutes of inactivity.

## Lock Lifecycle Workflow

### 1. Lock Acquisition

**Trigger:** Player clicks "Take Post" button to compose as a specific character in a scene.

**Lock Scope:**
- Unique constraint: `(sceneId, characterId)` pair
- Character-scoped: User acquires separate locks per character
- Scene-scoped: Same player can hold locks in different scenes simultaneously
- Multi-character: User controlling multiple characters must acquire separate locks for each

**Server Arbitration:**
```typescript
interface LockAcquisitionRequest {
  sceneId: string;
  characterId: string;
  userId: string;
  timestamp: number;
}

interface LockAcquisitionResponse {
  success: boolean;
  lockId?: string;              // UUID for this lock instance
  expiresAt?: number;           // Unix timestamp (now + 10 minutes)
  conflictHolder?: {            // Only if success: false
    characterId: string;        // Which character holds the lock
    // NO user identity exposed
  };
}
```

**Request Flow:**
1. Client sends lock acquisition request to server
2. Server checks existing lock for `(sceneId, characterId)`
3. First request wins; subsequent requests fail with conflict error
4. UI shows loading state during acquisition
5. On conflict, UI displays: "Another player is currently posting" (generic message)
6. On success, UI transitions to compose interface with timer UI

**Rate Limiting:**
- Maximum 1 acquire/release operation per 5 seconds per user
- Prevents spam and lock thrashing
- Server returns 429 Too Many Requests if violated
- Client UI disables "Take Post" button during cooldown

### 2. Heartbeat Maintenance

**Purpose:** Reset inactivity timer on each keystroke to prevent timeout during active composition.

**Heartbeat Mechanism:**
```typescript
interface HeartbeatRequest {
  lockId: string;
  timestamp: number;
}

interface HeartbeatResponse {
  acknowledged: boolean;
  expiresAt: number;            // Updated expiration time
  remainingSeconds: number;     // For UI countdown
}
```

**Client Behavior:**
- Send heartbeat on every keystroke in compose field
- Debounce: Maximum 1 heartbeat per 2 seconds (avoid server spam)
- Track consecutive failed heartbeats (disconnect detection)
- After 3 consecutive heartbeat failures, assume disconnection

**Server Behavior:**
- Validate lockId exists and belongs to requesting user
- Update `lastActivityAt` timestamp in lock record
- Reset `expiresAt` to `now + 10 minutes`
- Return updated expiration time for client UI sync

**Network Disconnection Handling:**
```typescript
// Client-side detection
let consecutiveHeartbeatFailures = 0;

function onHeartbeatFailure() {
  consecutiveHeartbeatFailures++;

  if (consecutiveHeartbeatFailures >= 3) {
    // Show disconnection warning
    showWarning("Connection lost. Your lock may expire soon.");
    // Continue attempting heartbeats for reconnection
  }
}

function onHeartbeatSuccess() {
  consecutiveHeartbeatFailures = 0;
  hideWarning();
}
```

**Draft Persistence:**
- Server persists draft content on every heartbeat
- Draft survives lock release (timeout or disconnection)
- Player can reacquire lock and resume from saved draft
- Multi-device sync: Same draft accessible from any device

### 3. Lock Release

**Release Triggers:**

**A. Graceful Release (Post Submission):**
```typescript
interface PostSubmissionRequest {
  lockId: string;
  sceneId: string;
  characterId: string;
  content: PostContent;
  intention?: string;
  modifier?: number;
}

// Server-side handler
async function submitPost(request: PostSubmissionRequest) {
  // 1. Validate lock ownership
  const lock = await getLock(request.lockId);
  if (!lock || lock.userId !== request.userId) {
    throw new Error("Lock not held by requesting user");
  }

  // 2. Create post record
  const post = await createPost(request);

  // 3. Release lock atomically
  await releaseLock(request.lockId);

  // 4. Broadcast post visibility to all witnesses
  await notifyWitnesses(request.sceneId, post);

  // 5. Clear draft
  await deleteDraft(request.sceneId, request.characterId);

  return { success: true, postId: post.id };
}
```

**B. Manual Release (Cancel):**
- Player clicks "Cancel" or navigates away
- Client sends explicit release request
- Server validates lock ownership before releasing
- Draft persists on server for future reacquisition

**C. Timeout Release (10-Minute Inactivity):**
```typescript
interface LockRecord {
  lockId: string;
  sceneId: string;
  characterId: string;
  userId: string;
  acquiredAt: number;
  lastActivityAt: number;
  expiresAt: number;              // lastActivityAt + 10 minutes
}

// Server-side timeout checker (runs every 30 seconds)
async function checkLockTimeouts() {
  const now = Date.now();
  const expiredLocks = await db.locks.where('expiresAt').lessThan(now);

  for (const lock of expiredLocks) {
    // Release lock
    await releaseLock(lock.lockId);

    // Notify scene participants
    await broadcastLockRelease(lock.sceneId, lock.characterId);

    // Draft persists for reacquisition
  }
}
```

**D. GM Force-Release:**
- GM can override any lock to maintain game pacing
- GM clicks "Release Lock" button on lock indicator
- Server validates GM role before releasing
- Player receives notification: "GM has released your compose lock"
- Draft persists for player to reacquire

**E. Disconnect Release:**
- Triggered after 3 consecutive missed heartbeats
- Server automatically releases lock
- Draft persists on server
- Player can reacquire lock on reconnect

### 4. Lock Visibility

**UI Indicators (Per Scene):**

**When Lock is Held:**
```typescript
interface LockIndicator {
  isLocked: true;
  // NO user identity exposed to other players
  message: "Another player is currently posting";
  // For lock holder only:
  timeRemaining?: number;       // Seconds until timeout
  showDrainBar?: boolean;       // True if < 60 seconds remain
}
```

**Visual Drain Bar (Final Minute):**
- Appears when `timeRemaining < 60` seconds
- Smooth CSS transition from green → yellow → red
- Pulses when < 10 seconds remain
- Provides clear warning before automatic release

**When Lock is Available:**
```typescript
interface LockIndicator {
  isLocked: false;
  availableCharacters: CharacterId[];  // Characters user can post as
  actionButton: "Take Post";
}
```

**Multi-Character Display:**
- If user controls multiple characters in scene:
  - Show separate "Take Post" button per character
  - Each button checks lock for that specific characterId
  - User can only hold one lock at a time per scene
  - After submitting post as Character A, user can acquire lock for Character B

### 5. Hidden Post Behavior

**Privacy Protection:**
- Lock holder's identity is NEVER exposed to other players
- UI shows generic message: "Another player is currently posting"
- No avatars, usernames, or character names displayed
- Prevents metagaming and maintains narrative surprise

**Exception: GM Visibility:**
```typescript
interface LockIndicatorForGM {
  isLocked: true;
  holder: {
    userId: string;
    username: string;
    characterId: string;
    characterName: string;
    acquiredAt: number;
    expiresAt: number;
  };
  actions: ["Force Release"];
}
```

GM sees full lock details for moderation and pacing purposes.

## Edge Cases and Error Handling

### Race Conditions

**Scenario:** Two players click "Take Post" simultaneously.

**Resolution:**
1. Both clients send acquisition requests
2. Server processes requests in arrival order (database-level locking)
3. First request wins, acquires lock
4. Second request receives conflict error
5. Second client displays: "Another player is currently posting"

### Multi-Tab Behavior

**Scenario:** Same user has multiple tabs open with same character.

**Resolution:**
- Lock is per-character, not per-tab
- Tabs compete for lock acquisition (same as different users)
- Only one tab can hold lock at a time
- Heartbeats from non-holding tabs are rejected
- Draft syncs across all tabs via server persistence

### Stale Lock Recovery

**Scenario:** Server crashes during active lock; heartbeat checker didn't run.

**Resolution:**
```typescript
// On server startup, check all locks
async function recoverStaleLocks() {
  const now = Date.now();
  const allLocks = await db.locks.all();

  for (const lock of allLocks) {
    if (lock.expiresAt < now) {
      await releaseLock(lock.lockId);
      console.log(`Recovered stale lock: ${lock.lockId}`);
    }
  }
}
```

### GM Lock Override Notification

**Scenario:** GM force-releases a player's lock.

**Flow:**
1. GM clicks "Release Lock" button
2. Server validates GM role
3. Server releases lock
4. Server sends real-time notification to lock holder:
   ```typescript
   {
     type: "lock_force_released",
     message: "GM has released your compose lock",
     sceneId: string,
     characterId: string
   }
   ```
5. Client UI shows notification and exits compose mode
6. Draft persists; player can reacquire lock if needed

## Rate Limiting Implementation

**Per-User Rate Limits:**
```typescript
interface RateLimitConfig {
  windowSeconds: 5;              // 5-second sliding window
  maxOperations: 1;              // 1 acquire/release per window
}

// Server-side rate limiter
class LockRateLimiter {
  private userOperations: Map<string, number[]> = new Map();

  isAllowed(userId: string): boolean {
    const now = Date.now();
    const window = now - 5000;  // 5 seconds ago

    const operations = this.userOperations.get(userId) || [];
    const recentOps = operations.filter(ts => ts > window);

    if (recentOps.length >= 1) {
      return false;  // Rate limit exceeded
    }

    recentOps.push(now);
    this.userOperations.set(userId, recentOps);
    return true;
  }
}
```

**Client-Side Cooldown UI:**
- Disable "Take Post" button for 5 seconds after release
- Show countdown timer: "Available in 3s..."
- Prevent button spam and improve UX

## Database Schema

**Lock Table:**
```sql
CREATE TABLE compose_locks (
  lock_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  UNIQUE(scene_id, character_id)  -- One lock per character per scene
);

CREATE INDEX idx_compose_locks_expiration ON compose_locks(expires_at);
CREATE INDEX idx_compose_locks_user ON compose_locks(user_id);
```

**Draft Table:**
```sql
CREATE TABLE compose_drafts (
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (scene_id, character_id)
);
```

## Real-Time Sync Requirements

**Events to Broadcast:**

1. **Lock Acquired:**
   ```typescript
   {
     event: "lock_acquired",
     sceneId: string,
     characterId: string,
     // NO user identity
   }
   ```

2. **Lock Released:**
   ```typescript
   {
     event: "lock_released",
     sceneId: string,
     characterId: string
   }
   ```

3. **Heartbeat (Internal Only):**
   - Not broadcasted to other clients
   - Only affects lock holder's expiration timer

4. **Post Submitted:**
   ```typescript
   {
     event: "post_created",
     sceneId: string,
     post: PostData,
     visibleTo: UserId[]  // Witness list
   }
   ```

**Subscription Model:**
- Clients subscribe to scene-level lock channels
- Subscribe: `scene:{sceneId}:locks`
- Receive real-time updates on lock state changes
- Update UI immediately (disable/enable "Take Post" button)

## Testing Scenarios

### Critical Test Cases

1. **Concurrent Acquisition:**
   - Two users click "Take Post" within 10ms
   - Verify only one succeeds
   - Verify loser receives conflict message

2. **Heartbeat Timeout:**
   - Acquire lock, stop sending heartbeats
   - Verify lock releases after exactly 10 minutes
   - Verify draft persists

3. **Network Disconnection:**
   - Acquire lock, disconnect network
   - Verify lock releases after 3 missed heartbeats
   - Reconnect and verify draft recovery

4. **Multi-Device Draft Sync:**
   - Acquire lock on Device A
   - Type draft content
   - Switch to Device B (same user)
   - Verify Device B cannot acquire lock
   - Release lock on Device A
   - Acquire lock on Device B
   - Verify draft content appears

5. **Rate Limit Enforcement:**
   - Acquire lock, release immediately
   - Attempt to reacquire within 5 seconds
   - Verify rejection with 429 status

6. **GM Force-Release:**
   - Player acquires lock
   - GM clicks "Release Lock"
   - Verify player receives notification
   - Verify draft persists

7. **Stale Lock Recovery:**
   - Manually insert expired lock in database
   - Trigger timeout checker
   - Verify automatic cleanup

8. **Multi-Character Lock:**
   - User controls Character A and B in same scene
   - Acquire lock for Character A
   - Attempt to acquire lock for Character B
   - Verify second acquisition fails (one lock per scene per user)
   - Submit post as Character A (releases lock)
   - Acquire lock for Character B
   - Verify success

## Configuration

**Fixed Constants (Not Configurable):**
```typescript
const LOCK_TIMEOUT_MINUTES = 10;          // Always 10 minutes
const HEARTBEAT_DEBOUNCE_MS = 2000;       // 2 seconds
const HEARTBEAT_FAILURE_THRESHOLD = 3;    // 3 missed heartbeats
const RATE_LIMIT_WINDOW_SECONDS = 5;      // 5-second cooldown
const RATE_LIMIT_MAX_OPERATIONS = 1;      // 1 operation per window
const DRAIN_BAR_THRESHOLD_SECONDS = 60;   // Show drain bar at < 60s
```

These values are NOT configurable per-campaign. They are system-wide constants designed for optimal play-by-post pacing.
