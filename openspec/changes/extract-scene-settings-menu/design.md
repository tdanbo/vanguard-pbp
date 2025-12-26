# Design: Extract Scene Settings Menu

## Component Architecture

### SceneSettingsMenu Component

```
SceneSettingsMenu
├── DropdownMenuTrigger (Settings icon button)
└── DropdownMenuContent
    ├── "Edit Scene" → navigates to /campaigns/:id/scenes/:sceneId/settings
    ├── "Archive Scene" → calls archiveScene() (if not archived)
    ├── "Unarchive Scene" → calls unarchiveScene() (if archived)
    ├── Separator
    └── "Delete Scene" → opens DeleteSceneDialog
```

### DeleteSceneDialog Component

Embedded within SceneSettingsMenu or extracted if reused:
- AlertDialog with destructive styling
- Input field for scene title confirmation
- Submit disabled until title matches exactly
- Calls `deleteScene()` on confirm

## Visual Placement

```
┌─────────────────────────────────────────┐
│  [Scene Header Image]                   │
│                        [NEW] [Archived] │
├─────────────────────────────────────────┤
│  Scene Title                            │
│  Description text...                    │
│                                         │
│  [Character Bubbles]                    │
│                                         │
│  📝 12 posts              ⋮ [Settings]  │
└─────────────────────────────────────────┘
                             └── Menu trigger (lower-right)
```

The settings menu trigger (three-dot icon or gear) appears in the footer area alongside the post count, right-aligned.

## Delete Scene Flow

```
User clicks "Delete Scene" in menu
           ↓
AlertDialog opens with:
  - Warning about permanent deletion
  - Input: "Type scene title to confirm"
  - Disabled "Delete" button
           ↓
User types exact scene title
           ↓
"Delete" button enables
           ↓
User clicks "Delete"
           ↓
Frontend calls DELETE /api/v1/campaigns/:id/scenes/:sceneId
           ↓
Backend:
  1. Verify user is GM
  2. Get scene header_image_url
  3. If has header image, delete from storage
  4. Delete scene row (cascades to related data via FK)
  5. Decrement campaign.scene_count
  6. Return 204 No Content
           ↓
Frontend removes scene from store
           ↓
Toast: "Scene deleted"
```

## API Changes

### DELETE /api/v1/campaigns/:id/scenes/:sceneId

**Authorization**: GM only

**Response**:
- `204 No Content` on success
- `403 Forbidden` if not GM
- `404 Not Found` if scene doesn't exist

**Side Effects**:
- Deletes scene header image from storage if present
- Decrements campaign.scene_count
- Cascades to delete related posts, compose_locks, compose_drafts

## Database Considerations

The existing `DeleteScene` sqlc query performs a hard delete. Related tables should have `ON DELETE CASCADE`:
- `posts.scene_id` → cascades
- `compose_locks.scene_id` → cascades
- `compose_drafts.scene_id` → cascades

No schema changes required.

## Error Handling

| Error | User Message |
|-------|--------------|
| Not GM | "Only the GM can delete scenes" |
| Scene not found | "Scene not found" |
| Storage deletion fails | Log warning, continue with scene deletion |
