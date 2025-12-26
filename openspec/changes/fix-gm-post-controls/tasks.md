# Tasks

## 1. Update GM menu visibility in ImmersivePostCard
- [x] Modify `canEdit` to allow GMs regardless of lock status
- [x] Modify `canDelete` to allow GMs regardless of lock status
- [x] Ensure `showActionMenu` displays for GMs on all posts
- **File:** `services/frontend/src/components/posts/ImmersivePostCard.tsx`

## 2. Update GM menu visibility in PostCard
- [x] Apply same logic changes as ImmersivePostCard
- **File:** `services/frontend/src/components/posts/PostCard.tsx`

## 3. Remove Delete button from ImmersiveComposer
- [x] Remove the Delete button JSX (lines 829-840)
- [x] Remove the `canDelete` variable
- [x] Remove the delete confirmation dialog
- [x] Remove `handleDeletePost` function
- [x] Remove `onPostDeleted` prop handling if no longer needed
- **File:** `services/frontend/src/components/posts/ImmersiveComposer.tsx`

## 4. Fix GM Cancel button functionality
- [x] Investigate why `onEditCancel` callback is not working for GM edits
- [x] Ensure `handleCancelEdit` properly exits edit mode
- **File:** `services/frontend/src/components/posts/ImmersiveComposer.tsx`

## 5. Verify player post menu behavior
- [x] Confirm players only see "..." on their most recent unlocked post
- [x] Test locked post behavior for players
