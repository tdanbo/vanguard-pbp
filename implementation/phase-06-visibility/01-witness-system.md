# Witness System Implementation

## Overview

The witness system captures a snapshot of all present characters when a post is created, storing them as an immutable array of character IDs. This array determines who can see the post, implementing character-based (not user-based) visibility.

## PRD References

- **Core Concepts**: "Visibility is character-based, not user-based"
- **Turn Structure**: "Present characters are witnesses to posts"
- **Technical**: "Witness lists are immutable arrays of character UUIDs"

## Skill Reference

**visibility-filter** - Witness-based visibility filtering, late arrival handling, multi-character view separation

## Database Schema

```sql
-- Posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  witnesses UUID[] NOT NULL DEFAULT '{}',
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_posts_witnesses ON posts USING GIN(witnesses);
CREATE INDEX idx_posts_scene_created ON posts(scene_id, created_at DESC);
CREATE INDEX idx_posts_character ON posts(character_id);

-- Trigger to update updated_at
CREATE TRIGGER set_posts_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Witness Capture on Post Creation

### Go Backend (sqlc)

```sql
-- name: CreatePost :one
INSERT INTO posts (
  scene_id,
  character_id,
  content,
  witnesses,
  is_hidden
) VALUES (
  $1, $2, $3, $4, $5
) RETURNING *;

-- name: GetPresentCharactersInScene :many
SELECT id
FROM characters
WHERE scene_id = $1
  AND is_present = true
  AND deleted_at IS NULL;
```

```go
// internal/service/post_service.go
package service

import (
    "context"
    "database/sql"
    "github.com/google/uuid"
    "vanguard-pbp/internal/db"
)

type PostService struct {
    queries *db.Queries
}

type CreatePostRequest struct {
    SceneID     uuid.UUID `json:"scene_id"`
    CharacterID uuid.UUID `json:"character_id"`
    Content     string    `json:"content"`
    IsHidden    bool      `json:"is_hidden"`
}

func (s *PostService) CreatePost(ctx context.Context, req CreatePostRequest) (*db.Post, error) {
    // Capture witnesses (present characters) atomically
    var witnesses []uuid.UUID

    if req.IsHidden {
        // Hidden posts have no witnesses (empty array)
        witnesses = []uuid.UUID{}
    } else {
        // Get all present characters in the scene
        presentChars, err := s.queries.GetPresentCharactersInScene(ctx, req.SceneID)
        if err != nil {
            return nil, err
        }
        witnesses = presentChars
    }

    // Create post with witness list
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

### API Handler

```go
// internal/handler/post_handler.go
package handler

import (
    "net/http"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "vanguard-pbp/internal/service"
)

type PostHandler struct {
    postService *service.PostService
}

func (h *PostHandler) CreatePost(c *gin.Context) {
    var req service.CreatePostRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    // Get authenticated user from context
    userID := c.GetString("user_id")

    // TODO: Verify character belongs to user and is in scene
    // This happens in middleware or service layer

    post, err := h.postService.CreatePost(c.Request.Context(), req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusCreated, post)
}
```

## Character-Based Visibility Queries

### SQL Queries (sqlc)

```sql
-- name: GetVisiblePostsForCharacter :many
-- Returns posts where the character is in the witness list
SELECT p.*
FROM posts p
WHERE p.scene_id = $1
  AND $2 = ANY(p.witnesses)
ORDER BY p.created_at ASC;

-- name: GetVisiblePostsForCharacterPaginated :many
SELECT p.*
FROM posts p
WHERE p.scene_id = $1
  AND $2 = ANY(p.witnesses)
  AND p.created_at > $3  -- cursor-based pagination
ORDER BY p.created_at ASC
LIMIT $4;

-- name: GetHiddenPostsForGM :many
-- GM sees all posts including hidden
SELECT p.*
FROM posts p
WHERE p.scene_id = $1
ORDER BY p.created_at ASC;
```

### Go Service

```go
// internal/service/post_service.go

func (s *PostService) GetPostsForCharacter(ctx context.Context, sceneID, characterID uuid.UUID, isGM bool) ([]db.Post, error) {
    if isGM {
        // GM sees all posts including hidden
        return s.queries.GetHiddenPostsForGM(ctx, sceneID)
    }

    // Character sees only witnessed posts
    return s.queries.GetVisiblePostsForCharacter(ctx, db.GetVisiblePostsForCharacterParams{
        SceneID:     sceneID,
        CharacterID: characterID,
    })
}
```

## Late Arrival Handling

### Concept

When a character joins a scene after posts have been created, they should only see posts created **after** their arrival. The system tracks this via the `entered_at` timestamp on the character's scene presence.

### SQL Query

```sql
-- name: GetPostsSinceArrival :many
SELECT p.*
FROM posts p
JOIN characters c ON c.id = $2
WHERE p.scene_id = $1
  AND $2 = ANY(p.witnesses)
  AND p.created_at >= c.entered_at  -- Only posts after arrival
ORDER BY p.created_at ASC;
```

### Character Schema Addition

```sql
-- Add entered_at tracking
ALTER TABLE characters
ADD COLUMN entered_at TIMESTAMPTZ;

-- Set entered_at when character becomes present
CREATE OR REPLACE FUNCTION set_character_entered_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_present = true AND (OLD.is_present = false OR OLD.is_present IS NULL) THEN
    NEW.entered_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER character_presence_entered
  BEFORE UPDATE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION set_character_entered_at();
```

### Service Implementation

```go
// internal/service/scene_service.go

type JoinSceneRequest struct {
    SceneID     uuid.UUID `json:"scene_id"`
    CharacterID uuid.UUID `json:"character_id"`
}

func (s *SceneService) JoinScene(ctx context.Context, req JoinSceneRequest) error {
    // Set character present (trigger will set entered_at)
    err := s.queries.SetCharacterPresent(ctx, db.SetCharacterPresentParams{
        ID:        req.CharacterID,
        IsPresent: true,
    })
    if err != nil {
        return err
    }

    // Character will only witness posts created after this moment
    return nil
}
```

## Multi-Character View Separation

### Concept

A user with multiple characters in the same scene sees different content per character. The UI must query per-character, not per-user.

### React Component

```tsx
// src/components/SceneFeed.tsx
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

interface SceneFeedProps {
  sceneId: string;
  userCharacters: Character[]; // Characters user owns in this scene
  isGM: boolean;
}

export function SceneFeed({ sceneId, userCharacters, isGM }: SceneFeedProps) {
  const [selectedCharacterID, setSelectedCharacterID] = useState<string>(
    userCharacters[0]?.id || null
  );

  // Query posts for the selected character
  const { data: posts, isLoading } = useQuery({
    queryKey: ['posts', sceneId, selectedCharacterID, isGM],
    queryFn: () => fetchPostsForCharacter(sceneId, selectedCharacterID, isGM),
    enabled: !!selectedCharacterID || isGM,
  });

  if (userCharacters.length > 1 && !isGM) {
    return (
      <div>
        {/* Character selector */}
        <div className="flex gap-2 mb-4">
          {userCharacters.map((char) => (
            <button
              key={char.id}
              onClick={() => setSelectedCharacterID(char.id)}
              className={selectedCharacterID === char.id ? 'selected' : ''}
            >
              {char.name}
            </button>
          ))}
        </div>

        {/* Post feed for selected character */}
        <PostList posts={posts} />
      </div>
    );
  }

  // Single character or GM view
  return <PostList posts={posts} />;
}

async function fetchPostsForCharacter(
  sceneId: string,
  characterId: string,
  isGM: boolean
): Promise<Post[]> {
  const params = new URLSearchParams({
    scene_id: sceneId,
    character_id: characterId,
    is_gm: isGM.toString(),
  });

  const res = await fetch(`/api/posts?${params}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });

  if (!res.ok) throw new Error('Failed to fetch posts');
  return res.json();
}
```

## Immutable Witness Lists

### Concept

Once a post is created, its witness list **cannot be changed** except by:
1. GM unhide operation (covered in `03-hidden-posts.md`)

This ensures narrative consistency: you can't retroactively make someone "forget" witnessing an event.

### Enforcement

```sql
-- Prevent witness list updates (except for unhide)
CREATE OR REPLACE FUNCTION prevent_witness_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow GM unhide (empty → populated)
  IF OLD.witnesses = '{}' AND NEW.witnesses != '{}' THEN
    RETURN NEW;
  END IF;

  -- Prevent all other witness changes
  IF OLD.witnesses != NEW.witnesses THEN
    RAISE EXCEPTION 'Witness lists are immutable once set';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_witness_changes
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_witness_modification();
```

## Scene Visibility (Emergent)

### Concept

A scene is visible to a character if they have witnessed **any** post in that scene. This is emergent behavior, not explicitly tracked.

### Query

```sql
-- name: GetVisibleScenes :many
-- Scenes where character has witnessed at least one post
SELECT DISTINCT s.*
FROM scenes s
JOIN posts p ON p.scene_id = s.id
WHERE s.campaign_id = $1
  AND $2 = ANY(p.witnesses)
ORDER BY s.created_at DESC;
```

### Alternative: Track Membership

If performance requires, track scene membership explicitly:

```sql
CREATE TABLE scene_memberships (
  scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (scene_id, character_id)
);

-- Add membership when character witnesses first post
-- This is an optimization, not required for correctness
```

## Edge Cases

### 1. Orphaned Characters (Deleted Character)

**Scenario**: Character is deleted, but their posts remain.

**Handling**:
- Posts keep `character_id` as UUID (nullable after deletion via `ON DELETE SET NULL`)
- Witness lists preserve deleted character IDs
- Posts remain visible to witnesses

```go
// Display deleted character gracefully
func (p *Post) GetAuthorName() string {
    if p.CharacterID == nil || !p.CharacterID.Valid {
        return "[Deleted Character]"
    }
    // Look up character...
}
```

### 2. Empty Scene (No Characters Present)

**Scenario**: GM posts when no player characters are present.

**Handling**:
- Witness list is empty `[]` (but not hidden)
- Only GM sees the post
- When first character arrives, they don't see GM-only posts

```go
// This is normal behavior - GM staging posts before players arrive
if len(witnesses) == 0 && !req.IsHidden {
    // This is a GM-only post in an empty scene
    // Not an error - proceed normally
}
```

### 3. Simultaneous Posts

**Scenario**: Two characters post at nearly the same time.

**Handling**:
- Each post captures witnesses at moment of creation
- Witness lists may differ by milliseconds
- This is correct behavior (captures actual timing)

```go
// No special handling needed - database transactions ensure consistency
// Post A: witnesses = [char1, char2] (captured at T0)
// Post B: witnesses = [char1, char2, char3] (captured at T1, char3 arrived between T0-T1)
```

### 4. Character Deletion Mid-Scene

**Scenario**: Character is deleted while present in a scene.

**Handling**:
- Existing posts preserve character in witness lists
- Future posts exclude the deleted character
- Deleted character's posts remain visible to witnesses

```sql
-- GetPresentCharactersInScene already filters deleted
WHERE deleted_at IS NULL
```

### 5. GM Characters

**Scenario**: GM controls an NPC character in the scene.

**Handling**:
- GM characters treated identically to player characters
- GM sees all posts (via GM role), not via GM character
- GM character witnesses posts like any other character

```go
// No special handling - GM characters are normal characters
// GM permission is role-based, not character-based
```

## Testing Checklist

### Unit Tests

- [ ] Witness capture on post creation
  - [ ] Normal post captures all present characters
  - [ ] Hidden post has empty witness list
  - [ ] Empty scene creates empty witness list
  - [ ] Deleted characters excluded from witnesses

- [ ] Visibility queries
  - [ ] Character sees witnessed posts
  - [ ] Character doesn't see non-witnessed posts
  - [ ] GM sees all posts including hidden
  - [ ] Query performance < 100ms for 1000 posts

- [ ] Late arrival
  - [ ] `entered_at` set on presence change
  - [ ] Character only sees posts after arrival
  - [ ] Re-entering scene updates `entered_at`

- [ ] Immutability
  - [ ] Witness list update rejected (except unhide)
  - [ ] Unhide operation allowed
  - [ ] Content edits don't affect witnesses

### Integration Tests

- [ ] Multi-character separation
  - [ ] User with 2 characters sees different feeds
  - [ ] Character A witnesses post, Character B doesn't
  - [ ] Character selector switches feed correctly

- [ ] Scene visibility
  - [ ] Scene visible if any post witnessed
  - [ ] Scene invisible if no posts witnessed
  - [ ] Scene list updates on new witnessed post

- [ ] Real-time updates
  - [ ] Subscription filtered by witness status
  - [ ] Character receives update only if witnessed
  - [ ] GM receives all updates

### E2E Tests

- [ ] Player creates post → all present characters witness
- [ ] Late-arriving character → only sees subsequent posts
- [ ] GM creates hidden post → only GM sees it
- [ ] Multi-character player → separate feeds per character
- [ ] Character deleted → posts remain visible to witnesses

## Verification Steps

1. **Create test scene** with 3 characters (A, B, C)
2. **Post as Character A** → verify witnesses = [A, B, C]
3. **Remove Character B from scene**
4. **Post as Character A** → verify witnesses = [A, C]
5. **Query as Character B** → verify sees only first post
6. **Add Character B back to scene**
7. **Post as Character C** → verify witnesses = [A, B, C]
8. **Query as Character B** → verify sees first and third posts, not second
9. **Create hidden post as GM** → verify witnesses = []
10. **Query as Character A** → verify hidden post not visible
11. **Query as GM** → verify hidden post visible
12. **Test multi-character** → verify separate feeds

## Performance Optimization

### Index Strategy

```sql
-- GIN index for witness array queries
CREATE INDEX idx_posts_witnesses ON posts USING GIN(witnesses);

-- Composite index for scene + timestamp queries
CREATE INDEX idx_posts_scene_created ON posts(scene_id, created_at DESC);

-- Partial index for hidden posts (GM queries)
CREATE INDEX idx_posts_hidden ON posts(scene_id, created_at DESC)
WHERE is_hidden = true;
```

### Query Optimization

```sql
-- Use cursor-based pagination for large feeds
-- Avoid OFFSET (scales poorly)

-- Good:
SELECT * FROM posts
WHERE scene_id = $1
  AND $2 = ANY(witnesses)
  AND created_at > $3  -- cursor
ORDER BY created_at ASC
LIMIT 50;

-- Bad:
SELECT * FROM posts
WHERE scene_id = $1
  AND $2 = ANY(witnesses)
ORDER BY created_at ASC
LIMIT 50 OFFSET 500;  -- slow for large offsets
```

### Caching Strategy

```go
// Cache witness lists are immutable, can cache aggressively
type PostCache struct {
    redis *redis.Client
}

func (c *PostCache) GetPost(ctx context.Context, postID uuid.UUID) (*db.Post, error) {
    // Posts are immutable (except content edits)
    // Witness list never changes, safe to cache
    key := fmt.Sprintf("post:%s", postID)

    // Try cache first
    cached, err := c.redis.Get(ctx, key).Result()
    if err == nil {
        var post db.Post
        json.Unmarshal([]byte(cached), &post)
        return &post, nil
    }

    // Cache miss - fetch from DB and cache
    // TTL: 1 hour (witness lists are immutable)
    // ...
}
```

## API Documentation

### POST /api/posts

Create a new post.

**Request**:
```json
{
  "scene_id": "uuid",
  "character_id": "uuid",
  "content": "Post content",
  "is_hidden": false
}
```

**Response**:
```json
{
  "id": "uuid",
  "scene_id": "uuid",
  "character_id": "uuid",
  "content": "Post content",
  "witnesses": ["uuid1", "uuid2"],
  "is_hidden": false,
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

### GET /api/posts

Get visible posts for a character.

**Query Parameters**:
- `scene_id` (required): Scene UUID
- `character_id` (required for players): Character UUID
- `is_gm` (optional): Boolean, if true returns all posts
- `cursor` (optional): Timestamp for pagination
- `limit` (optional): Number of posts (default 50, max 100)

**Response**:
```json
{
  "posts": [
    {
      "id": "uuid",
      "scene_id": "uuid",
      "character_id": "uuid",
      "content": "Post content",
      "witnesses": ["uuid1", "uuid2"],
      "is_hidden": false,
      "created_at": "2025-01-15T10:30:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    }
  ],
  "next_cursor": "2025-01-15T10:35:00Z"
}
```
