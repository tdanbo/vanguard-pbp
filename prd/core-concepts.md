# Core Concepts

## Campaigns

A campaign is the top-level container representing a single game or story.

**Properties:**
- Unique identifier
- Title and description
- Owner (GM)
- Player roster
- Campaign settings (time gates, fog of war, etc.)
- Collection of scenes

**Behaviors:**
- GM creates a campaign and receives a shareable invitation link
- Players join via invitation link
- GM can add or remove players at any time
- GM is responsible for moderation
- Campaign contains multiple scenes running in parallel or sequence
- Maximum 50 players per campaign

**Invitation Links:**
- 24-hour expiration
- One-time use (consumed on join)
- GM can generate multiple links and view their status (active, used, expired, revoked)
- GM can revoke any link before it's used

---

## Players & Characters

Players are **users** who participate in campaigns. Characters are the **in-game identities** they control.

### Campaign Members

**Properties:**
- **User ID:** Links to the user's account
- **Role:** GM or Player
- **Joined At:** When they joined the campaign

**Notes:**
- A user can be a member of multiple campaigns
- A user can be a GM in some campaigns and a player in others

### Characters

Characters are **campaign-owned entities**. Assignment to users is handled separately.

**Properties:**
- **Display name:** Character name visible to others
- **Description:** Character description
- **Avatar image:** Visual identifier in scene views and post feeds
- **Character type:** `pc` or `npc` (determines UI presentation only)

**Character Assignment:**
- GM creates characters and assigns them to users
- One user can control multiple characters in the same campaign
- Assignment is tracked via CharacterAssignment (separate from Character)
- If a user has multiple characters in the same scene, UI shows a dropdown to select who they're posting as

**Character Types:**
- **PC (Player Character):** Assigned to players, appears in player-facing interfaces
- **NPC (Non-Player Character):** Controlled by GM, appears in GM interfaces
- GM can promote/demote between PC and NPC via edit modal (GM Phase only)
- Type only affects UI presentation—both types work identically in the system
- Type changes don't retroactively update witness lists (historical records preserved)

**Character Archival:**
- GM can archive characters that are no longer active in the story
- Archived characters: visible to GM (greyed out), invisible to players
- Archived characters cannot be added to scenes
- GM can un-archive at any time
- All posts from archived characters remain accessible

**Character Immutability:**
- Characters **cannot be deleted** - they are permanent relationship records
- Characters can only be archived (hidden) or orphaned (user left)
- This design preserves post relationships and complete game history
- Display names are always resolved via the character record

**Key Constraints:**
- A character can only be in **one scene at a time**
- Pass state is **per-character per-scene**, not per-user (stored in `Scene.passStates`)

**Orphaned Characters:**
- If a user leaves or is removed, their character assignments are deleted
- Characters retain display name, avatar, and all submitted posts
- GM can reassign orphaned characters to other players or write them out
- Game history is preserved regardless of account status
- **Orphaned characters don't count toward "all characters passed" check** (won't block phase transition)
- When re-assigned and re-added to a scene, they see all posts they previously witnessed

---

## Scenes

Scenes are the fundamental organizing unit, representing a location or situation where play is happening.

**Properties:**
- **Title:** Scene identifier (e.g., "The Tavern", "Forest Ambush")
- **Description:** Opening narrative setting the scene (GM can update mid-scene)
- **Header Image:** Optional 16:9 image (GM-uploaded)
- **Characters:** List of character IDs currently in this scene (PCs + NPCs)
- **Status:** Active or archived

**Behaviors:**
- Multiple scenes can run in parallel (split party, separate locations)
- Characters can move between scenes (GM-initiated during GM Phase)
- GM controls scene creation and character placement
- All scenes share the same phase cycle (PC Phase / GM Phase)

**Note:** Campaigns can be paused, but scenes cannot. When a campaign is paused, the time gate freezes across all scenes.

**Character Presence:**
- A character can only be in **one scene at a time**
- Scene's `characters` array determines who is present
- Movement between scenes happens during GM Phase only
- When a character enters a scene, they witness the GM's entry description

**Scene Limits:**
- Hard limit: **25 scenes per campaign**
- Warnings at 20, 23, 24 scenes
- When creating 26th scene, oldest archived scene is auto-deleted
- GM can manually archive/delete scenes to free space

**Scene Lifecycle:**
1. GM creates scene with description and places characters
2. Scene runs through phase cycles (PC Phase → GM Phase)
3. Characters enter/leave as narrative dictates (GM Phase only)
4. GM archives scene when concluded

---

## Posts

A post is a single character's complete submission during a PC Phase (or GM during GM Phase). Posts are the atomic unit of play.

**Properties:**
- **Character:** The character who posted (selected via dropdown if user has multiple), or null for Narrator
- **User ID:** The user who created the post
- **Content:** Structured blocks (Action, Dialog) composed via UI
- **OOC Text:** Optional out-of-character notes (visibility per campaign setting)
- **Witnesses:** Character IDs who can see this post
- **Hidden flag:** Whether the post is visible only to GM (no witnesses until unhidden)
- **Intention:** Optional mechanical intent (e.g., Intimidation, Stealth)
- **Roll results:** If intention was set, the dice result
- **Locked:** Whether the post is locked (becomes true when next post is created)

### GM Posting

The GM uses the same interface as players but with additional options:
- **Narrator:** GM can post as "Narrator" (characterId = null) for scene descriptions
- **Character:** GM can post as any NPC they control
- **Witness Selection:** GM can select which characters witness a post (default: all characters in scene—both PCs and NPCs)

### Post Composition

Posts are composed using dedicated UI components, not markdown or text parsing. The structure is enforced at the UI layer.

**Block Types:**
- **Action** - What the character does (movement, observations, physical actions)
- **Dialog** - What the character says out loud
- **Intention** - The mechanical framing for the entire post (optional, one per post)

**OOC (Out-of-Character):**
- OOC is **metadata on the post**, not a block type
- Separate input field in the compose UI
- Visibility controlled by campaign setting:
  - `All players` - Everyone in the scene sees OOC
  - `GM only` - Only GM and author see OOC (default)

**Composition Rules:**
- A post can contain multiple Action blocks (chained movements/observations)
- A post can contain multiple Dialog blocks (back-and-forth dialogue)
- A post can contain at most one Intention (applies globally to all blocks)
- A post can contain optional OOC text (separate from blocks)
- **Constraint:** At least one Action or Dialog block must exist

**Example Post:**
```
Action: "I move toward the door"
Dialog: "Get out of my way!"
Action: "I push through"
Intention: Intimidate
OOC: "Hoping to get past without a fight"
```

**Posting Rules:**
- No limit on posts per character per phase
- Users can post as the same character multiple times in a row
- Only constraint is post locking (previous post locks when new post is created)

**Content Validation:**
- UI blocks invalid inputs (greyed-out submit button)
- Server-side validation mirrors frontend rules
- Cannot prevent gibberish text—GM has authority to delete/edit for cleanup
- See GM Moderation in Information Architecture

**Character Limits:**

| Preset | Limit | Use Case |
|--------|-------|----------|
| Concise | 1,000 | Quick exchanges, combat-heavy |
| Standard | 3,000 | Default—balanced narrative |
| Narrative | 6,000 | Story-focused, detailed posts |
| Epic | 10,000 | Long-form collaborative fiction |

**Restrictions:**
- No inline images in post content
- Scene headers and handout links are GM-managed only
- Block structure enforced by UI, not text parsing

**Post Locking:**
- Posts can be edited until the next post is created in the scene
- When a new post is created, the previous post becomes locked
- Locked posts cannot be edited (except by GM for moderation)
- When a post is deleted by GM, the previous post becomes unlocked

---

## Witness System

The witness concept is the foundation of visibility. **Witnessing is character-based and post-based.**

### Core Principle

Every post carries a witness list: the **characters** who can see that post. This determines:

- **Visibility:** A character can only see posts they witnessed
- **Locking:** A post locks when the next post is created (not based on witnesses)

### How It Works

When a post is created:
1. System captures the current "present characters" list for the scene (all PCs + NPCs in `Scene.characters`)
2. This list becomes the post's witness list
3. Only characters on that list can ever see that post
4. The previous post (if any) becomes locked

**Player Posting Options:**
- **Regular post:** All characters in scene become witnesses (default)
- **Hidden post:** No witnesses (GM only) - used for secret actions

**Players cannot select specific witnesses** - it's either all or none. This keeps the UI simple.

**GM Witness Control:**
- GM can select custom witnesses instead of "all characters in scene"
- GM can create hidden posts with no witnesses
- GM can unhide posts later, retroactively adding all present characters as witnesses
- GM uses `PATCH /api/posts/:id` with `{ witnesses: [...] }` to unhide

### Implications

- **Scene visibility is emergent:** A scene exists for a character if they've witnessed at least one post in it
- **Late arrivals see nothing before entry:** The GM's entry description is their first witness event
- **Hidden posts:** Have no witnesses until GM unhides them
- **No retroactive access:** If the character wasn't there, they can never see it (unless GM reveals in narrative)
- **Character-based, not user-based:** If a user has multiple characters, each character has their own witness history

### Example

```
Scene: Upstairs Room
Present Characters: [Garrett]

Post 1: GM (Narrator) describes the dusty room
  Witnesses: [Garrett]

Post 2: Garrett searches the desk, finds a letter
  Witnesses: [Garrett]

-- GM moves Thorne into the scene (during GM Phase) --
Present Characters: [Garrett, Thorne]

Post 3: GM (Narrator) describes Thorne entering
  Witnesses: [Garrett, Thorne]

Post 4: Garrett hides the letter and greets Thorne
  Witnesses: [Garrett, Thorne]
```

**Result:** Thorne's player can see posts 3 and 4. Posts 1 and 2 are invisible to Thorne—they literally don't exist in Thorne's view of the scene. Thorne must ask Garrett in-character what happened if they want to know.

**Multi-Character Note:** If a user controls both Garrett and Thorne, they would see different post histories when viewing as each character.
