# Real-time Subscriptions

## Overview

Implement real-time event synchronization using Supabase Real-time subscriptions. This provides WebSocket-based live updates for game state changes without requiring a custom WebSocket hub.

## PRD References

- **prd/technical.md**: Real-time sync architecture, Supabase Real-time
- **prd/core-concepts.md**: Witness-based visibility, identity protection
- **prd/turn-structure.md**: Phase transitions, compose locks

## Skills

- **real-time-sync**: Real-time event synchronization patterns
- **supabase-integration**: Supabase Real-time client usage

## Architecture

### No Custom WebSocket Hub

Use Supabase Real-time instead of building a custom WebSocket server:

- Supabase handles connection management
- JWT authentication built-in
- Automatic reconnection logic
- Presence tracking support
- Channel-based event distribution

### Channel Structure

**Campaign-level channel**: `campaign:{campaignId}`
- Phase transition events
- Character join/leave events
- GM role changes
- Campaign-wide announcements

**Scene-level channel**: `scene:{sceneId}`
- Post CRUD events
- Compose lock acquire/release
- Pass state changes
- Roll submissions
- Character arrival in scene

## Event Types

### Phase Transition Events

```typescript
interface PhaseTransitionEvent {
  type: 'phase_transition';
  campaign_id: string;
  from_phase: 'gm_phase' | 'pc_phase';
  to_phase: 'gm_phase' | 'pc_phase';
  transition_reason: 'manual' | 'all_passed' | 'time_gate_expired';
  timestamp: string;
}
```

### Post CRUD Events

```typescript
interface PostEvent {
  type: 'post_created' | 'post_updated' | 'post_deleted';
  post_id: string;
  scene_id: string;
  campaign_id: string;
  character_id: string;
  is_hidden: boolean;
  witness_list: string[]; // Character IDs
  timestamp: string;
}
```

### Compose Lock Events

```typescript
interface ComposeLockEvent {
  type: 'compose_lock_acquired' | 'compose_lock_released';
  scene_id: string;
  campaign_id: string;
  // DO NOT include character_id or user_id (identity protection)
  is_locked: boolean;
  timestamp: string;
}
```

### Pass State Events

```typescript
interface PassStateEvent {
  type: 'pass_state_changed';
  campaign_id: string;
  character_id: string;
  has_passed: boolean;
  timestamp: string;
}
```

### Presence Events

```typescript
interface PresenceState {
  user_id: string;
  online_at: string;
  typing_in_scene?: string; // Scene ID if typing
}
```

## Client-side Implementation

### Connection Setup

```typescript
// hooks/useRealtimeSubscription.ts
import { useEffect } from 'react';
import { useSupabaseClient, useUser } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useCampaignSubscription(campaignId: string) {
  const supabase = useSupabaseClient();
  const user = useUser();

  useEffect(() => {
    if (!user || !campaignId) return;

    const channel: RealtimeChannel = supabase
      .channel(`campaign:${campaignId}`)
      .on('broadcast', { event: 'phase_transition' }, (payload) => {
        handlePhaseTransition(payload);
      })
      .on('broadcast', { event: 'character_joined' }, (payload) => {
        handleCharacterJoined(payload);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        handlePresenceSync(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        handlePresenceJoin(newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        handlePresenceLeave(leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    // Cleanup on unmount
    return () => {
      channel.untrack();
      channel.unsubscribe();
    };
  }, [campaignId, user]);
}
```

### Scene-level Subscription

```typescript
// hooks/useSceneSubscription.ts
export function useSceneSubscription(sceneId: string, characterId: string) {
  const supabase = useSupabaseClient();
  const user = useUser();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user || !sceneId || !characterId) return;

    const channel = supabase
      .channel(`scene:${sceneId}`)
      .on('broadcast', { event: 'post_created' }, (payload) => {
        const event = payload.payload as PostEvent;

        // Client-side witness filtering (defense in depth)
        if (shouldShowPost(event, characterId)) {
          queryClient.invalidateQueries(['scene-posts', sceneId, characterId]);
        }
      })
      .on('broadcast', { event: 'compose_lock_acquired' }, (payload) => {
        // Update UI to show lock indicator (no identity revealed)
        queryClient.setQueryData(['compose-lock', sceneId], {
          is_locked: true,
          timestamp: payload.payload.timestamp,
        });
      })
      .on('broadcast', { event: 'compose_lock_released' }, (payload) => {
        queryClient.setQueryData(['compose-lock', sceneId], {
          is_locked: false,
          timestamp: payload.payload.timestamp,
        });
      })
      .on('broadcast', { event: 'pass_state_changed' }, (payload) => {
        queryClient.invalidateQueries(['pass-state', payload.payload.campaign_id]);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [sceneId, characterId, user]);
}
```

### Typing Indicators

```typescript
// hooks/useTypingIndicator.ts
export function useTypingIndicator(sceneId: string) {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [isTyping, setIsTyping] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const channel = useMemo(() => {
    return supabase.channel(`scene:${sceneId}`);
  }, [sceneId]);

  useEffect(() => {
    if (!user || !sceneId) return;

    channel.subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [channel, user, sceneId]);

  const startTyping = useCallback(() => {
    if (!isTyping) {
      setIsTyping(true);
      channel.track({
        user_id: user.id,
        typing_in_scene: sceneId,
        online_at: new Date().toISOString(),
      });
    }

    // Reset timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Stop typing after 3 seconds of inactivity
    timeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      channel.track({
        user_id: user.id,
        online_at: new Date().toISOString(),
      });
    }, 3000);
  }, [isTyping, channel, sceneId, user]);

  return { startTyping };
}
```

## Server-side Broadcasting

### Phase Transition Broadcast

```go
// services/phase_transition_service.go
func (s *PhaseTransitionService) BroadcastPhaseTransition(
    ctx context.Context,
    campaignID uuid.UUID,
    fromPhase, toPhase string,
    reason string,
) error {
    // Use Supabase REST API to broadcast
    event := map[string]interface{}{
        "type":              "phase_transition",
        "campaign_id":       campaignID.String(),
        "from_phase":        fromPhase,
        "to_phase":          toPhase,
        "transition_reason": reason,
        "timestamp":         time.Now().UTC().Format(time.RFC3339),
    }

    channelName := fmt.Sprintf("campaign:%s", campaignID.String())

    return s.supabase.BroadcastEvent(ctx, channelName, "phase_transition", event)
}
```

### Post Creation Broadcast

```go
// services/post_service.go
func (s *PostService) BroadcastPostCreated(
    ctx context.Context,
    post *models.Post,
) error {
    event := map[string]interface{}{
        "type":         "post_created",
        "post_id":      post.ID.String(),
        "scene_id":     post.SceneID.String(),
        "campaign_id":  post.CampaignID.String(),
        "character_id": post.CharacterID.String(),
        "is_hidden":    post.IsHidden,
        "witness_list": post.WitnessList,
        "timestamp":    time.Now().UTC().Format(time.RFC3339),
    }

    channelName := fmt.Sprintf("scene:%s", post.SceneID.String())

    return s.supabase.BroadcastEvent(ctx, channelName, "post_created", event)
}
```

### Compose Lock Broadcast (Identity Protected)

```go
// services/compose_lock_service.go
func (s *ComposeLockService) BroadcastLockAcquired(
    ctx context.Context,
    sceneID uuid.UUID,
    campaignID uuid.UUID,
) error {
    // DO NOT include character_id or user_id
    event := map[string]interface{}{
        "type":        "compose_lock_acquired",
        "scene_id":    sceneID.String(),
        "campaign_id": campaignID.String(),
        "is_locked":   true,
        "timestamp":   time.Now().UTC().Format(time.RFC3339),
    }

    channelName := fmt.Sprintf("scene:%s", sceneID.String())

    return s.supabase.BroadcastEvent(ctx, channelName, "compose_lock_acquired", event)
}

func (s *ComposeLockService) BroadcastLockReleased(
    ctx context.Context,
    sceneID uuid.UUID,
    campaignID uuid.UUID,
) error {
    event := map[string]interface{}{
        "type":        "compose_lock_released",
        "scene_id":    sceneID.String(),
        "campaign_id": campaignID.String(),
        "is_locked":   false,
        "timestamp":   time.Now().UTC().Format(time.RFC3339),
    }

    channelName := fmt.Sprintf("scene:%s", sceneID.String())

    return s.supabase.BroadcastEvent(ctx, channelName, "compose_lock_released", event)
}
```

## Client-side Witness Filtering

### Defense in Depth

Even though RLS policies enforce witness filtering on the database, perform additional client-side filtering:

```typescript
// lib/visibility.ts
export function shouldShowPost(
  event: PostEvent,
  currentCharacterId: string
): boolean {
  // Hidden posts only visible to witnesses
  if (event.is_hidden) {
    return event.witness_list.includes(currentCharacterId);
  }

  // Public posts visible to all
  return true;
}

export function filterPostEvents(
  events: PostEvent[],
  currentCharacterId: string
): PostEvent[] {
  return events.filter(event => shouldShowPost(event, currentCharacterId));
}
```

### Real-time Query Invalidation

```typescript
// hooks/useRealtimePostUpdates.ts
export function useRealtimePostUpdates(
  sceneId: string,
  characterId: string
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`scene:${sceneId}`)
      .on('broadcast', { event: 'post_created' }, (payload) => {
        const event = payload.payload as PostEvent;

        if (shouldShowPost(event, characterId)) {
          // Optimistic update
          queryClient.setQueryData(
            ['scene-posts', sceneId, characterId],
            (old: Post[] | undefined) => {
              if (!old) return old;
              // Fetch full post data or add placeholder
              return [...old, createPostPlaceholder(event)];
            }
          );

          // Then invalidate for fresh data
          queryClient.invalidateQueries(['scene-posts', sceneId, characterId]);
        }
      })
      .on('broadcast', { event: 'post_updated' }, (payload) => {
        const event = payload.payload as PostEvent;

        if (shouldShowPost(event, characterId)) {
          queryClient.invalidateQueries(['scene-posts', sceneId, characterId]);
          queryClient.invalidateQueries(['post', event.post_id]);
        }
      })
      .on('broadcast', { event: 'post_deleted' }, (payload) => {
        const event = payload.payload as PostEvent;

        queryClient.setQueryData(
          ['scene-posts', sceneId, characterId],
          (old: Post[] | undefined) => {
            if (!old) return old;
            return old.filter(post => post.id !== event.post_id);
          }
        );
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [sceneId, characterId, queryClient]);
}
```

## Subscription Cleanup

### Automatic Cleanup on Unmount

```typescript
// components/CampaignView.tsx
export function CampaignView({ campaignId }: { campaignId: string }) {
  const subscriptionRef = useRef<RealtimeChannel>();

  useEffect(() => {
    const channel = supabase.channel(`campaign:${campaignId}`);

    channel.subscribe();
    subscriptionRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.untrack();
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [campaignId]);

  // Component rendering...
}
```

### Connection State Management

```typescript
// hooks/useConnectionState.ts
export function useConnectionState() {
  const [state, setState] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    const handleOnline = () => setState('connected');
    const handleOffline = () => setState('disconnected');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return state;
}
```

## Edge Cases

### 1. Rapid Phase Transitions

**Issue**: Multiple phase transitions in quick succession

**Solution**:
```typescript
const [transitioning, setTransitioning] = useState(false);

function handlePhaseTransition(event: PhaseTransitionEvent) {
  if (transitioning) {
    // Queue the event
    queuedTransitions.push(event);
    return;
  }

  setTransitioning(true);

  // Process transition
  processTransition(event).finally(() => {
    setTransitioning(false);

    // Process queued transitions
    if (queuedTransitions.length > 0) {
      const next = queuedTransitions.shift();
      handlePhaseTransition(next);
    }
  });
}
```

### 2. Connection Loss During Compose

**Issue**: User loses connection while holding compose lock

**Solution**:
- Server-side heartbeat expiration (60s timeout)
- Client reconnects and checks lock status
- If lock expired, show notification and refresh

```typescript
function handleReconnect() {
  // Check if we still hold the lock
  const lockStatus = await checkComposeLock(sceneId);

  if (!lockStatus.is_locked || lockStatus.character_id !== characterId) {
    // Lost the lock
    toast.error('Your compose lock expired due to disconnection');
    clearComposerState();
  }
}
```

### 3. Duplicate Events

**Issue**: Same event received multiple times

**Solution**:
```typescript
const processedEvents = useRef<Set<string>>(new Set());

function handleEvent(event: PostEvent) {
  const eventKey = `${event.type}:${event.post_id}:${event.timestamp}`;

  if (processedEvents.current.has(eventKey)) {
    return; // Duplicate, ignore
  }

  processedEvents.current.add(eventKey);

  // Process event...

  // Clean up old keys (keep last 100)
  if (processedEvents.current.size > 100) {
    const oldest = Array.from(processedEvents.current)[0];
    processedEvents.current.delete(oldest);
  }
}
```

### 4. Stale Presence Data

**Issue**: Users shown as online after closing tab

**Solution**:
```typescript
useEffect(() => {
  const channel = supabase.channel(`campaign:${campaignId}`);

  // Track presence with heartbeat
  const interval = setInterval(() => {
    channel.track({
      user_id: user.id,
      online_at: new Date().toISOString(),
    });
  }, 30000); // 30 second heartbeat

  // Cleanup
  return () => {
    clearInterval(interval);
    channel.untrack();
    channel.unsubscribe();
  };
}, [campaignId, user]);
```

## Testing Checklist

- [ ] Campaign subscription connects with JWT
- [ ] Scene subscription receives post events
- [ ] Phase transition broadcasts to all campaign subscribers
- [ ] Compose lock events hide character identity
- [ ] Client-side witness filtering works correctly
- [ ] Presence tracking shows online status
- [ ] Typing indicators appear and disappear correctly
- [ ] Subscription cleanup prevents memory leaks
- [ ] Reconnection after network loss works
- [ ] Duplicate events are deduplicated
- [ ] Hidden posts only broadcast to witnesses
- [ ] Multiple simultaneous subscriptions work
- [ ] Unsubscribe on component unmount
- [ ] Heartbeat expires stale presence

## Verification Steps

1. **Connection Test**:
   ```bash
   # Open browser console
   # Subscribe to campaign
   # Verify WebSocket connection in Network tab
   ```

2. **Event Delivery Test**:
   ```bash
   # Open two browser windows
   # Create post in one window
   # Verify event appears in other window within 500ms
   ```

3. **Presence Test**:
   ```bash
   # Open campaign in two browsers
   # Verify both users appear online
   # Close one browser
   # Verify user removed from presence after timeout
   ```

4. **Witness Filtering Test**:
   ```bash
   # Create hidden post with specific witnesses
   # Verify non-witnesses don't receive event
   # Verify witnesses receive event
   ```

5. **Identity Protection Test**:
   ```bash
   # Acquire compose lock
   # Inspect broadcast event payload
   # Verify no character_id or user_id present
   ```

## Performance Considerations

- Limit subscriptions to active campaigns/scenes
- Unsubscribe from inactive channels
- Batch presence updates (30s heartbeat)
- Debounce typing indicators
- Use connection pooling on server
- Monitor channel count per user
- Implement subscription limits (max 10 per user)

## Security Considerations

- JWT validation on all connections
- Client-side witness filtering (defense in depth)
- Rate limiting on broadcast endpoints
- Channel authorization (user must be campaign member)
- No PII in compose lock broadcasts
- Sanitize all broadcast payloads
