# Change: Improve Hidden Post Toggle UX

## Why

The current hidden post toggle in the post composer has poor visual communication:
1. The switch state (ON/OFF) doesn't provide clear visual feedback
2. The "EyeOff" icon and "Hidden Post" label don't clearly communicate what hidden posts do
3. Players may accidentally submit posts as hidden or visible without realizing

## What Changes

- Replace the basic switch with a more prominent toggle button that changes appearance when active
- Add clearer state-dependent messaging explaining what will happen
- Use contrasting colors/styles for hidden vs visible states
- Show explicit confirmation of the current mode in the submit button

## Impact

- Affected specs: `post-composer` (new capability)
- Affected code: `services/frontend/src/components/posts/ImmersiveComposer.tsx` (main scene composer)
- Also updated: `services/frontend/src/components/posts/PostComposer.tsx` (legacy component)
- Created: `services/frontend/src/components/posts/HiddenPostToggle.tsx` (reusable component)
- No backend changes required
- No breaking changes
