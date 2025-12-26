# Design: Fix Fog of War to Respect Selected Character

## Problem Analysis

The current fog of war implementation uses `GetVisibleScenesForUser` which joins `character_assignments` to find ALL characters owned by a user and returns scenes where ANY of those characters have witnessed posts. This approach was designed to simplify the UI by not requiring character selection.

However, this defeats the anti-metagaming purpose: a player controlling multiple characters effectively sees the union of all their characters' visibility, allowing them to know information that their currently-played character shouldn't have.

## Design Decision: Optional Character Filtering

**Approach**: Make character-based filtering opt-in via query parameter rather than mandatory.

**Rationale**:
1. **Backwards compatibility**: Existing API calls without `characterId` continue to work
2. **Graceful fallback**: If no character selected in UI, show aggregate view (better than showing nothing)
3. **GM unaffected**: GM visibility unchanged, no character filtering applied
4. **Simple implementation**: Reuses existing `GetVisibleScenesForCharacter` query

## API Contract

### Current
```
GET /api/v1/campaigns/{id}/scenes
```
Returns scenes visible to user (aggregate of all owned characters when fog of war enabled).

### Proposed
```
GET /api/v1/campaigns/{id}/scenes?characterId={uuid}
```
When `characterId` provided AND fog of war enabled AND user is not GM:
- Returns scenes where that specific character has witnessed posts
- Validates character is assigned to requesting user

When `characterId` not provided OR fog of war disabled OR user is GM:
- Falls back to current behavior

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ CampaignDashboard                                               │
│                                                                 │
│  selectedCharacterId ─────────────────────────┐                │
│        │                                       │                │
│        ▼                                       ▼                │
│  ┌──────────────┐                    ┌──────────────────┐      │
│  │ Character    │                    │ fetchScenes()    │      │
│  │ Selector     │  onChange ───────▶ │ + characterId    │      │
│  └──────────────┘                    └────────┬─────────┘      │
│                                               │                 │
└───────────────────────────────────────────────┼─────────────────┘
                                                │
                                                ▼
                                   GET /campaigns/{id}/scenes
                                       ?characterId={uuid}
                                                │
                                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Backend                                                          │
│                                                                 │
│  ┌─────────────────┐                                            │
│  │ scenes.go       │                                            │
│  │ handler         │ ─── Parse characterId query param          │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │ scene.go        │                                            │
│  │ service         │                                            │
│  │                 │                                            │
│  │ if characterId && fogOfWar && !isGM:                        │
│  │   GetVisibleScenesForCharacter(campaignId, characterId)      │
│  │ else:                                                        │
│  │   GetVisibleScenesForUser(campaignId, userId)               │
│  └─────────────────┘                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Security Considerations

1. **Character ownership validation**: Backend must verify the requested `characterId` is assigned to the requesting user before using it for filtering
2. **GM bypass unchanged**: GM always sees all scenes regardless of any parameters
3. **No information leakage**: Invalid/unowned character IDs should not reveal scene existence

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| No character selected | Aggregate visibility (current behavior) |
| Character has no witnessed posts | Empty scene list for that character |
| Character ID not owned by user | 403 Forbidden |
| Invalid character UUID | 400 Bad Request |
| GM with characterId param | Ignored, sees all scenes |
| Fog of war disabled | CharacterId ignored, sees all scenes |

## Empty State Messaging

When character-scoped filtering results in no visible scenes:

**Current message**: "You haven't witnessed any scenes yet."

**Proposed message**: "No scenes visible to {character name} yet. Select a different character to see other scenes."

This provides context about why scenes aren't visible and guides the user toward a solution.
