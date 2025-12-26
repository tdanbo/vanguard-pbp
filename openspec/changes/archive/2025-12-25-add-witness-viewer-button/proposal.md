# Proposal: Add Witness Viewer Button to Posts

## Summary

Add a small eye button to each post that, when clicked, displays which characters (PCs/NPCs) witnessed that post. This provides a quick reference for players and GMs to understand "who knows what" within the game narrative.

## Motivation

In a play-by-post RPG with fog-of-war mechanics, tracking which characters have witnessed specific events is crucial for maintaining narrative consistency. Currently, witness data exists in the system but isn't easily accessible to users. This creates friction when:

- Players want to verify what their character knows before referencing an event
- GMs need to quickly check who saw a particular action or dialog
- Players controlling multiple characters need to track separate knowledge per character

## Proposed Solution

Add an unobtrusive eye icon button to the post header. When clicked, it reveals a popover or tooltip showing the list of character names who witnessed the post.

### UI Behavior

1. **Eye Button**: Small icon button placed in the post header (near the timestamp or actions area)
2. **Click Action**: Opens a popover showing witness list
3. **Witness Display**: Shows character names with avatars, grouped by type (PC/NPC) if helpful
4. **Empty State**: If somehow no witnesses (shouldn't happen in practice), show "No witnesses"

### Visibility Rules

- All users who can see a post can also see who witnessed it
- GM always sees full witness list
- Players see witnesses for posts visible to their characters

## Scope

- **Frontend only**: The `witnesses[]` array of character IDs is already returned with posts
- **No API changes**: All required data is already available
- **Minimal UI addition**: Single button + popover component

## Non-Goals

- Modifying witness lists (handled by existing reveal/hide mechanics)
- Filtering posts by witness (future enhancement)
- Editing witnesses after post creation

## Related Specs

- `fog-of-war`: Defines witness-based visibility filtering
- `campaign-settings`: Hidden posts toggle affects witness behavior
