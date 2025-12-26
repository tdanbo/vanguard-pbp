# Tasks: Fix Fog of War to Respect Selected Character

## Implementation Order

- [x] **Backend: Add characterId parameter to ListCampaignScenes service method**
   - Modify `ListCampaignScenes` signature to accept optional character ID
   - When character ID provided + fog of war enabled, use `GetVisibleScenesForCharacter` query
   - When character ID not provided, use existing `GetVisibleScenesForUser` query
   - Files: `services/backend/internal/service/scene.go`

- [x] **Backend: Add characterId query parameter to scenes handler**
   - Parse optional `characterId` query parameter from request
   - Validate character belongs to requesting user (if provided)
   - Pass to service layer
   - Files: `services/backend/internal/handlers/scenes.go`

- [x] **Frontend: Update scene fetching to accept characterId**
   - Add optional `characterId` param to `fetchScenes` in campaign store
   - Pass as query parameter to API endpoint
   - Files: `services/frontend/src/stores/campaignStore.ts`

- [x] **Frontend: Pass selected character when fetching scenes**
   - Thread `selectedCharacterId` to scene fetch calls in CampaignDashboard
   - Re-fetch scenes when selected character changes
   - Only pass characterId for non-GM players when fog of war is enabled
   - Files: `services/frontend/src/pages/campaigns/CampaignDashboard.tsx`

- [x] **Frontend: Update empty state messaging**
   - When no scenes visible due to fog of war + selected character, show character-specific message
   - Example: "No scenes visible to Una Erli yet"
   - Files: `services/frontend/src/pages/campaigns/CampaignDashboard.tsx`

- [x] **Validation: Test character-scoped visibility**
   - Verify selecting different characters shows different scene sets
   - Verify GM still sees all scenes
   - Verify fog of war disabled shows all scenes regardless of selection

## Dependencies

- Tasks 1-2 (backend) can be done in parallel with tasks 3-5 (frontend) as long as API contract is agreed
- Task 4 depends on task 3
- Task 5 depends on task 4
- Task 6 depends on all previous tasks
