# Change: Implement Fog of War Scene Visibility Filtering

## Why

The fog of war setting can be toggled in campaign settings, but it currently has no effect. When enabled, players can still see all scenes in the campaign, which defeats the core anti-metagaming purpose of the feature. The PRD specifies that with fog of war enabled, "characters only see scenes where they have witnessed at least one post."

## What Changes

- **Backend**: Modify scene listing to respect the `fogOfWar` campaign setting
  - GM always sees all scenes regardless of setting
  - Players only see scenes where their assigned characters have witnessed posts (when fog of war enabled)
  - Query existing `GetVisibleScenesForCharacter` to filter scenes by witness status
  - Aggregate visibility across all of a player's characters

- **Frontend**: Update scene fetching to work with fog of war filtering
  - No character selection required - backend aggregates across all user's characters
  - Empty state messaging when no scenes are visible due to fog of war

## Impact

- Affected specs: New capability `fog-of-war`
- Affected code:
  - `services/backend/internal/service/scene.go` - `ListCampaignScenes` to check fog of war and filter
  - `services/backend/db/queries/scenes.sql` - New query for player-visible scenes
  - `services/frontend/src/pages/campaigns/CampaignDashboard.tsx` - Empty state for fog of war
- No database migrations required - witness data already stored on posts
