# Compose Lock System

## Overview

Sequential composing prevents race conditions. One player at a time can hold the compose lock per character per scene.

## PRD References

- [Turn Structure](/home/tobiasd/github/vanguard-pbp/prd/turn-structure.md) - Compose lock mechanics, timeout
- [Technical](/home/tobiasd/github/vanguard-pbp/prd/technical.md) - ComposeSession model

## Database Schema

```sql
CREATE TABLE compose_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE(scene_id, character_id)  -- One lock per character per scene
);

CREATE INDEX idx_compose_sessions_scene ON compose_sessions(scene_id);
CREATE INDEX idx_compose_sessions_expires_at ON compose_sessions(expires_at);
```

## Backend Service

```go
// internal/service/compose.go
const (
    ComposeLockTimeout = 10 * time.Minute
    HeartbeatInterval  = 30 * time.Second
    RateLimitDuration  = 5 * time.Second
)

func (s *ComposeService) AcquireLock(ctx context.Context, sceneID, characterID, userID uuid.UUID) (*generated.ComposeSession, error) {
    // Check rate limit
    lastOp, err := s.getLastLockOperation(ctx, sceneID, userID)
    if err == nil && time.Since(lastOp) < RateLimitDuration {
        return nil, errors.New("rate limit: wait 5 seconds between lock operations")
    }

    // Verify character assignment
    assignment, err := s.queries.GetCharacterAssignment(ctx, characterID)
    if err != nil {
        return nil, errors.New("character not assigned to you")
    }
    if assignment.UserID != userID {
        return nil, errors.New("character not assigned to you")
    }

    // Verify scene membership
    scene, err := s.queries.GetScene(ctx, sceneID)
    if err != nil {
        return nil, err
    }

    // Check if character in scene
    inScene := false
    for _, charID := range scene.Characters {
        if charID == characterID {
            inScene = true
            break
        }
    }
    if !inScene {
        return nil, errors.New("character not in scene")
    }

    // Try to acquire lock
    session, err := s.queries.AcquireComposeLock(ctx, generated.AcquireComposeLockParams{
        SceneID:     sceneID,
        CharacterID: characterID,
        UserID:      userID,
        ExpiresAt:   time.Now().Add(ComposeLockTimeout),
    })
    if err != nil {
        // Check if lock already held
        existing, err := s.queries.GetComposeLock(ctx, generated.GetComposeLockParams{
            SceneID:     sceneID,
            CharacterID: characterID,
        })
        if err == nil {
            return nil, errors.New("lock already held by another player")
        }
        return nil, err
    }

    return &session, nil
}

func (s *ComposeService) Heartbeat(ctx context.Context, sessionID, userID uuid.UUID) error {
    session, err := s.queries.GetComposeLockByID(ctx, sessionID)
    if err != nil {
        return errors.New("session not found")
    }

    if session.UserID != userID {
        return errors.New("not your session")
    }

    // Update last activity
    return s.queries.UpdateComposeLockActivity(ctx, generated.UpdateComposeLockActivityParams{
        ID:             sessionID,
        LastActivityAt: time.Now(),
        ExpiresAt:      time.Now().Add(ComposeLockTimeout),
    })
}

func (s *ComposeService) ReleaseLock(ctx context.Context, sessionID, userID uuid.UUID) error {
    session, err := s.queries.GetComposeLockByID(ctx, sessionID)
    if err != nil {
        return errors.New("session not found")
    }

    if session.UserID != userID {
        return errors.New("not your session")
    }

    return s.queries.DeleteComposeLock(ctx, sessionID)
}

func (s *ComposeService) ForceRelease(ctx context.Context, sceneID, gmUserID uuid.UUID) error {
    // Verify GM
    scene, err := s.queries.GetScene(ctx, sceneID)
    if err != nil {
        return err
    }

    campaign, err := s.queries.GetCampaign(ctx, scene.CampaignID)
    if err != nil {
        return err
    }

    if !campaign.OwnerID.Valid || campaign.OwnerID.UUID != gmUserID {
        return errors.New("only GM can force-release locks")
    }

    // Delete all locks for scene
    return s.queries.DeleteSceneComposeLocks(ctx, sceneID)
}

// Background job: Clean up expired locks
func (s *ComposeService) CleanupExpiredLocks(ctx context.Context) error {
    return s.queries.DeleteExpiredComposeLocks(ctx, time.Now())
}
```

## Frontend Hook

```tsx
// hooks/use-compose-lock.ts
export function useComposeLock(sceneId: string, characterId: string) {
  const [session, setSession] = useState<ComposeSession | null>(null);
  const [holder, setHolder] = useState<{ name: string; avatar: string } | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const acquireLock = async () => {
    try {
      const result = await api.post(`/api/scenes/${sceneId}/compose/acquire`, {
        characterId,
      });
      setSession(result);
      startHeartbeat();
      toast({ title: 'Lock acquired', description: 'You can now compose your post.' });
    } catch (error: any) {
      if (error.response?.data?.error?.code === 'LOCK_HELD') {
        toast({
          title: 'Lock unavailable',
          description: 'Another player is currently composing.',
          variant: 'destructive',
        });
      } else if (error.response?.data?.error?.code === 'RATE_LIMIT_EXCEEDED') {
        toast({
          title: 'Too fast',
          description: 'Wait 5 seconds between lock operations.',
          variant: 'destructive',
        });
      }
    }
  };

  const releaseLock = async () => {
    if (!session) return;

    try {
      await api.post(`/api/scenes/${sceneId}/compose/release`, {
        sessionId: session.id,
      });
      setSession(null);
      stopHeartbeat();
    } catch (error) {
      console.error('Failed to release lock:', error);
    }
  };

  const startHeartbeat = () => {
    heartbeatIntervalRef.current = setInterval(async () => {
      if (session) {
        try {
          await api.post(`/api/scenes/${sceneId}/compose/heartbeat`, {
            sessionId: session.id,
          });
        } catch (error) {
          console.error('Heartbeat failed:', error);
          setSession(null);
          stopHeartbeat();
        }
      }
    }, 30000); // 30 seconds
  };

  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  // Monitor time remaining
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        new Date(session.expires_at).getTime() - Date.now()
      );
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setSession(null);
        toast({
          title: 'Lock expired',
          description: 'Your compose lock has timed out. Re-acquire to continue.',
          variant: 'destructive',
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  return {
    session,
    holder,
    timeRemaining,
    hasLock: !!session,
    acquireLock,
    releaseLock,
  };
}
```

## UI Component

```tsx
// components/post/ComposeLockIndicator.tsx
export function ComposeLockIndicator({ session, timeRemaining }: ComposeLockIndicatorProps) {
  if (!session) return null;

  const minutesRemaining = Math.floor((timeRemaining || 0) / 60000);
  const showDrainBar = minutesRemaining <= 1;

  return (
    <div className="border-l-4 border-yellow-500 bg-yellow-50 p-4 rounded">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-700" />
          <span className="text-sm font-medium text-yellow-700">
            Composing ({minutesRemaining}m remaining)
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onRelease}>
          Release Lock
        </Button>
      </div>

      {showDrainBar && (
        <div className="mt-2">
          <Progress
            value={(timeRemaining / 60000) * 100}
            className="h-2"
          />
          <p className="text-xs text-yellow-600 mt-1">
            Lock expires soon. Keep typing to extend.
          </p>
        </div>
      )}
    </div>
  );
}
```

## Real-time Events

```typescript
// Subscribe to compose lock changes
supabase
  .channel(`scene:${sceneId}:compose`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'compose_sessions',
    filter: `scene_id=eq.${sceneId}`,
  }, (payload) => {
    // Show "Another player is composing" indicator
    setLockHolder({ /* generic indicator */ });
  })
  .on('postgres_changes', {
    event: 'DELETE',
    schema: 'public',
    table: 'compose_sessions',
    filter: `scene_id=eq.${sceneId}`,
  }, () => {
    // Clear lock indicator
    setLockHolder(null);
  })
  .subscribe();
```

## Edge Cases

- **Network Disconnection**: Missed heartbeats auto-release lock after timeout
- **Browser Refresh**: Lock persists, draft syncs from server
- **Multiple Tabs**: Same user competes for lock across tabs
- **GM Force-Release**: GM can free stuck locks to keep game moving
- **Hidden Posts**: Generic "Another player is posting" message (no identity revealed)

## Testing

- [ ] Acquire lock successfully
- [ ] Block concurrent acquisition
- [ ] Heartbeat extends timeout
- [ ] Lock expires after 10 minutes
- [ ] Drain bar appears at 1 minute
- [ ] Release lock manually
- [ ] GM force-release works
- [ ] Rate limit blocks rapid operations
- [ ] Real-time indicator updates
