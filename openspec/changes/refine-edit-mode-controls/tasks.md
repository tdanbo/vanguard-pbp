# Tasks

## 1. Fix Release button for GM edit mode
- [x] 1.1 Update `handleReleaseLock` to call `onEditCancel()` when in edit mode
- [x] 1.2 Reset `editInitializedRef.current = null` on release
- [x] 1.3 Clear form state on release (blocks, oocText, mode)
- **File:** `services/frontend/src/components/posts/ImmersiveComposer.tsx`

## 2. Remove Cancel button from edit mode
- [x] 2.1 Remove Cancel button from "pre-lock" edit state
- [x] 2.2 Replace Cancel with Release in "has-lock" edit state
- [x] 2.3 Remove `handleCancelEdit` function (now redundant with Release)
- **File:** `services/frontend/src/components/posts/ImmersiveComposer.tsx`

## 3. Hide lock icon from GM in ImmersivePostCard
- [x] 3.1 Update lock icon render condition to `post.isLocked && !isGM`
- **File:** `services/frontend/src/components/posts/ImmersivePostCard.tsx`

## 4. Hide lock icon from GM in PostCard
- [x] 4.1 Update lock icon render condition to `post.isLocked && !isGM` (both badge and icon)
- **File:** `services/frontend/src/components/posts/PostCard.tsx`

## 5. Verify behavior
- [x] 5.1 Test GM editing another player's post - Release should exit edit mode
- [x] 5.2 Test player editing their own post - Release should exit edit mode
- [x] 5.3 Confirm GM never sees lock icons on any posts
- [x] 5.4 Confirm players still see lock icons on locked posts
- [x] 5.5 Confirm edit is blocked when another user holds the compose lock
