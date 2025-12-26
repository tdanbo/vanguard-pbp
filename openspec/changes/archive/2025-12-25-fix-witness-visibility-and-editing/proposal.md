# Proposal: fix-witness-visibility-and-editing

## Summary

This change fixes a bug where selected characters can see posts they haven't witnessed, and adds a GM editorial tool to modify post witnesses for corrections.

## Problem Statement

### Bug: Character-Scoped Post Visibility Not Applied

When a player selects a character in the scene view, the frontend fetches posts without passing the `characterId` parameter. This causes:

1. **Frontend issue**: `SceneView.tsx` line 163 calls `fetchPosts(campaignId, sceneId)` without the character ID
2. **Result**: The backend falls back to the first user character in the scene, not the selected one
3. **Impact**: When a player switches between characters with different witness lists, they see posts from the wrong character's perspective

### Missing Feature: GM Witness Editing

When something goes wrong with witness lists (e.g., post created with incorrect witnesses, character missing from witness list due to timing issues), the GM has no way to correct them. The existing `UnhidePost` endpoint only works for hidden posts.

## Solution

### Fix 1: Pass Selected Character ID to Posts Fetch

Modify the frontend to:
1. Pass `effectiveSelectedCharacterId` when fetching posts
2. Refetch posts when the selected character changes
3. Skip the character ID parameter when in GM view (narrator mode)

### Fix 2: Editable Witness Popover for GM

Add GM-only editing capability to the `WitnessPopover` component:
1. When GM clicks the eye icon, show current witnesses with ability to add/remove
2. Restrict additions to characters currently in the scene (PCs and NPCs)
3. Create a new backend endpoint `PATCH /api/v1/posts/:postId/witnesses` for updating witnesses

## Scope

- **Frontend**: `SceneView.tsx`, `PostStream.tsx`, `WitnessPopover.tsx`, `campaignStore.ts`
- **Backend**: New handler for witness updates, service method, SQL query
- **API**: New endpoint `PATCH /api/v1/posts/:postId/witnesses`

## Out of Scope

- Retroactively fixing historical witness data
- RLS policy changes (existing policies handle witness filtering at DB level)
- Real-time sync updates (existing broadcast mechanisms are sufficient)

## Risks

- **Data consistency**: Modifying witnesses on old posts changes visibility retroactively. This is intentional as an editorial correction tool.
- **Abuse potential**: GM could theoretically hide posts from players by removing witnesses. This is consistent with existing GM powers.
