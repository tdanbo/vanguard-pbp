# Tasks: Implement Fog of War Scene Visibility Filtering

## 1. Backend - SQL Query

- [x] 1.1 Add `GetVisibleScenesForUser` query to `scenes.sql` that returns scenes where any of the user's characters have witnessed posts
- [x] 1.2 Run `sqlc generate` to generate Go code for new query

## 2. Backend - Service Layer

- [x] 2.1 Modify `ListCampaignScenes` in `scene.go` to:
  - Fetch campaign settings to check `fogOfWar` flag
  - Check if user is GM (bypass filtering)
  - If fog of war enabled and not GM, use `GetVisibleScenesForUser` instead of `ListCampaignScenes`
  - Return filtered scene list

## 3. Frontend - Empty State

- [x] 3.1 Update `CampaignDashboard.tsx` empty state for scenes tab to show fog-of-war-aware messaging when player has no visible scenes
- [x] 3.2 Add helper text explaining that scenes become visible when character witnesses a post

## 4. Validation

- [x] 4.1 Test: GM sees all scenes with fog of war enabled
- [x] 4.2 Test: Player with no character assignments sees no scenes
- [x] 4.3 Test: Player sees only scenes where their character has witnessed posts
- [x] 4.4 Test: Player with multiple characters sees union of visible scenes
- [x] 4.5 Test: Disabling fog of war shows all scenes to all players
- [x] 4.6 Test: Archived scenes are excluded from fog-of-war filtered results
