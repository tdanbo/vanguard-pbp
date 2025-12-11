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
- No revocation—GM removes player and generates new link if needed

---

## Players

Players are represented within a campaign by their character identity.

**Properties:**
- **Display name:** Character or player name visible to others
- **Avatar image:** Visual identifier in scene views and action feeds
- **Role:** GM or Player

**Notes:**
- A user can be a player in multiple campaigns
- A user can be a GM in some campaigns and a player in others
- Player identity is per-campaign (same user could have different names in different games)

**Orphaned Characters:**
- If a user deletes their account, their character remains in the campaign
- Character retains display name, avatar, and all submitted actions
- GM can reassign an orphaned character to a new player
- Game history is preserved regardless of account status

---

## Scenes

Scenes are the fundamental organizing unit, representing a location or situation where play is happening.

**Properties:**
- **Title:** Scene identifier (e.g., "The Tavern", "Forest Ambush")
- **Description:** Opening narrative setting the scene
- **Time gate:** Duration of player window before turn auto-passes
- **Present characters:** Dynamic list—characters can enter/leave
- **Status:** Active, paused, or archived

**Behaviors:**
- Multiple scenes can run in parallel (split party, separate locations)
- Characters can move between scenes, potentially creating new ones
- GM controls scene creation and character placement
- Each scene has independent pacing based on narrative needs
- When a player is added to a scene, they become active in that scene when the next turn starts

**Scene Lifecycle:**
1. GM creates scene with description and initial characters
2. Scene runs through turn cycles (player windows → GM resolution)
3. Characters enter/leave as narrative dictates
4. GM archives scene when concluded

---

## Turns

A turn is a single character's complete submission in a round. Turns are the atomic unit of play.

**Properties:**
- **Author:** The player or GM who posted
- **Content:** Structured blocks (Action, Dialog) composed via UI
- **Timestamp:** When the turn was submitted
- **Witness list:** Players present in the scene when the turn was posted
- **Hidden flag:** Whether the turn is visible only to GM
- **Intention:** Optional mechanical intent (e.g., Intimidation, Stealth)
- **Roll results:** If intention was set, the dice result

### Turn Composition

Turns are composed using dedicated UI components, not markdown or text parsing. The structure is enforced at the UI layer.

**Block Types:**
- **Action** - What the character does (movement, observations, physical actions)
- **Dialog** - What the character says out loud
- **Intention** - The mechanical framing for the entire turn (optional, one per turn)

**Composition Rules:**
- A turn can contain multiple Action blocks (chained movements/observations)
- A turn can contain multiple Dialog blocks (back-and-forth dialogue)
- A turn can contain at most one Intention (applies globally to all blocks)
- **Constraint:** At least one Action or Dialog block must exist

**Example Turn:**
```
Action: "I move toward the door"
Dialog: "Get out of my way!"
Action: "I push through"
Intention: Intimidate
```

**Empty Blocks:**
- Dialog blocks can be submitted with only speech, no description
- Action blocks can be submitted with intention but minimal description
- UI prevents completely empty submissions

**Content Validation:**
- UI blocks invalid inputs (greyed-out submit button)
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
- No inline images in turn content
- Scene headers and handout links are GM-managed only
- Block structure enforced by UI, not text parsing

**Immutability:**
- Turns can be edited until the next turn is posted
- Once witnessed by another turn, the turn is locked
- This prevents retroactive changes after others have responded

---

## Witness System

The witness concept is the foundation of both visibility and immutability.

### Core Principle

Every turn carries a witness list: the players who were present in the scene when it was posted. This determines:

- **Visibility:** You can only see turns you witnessed
- **Immutability:** Your turn locks when the next turn is posted (it has been witnessed)

### How It Works

When a turn is posted:
1. System captures the current "present characters" list for the scene
2. This list becomes the turn's witness list
3. Only players on that list can ever see that turn
4. The previous turn (if any) becomes immutable

### Implications

- **Scene visibility is emergent:** A scene exists for you if you've witnessed at least one turn in it
- **Late arrivals see nothing before entry:** The GM's entry description is their first witness event
- **Hidden turns:** Have a witness list of only [author, GM]
- **No retroactive access:** If you weren't there, you can never see it (unless GM reveals in narrative)

### Example

```
Scene: Upstairs Room
Present: [Garrett, GM]

Turn 1: GM describes the dusty room
  Witnesses: [Garrett, GM]

Turn 2: Garrett searches the desk, finds a letter
  Witnesses: [Garrett, GM]

-- Thorne enters the scene --
Present: [Garrett, Thorne, GM]

Turn 3: GM describes Thorne entering
  Witnesses: [Garrett, Thorne, GM]

Turn 4: Garrett hides the letter and greets Thorne
  Witnesses: [Garrett, Thorne, GM]
```

**Result:** Thorne can see turns 3 and 4. Turns 1 and 2 are invisible to Thorne—they literally don't exist in Thorne's view of the scene. Thorne must ask Garrett what happened if they want to know.
