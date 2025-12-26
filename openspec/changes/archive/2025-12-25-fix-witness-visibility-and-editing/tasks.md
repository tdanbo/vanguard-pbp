# Tasks: fix-witness-visibility-and-editing

## Fix 1: Character-Scoped Post Visibility

### Task 1.1: Update SceneView to pass character ID when fetching posts
- [x] Modify `fetchPosts` call in `SceneView.tsx` to include `effectiveSelectedCharacterId`
- [x] Skip passing character ID when `effectiveSelectedCharacterId === 'narrator'` (GM mode)
- [x] Add `useEffect` to refetch posts when `effectiveSelectedCharacterId` changes
- **Validation**: Switching characters updates visible posts correctly

### Task 1.2: Verify backend handles character ID correctly
- [x] Confirm `ListScenePosts` properly filters by `viewAsCharacterID` when provided
- [x] Confirm GM bypass works (no filtering when user is GM)
- **Validation**: Backend returns correctly filtered posts based on character ID

---

## Fix 2: GM Witness Editing

### Task 2.1: Add backend endpoint for witness updates
- [x] Add `UpdatePostWitnesses` handler in `handlers/posts.go`
- [x] Add `UpdatePostWitnesses` service method in `service/post.go`
  - Verify GM status
  - Validate all witness IDs are characters in the scene
  - Call existing `EditPostWitnesses` query
- [x] Register route: `PATCH /api/v1/posts/:postId/witnesses`
- [x] Fix: Add `charID.Valid` check when building scene character ID map (prevents 500 error)
- **Validation**: `make backend-test` passes, endpoint returns updated post

### Task 2.2: Add store method for witness updates
- [x] Add `updatePostWitnesses(postId, witnesses)` method to `campaignStore.ts`
- [x] Update local posts state after successful API call
- **Validation**: Store correctly calls API and updates state

### Task 2.3: Make WitnessPopover editable for GM
- [x] Add `isGM`, `postId`, and `onWitnessesUpdated` props to `WitnessPopover`
- [x] Add edit mode state with checkbox selection for scene characters
- [x] Show edit button/mode only when `isGM === true`
- [x] Add Save button that calls `updatePostWitnesses`
- [x] Pass new props from `ImmersivePostCard` through `PostStream`
- **Validation**: GM can add/remove witnesses, changes persist after refresh

### Task 2.4: Broadcast witness updates
- [x] Call `BroadcastPostUpdated` after witness update in handler
- **Validation**: Other clients refetch posts after witness change

---

## Verification Tasks

### Task 3.1: Test character switching visibility
- [ ] As player with 2+ characters in scene, switch between them
- [ ] Verify post list updates based on each character's witnesses
- [ ] Verify narrator mode shows all posts

### Task 3.2: Test GM witness editing
- [ ] As GM, edit witnesses on a post
- [ ] Add a character and verify they can see the post
- [ ] Remove a character and verify they can no longer see the post
- [ ] Test empty witness list (should effectively hide post from all players)

### Task 3.3: Linting and builds pass
- [x] `make frontend-lint` passes (pre-existing issues remain in SceneCard.tsx and ui files)
- [x] `make backend-lint` passes (pre-existing issues remain in campaigns.go and invites.go)
- [x] `make frontend-build` passes
- [x] `make backend-build` passes
