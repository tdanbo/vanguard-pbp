# Game Log and Bookmarks

## Overview

Implement a character-scoped game log view that displays all posts visible to a character, organized by scene. Include bookmark functionality for quick navigation to important characters, scenes, and posts.

## PRD References

- **prd/information-architecture.md**: Game log structure, bookmarks
- **prd/core-concepts.md**: Witness-based visibility
- **prd/scope.md**: Performance considerations for long campaigns

## Skills

- **visibility-filter**: Character-scoped post filtering
- **shadcn-react**: Game log UI components
- **go-api-server**: Game log API endpoints
- **supabase-integration**: Database queries for game log

## Database Schema

### Bookmarks

```sql
CREATE TABLE bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    bookmark_type TEXT NOT NULL CHECK (bookmark_type IN ('character', 'scene', 'post')),
    target_character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
    target_scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
    target_post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookmarks_user_campaign ON bookmarks(user_id, campaign_id, character_id);
CREATE INDEX idx_bookmarks_type ON bookmarks(bookmark_type, character_id);

-- Ensure only one target is set
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_single_target CHECK (
    (bookmark_type = 'character' AND target_character_id IS NOT NULL AND target_scene_id IS NULL AND target_post_id IS NULL) OR
    (bookmark_type = 'scene' AND target_scene_id IS NOT NULL AND target_character_id IS NULL AND target_post_id IS NULL) OR
    (bookmark_type = 'post' AND target_post_id IS NOT NULL AND target_character_id IS NULL AND target_scene_id IS NULL)
);

-- Prevent duplicate bookmarks
CREATE UNIQUE INDEX idx_bookmarks_unique_character ON bookmarks(character_id, target_character_id)
WHERE bookmark_type = 'character';

CREATE UNIQUE INDEX idx_bookmarks_unique_scene ON bookmarks(character_id, target_scene_id)
WHERE bookmark_type = 'scene';

CREATE UNIQUE INDEX idx_bookmarks_unique_post ON bookmarks(character_id, target_post_id)
WHERE bookmark_type = 'post';
```

## Game Log API

### Backend Service

```go
// services/game_log_service.go
type GameLogService struct {
    db *sqlc.Queries
}

type GameLogEntry struct {
    SceneID     uuid.UUID       `json:"scene_id"`
    SceneName   string          `json:"scene_name"`
    Posts       []*models.Post  `json:"posts"`
    FirstPostAt time.Time       `json:"first_post_at"`
    LastPostAt  time.Time       `json:"last_post_at"`
    PostCount   int             `json:"post_count"`
}

func (s *GameLogService) GetGameLog(
    ctx context.Context,
    campaignID uuid.UUID,
    characterID uuid.UUID,
    limit int,
    offset int,
) ([]*GameLogEntry, error) {
    // Get scenes where character has witnessed posts
    scenes, err := s.db.GetScenesWithWitnessedPosts(ctx, sqlc.GetScenesWithWitnessedPostsParams{
        CampaignID:  campaignID,
        CharacterID: characterID,
        Limit:       int32(limit),
        Offset:      int32(offset),
    })
    if err != nil {
        return nil, fmt.Errorf("failed to get scenes: %w", err)
    }

    entries := make([]*GameLogEntry, 0, len(scenes))

    for _, scene := range scenes {
        // Get posts in scene visible to character
        posts, err := s.db.GetScenePostsForCharacter(ctx, sqlc.GetScenePostsForCharacterParams{
            SceneID:     scene.ID,
            CharacterID: characterID,
        })
        if err != nil {
            log.Printf("failed to get posts for scene %s: %v", scene.ID, err)
            continue
        }

        if len(posts) == 0 {
            continue
        }

        entry := &GameLogEntry{
            SceneID:     scene.ID,
            SceneName:   scene.Name,
            Posts:       posts,
            FirstPostAt: posts[len(posts)-1].CreatedAt, // Posts ordered desc
            LastPostAt:  posts[0].CreatedAt,
            PostCount:   len(posts),
        }

        entries = append(entries, entry)
    }

    return entries, nil
}
```

### SQL Queries

```sql
-- queries/game_log.sql
-- name: GetScenesWithWitnessedPosts :many
SELECT DISTINCT s.*
FROM scenes s
INNER JOIN posts p ON p.scene_id = s.id
WHERE s.campaign_id = $1
  AND (
    -- Public posts
    p.is_hidden = false
    OR
    -- Hidden posts where character is witness
    (p.is_hidden = true AND $2 = ANY(p.witness_list))
  )
ORDER BY (
    SELECT MAX(created_at)
    FROM posts
    WHERE scene_id = s.id
      AND (
        is_hidden = false
        OR (is_hidden = true AND $2 = ANY(witness_list))
      )
) DESC
LIMIT $3 OFFSET $4;

-- name: GetScenePostsForCharacter :many
SELECT p.*, c.name as character_name, c.avatar_url as character_avatar
FROM posts p
INNER JOIN characters c ON c.id = p.character_id
WHERE p.scene_id = $1
  AND (
    p.is_hidden = false
    OR (p.is_hidden = true AND $2 = ANY(p.witness_list))
  )
ORDER BY p.created_at DESC;
```

### API Endpoint

```go
// handlers/game_log_handler.go
func (h *GameLogHandler) GetGameLog(c *gin.Context) {
    userID := getUserID(c)
    campaignID := c.Param("campaign_id")
    characterID := c.Query("character_id")

    if characterID == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "character_id required"})
        return
    }

    campaignUUID, err := uuid.Parse(campaignID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid campaign_id"})
        return
    }

    characterUUID, err := uuid.Parse(characterID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid character_id"})
        return
    }

    // Verify user owns character
    char, err := h.charService.GetCharacter(c.Request.Context(), characterUUID)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "character not found"})
        return
    }

    if char.UserID != userID && !h.isGM(c.Request.Context(), campaignUUID, userID) {
        c.JSON(http.StatusForbidden, gin.H{"error": "not your character"})
        return
    }

    limit := 20
    if l := c.Query("limit"); l != "" {
        if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
            limit = parsed
        }
    }

    offset := 0
    if o := c.Query("offset"); o != "" {
        if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
            offset = parsed
        }
    }

    log, err := h.service.GetGameLog(c.Request.Context(), campaignUUID, characterUUID, limit, offset)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch game log"})
        return
    }

    c.JSON(http.StatusOK, log)
}
```

## Game Log Frontend

### Game Log Component

```typescript
// components/GameLog.tsx
import { useInfiniteQuery } from '@tanstack/react-query';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';
import { Button } from '@/components/ui/button';
import { ArrowUp } from 'lucide-react';

export function GameLog({ campaignId, characterId }: {
  campaignId: string;
  characterId: string;
}) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['game-log', campaignId, characterId],
    queryFn: ({ pageParam = 0 }) =>
      fetchGameLog(campaignId, characterId, { offset: pageParam }),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length === 0) return undefined;
      return allPages.flat().length;
    },
  });

  const loadMoreRef = useIntersectionObserver(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  });

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const entries = data?.pages.flat() || [];

  return (
    <div className="relative">
      <div className="space-y-8">
        {entries.map((entry) => (
          <GameLogScene key={entry.scene_id} entry={entry} />
        ))}

        {hasNextPage && (
          <div ref={loadMoreRef} className="py-4 text-center">
            {isFetchingNextPage ? (
              <div>Loading more...</div>
            ) : (
              <div>Scroll for more</div>
            )}
          </div>
        )}
      </div>

      {/* Jump to recent button */}
      <Button
        className="fixed bottom-8 right-8 rounded-full shadow-lg"
        size="icon"
        onClick={scrollToTop}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
    </div>
  );
}

function GameLogScene({ entry }: { entry: GameLogEntry }) {
  return (
    <div className="border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">{entry.scene_name}</h2>
        <div className="text-sm text-muted-foreground">
          {entry.post_count} post{entry.post_count !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="space-y-4">
        {entry.posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
```

### Character Filter

```typescript
// components/GameLogCharacterFilter.tsx
export function GameLogCharacterFilter({
  campaignId,
  selectedCharacterId,
  onCharacterChange,
}: {
  campaignId: string;
  selectedCharacterId: string;
  onCharacterChange: (characterId: string) => void;
}) {
  const { data: characters } = useQuery({
    queryKey: ['user-characters', campaignId],
    queryFn: () => fetchUserCharacters(campaignId),
  });

  if (!characters || characters.length === 1) {
    return null; // No need to show filter for single character
  }

  return (
    <div className="mb-4">
      <Label>View as Character:</Label>
      <Select value={selectedCharacterId} onValueChange={onCharacterChange}>
        <SelectTrigger className="w-full max-w-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {characters.map((char) => (
            <SelectItem key={char.id} value={char.id}>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={char.avatar_url} />
                  <AvatarFallback>{char.name[0]}</AvatarFallback>
                </Avatar>
                {char.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

## Bookmark System

### Backend Service

```go
// services/bookmark_service.go
type BookmarkService struct {
    db *sqlc.Queries
}

type CreateBookmarkParams struct {
    UserID            uuid.UUID
    CampaignID        uuid.UUID
    CharacterID       uuid.UUID
    BookmarkType      string
    TargetCharacterID *uuid.UUID
    TargetSceneID     *uuid.UUID
    TargetPostID      *uuid.UUID
    Label             *string
}

func (s *BookmarkService) CreateBookmark(
    ctx context.Context,
    params CreateBookmarkParams,
) (*models.Bookmark, error) {
    // Verify character belongs to user
    char, err := s.db.GetCharacter(ctx, params.CharacterID)
    if err != nil {
        return nil, fmt.Errorf("character not found: %w", err)
    }

    if char.UserID != params.UserID {
        return nil, fmt.Errorf("not your character")
    }

    // Create bookmark
    bookmark, err := s.db.CreateBookmark(ctx, sqlc.CreateBookmarkParams{
        UserID:            params.UserID,
        CampaignID:        params.CampaignID,
        CharacterID:       params.CharacterID,
        BookmarkType:      params.BookmarkType,
        TargetCharacterID: params.TargetCharacterID,
        TargetSceneID:     params.TargetSceneID,
        TargetPostID:      params.TargetPostID,
        Label:             params.Label,
    })
    if err != nil {
        return nil, fmt.Errorf("failed to create bookmark: %w", err)
    }

    return bookmark, nil
}

func (s *BookmarkService) GetBookmarks(
    ctx context.Context,
    characterID uuid.UUID,
) ([]*models.Bookmark, error) {
    return s.db.GetCharacterBookmarks(ctx, characterID)
}

func (s *BookmarkService) DeleteBookmark(
    ctx context.Context,
    bookmarkID uuid.UUID,
    userID uuid.UUID,
) error {
    bookmark, err := s.db.GetBookmark(ctx, bookmarkID)
    if err != nil {
        return fmt.Errorf("bookmark not found: %w", err)
    }

    if bookmark.UserID != userID {
        return fmt.Errorf("not your bookmark")
    }

    return s.db.DeleteBookmark(ctx, bookmarkID)
}
```

### API Endpoints

```go
// handlers/bookmark_handler.go
type CreateBookmarkRequest struct {
    CampaignID        string  `json:"campaign_id" binding:"required"`
    CharacterID       string  `json:"character_id" binding:"required"`
    BookmarkType      string  `json:"bookmark_type" binding:"required,oneof=character scene post"`
    TargetCharacterID *string `json:"target_character_id"`
    TargetSceneID     *string `json:"target_scene_id"`
    TargetPostID      *string `json:"target_post_id"`
    Label             *string `json:"label"`
}

func (h *BookmarkHandler) CreateBookmark(c *gin.Context) {
    userID := getUserID(c)

    var req CreateBookmarkRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
        return
    }

    // Parse UUIDs
    campaignUUID, _ := uuid.Parse(req.CampaignID)
    characterUUID, _ := uuid.Parse(req.CharacterID)

    var targetCharID, targetSceneID, targetPostID *uuid.UUID

    if req.TargetCharacterID != nil {
        id, _ := uuid.Parse(*req.TargetCharacterID)
        targetCharID = &id
    }
    if req.TargetSceneID != nil {
        id, _ := uuid.Parse(*req.TargetSceneID)
        targetSceneID = &id
    }
    if req.TargetPostID != nil {
        id, _ := uuid.Parse(*req.TargetPostID)
        targetPostID = &id
    }

    bookmark, err := h.service.CreateBookmark(c.Request.Context(), services.CreateBookmarkParams{
        UserID:            userID,
        CampaignID:        campaignUUID,
        CharacterID:       characterUUID,
        BookmarkType:      req.BookmarkType,
        TargetCharacterID: targetCharID,
        TargetSceneID:     targetSceneID,
        TargetPostID:      targetPostID,
        Label:             req.Label,
    })
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusCreated, bookmark)
}

func (h *BookmarkHandler) GetBookmarks(c *gin.Context) {
    characterID := c.Param("character_id")

    characterUUID, err := uuid.Parse(characterID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid character_id"})
        return
    }

    bookmarks, err := h.service.GetBookmarks(c.Request.Context(), characterUUID)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch bookmarks"})
        return
    }

    c.JSON(http.StatusOK, bookmarks)
}

func (h *BookmarkHandler) DeleteBookmark(c *gin.Context) {
    userID := getUserID(c)
    bookmarkID := c.Param("bookmark_id")

    bookmarkUUID, err := uuid.Parse(bookmarkID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bookmark_id"})
        return
    }

    err = h.service.DeleteBookmark(c.Request.Context(), bookmarkUUID, userID)
    if err != nil {
        c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, gin.H{"success": true})
}
```

### Bookmark UI

```typescript
// components/BookmarkButton.tsx
export function BookmarkButton({
  type,
  targetId,
  characterId,
  campaignId,
}: {
  type: 'character' | 'scene' | 'post';
  targetId: string;
  characterId: string;
  campaignId: string;
}) {
  const queryClient = useQueryClient();

  const { data: bookmarks } = useQuery({
    queryKey: ['bookmarks', characterId],
    queryFn: () => fetchBookmarks(characterId),
  });

  const isBookmarked = bookmarks?.some(
    (b) =>
      b.bookmark_type === type &&
      (b.target_character_id === targetId ||
        b.target_scene_id === targetId ||
        b.target_post_id === targetId)
  );

  const createMutation = useMutation({
    mutationFn: (label?: string) =>
      createBookmark({
        campaign_id: campaignId,
        character_id: characterId,
        bookmark_type: type,
        [`target_${type}_id`]: targetId,
        label,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookmarks', characterId]);
      toast.success('Bookmark added');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (bookmarkId: string) => deleteBookmark(bookmarkId),
    onSuccess: () => {
      queryClient.invalidateQueries(['bookmarks', characterId]);
      toast.success('Bookmark removed');
    },
  });

  const handleToggle = () => {
    if (isBookmarked) {
      const bookmark = bookmarks.find(
        (b) =>
          b.bookmark_type === type &&
          (b.target_character_id === targetId ||
            b.target_scene_id === targetId ||
            b.target_post_id === targetId)
      );
      if (bookmark) {
        deleteMutation.mutate(bookmark.id);
      }
    } else {
      createMutation.mutate();
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggle}
      disabled={createMutation.isPending || deleteMutation.isPending}
    >
      <Bookmark
        className={cn(
          'h-4 w-4',
          isBookmarked && 'fill-current text-primary'
        )}
      />
    </Button>
  );
}
```

### Bookmark Navigation

```typescript
// components/BookmarkList.tsx
export function BookmarkList({
  characterId,
  campaignId,
}: {
  characterId: string;
  campaignId: string;
}) {
  const { data: bookmarks } = useQuery({
    queryKey: ['bookmarks', characterId],
    queryFn: () => fetchBookmarks(characterId),
  });

  const navigate = useNavigate();

  const navigateToBookmark = (bookmark: Bookmark) => {
    switch (bookmark.bookmark_type) {
      case 'character':
        // Find first post with this character
        navigate(`/campaigns/${campaignId}/log?character=${bookmark.target_character_id}`);
        break;
      case 'scene':
        navigate(`/campaigns/${campaignId}/scenes/${bookmark.target_scene_id}`);
        break;
      case 'post':
        // Navigate to scene with post highlighted
        navigate(`/campaigns/${campaignId}/log#post-${bookmark.target_post_id}`);
        break;
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="font-semibold mb-2">Bookmarks</h3>
      {bookmarks?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookmarks yet</p>
      ) : (
        bookmarks?.map((bookmark) => (
          <div
            key={bookmark.id}
            className="flex items-center justify-between p-2 hover:bg-muted rounded cursor-pointer"
            onClick={() => navigateToBookmark(bookmark)}
          >
            <div className="flex items-center gap-2">
              <BookmarkIcon className="h-4 w-4" />
              <div>
                <p className="text-sm font-medium">
                  {bookmark.label || formatBookmarkTarget(bookmark)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBookmarkType(bookmark.bookmark_type)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                deleteBookmark(bookmark.id);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))
      )}
    </div>
  );
}
```

## GM View (Complete Visibility)

### GM Game Log

```go
// services/game_log_service.go
func (s *GameLogService) GetGameLogAsGM(
    ctx context.Context,
    campaignID uuid.UUID,
    limit int,
    offset int,
) ([]*GameLogEntry, error) {
    // GM sees all posts in all scenes
    scenes, err := s.db.GetCampaignScenes(ctx, sqlc.GetCampaignScenesParams{
        CampaignID: campaignID,
        Limit:      int32(limit),
        Offset:     int32(offset),
    })
    if err != nil {
        return nil, fmt.Errorf("failed to get scenes: %w", err)
    }

    entries := make([]*GameLogEntry, 0, len(scenes))

    for _, scene := range scenes {
        // Get all posts in scene (no visibility filter)
        posts, err := s.db.GetScenePosts(ctx, scene.ID)
        if err != nil {
            log.Printf("failed to get posts for scene %s: %v", scene.ID, err)
            continue
        }

        if len(posts) == 0 {
            continue
        }

        entry := &GameLogEntry{
            SceneID:     scene.ID,
            SceneName:   scene.Name,
            Posts:       posts,
            FirstPostAt: posts[len(posts)-1].CreatedAt,
            LastPostAt:  posts[0].CreatedAt,
            PostCount:   len(posts),
        }

        entries = append(entries, entry)
    }

    return entries, nil
}
```

## Edge Cases

### 1. Scene With No Visible Posts

**Issue**: Scene exists but character hasn't witnessed any posts

**Solution**: Don't include in game log
```go
if len(posts) == 0 {
    continue // Skip scene
}
```

### 2. Post Becomes Visible Mid-Game

**Issue**: Hidden post unhidden, now visible

**Solution**: Invalidate game log query
```go
// After unhiding post
queryClient.invalidateQueries(['game-log', campaignId, characterId]);
```

### 3. Multi-character User Navigation

**Issue**: User switches characters, bookmarks change

**Solution**: Character-scoped bookmarks and query keys
```typescript
queryKey: ['bookmarks', characterId] // Unique per character
```

### 4. Bookmarking Deleted Content

**Issue**: Bookmark points to deleted post/scene

**Solution**: Cascade delete bookmarks
```sql
target_post_id UUID REFERENCES posts(id) ON DELETE CASCADE
```

### 5. Long Campaign Performance

**Issue**: 10,000+ posts in game log

**Solution**: Infinite scroll with pagination
```typescript
getNextPageParam: (lastPage, allPages) => {
  if (lastPage.length === 0) return undefined;
  return allPages.flat().length; // Offset for next page
}
```

### 6. Navigate to First/Last Encounter

**Issue**: Finding first or last interaction with character

**Solution**: Bookmark-based navigation
```go
func (s *BookmarkService) FindFirstEncounter(
    ctx context.Context,
    characterID uuid.UUID,
    targetCharacterID uuid.UUID,
) (*models.Post, error) {
    return s.db.GetFirstSharedPost(ctx, sqlc.GetFirstSharedPostParams{
        CharacterID:       characterID,
        TargetCharacterID: targetCharacterID,
    })
}
```

## Testing Checklist

- [ ] Game log displays scenes with witnessed posts
- [ ] Scenes ordered by most recent post
- [ ] Posts within scenes ordered chronologically
- [ ] Hidden posts only visible if character is witness
- [ ] Infinite scroll loads more scenes
- [ ] Character filter switches perspective
- [ ] GM view shows all posts (no filtering)
- [ ] Bookmark character works
- [ ] Bookmark scene works
- [ ] Bookmark post works
- [ ] Navigate to bookmarked content
- [ ] Delete bookmark works
- [ ] Duplicate bookmarks prevented
- [ ] Bookmarks cascade delete with target
- [ ] Jump to recent button scrolls to top
- [ ] Performance acceptable with 1000+ posts
- [ ] Empty states shown when no content

## Verification Steps

1. **Basic Game Log Test**:
   ```bash
   # Create posts in multiple scenes
   # View game log as character
   # Verify only witnessed posts shown
   # Verify scenes ordered by recent activity
   ```

2. **Visibility Test**:
   ```bash
   # Create hidden post with specific witnesses
   # View as witness character (should see)
   # View as non-witness character (should not see)
   # View as GM (should see all)
   ```

3. **Infinite Scroll Test**:
   ```bash
   # Create 50 posts across 10 scenes
   # Load game log (20 scenes per page)
   # Scroll to bottom
   # Verify next page loads
   ```

4. **Bookmark Test**:
   ```bash
   # Bookmark a character
   # Bookmark a scene
   # Bookmark a post
   # Navigate to bookmarks
   # Verify correct content shown
   # Delete bookmark
   # Verify removed from list
   ```

5. **Multi-character Test**:
   ```bash
   # Create two characters
   # Create posts visible to only one
   # Switch character filter
   # Verify different posts shown
   ```

## Performance Considerations

- Index on posts(scene_id, created_at)
- Index on posts(campaign_id, created_at)
- Limit initial load to 20 scenes
- Pagination for large campaigns
- Cache game log entries (5 minute TTL)
- Optimize witness list queries
- Lazy load post content (show summaries first)

## Security Considerations

- RLS enforces witness-based visibility
- Verify character ownership before showing log
- GM verification for complete visibility
- Bookmark ownership verified on all operations
- Rate limit game log endpoint (prevent scraping)
- Sanitize bookmark labels (prevent XSS)
