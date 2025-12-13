# Information Architecture

How information flows and who can see what.

## Visibility Matrix

| Content | Character (own scene) | Character (other scene) | GM |
|---------|----------------------|------------------------|-----|
| Scene exists | Yes | No (with fog) | Yes |
| History before arrival | No (with fog) | No | Yes |
| Content while present | Yes | No | Yes |
| Character locations | No (with fog) | No | Yes |
| Hidden posts | Own only | No | Yes |
| All rolls | Yes | No | Yes |
| Other characters' pass status | Yes | No | Yes |
| Time gate remaining | Yes | No | Yes |
| User identity behind character | No | No | Yes |
| OOC text | Per campaign setting | No | Yes |

**Multi-Character Note:** If a user controls multiple characters, each character has independent visibility based on their own witness history.

---

## GM Role

The GM is the omniscient narrator and information broker.

### Visibility

- Sees all scenes simultaneously
- Sees all hidden posts
- Sees all roll results
- Sees all character locations
- Full campaign history access
- Sees mapping of user_id → character (for administration)
- Sees all OOC text regardless of campaign setting

### Capabilities

- Create scenes with descriptions and header images
- Add/remove characters from scenes (during GM Phase)
- Move characters between scenes (during GM Phase)
- Override compose locks
- Request rolls from players (during PC Phase)
- Resolve unresolved rolls manually
- Archive completed scenes
- Delete scenes (frees storage)
- Moderate content (edit/delete posts)
- Claim/transfer GM role
- Reassign orphaned characters to new players
- Create and manage NPCs
- Post as Narrator (characterId = null) for scene descriptions
- Select custom witness groups for posts (all/specific/hidden)
- Pause/resume campaigns

### Responsibilities

- Review all scenes during GM Phase
- Post responses scene-by-scene (messenger-style)
- Resolve any unresolved rolls before transitioning
- Move characters between scenes as narrative dictates
- Keep the story moving
- Handle disputes and moderation

### GM Phase Workflow

When all characters have passed (or time gate expires):
1. GM reviews each scene individually
2. GM resolves any pending rolls manually
3. GM posts responses/descriptions in each scene
4. GM moves characters between scenes as needed
5. GM clicks "Move to PC Phase" to start next cycle

---

## GM Moderation Tools

### Content Editing Authority

- **GM can edit any post** at any point (before/after lock)
- **GM can delete any post** at any point
- When a post is deleted, the previous post becomes unlocked

### Intended Use

- Content cleanup (offensive language, typos, mistakes)
- **NOT for changing gameplay outcomes** or results
- Safety valve for accidental submissions

### Edit Visibility

- **Small edit indicator:** "Edited by GM" badge on affected post
- **No audit trail visible** to players
- **No version history** or original text shown
- Just enough to signal "this was modified"

### Not Available

- Editing roll results after execution
- Changing witness lists retroactively (except unhiding hidden posts)
- Hiding the edit indicator

---

## Game Log

The game log is a persistent record of all scenes and posts, filtered by witness visibility.

### Character View

- Shows only scenes where the character has witnessed posts
- Within each scene, shows only posts the character witnessed
- Essentially a personal history of the character's journey
- If user has multiple characters, can switch between character views
- Can be exported as a narrative document (future feature)

### GM View

- Complete visibility of all scenes
- All posts including hidden posts
- Full campaign history for reference and continuity
- Useful for recaps and maintaining consistency

### Log Features

- Scene list view → click into scene for posts
- Infinite scroll, recent-first
- "Jump to most recent" button for long histories
- Character filter (show only specific character's posts)

### Bookmarks

- Character-scoped memories that create quick links within the game log
- Bookmark types: NPC, scene, or post
- Can navigate to first/last encounter with NPCs
- Scoped per character per campaign (different characters have different bookmarks)
- Personal to each player—not shared

### Scene Limits

- Hard limit: **25 scenes per campaign**
- Each character can only be in one scene at a time
- Empty scenes can be archived by GM (during GM Phase)
- Archived scenes remain in game log (read-only)
- GM can delete scenes to free storage
- When creating 26th scene, oldest archived scene is auto-deleted

---

## Scene States

Scenes have two states. **Campaigns can be paused, but scenes cannot.**

### Active

- Phase cycle is running
- Players can create posts and pass
- Time gates are counting
- Compose locks are enforced
- PCs currently in scene (front-stage in UI)

### Completed (Archived)

- No active PCs in scene (moved to log/history view)
- Read-only for players
- **GM retains full edit power:** can edit descriptions, details silently
- GM can reopen scene and add PCs back if needed
- Part of game log for historical reference

**Note:** "Completed" is the preferred term. Scenes are "not active" rather than permanently locked. GM flexibility is preserved.

### Campaign Pausing

To pause play, pause the **campaign** (not individual scenes):
- All scenes freeze simultaneously
- Time gates stop counting
- No new posts can be created
- GM inactivity checks continue
- GM can resume when ready

---

## Character Presence

### Present in Scene

- Can see new posts as they're created
- Included in witness lists by default
- Can acquire compose lock (for their character)
- Subject to pass requirements (per-character)
- Receives post notifications

### Arriving

- Added by GM to scene during GM Phase
- First witnessed post is their "entry" (usually GM description)
- Cannot see history before arrival
- Immediately becomes present after entry post

### Departed

- Removed by GM from scene during GM Phase
- Can no longer see new posts
- Previous witnessed posts remain visible in log
- Can be re-added later (treated as new arrival)

### Character Movement Constraints

- Characters can only be in **one scene at a time**
- Movement only happens during GM Phase
- Characters cannot leave mid-PC Phase
- GM moves characters based on narrative actions

### Multi-Character Users

If a user controls multiple characters:
- Each character has independent scene presence
- Each character has independent pass state
- User sees dropdown to select which character is posting
- Each character has their own witness history

### Character Removal (User Leaves Campaign)

When a character's owner is removed from a campaign:
- CharacterAssignment is deleted (character becomes orphaned)
- Submitted posts remain immutable and visible to witnesses
- Unsubmitted drafts (server-persisted) are deleted
- GM can reassign orphaned character to another player or write them out
- Game log preserves character's contribution
- **Orphaned characters don't count toward "all characters passed" check**

### Character Archival

GM can archive characters that are no longer active in the story:

| Viewer | Archived Character Visibility |
|--------|------------------------------|
| Player | Invisible (not shown in their character lists) |
| GM | Visible but greyed out in assignment window |

**Behavior:**
- Archived characters cannot be added to scenes
- GM can un-archive at any time
- All posts from archived characters remain accessible
- Useful for characters who have left the story but may return

### Character Immutability

Characters **cannot be deleted** - only archived or orphaned:
- Characters are permanent relationship records linking posts to the game history
- This design preserves post relationships and complete game history
- Display names are always resolved via the character record (no denormalization needed)
