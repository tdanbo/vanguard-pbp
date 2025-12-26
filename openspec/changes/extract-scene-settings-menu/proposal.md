# Proposal: Extract Scene Settings Menu

## Summary

Extract scene settings into a reusable dropdown menu component and add it to SceneCard in the campaign dashboard. Update the menu options to remove "View Roster" and add functional "Delete Scene" capability.

## Motivation

Currently, scene settings are only accessible via a full page (`/campaigns/:id/scenes/:sceneId/settings`). This requires navigation away from the campaign dashboard to perform quick scene management actions. Having a lightweight menu on each SceneCard would improve GM workflow by allowing:

1. Quick access to scene settings from the campaign view
2. Ability to archive or delete scenes without leaving the dashboard
3. Better discoverability of scene management options

## Scope

### In Scope
- Create a reusable `SceneSettingsMenu` component (dropdown)
- Add the menu to `SceneCard` in the lower-right corner (GM only)
- Remove "View Roster" action (character management handled elsewhere)
- Add "Delete Scene" action with confirmation dialog
- Implement backend `DELETE /scenes/:sceneId` endpoint
- Add `deleteScene` to campaign store

### Out of Scope
- Modifying the existing full SceneSettings page (remains for header image and detailed settings)
- Real-time sync of scene deletions (handled by existing patterns)
- Mobile-specific menu adaptations

## Technical Approach

### Frontend
1. Create `SceneSettingsMenu` component using shadcn `DropdownMenu`
2. Menu options: "Edit Scene", "Archive Scene", "Delete Scene"
3. Position in lower-right of SceneCard during GM Phase
4. Delete confirmation dialog with scene title confirmation

### Backend
1. Add `DeleteScene` handler in `scenes.go`
2. Add `DeleteScene` method to scene service
3. Cascade delete scene header images from storage
4. Use existing `DeleteScene` sqlc query (already exists)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Accidental scene deletion | Require scene title confirmation in delete dialog |
| Orphaned storage files | Delete scene header images before scene row |
| Posts lost with scene | Document that deletion is permanent; archived scenes preferred |

## Dependencies

- Existing `DeleteScene` sqlc query (already implemented)
- shadcn DropdownMenu component (already in project)
- SceneCard component (exists)
