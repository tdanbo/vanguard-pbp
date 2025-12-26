# fix-gm-post-controls

## Status
- [ ] Draft
- [x] Ready for Review
- [ ] Approved
- [ ] Complete

## Why

The current post controls implementation has several issues that affect GM and player experience:

1. **GMs cannot see the "..." menu on locked posts** - The menu visibility is gated by `!post.isLocked`, which incorrectly hides GM actions on older posts. Per the existing `post-display` spec, "Posts are never locked for the GM."

2. **GM Cancel button doesn't work in edit mode** - When a GM enters edit mode on another player's post, the Cancel button fails to exit edit mode properly.

3. **Delete button appears in composer** - The ImmersiveComposer shows a Delete button during edit mode, but deletion should only be accessible via the "..." menu on posts for consistency.

## What Changes

### Frontend Post Controls

**ImmersivePostCard.tsx / PostCard.tsx:**
- Update `canEdit` logic: GMs always can edit (ignore `isLocked`), players keep existing behavior (unlocked + last post)
- Update `canDelete` logic: GMs always can delete (ignore `isLocked`), players keep existing behavior
- Update `showActionMenu` to always show for GMs

**ImmersiveComposer.tsx:**
- Remove the Delete button from edit mode toolbar
- Remove the delete confirmation dialog from composer
- Fix Cancel button to properly call `onEditCancel` callback for GM edits
