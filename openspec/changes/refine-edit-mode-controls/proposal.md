# Change: Refine Edit Mode Controls

## Status
- [ ] Draft
- [ ] Ready for Review
- [ ] Approved
- [x] Complete

## Why

The current edit mode UX has several issues:

1. **Editing is treated differently from taking a turn** - Currently there's a Cancel button in edit mode, but conceptually editing a post IS taking a turn. Users should not be able to discard changes without releasing the lock.

2. **GM Release button doesn't work** - When GM edits another player's post, the Release button sets `narratorComposing = false` but doesn't call `onEditCancel()` to actually exit edit mode.

3. **Lock icon shown to GM** - GMs don't need to see the lock icon on posts since posts are never locked for them (they can always edit). The lock indicator is only meaningful to players.

4. **Two-step edit flow is confusing** - There's a "Cancel" button before acquiring the lock and an "Edit Post" button. Edit should be 1-click to acquire the lock directly (but blocked if lock is held by another user).

## What Changes

### ImmersiveComposer.tsx
- Remove Cancel button from edit mode - only show Release button (same as new post flow)
- Fix `handleReleaseLock` to call `onEditCancel()` when in edit mode (for GM and narrator editing)
- Remove the "pre-lock" Cancel button from edit mode state
- Edit behaves exactly like "Take Turn" - 1-click acquisition, Release to exit

### ImmersivePostCard.tsx
- Hide lock icon from GMs (only show to players)

### PostCard.tsx
- Hide lock icon from GMs (only show to players)

## Impact
- Affected specs: `post-composer`, `post-display`
- Affected code:
  - `services/frontend/src/components/posts/ImmersiveComposer.tsx`
  - `services/frontend/src/components/posts/ImmersivePostCard.tsx`
  - `services/frontend/src/components/posts/PostCard.tsx`
