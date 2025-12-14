# Real-Time Indicators

This document defines the UI patterns for real-time indicators in Vanguard PBP.

**Related Hooks**:
- `src/hooks/useComposeLock.ts` - Compose lock acquisition and heartbeat
- `src/hooks/useTypingIndicator.ts` - Typing indicator presence
- `src/hooks/useSceneSubscription.ts` - Scene-level event subscription
- `src/hooks/useCampaignSubscription.ts` - Campaign-level event subscription

---

## Design Principles

1. **Non-Blocking** - Indicators should inform, not prevent action
2. **Immediate Feedback** - Changes should appear instantly
3. **Graceful Degradation** - Work offline, sync when reconnected
4. **Minimal Distraction** - Subtle animations, no jarring changes

---

## Compose Lock Indicator

Ensures only one player posts at a time in a scene. The compose lock is displayed in the messenger-style composer toolbar.

### Lock Timer Bar (Primary Display)

The lock timer is displayed as a slim progress bar in the composer toolbar, not as a text badge. This provides a glanceable indicator without cluttering the minimal UI.

```tsx
function LockTimerBar({ remainingSeconds }: { remainingSeconds: number }) {
  const maxSeconds = 600 // 10 minutes
  const percentage = (remainingSeconds / maxSeconds) * 100
  const isWarning = remainingSeconds < 120 // < 2 minutes

  return (
    <div
      className="w-20 h-1 bg-muted rounded-full overflow-hidden"
      title={`${Math.floor(remainingSeconds / 60)}:${(remainingSeconds % 60).toString().padStart(2, '0')} remaining`}
    >
      <div
        className={`h-full transition-all duration-1000 ${
          isWarning ? 'bg-destructive' : 'bg-primary'
        }`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
```

#### Timer Bar Specifications

| Property | Value |
|----------|-------|
| Width | 80px (`w-20`) |
| Height | 4px (`h-1`) |
| Background | `bg-muted` |
| Fill (normal) | `bg-primary` |
| Fill (warning) | `bg-destructive` |
| Border radius | Full (`rounded-full`) |

#### Timer Bar States

| State | Condition | Fill Color | Behavior |
|-------|-----------|------------|----------|
| Normal | >= 2 minutes | `bg-primary` | Gradually draining from right |
| Warning | < 2 minutes | `bg-destructive` | Red fill, draining faster |
| Expired | 0 seconds | - | Bar empty, lock lost toast shown |
| No Lock | Lock not held | - | Timer bar not rendered |

#### Time Format (Tooltip)

The tooltip shows the exact remaining time:

```tsx
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
```

Examples: `5:00`, `2:30`, `0:45`

### Lock Button States

The lock button in the composer toolbar shows different icons based on state:

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={hasLock ? releaseLock : acquireLock}
  title={hasLock ? 'Release lock' : 'Acquire lock'}
  disabled={isAcquiring}
>
  {isAcquiring ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : hasLock ? (
    <Unlock className="h-4 w-4" />
  ) : (
    <Lock className="h-4 w-4" />
  )}
</Button>
```

| State | Icon | Behavior |
|-------|------|----------|
| No Lock | `Lock` | Click to acquire |
| Acquiring | `Loader2` (spinning) | Wait for server |
| Has Lock | `Unlock` | Click to release |

### Lock Lost Toast

```tsx
toast({
  variant: 'destructive',
  title: 'Lock expired',
  description: 'Your compose lock has expired. Please try again.',
})
```

### Lock Banner (Scene View)

When another player holds the lock, show a subtle banner above the posts:

```tsx
<Alert className="mb-4">
  <Lock className="h-4 w-4" />
  <AlertTitle>Compose lock active</AlertTitle>
  <AlertDescription>
    {lockHolder.characterName} is composing a post...
  </AlertDescription>
</Alert>
```

### Lock Acquisition Error

When lock acquisition fails (another player has the lock):

```tsx
toast({
  variant: 'destructive',
  title: 'Lock unavailable',
  description: `${lockHolder.characterName} is currently composing a post.`,
})
```

---

## Typing Indicators

Shows which characters are currently typing.

### Message Format

| Users Typing | Display |
|--------------|---------|
| 1 | "Doravar is typing..." |
| 2 | "Doravar and Elara are typing..." |
| 3+ | "3 people are typing..." |

### Display Component

```tsx
{typingMessage && (
  <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
    <TypingAnimation />
    <span>{typingMessage}</span>
  </div>
)}
```

### Typing Animation

Three bouncing dots:

```tsx
function TypingAnimation() {
  return (
    <div className="flex items-center gap-0.5">
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
    </div>
  )
}
```

### Positioning

Typing indicators appear at the bottom of the post list, above the compose button:

```
┌─────────────────────────────────────────┐
│ [Post 1]                                │
│ [Post 2]                                │
│ [Post 3]                                │
├─────────────────────────────────────────┤
│ ● ● ● Doravar is typing...              │
├─────────────────────────────────────────┤
│ [Compose Post]                          │
└─────────────────────────────────────────┘
```

---

## Draft Save Indicator

Shows when draft is being auto-saved.

```tsx
{isSaving && (
  <Badge variant="secondary" className="gap-1">
    <Save className="h-3 w-3" />
    Saving...
  </Badge>
)}
```

Appears in the composer header next to character badge.

---

## Real-Time Event Types

### Scene Events

Subscribed via `useSceneSubscription`:

| Event | Handler | UI Response |
|-------|---------|-------------|
| `post_created` | `onPostCreated` | Add post to list |
| `post_updated` | `onPostUpdated` | Update post in place |
| `post_deleted` | `onPostDeleted` | Remove post from list |
| `compose_lock_acquired` | `onComposeLockAcquired` | Show lock banner |
| `compose_lock_released` | `onComposeLockReleased` | Hide lock banner |
| `pass_state_changed` | `onPassStateChanged` | Update pass overview |
| `character_joined` | `onCharacterJoined` | Refresh character list |
| `character_left` | `onCharacterLeft` | Refresh character list |
| `roll_created` | `onRollCreated` | Show pending roll |
| `roll_resolved` | `onRollResolved` | Update roll status |

### Campaign Events

Subscribed via `useCampaignSubscription`:

| Event | Handler | UI Response |
|-------|---------|-------------|
| `phase_transition` | `onPhaseTransition` | Update phase indicator, show toast |
| `pass_state_changed` | `onPassStateChanged` | Update pass overview |
| `timegate_warning` | `onTimeGateWarning` | Show warning toast/notification |

---

## Live Update Animations

### New Post Animation

When a post appears from another player:

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  <PostCard post={post} />
</motion.div>
```

Alternative with CSS:

```tsx
<div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
  <PostCard post={post} />
</div>
```

### Update Highlight

Briefly highlight when content updates:

```tsx
<div className="animate-pulse-once">
  <PostCard post={post} />
</div>
```

CSS:

```css
@keyframes pulse-once {
  0%, 100% { background-color: transparent; }
  50% { background-color: hsl(var(--accent)); }
}

.animate-pulse-once {
  animation: pulse-once 1s ease-in-out;
}
```

---

## Connection Status

### Connected State

No indicator shown - connection is assumed.

### Disconnected State

Show a banner at the top of the page:

```tsx
<Alert variant="destructive" className="rounded-none">
  <WifiOff className="h-4 w-4" />
  <AlertTitle>Connection lost</AlertTitle>
  <AlertDescription>
    Trying to reconnect...
  </AlertDescription>
</Alert>
```

### Reconnecting State

```tsx
<Alert className="rounded-none">
  <Loader2 className="h-4 w-4 animate-spin" />
  <AlertTitle>Reconnecting</AlertTitle>
  <AlertDescription>
    Please wait while we restore your connection.
  </AlertDescription>
</Alert>
```

---

## Heartbeat Timing

### Compose Lock

| Parameter | Value |
|-----------|-------|
| Heartbeat interval | 30 seconds |
| Lock duration | 10 minutes (600 seconds) |
| Warning threshold | < 2 minutes (120 seconds) |

### Typing Indicator

| Parameter | Value |
|-----------|-------|
| Typing timeout | 5 seconds |
| Cleanup interval | 5 seconds |
| Stale threshold | 10 seconds |

---

## Icons

| Icon | Usage |
|------|-------|
| `Lock` | Acquire compose lock (no lock held) |
| `Unlock` | Release compose lock (lock held) |
| `Loader2` | Loading/reconnecting/acquiring (with `animate-spin`) |
| `AlertCircle` | Error states |
| `Save` | Draft saving indicator |
| `WifiOff` | Disconnected state |
| `Clock` | Legacy timer display (replaced by progress bar in composer) |

---

## Witness Filtering

Real-time events respect visibility rules:

```tsx
// In useSceneSubscription
const canSeePost = (event: PostEvent): boolean => {
  // Public posts visible to all
  if (!event.is_hidden) return true

  // Check if user's characters are in witness list
  return event.witness_list.some(witnessId =>
    visibleCharacterIds.includes(witnessId)
  )
}
```

Hidden post events are filtered client-side before handlers are called.

---

## Integration Pattern

### Scene View Integration

```tsx
function SceneView({ sceneId }: { sceneId: string }) {
  const [posts, setPosts] = useState<Post[]>([])
  const [lockHolder, setLockHolder] = useState<ComposeLockEvent | null>(null)

  // Subscribe to scene events
  useSceneSubscription({
    sceneId,
    handlers: {
      onPostCreated: (event) => {
        setPosts(prev => [...prev, event.post])
      },
      onComposeLockAcquired: (event) => {
        setLockHolder(event)
      },
      onComposeLockReleased: () => {
        setLockHolder(null)
      },
    },
    visibleCharacterIds: myCharacterIds,
  })

  // Subscribe to typing indicators
  const { typingMessage, startTyping, stopTyping } = useTypingIndicator({
    sceneId,
    characterId: activeCharacterId,
    characterName: activeCharacterName,
  })

  return (
    <div>
      {/* Lock banner */}
      {lockHolder && <ComposeLockBanner holder={lockHolder} />}

      {/* Posts */}
      <PostList posts={posts} />

      {/* Typing indicator */}
      {typingMessage && <TypingIndicator message={typingMessage} />}
    </div>
  )
}
```

### Campaign Dashboard Integration

```tsx
function CampaignDashboard({ campaignId }: { campaignId: string }) {
  const { toast } = useToast()

  useCampaignSubscription({
    campaignId,
    handlers: {
      onPhaseTransition: (event) => {
        toast({
          title: 'Phase changed',
          description: `Campaign is now in ${event.newPhase} phase`,
        })
      },
      onTimeGateWarning: (event) => {
        toast({
          variant: 'destructive',
          title: 'Time gate expiring',
          description: `Phase will end in ${event.minutesRemaining} minutes`,
        })
      },
    },
  })

  return <DashboardContent />
}
```

---

## Accessibility

- Connection status changes should be announced to screen readers
- Typing indicators use `aria-live="polite"` for updates
- Lock timers have `aria-label` describing remaining time
- Error states are properly announced

```tsx
<div aria-live="polite" className="sr-only">
  {typingMessage}
</div>
```
