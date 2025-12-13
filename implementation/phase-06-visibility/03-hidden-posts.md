# Hidden Posts Implementation

## Overview

Hidden posts are posts with an empty witness list (`witnesses = []`), visible only to the GM. The GM can later "unhide" a post by retroactively assigning witnesses, making it visible to specified characters.

## PRD References

- **Core Concepts**: "Hidden posts have empty witness list, only GM sees them"
- **Turn Structure**: "GM can unhide posts retroactively"
- **Compose Lock**: "Hidden posts show generic 'Another player is posting'"

## Skill Reference

**visibility-filter** - Hidden post mechanics, GM unhide operations, compose lock integration

## Database Schema

No additional tables needed - uses existing `posts` table:

```sql
-- Posts table (already defined)
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  witnesses UUID[] NOT NULL DEFAULT '{}',  -- Empty for hidden posts
  is_hidden BOOLEAN NOT NULL DEFAULT false,  -- Flag for UI convenience
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Note: `is_hidden` is a convenience flag. The **actual** visibility enforcement comes from the empty `witnesses` array.

## Hidden Post Creation

### Go Service

```go
// internal/service/post_service.go

type CreatePostRequest struct {
    SceneID     uuid.UUID `json:"scene_id"`
    CharacterID uuid.UUID `json:"character_id"`
    Content     string    `json:"content"`
    IsHidden    bool      `json:"is_hidden"`  // Set by GM
}

func (s *PostService) CreatePost(ctx context.Context, req CreatePostRequest) (*db.Post, error) {
    var witnesses []uuid.UUID

    if req.IsHidden {
        // Hidden post: empty witness list
        witnesses = []uuid.UUID{}
    } else {
        // Normal post: capture present characters
        presentChars, err := s.queries.GetPresentCharactersInScene(ctx, req.SceneID)
        if err != nil {
            return nil, err
        }
        witnesses = presentChars
    }

    post, err := s.queries.CreatePost(ctx, db.CreatePostParams{
        SceneID:     req.SceneID,
        CharacterID: uuid.NullUUID{UUID: req.CharacterID, Valid: true},
        Content:     req.Content,
        Witnesses:   witnesses,
        IsHidden:    req.IsHidden,
    })
    if err != nil {
        return nil, err
    }

    return &post, nil
}
```

### React UI (GM Post Form)

```tsx
// src/components/PostComposer.tsx
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface PostComposerProps {
  sceneId: string;
  characterId: string;
  onPostCreated: () => void;
}

export function PostComposer({ sceneId, characterId, onPostCreated }: PostComposerProps) {
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [isHidden, setIsHidden] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        scene_id: sceneId,
        character_id: characterId,
        content,
        is_hidden: isHidden,
      }),
    });

    if (response.ok) {
      setContent('');
      setIsHidden(false);
      onPostCreated();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your post..."
        className="w-full min-h-[120px] p-3 border rounded"
      />

      {/* Hidden post checkbox - GM only */}
      {user.is_gm && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="hidden"
            checked={isHidden}
            onCheckedChange={setIsHidden}
          />
          <Label htmlFor="hidden" className="text-sm">
            Hidden post (only you can see this)
          </Label>
        </div>
      )}

      <button
        type="submit"
        disabled={!content.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {isHidden ? 'Post Hidden' : 'Post'}
      </button>
    </form>
  );
}
```

## GM Visibility of Hidden Posts

### SQL Query

```sql
-- name: GetAllPostsForGM :many
-- GM sees all posts including hidden
SELECT p.*
FROM posts p
WHERE p.scene_id = $1
ORDER BY p.created_at ASC;

-- name: GetHiddenPostsInScene :many
-- Query specifically for hidden posts
SELECT p.*
FROM posts p
WHERE p.scene_id = $1
  AND p.is_hidden = true
ORDER BY p.created_at ASC;
```

### React UI (Post Feed)

```tsx
// src/components/PostFeed.tsx
import { Post } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { EyeOff } from 'lucide-react';

interface PostFeedProps {
  posts: Post[];
}

export function PostFeed({ posts }: PostFeedProps) {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <div
          key={post.id}
          className={`p-4 border rounded ${
            post.is_hidden ? 'bg-amber-50 border-amber-300' : 'bg-white'
          }`}
        >
          {/* Hidden post indicator (GM only sees this) */}
          {post.is_hidden && user.is_gm && (
            <div className="flex items-center gap-2 mb-2 text-amber-700 text-sm">
              <EyeOff className="w-4 h-4" />
              <span>Hidden post - only you can see this</span>
            </div>
          )}

          <div className="prose max-w-none">
            {post.content}
          </div>

          <div className="mt-2 text-sm text-gray-500">
            {post.character_name} • {formatDate(post.created_at)}
          </div>

          {/* Unhide button (GM only) */}
          {post.is_hidden && user.is_gm && (
            <UnhideButton postId={post.id} sceneId={post.scene_id} />
          )}
        </div>
      ))}
    </div>
  );
}
```

## GM Unhide Operation

### Concept

When GM unhides a post, they select which characters should retroactively become witnesses. This makes the post visible to those characters as if they had witnessed it originally.

### Database Operation

```sql
-- name: UnhidePost :one
UPDATE posts
SET
  witnesses = $2,
  is_hidden = false,
  updated_at = now()
WHERE id = $1
RETURNING *;
```

### Trigger to Allow Unhide

```sql
-- Modify witness immutability trigger to allow unhide
CREATE OR REPLACE FUNCTION prevent_witness_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow GM unhide (empty → populated)
  IF OLD.witnesses = '{}' AND array_length(NEW.witnesses, 1) > 0 THEN
    -- This is an unhide operation - allow it
    RETURN NEW;
  END IF;

  -- Prevent all other witness changes
  IF OLD.witnesses != NEW.witnesses THEN
    RAISE EXCEPTION 'Witness lists are immutable once set (except unhide)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Go Service

```go
// internal/service/post_service.go

type UnhidePostRequest struct {
    PostID    uuid.UUID   `json:"post_id"`
    Witnesses []uuid.UUID `json:"witnesses"`  // Characters to add as witnesses
}

func (s *PostService) UnhidePost(ctx context.Context, req UnhidePostRequest) (*db.Post, error) {
    // Verify caller is GM
    userID := getUserIDFromContext(ctx)
    isGM, err := s.queries.IsUserGM(ctx, userID)
    if err != nil || !isGM {
        return nil, errors.New("unauthorized: only GM can unhide posts")
    }

    // Verify post is currently hidden
    post, err := s.queries.GetPost(ctx, req.PostID)
    if err != nil {
        return nil, err
    }
    if !post.IsHidden {
        return nil, errors.New("post is not hidden")
    }

    // Unhide post with specified witnesses
    unhiddenPost, err := s.queries.UnhidePost(ctx, db.UnhidePostParams{
        ID:        req.PostID,
        Witnesses: req.Witnesses,
    })
    if err != nil {
        return nil, err
    }

    // TODO: Send notifications to newly added witnesses

    return &unhiddenPost, nil
}
```

### API Handler

```go
// internal/handler/post_handler.go

func (h *PostHandler) UnhidePost(c *gin.Context) {
    var req service.UnhidePostRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    post, err := h.postService.UnhidePost(c.Request.Context(), req)
    if err != nil {
        c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, post)
}
```

### React UI (Unhide Dialog)

```tsx
// src/components/UnhideButton.tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface UnhideButtonProps {
  postId: string;
  sceneId: string;
}

export function UnhideButton({ postId, sceneId }: UnhideButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch present characters in scene
  const { data: characters } = useQuery({
    queryKey: ['characters', sceneId],
    queryFn: () => fetchPresentCharacters(sceneId),
    enabled: isOpen,
  });

  // Unhide mutation
  const unhideMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/posts/unhide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          post_id: postId,
          witnesses: selectedCharacters,
        }),
      });
      if (!res.ok) throw new Error('Failed to unhide');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', sceneId] });
      setIsOpen(false);
      setSelectedCharacters([]);
    },
  });

  const handleToggleCharacter = (charId: string) => {
    setSelectedCharacters((prev) =>
      prev.includes(charId)
        ? prev.filter((id) => id !== charId)
        : [...prev, charId]
    );
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="mt-2"
      >
        Unhide Post
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unhide Post - Select Witnesses</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Select which characters should see this post:
            </p>

            {characters?.map((char) => (
              <div key={char.id} className="flex items-center space-x-2">
                <Checkbox
                  id={char.id}
                  checked={selectedCharacters.includes(char.id)}
                  onCheckedChange={() => handleToggleCharacter(char.id)}
                />
                <label htmlFor={char.id} className="text-sm">
                  {char.name}
                </label>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => unhideMutation.mutate()}
              disabled={selectedCharacters.length === 0 || unhideMutation.isPending}
            >
              {unhideMutation.isPending ? 'Unhiding...' : 'Unhide'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

async function fetchPresentCharacters(sceneId: string) {
  const res = await fetch(`/api/scenes/${sceneId}/characters?present=true`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch characters');
  return res.json();
}

function getToken(): string {
  // Implement token retrieval from storage/context
  return localStorage.getItem('auth_token') || '';
}
```

## Compose Lock Integration

### Concept

When a hidden post is being composed, the compose lock should show a **generic** message to players, without revealing the GM's identity or that it's a hidden post.

**PRD Reference**: "Compose lock shows generic 'Another player is posting'"

### Compose Lock Message Logic

```go
// internal/service/lock_service.go

type ComposeLockStatus struct {
    IsLocked     bool      `json:"is_locked"`
    LockedBy     string    `json:"locked_by"`      // Character name or generic
    LockedByID   uuid.UUID `json:"locked_by_id"`
    IsHidden     bool      `json:"is_hidden"`
}

func (s *LockService) GetComposeLockStatus(ctx context.Context, sceneID uuid.UUID, callerIsGM bool) (*ComposeLockStatus, error) {
    lock, err := s.queries.GetComposeLock(ctx, sceneID)
    if err != nil {
        // No lock
        return &ComposeLockStatus{IsLocked: false}, nil
    }

    // Check if lock is for hidden post
    isHidden := lock.IsHidden

    // Show different messages based on viewer
    var lockedBy string
    if callerIsGM {
        // GM sees actual character name, even for hidden posts
        lockedBy = lock.CharacterName
    } else if isHidden {
        // Players see generic message for hidden posts
        lockedBy = "Another player"
    } else {
        // Players see actual character name for normal posts
        lockedBy = lock.CharacterName
    }

    return &ComposeLockStatus{
        IsLocked:   true,
        LockedBy:   lockedBy,
        LockedByID: lock.CharacterID,
        IsHidden:   isHidden && !callerIsGM,  // Hide this flag from players
    }, nil
}
```

### React UI (Compose Lock Indicator)

```tsx
// src/components/ComposeLockIndicator.tsx
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

interface ComposeLockIndicatorProps {
  sceneId: string;
}

export function ComposeLockIndicator({ sceneId }: ComposeLockIndicatorProps) {
  const { user } = useAuth();

  const { data: lockStatus } = useQuery({
    queryKey: ['compose-lock', sceneId],
    queryFn: () => fetchComposeLockStatus(sceneId),
    refetchInterval: 2000, // Poll every 2 seconds
  });

  if (!lockStatus?.is_locked) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded">
      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
      <span className="text-sm text-blue-800">
        {lockStatus.locked_by} is composing a post...
      </span>
    </div>
  );
}

async function fetchComposeLockStatus(sceneId: string) {
  const res = await fetch(`/api/scenes/${sceneId}/compose-lock`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Failed to fetch lock status');
  return res.json();
}

function getToken(): string {
  return localStorage.getItem('auth_token') || '';
}
```

## Hidden Posts and Pass State

### Concept

Hidden posts do **not** affect the pass system. Characters can still pass even if the GM is composing a hidden post.

**PRD Reference**: "Hidden post doesn't affect pass state"

### Implementation

```go
// internal/service/pass_service.go

func (s *PassService) CanCharacterPass(ctx context.Context, characterID uuid.UUID) (bool, error) {
    // Check for compose lock
    lock, err := s.queries.GetComposeLockForCharacterScene(ctx, characterID)
    if err != nil {
        // No lock - can pass
        return true, nil
    }

    // If lock is for a hidden post, ignore it for pass purposes
    if lock.IsHidden {
        return true, nil
    }

    // Normal post being composed - cannot pass yet
    return false, nil
}
```

## Notifications on Unhide

### Concept

When GM unhides a post, newly added witnesses receive a notification that a post has been revealed to them.

### Notification Service

```go
// internal/service/notification_service.go

func (s *NotificationService) NotifyPostUnhidden(ctx context.Context, postID uuid.UUID, witnesses []uuid.UUID) error {
    for _, witnessCharID := range witnesses {
        // Get character's user
        char, err := s.queries.GetCharacter(ctx, witnessCharID)
        if err != nil {
            continue
        }

        // Create notification
        err = s.queries.CreateNotification(ctx, db.CreateNotificationParams{
            UserID: char.UserID,
            Type:   "post_unhidden",
            Data: map[string]interface{}{
                "post_id": postID,
                "character_id": witnessCharID,
            },
        })
        if err != nil {
            log.WithError(err).Warn("Failed to create unhide notification")
        }
    }

    return nil
}
```

### React Notification

```tsx
// src/components/NotificationToast.tsx
import { useToast } from '@/components/ui/use-toast';

export function usePostUnhiddenNotification() {
  const { toast } = useToast();

  // Subscribe to real-time notifications
  useEffect(() => {
    const subscription = supabase
      .from('notifications')
      .on('INSERT', (payload) => {
        if (payload.new.type === 'post_unhidden') {
          toast({
            title: 'New Post Revealed',
            description: 'The GM has revealed a previously hidden post to you.',
            action: (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToPost(payload.new.data.post_id)}
              >
                View
              </Button>
            ),
          });
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);
}
```

## Edge Cases

### 1. Unhide to Characters Who Later Left

**Scenario**: GM unhides post, adds Character A as witness. Character A later leaves the scene.

**Handling**: Character A retains witness status (witness lists are immutable after unhide).

```go
// This is correct behavior - witness lists are immutable
// Leaving a scene doesn't remove witness status retroactively
```

### 2. Unhide to Empty List

**Scenario**: GM attempts to unhide with empty witness list.

**Handling**: Reject the operation - unhide must add at least one witness.

```go
func (s *PostService) UnhidePost(ctx context.Context, req UnhidePostRequest) (*db.Post, error) {
    if len(req.Witnesses) == 0 {
        return nil, errors.New("must specify at least one witness to unhide")
    }
    // ...
}
```

### 3. Unhide to Deleted Characters

**Scenario**: GM tries to unhide to a character that was deleted.

**Handling**: Filter out deleted characters from witness selection.

```sql
-- name: GetPresentCharactersInScene :many
SELECT id, name
FROM characters
WHERE scene_id = $1
  AND is_present = true
  AND deleted_at IS NULL  -- Exclude deleted characters
ORDER BY name;
```

### 4. Multiple Unhides

**Scenario**: GM tries to unhide a post that's already been unhidden.

**Handling**: Reject the operation.

```go
func (s *PostService) UnhidePost(ctx context.Context, req UnhidePostRequest) (*db.Post, error) {
    post, err := s.queries.GetPost(ctx, req.PostID)
    if err != nil {
        return nil, err
    }

    if !post.IsHidden {
        return nil, errors.New("post is already visible")
    }
    // ...
}
```

### 5. Hidden Post in Empty Scene

**Scenario**: GM creates hidden post when no characters are present.

**Handling**: Normal behavior - hidden post with empty witness list. Can unhide later when characters arrive.

```go
// No special handling needed - this is valid
// Hidden post: witnesses = []
// Can unhide later to any characters
```

### 6. Compose Lock Shows Hidden Post Being Written

**Scenario**: GM typing hidden post, player sees "Another player is posting".

**Handling**: This is intentional behavior to prevent identity leak.

```go
// Frontend shows generic message for hidden posts
if (lockStatus.is_hidden) {
  return "Another player is composing a post...";
} else {
  return `${lockStatus.locked_by} is composing a post...`;
}
```

## Testing Checklist

### Unit Tests

- [ ] Hidden post creation
  - [ ] `is_hidden: true` creates empty witness list
  - [ ] Only GM can create hidden posts
  - [ ] Hidden post saves correctly

- [ ] GM visibility
  - [ ] GM sees hidden posts in feed
  - [ ] Players don't see hidden posts
  - [ ] RLS enforces hidden post filtering

- [ ] Unhide operation
  - [ ] Unhide populates witness list
  - [ ] Unhide sets `is_hidden: false`
  - [ ] Only GM can unhide
  - [ ] Cannot unhide already-visible post
  - [ ] Must specify at least one witness

- [ ] Witness immutability
  - [ ] Cannot modify witnesses after unhide
  - [ ] Can unhide (empty → populated)
  - [ ] Cannot re-hide (populated → empty)

### Integration Tests

- [ ] Compose lock
  - [ ] Hidden post lock shows generic message
  - [ ] Normal post lock shows character name
  - [ ] GM sees actual name for hidden posts

- [ ] Pass system
  - [ ] Hidden post doesn't block passing
  - [ ] Normal post blocks passing

- [ ] Notifications
  - [ ] Witnesses notified on unhide
  - [ ] Notification includes post link
  - [ ] Real-time delivery works

### E2E Tests

- [ ] GM creates hidden post → only GM sees it
- [ ] Player queries scene → hidden post not in feed
- [ ] GM unhides post → selected characters see it
- [ ] Newly added witnesses receive notification
- [ ] Compose lock shows generic "Another player" for hidden
- [ ] Pass system unaffected by hidden post composition

## Verification Steps

1. **Login as GM**
2. **Create hidden post** in scene with characters present
3. **Verify post visible to GM** with "Hidden" indicator
4. **Login as Player** (different browser/session)
5. **Verify hidden post NOT visible** in scene feed
6. **Switch back to GM**
7. **Click "Unhide Post"**
8. **Select Character A as witness**
9. **Confirm unhide**
10. **Switch to Player (Character A)**
11. **Verify post NOW visible** in feed
12. **Check notification received**
13. **Login as Player (Character B)**
14. **Verify post NOT visible** (not in witness list)
15. **Test compose lock**: GM starts hidden post
16. **Verify players see** "Another player is posting"
17. **Verify GM sees** actual character name

## API Documentation

### POST /api/posts

Create a post (including hidden).

**Request**:
```json
{
  "scene_id": "uuid",
  "character_id": "uuid",
  "content": "Post content",
  "is_hidden": true
}
```

**Response**:
```json
{
  "id": "uuid",
  "scene_id": "uuid",
  "character_id": "uuid",
  "content": "Post content",
  "witnesses": [],
  "is_hidden": true,
  "created_at": "2025-01-15T10:30:00Z"
}
```

### POST /api/posts/unhide

Unhide a post and assign witnesses.

**Request**:
```json
{
  "post_id": "uuid",
  "witnesses": ["char-uuid-1", "char-uuid-2"]
}
```

**Response**:
```json
{
  "id": "uuid",
  "scene_id": "uuid",
  "character_id": "uuid",
  "content": "Post content",
  "witnesses": ["char-uuid-1", "char-uuid-2"],
  "is_hidden": false,
  "updated_at": "2025-01-15T10:35:00Z"
}
```

### GET /api/scenes/:scene_id/compose-lock

Get compose lock status for scene.

**Response**:
```json
{
  "is_locked": true,
  "locked_by": "Character Name",
  "locked_by_id": "char-uuid",
  "is_hidden": false
}
```

**Response (Hidden Post)**:
```json
{
  "is_locked": true,
  "locked_by": "Another player",
  "locked_by_id": "char-uuid",
  "is_hidden": true
}
```

## Performance Considerations

### Index for Hidden Posts

```sql
-- Partial index for GM queries (only hidden posts)
CREATE INDEX idx_posts_hidden ON posts(scene_id, created_at DESC)
WHERE is_hidden = true;
```

### Caching

```go
// Hidden post status is immutable (until unhide)
// Can cache aggressively

func (c *PostCache) IsPostHidden(ctx context.Context, postID uuid.UUID) (bool, error) {
    key := fmt.Sprintf("post:hidden:%s", postID)

    // Try cache
    cached, err := c.redis.Get(ctx, key).Result()
    if err == nil {
        return cached == "true", nil
    }

    // Fetch from DB
    post, err := c.queries.GetPost(ctx, postID)
    if err != nil {
        return false, err
    }

    // Cache result (TTL: 1 hour, or until unhide event)
    c.redis.Set(ctx, key, post.IsHidden, time.Hour)

    return post.IsHidden, nil
}

// Invalidate cache on unhide
func (s *PostService) UnhidePost(...) {
    // ... unhide logic ...

    // Invalidate cache
    s.cache.Delete(ctx, fmt.Sprintf("post:hidden:%s", postID))
}
```

## Security Considerations

### 1. Prevent Hidden Post Information Leak

Ensure API responses don't leak hidden post existence:

```go
// Bad: Leaks hidden post count
{
  "visible_posts": 5,
  "hidden_posts": 2,  // LEAK!
  "total_posts": 7
}

// Good: No hidden post information
{
  "posts": [...],  // Only visible posts
  "count": 5
}
```

### 2. Compose Lock Generic Message

Never reveal GM identity or post type via compose lock:

```go
// Bad: Reveals GM is posting
{
  "locked_by": "GM Character Name",
  "is_gm": true  // LEAK!
}

// Good: Generic message
{
  "locked_by": "Another player"
}
```

### 3. Notification Privacy

Only notify witnesses on unhide, not all scene members:

```go
// Good: Only notify newly added witnesses
for _, witnessID := range req.Witnesses {
    notifyUser(witnessID, "post_unhidden", postID)
}

// Bad: Notify all scene members (information leak!)
```
