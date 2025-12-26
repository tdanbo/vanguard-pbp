# Tasks: Add Witness Viewer Button

## Implementation Tasks

### 1. Create WitnessPopover component
- [x] Create `services/frontend/src/components/posts/WitnessPopover.tsx`
- [x] Accept `witnessIds: string[]` and `characters: Character[]` props
- [x] Resolve witness IDs to character names/avatars
- [x] Display character list with avatars in a compact format
- [x] Group by character type (PC/NPC) with subtle visual distinction
- [x] Handle empty state gracefully

### 2. Add eye button to PostCard
- [x] Import `Eye` icon from lucide-react (already available)
- [x] Add button in post header area
- [x] Wire up Popover trigger
- [x] Style button to be unobtrusive (ghost variant, small size)
- [x] Position appropriately in header layout

### 3. Pass character data to PostCard
- [x] Ensure `sceneCharacters` prop contains all characters needed
- [x] Verify witness IDs can be resolved from available character list
- [x] Handle case where witness character may not be in current scene list

### 4. Verify accessibility
- [x] Ensure button has proper aria-label ("View witnesses")
- [x] Popover should be keyboard accessible
- [x] Screen reader should announce witness count

## Validation

- [x] Manual test: Click eye button shows correct witness names
- [x] Manual test: Works for posts with 1 witness, many witnesses
- [x] Manual test: GM can see witnesses on all posts
- [x] Manual test: Player can see witnesses on visible posts
- [x] Visual review: Button doesn't clutter post header
