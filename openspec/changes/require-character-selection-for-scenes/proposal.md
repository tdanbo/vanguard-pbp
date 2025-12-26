# Change: Require Character Selection for Scene Visibility

## Why

Currently, when a player has no character selected and fog of war is enabled, the system shows scenes visible to ANY of their characters (aggregate/union visibility). This creates an implicit metagaming situation where players can see all locations their characters have visited without actively choosing a perspective. Requiring explicit character selection reinforces the immersive, character-scoped experience that fog of war is designed to provide.

## What Changes

- When fog of war is enabled and no character is selected, show an empty state prompting the player to select a character
- Remove the "aggregate visibility" behavior that shows union of all character-visible scenes
- Update empty state messaging to clearly communicate that character selection is required
- Backend behavior remains unchanged (no characterId = no filtering), the change is frontend-only

## Impact

- Affected specs: `fog-of-war`
- Affected code:
  - `services/frontend/src/pages/campaigns/CampaignDashboard.tsx` - Scene display logic and empty states
