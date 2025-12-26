# Tasks: Extract Scene Settings Menu

## Implementation Order

### 1. Backend: Delete Scene Endpoint
- [x] Add `DeleteScene` handler to `services/backend/internal/handlers/scenes.go`
- [x] Add `DeleteScene` method to `services/backend/internal/service/scene.go`
- [x] Handle cascade: delete scene header image from storage before deleting scene
- [x] Register `DELETE /scenes/:sceneId` route in `main.go`
- [x] Add `ErrSceneHasPosts` error for non-empty scenes (optional: allow deletion regardless)
- **Validation**: `go build ./...` and manual API test

### 2. Frontend: Add deleteScene to Campaign Store
- [x] Add `deleteScene` function signature to `CampaignState` interface
- [x] Implement `deleteScene(campaignId: string, sceneId: string): Promise<void>`
- [x] Remove scene from local `scenes` array on success
- **Validation**: TypeScript compiles

### 3. Frontend: Create SceneSettingsMenu Component
- [x] Create `services/frontend/src/components/scene/SceneSettingsMenu.tsx`
- [x] Use shadcn `DropdownMenu` with trigger button (Settings icon)
- [x] Menu items: "Edit Scene" (navigates to settings page), "Archive Scene", "Delete Scene"
- [x] Delete triggers confirmation dialog requiring scene title input
- [x] Archive uses existing `archiveScene` store method
- [x] Props: `campaignId`, `sceneId`, `sceneTitle`, `isArchived`
- **Validation**: Component renders in Storybook or visual test

### 4. Frontend: Integrate SceneSettingsMenu into SceneCard
- [x] Import `SceneSettingsMenu` in `SceneCard.tsx`
- [x] Position menu trigger in lower-right corner of card content
- [x] Only render for GM users (`isGM` prop)
- [x] Stop click propagation so menu doesn't navigate to scene
- **Validation**: Menu visible on scene cards in campaign dashboard (GM view)

### 5. Validation & Cleanup
- [x] Run `bun run lint` and fix any issues
- [x] Run `go test ./...` for backend
- [ ] Test delete flow end-to-end
- [ ] Test archive flow from menu
- [ ] Test edit navigation from menu
