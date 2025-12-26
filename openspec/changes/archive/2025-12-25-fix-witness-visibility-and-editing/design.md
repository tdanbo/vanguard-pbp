# Design: fix-witness-visibility-and-editing

## Architecture Overview

This change involves two independent fixes that share the witness system:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                 │
├─────────────────────────────────────────────────────────────────┤
│  SceneView.tsx                                                   │
│  ├── effectiveSelectedCharacterId                               │
│  ├── useEffect: refetch posts on character change ─────────┐   │
│  └── fetchPosts(campaignId, sceneId, characterId) ──────────┤   │
│                                                              │   │
│  PostStream.tsx                                              │   │
│  └── passes isGM, sceneCharacters to ImmersivePostCard      │   │
│                                                              │   │
│  WitnessPopover.tsx                                          │   │
│  ├── View mode (always): show witness list                   │   │
│  └── Edit mode (GM only): add/remove witnesses ─────────────┤   │
│                                                              │   │
│  campaignStore.ts                                            │   │
│  └── updatePostWitnesses(postId, witnesses) ────────────────┤   │
└──────────────────────────────────────────────────────────────┴──┘
                                                               │
                         API Layer                             │
┌──────────────────────────────────────────────────────────────▼──┐
│  GET  /scenes/:sceneId/posts?characterId=xxx                    │
│  PATCH /posts/:postId/witnesses  { witnesses: string[] }       │
└─────────────────────────────────────────────────────────────────┘
                                                               │
                         Backend                               │
┌──────────────────────────────────────────────────────────────▼──┐
│  handlers/posts.go                                              │
│  └── UpdatePostWitnesses handler                                │
│                                                                 │
│  service/post.go                                                │
│  └── UpdatePostWitnesses(ctx, userID, postID, witnesses)       │
│      ├── Verify GM status                                       │
│      ├── Validate witnesses are in scene                        │
│      └── Call queries.UpdatePostWitnesses                       │
│                                                                 │
│  db/queries/posts.sql                                           │
│  └── UpdatePostWitnesses (already exists!)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Fix 1: Character-Scoped Post Fetching

### Current Flow (Buggy)

```
User selects character "Thorne" in UI
         ↓
SceneView calls fetchPosts(campaignId, sceneId)  ← No characterId!
         ↓
Backend: ListScenePosts checks viewAsCharacterID = nil
         ↓
Backend falls back to first user character in scene (might be "Garrett")
         ↓
Posts filtered by "Garrett"'s witnesses, not "Thorne"'s
```

### Fixed Flow

```
User selects character "Thorne" in UI
         ↓
useEffect detects effectiveSelectedCharacterId changed
         ↓
SceneView calls fetchPosts(campaignId, sceneId, "thorne-uuid")
         ↓
Backend: ListScenePosts uses viewAsCharacterID = "thorne-uuid"
         ↓
Posts correctly filtered by "Thorne"'s witnesses
```

### Edge Cases

1. **GM/Narrator mode**: Don't pass characterId; GM sees all posts
2. **Initial load**: Use effectiveSelectedCharacterId (defaults to first user character)
3. **Character not in scene**: Don't pass characterId if selected character isn't in scene

## Fix 2: GM Witness Editing

### UI Flow

```
GM clicks eye icon on post
         ↓
WitnessPopover opens with:
┌────────────────────────────────┐
│ 👁 Witnesses                   │
├────────────────────────────────┤
│ Player Characters              │
│   [✓] Garrett                  │
│   [✓] Thorne                   │
│   [ ] (available to add)       │
│                                │
│ NPCs                           │
│   [ ] Shopkeeper               │
│   [ ] Guard                    │
│                                │
│ [Save Changes]                 │
└────────────────────────────────┘
```

### Component Hierarchy

```
WitnessPopover
├── isEditing state (false by default, true when GM clicks edit)
├── localWitnesses state (copy of post.witnesses for editing)
├── View Mode
│   └── Current witness display (existing)
└── Edit Mode (GM only)
    ├── Checkbox list of scene characters
    ├── Current witnesses pre-checked
    └── Save button → calls updatePostWitnesses
```

### API Contract

```
PATCH /api/v1/posts/:postId/witnesses
Authorization: Bearer <token>  (must be GM)
Content-Type: application/json

Request:
{
  "witnesses": ["uuid-1", "uuid-2", "uuid-3"]
}

Response (200 OK):
{
  "id": "post-uuid",
  "sceneId": "scene-uuid",
  "witnesses": ["uuid-1", "uuid-2", "uuid-3"],
  ... (full PostResponse)
}

Errors:
- 404: Post not found
- 403: NOT_GM - Only GM can modify witnesses
- 400: Invalid witness ID or character not in scene
```

### Validation Rules

1. **GM-only**: Only campaign GM can modify witnesses
2. **Scene membership**: All provided witness IDs must be characters currently in the scene
3. **Empty allowed**: Witnesses array can be empty (effectively hides post from all characters)
4. **No duplicates**: Witness list is deduplicated

## State Management

### campaignStore Changes

```typescript
// Add new method
updatePostWitnesses: async (postId: string, witnesses: string[]) => {
  const post = await api<Post>(`/api/v1/posts/${postId}/witnesses`, {
    method: 'PATCH',
    body: { witnesses },
  })
  set((state) => ({
    posts: state.posts.map((p) => (p.id === postId ? post : p)),
  }))
  return post
}
```

### WitnessPopover Props

```typescript
interface WitnessPopoverProps {
  witnessIds: string[]
  characters: Character[]      // Scene characters for display
  isGM?: boolean               // Enable edit mode
  postId?: string              // Required for editing
  onWitnessesUpdated?: () => void  // Callback after save
}
```

## Broadcast Considerations

When witnesses are updated, the existing `BroadcastPostUpdated` mechanism should be used. This triggers clients to refetch posts, ensuring all players see the correct visibility.

## Testing Strategy

### Bug Fix Testing

1. Select character A with limited witnesses
2. View posts (should only see A's witnessed posts)
3. Switch to character B with different witnesses
4. Verify posts update to B's witnessed posts
5. Switch to narrator (GM) mode
6. Verify all posts are visible

### GM Editing Testing

1. As GM, click eye icon on a post
2. Verify edit mode shows all scene characters
3. Add a character as witness
4. Save and verify the character can now see the post
5. Remove a character from witnesses
6. Save and verify the character can no longer see the post
