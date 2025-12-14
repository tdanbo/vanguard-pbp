---
name: real-time-sync
description: Real-time event synchronization using Supabase Real-time subscriptions for the Vanguard PBP system. Use this skill when implementing or debugging WebSocket subscriptions, presence tracking, typing indicators, phase transition broadcasts, post visibility filtering, campaign-wide events, and JWT-authenticated real-time connections. Critical for live updates, compose lock status, and witness-filtered event delivery.
---

# Real-Time Sync

## Overview

This skill provides patterns and implementation guidance for real-time event synchronization in the Vanguard PBP system using Supabase Real-time subscriptions. The system handles campaign-wide broadcasts (phase transitions, time gates), scene-level events (posts, compose locks, passes), and presence tracking (typing indicators) while enforcing witness visibility rules to prevent identity leakage for hidden posts.

## Core Capabilities

### 1. Supabase Real-time Architecture

**No Custom WebSocket Hub Required**

The system uses Supabase Real-time exclusively for all WebSocket functionality. No separate WebSocket server or custom hub implementation is needed.

**Connection Pattern:**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// JWT authentication handled automatically by Supabase client
// Connection is authenticated via the user's session token
```

**JWT Authentication:**

- All WebSocket connections require valid JWT from Supabase Auth
- Token automatically included in connection handshake
- Invalid/expired tokens reject connection
- Supabase handles token refresh automatically

### 2. Campaign-Wide Event Broadcasting

**Phase Transition Events:**

Phase transitions are global to the entire campaign and must be broadcast to all connected clients in that campaign.

```typescript
// Server: Broadcast phase transition after updating Campaign.currentPhase
const { error } = await supabase
  .from('campaigns')
  .update({
    currentPhase: 'pc_phase',
    currentPhaseExpiresAt: expirationTime
  })
  .eq('id', campaignId);

// Client: Subscribe to campaign updates
const campaignChannel = supabase
  .channel(`campaign:${campaignId}`)
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'campaigns',
      filter: `id=eq.${campaignId}`
    },
    (payload) => {
      // Handle phase transition
      const { currentPhase, currentPhaseExpiresAt } = payload.new;
      handlePhaseTransition(currentPhase, currentPhaseExpiresAt);
    }
  )
  .subscribe();
```

**Time Gate Warning Events:**

Time gate warnings are broadcast when PC Phase is approaching expiration (e.g., 1 hour remaining, 10 minutes remaining).

```typescript
// Server: Broadcast time gate warning
// Trigger via scheduled job or polling mechanism
const channel = supabase.channel(`campaign:${campaignId}`);
channel.send({
  type: 'broadcast',
  event: 'timegate:warning',
  payload: {
    campaignId,
    remainingMinutes: 60
  }
});

// Client: Listen for time gate warnings
campaignChannel.on('broadcast', { event: 'timegate:warning' }, (payload) => {
  const { remainingMinutes } = payload.payload;
  showTimeGateWarning(remainingMinutes);
});
```

**Campaign Status Events:**

Pause/resume events broadcast campaign state changes.

```typescript
// Server: Broadcast pause/resume
await supabase
  .from('campaigns')
  .update({ isPaused: true })
  .eq('id', campaignId);

// Client: Subscribe to campaign status changes
campaignChannel.on(
  'postgres_changes',
  {
    event: 'UPDATE',
    schema: 'public',
    table: 'campaigns',
    filter: `id=eq.${campaignId}`
  },
  (payload) => {
    const { isPaused } = payload.new;
    handleCampaignStatus(isPaused ? 'paused' : 'active');
  }
);
```

### 3. Scene-Level Event Subscriptions

**Room Join/Leave Pattern:**

Clients join scene-specific channels for real-time updates within that scene.

```typescript
// Client: Join scene room
const sceneChannel = supabase
  .channel(`scene:${sceneId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'posts',
      filter: `scene_id=eq.${sceneId}`
    },
    handlePostEvent
  )
  .subscribe();

// Client: Leave scene room
const leaveScene = () => {
  supabase.removeChannel(sceneChannel);
};
```

**Post Events:**

Post creation, editing, and deletion are broadcast to all scene subscribers. Witness filtering is applied at the application layer.

```typescript
// Server: Create post (Supabase triggers broadcast automatically)
const { data: newPost } = await supabase
  .from('posts')
  .insert({
    sceneId,
    characterId,
    userId,
    blocks: postBlocks,
    witnesses,
    submitted: true
  })
  .select()
  .single();

// Client: Handle post events with witness filtering
sceneChannel.on(
  'postgres_changes',
  {
    event: 'INSERT',
    schema: 'public',
    table: 'posts',
    filter: `scene_id=eq.${sceneId}`
  },
  (payload) => {
    const post = payload.new;

    // Client-side witness filtering
    const userCharacterIds = getUserCharacterIdsInScene(sceneId);
    const isWitness = post.witnesses.some(witnessId =>
      userCharacterIds.includes(witnessId)
    );

    if (isWitness || userIsGM) {
      addPostToFeed(post);
    }
  }
);

// Post edit events
sceneChannel.on(
  'postgres_changes',
  {
    event: 'UPDATE',
    schema: 'public',
    table: 'posts',
    filter: `scene_id=eq.${sceneId}`
  },
  (payload) => {
    const updatedPost = payload.new;
    updatePostInFeed(updatedPost);
  }
);

// Post deletion (GM moderation)
sceneChannel.on(
  'postgres_changes',
  {
    event: 'DELETE',
    schema: 'public',
    table: 'posts',
    filter: `scene_id=eq.${sceneId}`
  },
  (payload) => {
    const deletedPostId = payload.old.id;
    removePostFromFeed(deletedPostId);
  }
);
```

**Post Unlocking:**

When a post is deleted, the previous post becomes unlocked.

```typescript
// Server: Handle post deletion and unlock previous
const deletedPost = await getPost(postId);
const previousPost = await getPreviousPostInScene(deletedPost.sceneId, deletedPost.createdAt);

if (previousPost) {
  await supabase
    .from('posts')
    .update({ isLocked: false, lockedAt: null })
    .eq('id', previousPost.id);
}

// Client: Handle unlock event via UPDATE subscription
// The UPDATE event for the previous post will trigger automatically
```

### 4. Compose Lock & Typing Indicators

**Compose Lock Events:**

Compose lock acquisition and release must be broadcast to prevent identity leakage for hidden posts.

```typescript
// Server: Acquire compose lock
const { data: session } = await supabase
  .from('compose_sessions')
  .insert({
    sceneId,
    characterId,
    userId,
    acquiredAt: now,
    lastActivityAt: now,
    expiresAt: addMinutes(now, 10)
  })
  .select()
  .single();

// Broadcast generic compose event (NO CHARACTER IDENTITY)
const channel = supabase.channel(`scene:${sceneId}`);
channel.send({
  type: 'broadcast',
  event: 'compose:start',
  payload: { sceneId }  // No characterId or userId included
});

// Client: Show generic "Another player is currently posting"
sceneChannel.on('broadcast', { event: 'compose:start' }, (payload) => {
  showGenericComposingIndicator();  // No identity shown
});

// Server: Release compose lock
await supabase
  .from('compose_sessions')
  .delete()
  .eq('id', sessionId);

channel.send({
  type: 'broadcast',
  event: 'compose:end',
  payload: { sceneId }
});

// Client: Hide composing indicator
sceneChannel.on('broadcast', { event: 'compose:end' }, () => {
  hideComposingIndicator();
});
```

**Typing Indicators with Presence:**

Typing indicators use Supabase Presence to show who is actively typing (distinct from compose lock).

```typescript
// Client: Join presence and track typing
const presenceChannel = supabase.channel(`scene:${sceneId}:presence`);

presenceChannel
  .on('presence', { event: 'sync' }, () => {
    const state = presenceChannel.presenceState();
    updateTypingIndicators(state);
  })
  .on('presence', { event: 'join' }, ({ key, newPresences }) => {
    // User joined presence
  })
  .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    // User left presence
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      // Track user presence
      await presenceChannel.track({
        userId,
        characterId,
        isTyping: false,
        timestamp: Date.now()
      });
    }
  });

// Update typing state
const setTyping = (isTyping: boolean) => {
  presenceChannel.track({
    userId,
    characterId,
    isTyping,
    timestamp: Date.now()
  });
};

// Debounced typing handler
let typingTimeout: NodeJS.Timeout;
const handleKeystroke = () => {
  setTyping(true);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => setTyping(false), 3000);
};
```

### 5. Pass State Updates

**Pass/Unpass Events:**

Pass state changes are broadcast via scene-level events.

```typescript
// Server: Update pass state
await supabase
  .from('scenes')
  .update({
    passStates: {
      ...currentPassStates,
      [characterId]: 'passed'
    }
  })
  .eq('id', sceneId);

// Broadcast pass update
const channel = supabase.channel(`scene:${sceneId}`);
channel.send({
  type: 'broadcast',
  event: 'pass:update',
  payload: {
    sceneId,
    characterId,
    passState: 'passed'
  }
});

// Client: Handle pass state updates
sceneChannel.on('broadcast', { event: 'pass:update' }, (payload) => {
  const { characterId, passState } = payload.payload;
  updateCharacterPassState(characterId, passState);
});
```

### 6. Character Presence in Scenes

**Character Add/Remove Events:**

When GM adds or removes characters from a scene, broadcast presence changes.

```typescript
// Server: Add character to scene
const scene = await getScene(sceneId);
const updatedCharacters = [...scene.characters, characterId];

await supabase
  .from('scenes')
  .update({
    characters: updatedCharacters,
    passStates: {
      ...scene.passStates,
      [characterId]: 'none'
    }
  })
  .eq('id', sceneId);

// Broadcast presence change
const channel = supabase.channel(`scene:${sceneId}`);
channel.send({
  type: 'broadcast',
  event: 'presence:add',
  payload: {
    sceneId,
    character: await getCharacter(characterId)
  }
});

// Server: Remove character from scene
const updatedCharacters = scene.characters.filter(id => id !== characterId);
const updatedPassStates = { ...scene.passStates };
delete updatedPassStates[characterId];

await supabase
  .from('scenes')
  .update({
    characters: updatedCharacters,
    passStates: updatedPassStates
  })
  .eq('id', sceneId);

channel.send({
  type: 'broadcast',
  event: 'presence:remove',
  payload: { sceneId, characterId }
});

// Client: Handle presence changes
sceneChannel.on('broadcast', { event: 'presence:add' }, (payload) => {
  const { character } = payload.payload;
  addCharacterToScene(character);
});

sceneChannel.on('broadcast', { event: 'presence:remove' }, (payload) => {
  const { characterId } = payload.payload;
  removeCharacterFromScene(characterId);
});
```

### 7. Roll Events

**Roll Result Broadcasting:**

Roll results follow post witness rules for visibility.

```typescript
// Server: Execute roll and broadcast
const roll = await executeRoll({
  postId,
  sceneId,
  characterId,
  intention,
  modifier,
  diceType,
  diceCount
});

const { data: newRoll } = await supabase
  .from('rolls')
  .insert(roll)
  .select()
  .single();

// Client: Subscribe to roll events
sceneChannel.on(
  'postgres_changes',
  {
    event: 'INSERT',
    schema: 'public',
    table: 'rolls',
    filter: `scene_id=eq.${sceneId}`
  },
  (payload) => {
    const roll = payload.new;

    // Filter by post witnesses if roll is attached to a post
    if (roll.postId) {
      const post = getPostById(roll.postId);
      const userCharacterIds = getUserCharacterIdsInScene(sceneId);
      const isWitness = post.witnesses.some(witnessId =>
        userCharacterIds.includes(witnessId)
      );

      if (isWitness || userIsGM) {
        displayRollResult(roll);
      }
    } else {
      // GM-requested rolls visible to all
      displayRollResult(roll);
    }
  }
);
```

### 8. Scene Limit Warnings

**Scene Count Warnings:**

Broadcast warnings when approaching scene limit.

```typescript
// Server: Check scene count after scene creation
const sceneCount = await countScenesInCampaign(campaignId);

if ([20, 23, 24].includes(sceneCount)) {
  const channel = supabase.channel(`campaign:${campaignId}`);
  channel.send({
    type: 'broadcast',
    event: 'scene:limit_warning',
    payload: {
      campaignId,
      currentCount: sceneCount,
      limit: 25
    }
  });
}

// Client: Handle scene limit warnings
campaignChannel.on('broadcast', { event: 'scene:limit_warning' }, (payload) => {
  const { currentCount, limit } = payload.payload;
  showSceneLimitWarning(currentCount, limit);
});
```

### 9. GM Availability Events

**GM Role Available:**

Broadcast when GM position becomes claimable (inactivity or account deletion).

```typescript
// Server: Broadcast GM availability
const channel = supabase.channel(`campaign:${campaignId}`);
channel.send({
  type: 'broadcast',
  event: 'gm:available',
  payload: { campaignId }
});

// Client: Show GM claim notification
campaignChannel.on('broadcast', { event: 'gm:available' }, () => {
  showGmClaimNotification();
});
```

### 10. WebSocket Lifecycle Management

**Connection Handling:**

```typescript
// Client: Connection lifecycle
const setupRealtimeConnection = (campaignId: string, sceneId: string) => {
  // Campaign-level channel
  const campaignChannel = supabase
    .channel(`campaign:${campaignId}`)
    .on('postgres_changes', { /* ... */ }, handleCampaignEvent)
    .on('broadcast', { event: '*' }, handleCampaignBroadcast)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Connected to campaign channel');
      }
      if (status === 'CHANNEL_ERROR') {
        console.error('Failed to connect to campaign channel');
        handleConnectionError();
      }
    });

  // Scene-level channel
  const sceneChannel = supabase
    .channel(`scene:${sceneId}`)
    .on('postgres_changes', { /* ... */ }, handleSceneEvent)
    .on('broadcast', { event: '*' }, handleSceneBroadcast)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Connected to scene channel');
      }
    });

  // Cleanup on unmount
  return () => {
    supabase.removeChannel(campaignChannel);
    supabase.removeChannel(sceneChannel);
  };
};
```

**Reconnection Handling:**

```typescript
// Client: Handle disconnections and reconnections
supabase.realtime.onConnStateChange((state) => {
  switch (state) {
    case 'CONNECTING':
      showConnectionStatus('Reconnecting...');
      break;
    case 'CONNECTED':
      showConnectionStatus('Connected');
      // Re-fetch latest data to catch up
      refetchSceneData();
      break;
    case 'DISCONNECTED':
      showConnectionStatus('Disconnected');
      break;
  }
});
```

### 11. Room Join Verification

**Authorization Checks:**

Supabase Real-time uses Row Level Security (RLS) policies to enforce authorization.

```sql
-- Example RLS policy for posts
CREATE POLICY "Users can view posts they witness"
ON posts
FOR SELECT
USING (
  -- User is GM
  EXISTS (
    SELECT 1 FROM campaign_members
    WHERE campaign_members.user_id = auth.uid()
    AND campaign_members.role = 'gm'
    AND campaign_members.campaign_id = (
      SELECT campaign_id FROM scenes WHERE scenes.id = posts.scene_id
    )
  )
  OR
  -- User's character is a witness
  EXISTS (
    SELECT 1 FROM character_assignments
    WHERE character_assignments.user_id = auth.uid()
    AND character_assignments.character_id = ANY(posts.witnesses)
  )
);
```

**Client-Side Filtering:**

Even with RLS, add client-side filtering as defense-in-depth.

```typescript
// Client: Filter events by witness visibility
const handlePostEvent = (payload: any) => {
  const post = payload.new;

  // Check if user should see this post
  const userCharacterIds = getUserCharacterIdsInScene(post.sceneId);
  const isWitness = post.witnesses.some(witnessId =>
    userCharacterIds.includes(witnessId)
  );
  const isGM = getUserRole() === 'gm';

  if (isWitness || isGM) {
    displayPost(post);
  } else {
    console.log('Post filtered by witness rules');
  }
};
```

## Event Type Reference

### Campaign-Wide Events

```typescript
// Phase transition
{
  event: 'phase:transition',
  campaignId: string,
  newPhase: 'pc_phase' | 'gm_phase'
}

// Time gate warning
{
  event: 'timegate:warning',
  campaignId: string,
  remainingMinutes: number
}

// Campaign status change
{
  event: 'campaign:status',
  campaignId: string,
  status: 'active' | 'paused'
}

// Scene limit warning
{
  event: 'scene:limit_warning',
  campaignId: string,
  currentCount: number,
  limit: number
}

// GM role available
{
  event: 'gm:available',
  campaignId: string
}
```

### Scene-Level Events

```typescript
// Post events
{ event: 'post:new', post: Post }
{ event: 'post:edit', post: Post }
{ event: 'post:delete', postId: string }
{ event: 'post:unlocked', postId: string }

// Compose lock events
{ event: 'compose:start', sceneId: string }  // No identity exposed
{ event: 'compose:end', sceneId: string }

// Pass state updates
{
  event: 'pass:update',
  sceneId: string,
  characterId: string,
  passState: 'none' | 'passed' | 'hard_passed'
}

// Character presence
{ event: 'presence:add', sceneId: string, character: Character }
{ event: 'presence:remove', sceneId: string, characterId: string }

// Roll results
{ event: 'roll:result', roll: Roll }
```

## Security Considerations

### Identity Leakage Prevention

**Hidden Post Compose Lock:**

When a player acquires compose lock for a hidden post, the broadcast MUST NOT include character identity.

```typescript
// CORRECT: Generic compose event
channel.send({
  type: 'broadcast',
  event: 'compose:start',
  payload: { sceneId }  // No characterId
});

// INCORRECT: Leaks identity
channel.send({
  type: 'broadcast',
  event: 'compose:start',
  payload: { sceneId, characterId }  // Identity leaked!
});
```

**UI Display:**

Show generic message: "Another player is currently posting" (no name, no character).

### Witness Visibility Filtering

**Server-Side RLS:**

Primary security layer enforced at database level via Row Level Security policies.

**Client-Side Filtering:**

Secondary defense-in-depth layer to prevent accidental display of unauthorized data.

```typescript
// Always check witness visibility before displaying
const canViewPost = (post: Post, userCharacterIds: string[], isGM: boolean) => {
  if (isGM) return true;
  return post.witnesses.some(witnessId => userCharacterIds.includes(witnessId));
};
```

### JWT Token Security

**Token Validation:**

- All WebSocket connections validated by Supabase Auth
- Invalid tokens reject connection immediately
- Token expiration enforced automatically
- No custom token handling needed

**Connection Security:**

- All connections use WSS (WebSocket Secure)
- Encrypted end-to-end via TLS
- No plain-text credential transmission

## Performance Considerations

### Connection Pooling

**Multiple Channels:**

Clients may subscribe to multiple channels simultaneously (campaign + scene + presence).

```typescript
// Efficient channel management
const channels = {
  campaign: supabase.channel(`campaign:${campaignId}`),
  scene: supabase.channel(`scene:${sceneId}`),
  presence: supabase.channel(`scene:${sceneId}:presence`)
};

// Subscribe all channels
Object.values(channels).forEach(channel => channel.subscribe());

// Cleanup all channels
const cleanup = () => {
  Object.values(channels).forEach(channel => {
    supabase.removeChannel(channel);
  });
};
```

### Message Rate Limiting

**Presence Updates:**

Debounce typing indicators to prevent excessive presence updates.

```typescript
// Debounced presence update
let presenceTimeout: NodeJS.Timeout;
const updatePresence = debounce((state: PresenceState) => {
  presenceChannel.track(state);
}, 1000);  // Max 1 update per second
```

### Event Batching

**Post Creation:**

Supabase Real-time automatically batches updates for efficiency. No custom batching needed.

## Common Patterns

### Scene View Component

```typescript
const SceneView: React.FC<{ sceneId: string }> = ({ sceneId }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isComposing, setIsComposing] = useState(false);

  useEffect(() => {
    // Subscribe to scene events
    const channel = supabase
      .channel(`scene:${sceneId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'posts',
          filter: `scene_id=eq.${sceneId}`
        },
        (payload) => {
          const post = payload.new as Post;
          if (canViewPost(post)) {
            setPosts(prev => [...prev, post]);
          }
        }
      )
      .on('broadcast', { event: 'compose:start' }, () => {
        setIsComposing(true);
      })
      .on('broadcast', { event: 'compose:end' }, () => {
        setIsComposing(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sceneId]);

  return (
    <div>
      {posts.map(post => <PostCard key={post.id} post={post} />)}
      {isComposing && <ComposingIndicator />}
    </div>
  );
};
```

### Campaign Dashboard

```typescript
const CampaignDashboard: React.FC<{ campaignId: string }> = ({ campaignId }) => {
  const [phase, setPhase] = useState<PhaseState>('gm_phase');
  const [timeGateExpires, setTimeGateExpires] = useState<Date | null>(null);

  useEffect(() => {
    // Subscribe to campaign events
    const channel = supabase
      .channel(`campaign:${campaignId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaigns',
          filter: `id=eq.${campaignId}`
        },
        (payload) => {
          const campaign = payload.new;
          setPhase(campaign.currentPhase);
          setTimeGateExpires(campaign.currentPhaseExpiresAt);
        }
      )
      .on('broadcast', { event: 'timegate:warning' }, (payload) => {
        const { remainingMinutes } = payload.payload;
        showTimeGateWarning(remainingMinutes);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return (
    <div>
      <PhaseIndicator phase={phase} expiresAt={timeGateExpires} />
    </div>
  );
};
```

## Troubleshooting

### Connection Issues

**Problem:** WebSocket connection fails or frequently disconnects.

**Solution:**
- Verify JWT token is valid and not expired
- Check Supabase project settings for Real-time enabled
- Ensure user has proper RLS permissions
- Check browser console for connection errors

### Events Not Received

**Problem:** Client not receiving real-time events.

**Solution:**
- Verify channel subscription status (should be 'SUBSCRIBED')
- Check RLS policies allow user to read the data
- Confirm event filter matches the expected pattern
- Check if user's character is in witness list (for posts)

### Duplicate Events

**Problem:** Receiving duplicate events for same action.

**Solution:**
- Ensure only one channel subscription per room
- Clean up channels on component unmount
- Use event deduplication based on entity ID + timestamp

### Identity Leakage

**Problem:** Hidden post author identity exposed via compose lock.

**Solution:**
- Verify compose:start event does not include characterId or userId
- Ensure UI shows generic "Another player is posting" message
- Never expose character/user info in broadcast payloads for compose events

## UI Components

### ComposeLockTimerBar Component

Primary display of remaining compose lock time in composer toolbar:

```tsx
interface ComposeLockTimerBarProps {
  remainingSeconds: number;
  totalSeconds?: number; // Default 600 (10 min)
}

function ComposeLockTimerBar({
  remainingSeconds,
  totalSeconds = 600,
}: ComposeLockTimerBarProps) {
  const percentage = (remainingSeconds / totalSeconds) * 100;
  const isWarning = remainingSeconds < 120; // < 2 minutes

  // Format as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="w-20 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-1000",
                isWarning ? "bg-destructive" : "bg-primary"
              )}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <span className="font-mono">{formatTime(remainingSeconds)}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

**Dimensions:** `w-20` (80px width), `h-1` (4px height)
**States:**
- Normal (≥2min): `bg-primary` fill draining from right
- Warning (<2min): `bg-destructive` fill (red)
- Expired: Empty bar + toast notification

### LockButton Component

Toggle button for acquiring/releasing compose lock:

```tsx
interface LockButtonProps {
  hasLock: boolean;
  isAcquiring: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

function LockButton({ hasLock, isAcquiring, onToggle, disabled }: LockButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      disabled={disabled || isAcquiring}
      aria-label={hasLock ? 'Release compose lock' : 'Acquire compose lock'}
    >
      {isAcquiring ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : hasLock ? (
        <Unlock className="h-4 w-4" />
      ) : (
        <Lock className="h-4 w-4" />
      )}
    </Button>
  );
}
```

**Icon States:**
- `Lock`: No lock held (click to acquire)
- `Loader2` (spinning): Acquiring lock
- `Unlock`: Lock held (click to release)

### LockBanner Component

Alert shown when another player has compose lock:

```tsx
interface LockBannerProps {
  characterName: string; // Only shown if not hidden post
  isHidden?: boolean;
}

function LockBanner({ characterName, isHidden }: LockBannerProps) {
  return (
    <Alert className="mb-4">
      <Lock className="h-4 w-4" />
      <AlertTitle>Compose lock active</AlertTitle>
      <AlertDescription>
        {isHidden
          ? 'Another player is composing a post...'
          : `${characterName} is composing a post...`}
      </AlertDescription>
    </Alert>
  );
}
```

**Security:** When `isHidden` is true, never reveal character identity to prevent witness list leakage.

### TypingIndicator Component

Shows who is currently typing in the scene:

```tsx
interface TypingIndicatorProps {
  typingUsers: Array<{ characterName: string }>;
}

function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const getMessage = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].characterName} is typing...`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0].characterName} and ${typingUsers[1].characterName} are typing...`;
    }
    return `${typingUsers.length} people are typing...`;
  };

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
      {/* Bouncing dots animation */}
      <div className="flex gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{getMessage()}</span>
    </div>
  );
}
```

**Position:** Bottom of post list, above compose button.

**Message formats:**
- 1 user: "Doravar is typing..."
- 2 users: "Doravar and Elara are typing..."
- 3+ users: "3 people are typing..."

### DraftSaveIndicator Component

Shows when draft is being saved:

```tsx
interface DraftSaveIndicatorProps {
  isSaving: boolean;
  lastSaved?: Date;
}

function DraftSaveIndicator({ isSaving, lastSaved }: DraftSaveIndicatorProps) {
  if (isSaving) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Save className="h-3 w-3" />
        <span>Saving...</span>
      </div>
    );
  }

  if (lastSaved) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Check className="h-3 w-3" />
        <span>Saved</span>
      </div>
    );
  }

  return null;
}
```

**Position:** Composer header, next to character name.

### ConnectionStatus Component

Shows WebSocket connection state:

```tsx
type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

interface ConnectionStatusProps {
  status: ConnectionState;
}

function ConnectionStatus({ status }: ConnectionStatusProps) {
  if (status === 'connected') {
    return null; // No indicator when connected
  }

  if (status === 'reconnecting') {
    return (
      <Alert>
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>Reconnecting...</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <WifiOff className="h-4 w-4" />
      <AlertTitle>Connection lost</AlertTitle>
      <AlertDescription>
        Trying to reconnect. Your changes will be saved when connection is restored.
      </AlertDescription>
    </Alert>
  );
}
```

**States:**
- Connected: No indicator (clean UI)
- Disconnected: Red alert with WifiOff icon
- Reconnecting: Default alert with spinner

### ComposerToolbar Component

Combines lock controls and timer:

```tsx
interface ComposerToolbarProps {
  hasLock: boolean;
  isAcquiring: boolean;
  remainingSeconds: number;
  onLockToggle: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
}

function ComposerToolbar({
  hasLock,
  isAcquiring,
  remainingSeconds,
  onLockToggle,
  onSubmit,
  canSubmit,
}: ComposerToolbarProps) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-2">
      <div className="flex items-center gap-2">
        <LockButton
          hasLock={hasLock}
          isAcquiring={isAcquiring}
          onToggle={onLockToggle}
        />
        {hasLock && (
          <ComposeLockTimerBar remainingSeconds={remainingSeconds} />
        )}
      </div>
      <Button
        size="icon"
        onClick={onSubmit}
        disabled={!hasLock || !canSubmit}
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

### Timing Constants

```typescript
// Compose lock timing
const COMPOSE_LOCK_DURATION = 10 * 60 * 1000;  // 10 minutes
const COMPOSE_LOCK_HEARTBEAT = 30 * 1000;      // 30 seconds
const COMPOSE_LOCK_WARNING = 2 * 60 * 1000;    // 2 minutes (warning threshold)

// Typing indicator timing
const TYPING_TIMEOUT = 5 * 1000;               // 5 seconds until cleared
const TYPING_CLEANUP_INTERVAL = 5 * 1000;      // Check every 5 seconds
const TYPING_STALE_THRESHOLD = 10 * 1000;      // 10 seconds = stale
```

### Icons Used

```tsx
import {
  Lock,        // No lock held
  Unlock,      // Lock held (release)
  Loader2,     // Loading/acquiring/reconnecting
  AlertCircle, // Error states
  Save,        // Draft save indicator
  Check,       // Saved confirmation
  WifiOff,     // Disconnected
  Clock,       // Time-related
  Send,        // Submit post
} from "lucide-react";
```

### useComposeLock Hook Pattern

```tsx
function useComposeLock(sceneId: string) {
  const [hasLock, setHasLock] = useState(false);
  const [isAcquiring, setIsAcquiring] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const heartbeatRef = useRef<NodeJS.Timeout>();

  const acquireLock = async () => {
    setIsAcquiring(true);
    try {
      const session = await api.acquireComposeLock(sceneId);
      setHasLock(true);
      setRemainingSeconds(600); // 10 minutes
      startHeartbeat();
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Lock unavailable',
        description: 'Another player is currently composing.',
      });
    } finally {
      setIsAcquiring(false);
    }
  };

  const releaseLock = async () => {
    stopHeartbeat();
    await api.releaseComposeLock(sceneId);
    setHasLock(false);
    setRemainingSeconds(0);
  };

  const startHeartbeat = () => {
    heartbeatRef.current = setInterval(async () => {
      try {
        await api.heartbeatComposeLock(sceneId);
        setRemainingSeconds(prev => Math.max(0, prev - 30));
      } catch {
        // Lock expired
        setHasLock(false);
        toast({
          variant: 'destructive',
          title: 'Lock expired',
          description: 'Your compose lock has expired.',
        });
      }
    }, 30000);
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
  };

  // Countdown timer
  useEffect(() => {
    if (!hasLock) return;

    const timer = setInterval(() => {
      setRemainingSeconds(prev => {
        if (prev <= 1) {
          releaseLock();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [hasLock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hasLock) {
        releaseLock();
      }
    };
  }, []);

  return {
    hasLock,
    isAcquiring,
    remainingSeconds,
    acquireLock,
    releaseLock,
    toggleLock: () => hasLock ? releaseLock() : acquireLock(),
  };
}
```
