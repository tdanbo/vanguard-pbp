# Change: Fix Fog of War to Respect Selected Character

## Why

The fog of war implementation currently aggregates visibility across all of a player's assigned characters, rather than filtering by the currently selected character. When a player selects a specific character in the "My Characters" pane, they should only see scenes where that specific character has witnessed posts.

**Current behavior:** Player selecting "Una Erli" (who has no witnessed posts in "Rusty Tab Cellar") still sees the scene because their other character "Leman Russ" has witnessed posts there.

**Expected behavior:** Player selecting "Una Erli" should NOT see "Rusty Tab Cellar" unless Una Erli has witnessed at least one post there. The fog of war should filter by the selected character, not aggregate across all owned characters.

## What Changes

- **Backend API**: Add optional `characterId` query parameter to the scene listing endpoint
  - When provided AND fog of war is enabled, filter scenes by that specific character's witnessed posts
  - When not provided, fall back to current behavior (aggregate across all user's characters)
  - GM always sees all scenes regardless of parameter

- **Frontend**: Pass selected character ID when fetching scenes for players
  - Thread `selectedCharacterId` from CampaignDashboard to scene fetching logic
  - Update empty state messaging to reference the selected character
  - Only apply character filtering when fog of war is enabled AND a character is selected

## Impact

- Affected specs: Modifies `fog-of-war` capability behavior
- Affected code:
  - `services/backend/internal/api/handlers/scenes.go` - Add `characterId` query param support
  - `services/backend/internal/service/scene.go` - Add character ID parameter to `ListCampaignScenes`
  - `services/frontend/src/pages/campaigns/CampaignDashboard.tsx` - Pass selected character when fetching
  - `services/frontend/src/stores/campaignStore.ts` - Add characterId param to fetchScenes
- No database migrations required - `GetVisibleScenesForCharacter` query already exists (lines 159-167 in scenes.sql)
