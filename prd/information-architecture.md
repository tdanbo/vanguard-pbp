# Information Architecture

How information flows and who can see what.

## Visibility Matrix

| Content | Player (own scene) | Player (other scene) | GM |
|---------|-------------------|---------------------|-----|
| Scene exists | Yes | No (with fog) | Yes |
| History before arrival | No (with fog) | No | Yes |
| Content while present | Yes | No | Yes |
| Character locations | No (with fog) | No | Yes |
| Hidden turns | Own only | No | Yes |
| All rolls | Yes | No | Yes |
| Other players' pass status | Yes | No | Yes |
| Time gate remaining | Yes | No | Yes |
| User identity behind character | No | No | Yes |

---

## GM Role

The GM is the omniscient narrator and information broker.

### Visibility

- Sees all scenes simultaneously
- Sees all hidden turns
- Sees all roll results
- Sees all player locations
- Full campaign history access
- Sees mapping of user_id → character (for administration)

### Capabilities

- Create scenes with descriptions
- Add/remove players from scenes
- Move players between scenes
- Override compose locks
- Request rolls from players
- Archive completed scenes
- Delete scenes (frees storage)
- Moderate content (edit/delete turns)
- Claim/transfer GM role

### Responsibilities

- Write resolution posts that weave player turns together
- Decide what information to reveal and when
- Write entry snapshots for late arrivals (what they see when they enter)
- Keep the story moving
- Handle disputes and moderation

### Resolution Posts

When the player window closes, the GM writes resolutions for **all scenes** that:
1. Acknowledge player turns
2. Incorporate roll results
3. Advance the narrative
4. Set up the next beat
5. Open new player window (campaign-wide)

---

## GM Moderation Tools

### Content Editing Authority

- **GM can edit any turn** at any point (before/after lock, before/after resolution)
- **GM can delete any turn** at any point

### Intended Use

- Content cleanup (offensive language, typos, mistakes)
- **NOT for changing gameplay outcomes** or results
- Safety valve for accidental submissions

### Edit Visibility

- **Small edit indicator:** "Edited by GM" badge on affected turn
- **No audit trail visible** to players
- **No version history** or original text shown
- Just enough to signal "this was modified"

### Not Available

- Editing roll results after execution
- Changing witness lists retroactively
- Hiding the edit indicator

---

## Game Log

The game log is a persistent record of all scenes and turns, filtered by witness visibility.

### Player View

- Shows only scenes where the player has witnessed turns
- Within each scene, shows only turns the player witnessed
- Essentially a personal history of the character's journey
- Can be exported as a narrative document (future feature)

### GM View

- Complete visibility of all scenes
- All turns including hidden turns
- Full campaign history for reference and continuity
- Useful for recaps and maintaining consistency

### Log Features

- Scene list view → click into scene for turns
- Infinite scroll, recent-first
- "Jump to most recent" button for long histories
- Character filter (show only specific character's turns)

### Bookmarks

- Unified bookmark system for characters and turns
- Custom labels on bookmarks (e.g., "Plot twist", "Clue found")
- Bookmark visibility follows campaign strictness settings
- Personal to each player—not shared

### Scene Limits

- No hard limit on active scenes
- Naturally limited by character count (each character can only be in one scene)
- Scenes auto-archive immediately when empty (all characters departed)
- Archived scenes remain in game log
- GM can delete scenes to free storage (500 MB per-campaign limit)

---

## Scene States

### Active

- Turn cycle is running
- Players can post and pass
- Time gates are counting
- Compose locks are enforced

### Paused

- Turn cycle frozen
- No new actions can be posted
- Used for breaks, GM absence, or narrative holds
- Players notified of pause
- Time gate paused

### Archived

- Scene is concluded
- Read-only access
- Part of game log
- Cannot be reactivated (new scene needed to revisit location)

---

## Character Presence

### Present in Scene

- Can see new turns as they're posted
- Included in witness lists
- Can acquire compose lock
- Subject to pass requirements
- Receives turn notifications

### Arriving

- Added by GM to scene at turn boundary
- First witnessed turn is their "entry" (usually GM description)
- Cannot see history before arrival
- Immediately becomes present after entry turn

### Departed

- Removed by GM from scene at turn boundary
- Can no longer see new turns
- Previous witnessed turns remain visible in log
- Can be re-added later (treated as new arrival)

### Player Locked in Scene

- Players cannot leave mid-turn
- At turn boundary, player can choose to leave
- If last player leaves, scene auto-archives immediately

### Player Removal Mid-Campaign

When a player is removed from a campaign entirely:
- Submitted turns remain immutable and visible to witnesses
- Unsubmitted drafts are discarded (local-only, never reached server)
- Character can be reassigned to another player by GM
- Game log preserves character's contribution
