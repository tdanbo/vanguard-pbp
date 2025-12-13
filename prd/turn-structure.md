# Phase Structure

Play alternates between **PC Phase** (player posts) and **GM Phase** (GM resolution). **All scenes in a campaign sync globally at phase boundaries.**

## Phase Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        PC PHASE                             │
│  1. PC Phase opens across ALL scenes simultaneously         │
│                         ↓                                   │
│  2. Players create posts (compose locking per scene)        │
│                         ↓                                   │
│  3. Players select intentions for rolls as needed           │
│                         ↓                                   │
│  4. GM monitors and can request rolls on player posts       │
│                         ↓                                   │
│  5. Characters pass when satisfied (per-character)          │
│                         ↓                                   │
│  6. PC Phase ends (all characters passed OR timer expires)  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                        GM PHASE                             │
│  7. GM resolves any unresolved rolls manually               │
│                         ↓                                   │
│  8. GM reviews and responds to each scene (messenger-style) │
│                         ↓                                   │
│  9. GM moves characters between scenes as narrative dictates│
│                         ↓                                   │
│  10. GM clicks "Move to PC Phase" → Next cycle begins       │
└─────────────────────────────────────────────────────────────┘
```

## Global Phase Synchronization

All scenes in a campaign operate on a unified phase cycle, not independent timers.

### Key Properties

- **Campaign-wide phases:** Phase state (`pc_phase` / `gm_phase`) is global, not per-scene
- **Simultaneous phases:** All scenes enter PC Phase and GM Phase together
- **Batch resolution:** GM reviews all scenes before transitioning back to PC Phase
- **Single character per scene:** Each character can only be in one scene at a time

### Implications

- Parallel narrative threads remain synchronized
- All scenes transition together at phase boundaries
- Players experience a unified rhythm across the entire campaign
- Character movement between scenes happens only during GM Phase

---

## Sequential Composing

To maintain action ordering and prevent race conditions, composing is sequential within each scene.

### Compose Lock Behavior

- Player clicks "Take Post" button to explicitly acquire the compose lock
- UI shows who currently has the lock (name and avatar)
- No other player can acquire lock while held
- Lock releases when the player submits their post
- The submitted post is immediately visible to all witnesses

### Lock Timeout

**Fixed at 10 minutes.** This is not configurable per-campaign.

- Timer starts on lock acquisition
- Keystrokes reset the inactivity timer (heartbeat)
- Visual drain bar appears in final minute of timeout
- After 10 minutes of inactivity, lock releases automatically
- Draft persists server-side—player can reacquire lock and continue

### Lock Acquisition

- Server arbitrates all lock requests
- First request wins; subsequent requests queue or fail gracefully
- UI shows loading state while acquiring lock
- On conflict, losing request receives immediate feedback

### Network Disconnection

- Client sends periodic heartbeats while holding lock
- Missed heartbeats (e.g., 3 consecutive) trigger automatic lock release
- Disconnected player's draft remains server-side; they can reacquire lock on reconnect
- Other players see compose indicator update when lock releases

### Multi-Device Behavior

- Drafts are server-persisted and sync across tabs/devices (same database entry)
- Lock is per-character—same user on different devices competes for lock
- Visual drain bar shows remaining lock time
- GM can force-release any lock to keep game moving

### GM Lock Priority

The GM can bypass or override the compose lock when necessary for pacing or moderation purposes.

### Scope

The compose lock is **per-character per-scene**. A user must acquire a lock for a specific character to post as them. If a user controls multiple characters:
- They must acquire a separate lock for each character they want to post as
- Lock releases on post submission
- They can then acquire a lock for another character

Players can compose in different scenes simultaneously. A player in two active scenes can write in both without conflict.

---

## Pass Mechanics

Passing signals readiness to move on to GM Phase. **Pass is per-character, not per-user.**

### Pass Types

Both options are visible in the scene interface (per character):

- **Pass:** "I'm satisfied with my contribution for now"
  - Can be undone anytime (click avatar again)
  - **Auto-clears** if another character posts in the scene (character-based, not user-based)
  - Player is notified and can respond or pass again
  - Note: If User A controls both Character X and Y, and X passes, then A posts as Y, X's pass auto-clears

- **Pass (Hard):** "I'm stepping away—don't involve me further"
  - Can be undone manually (click avatar again)
  - Does **NOT** auto-clear if another player posts
  - Player receives **NO** notification of new activity
  - Useful for: "I need to sleep/work—don't drag me back in"

### Multi-Character Pass

If a user controls multiple characters in the same scene:
- Each character has its own pass button
- User must pass for **each character separately**
- UI shows pass state indicator on each character's avatar

### Phase Transition

The PC Phase can end when:
- All characters in all scenes have passed (regular or hard), OR
- The time gate expires (all remaining characters auto-passed)

**Roll Blocking:** Characters with pending roll requests cannot pass (regular or hard) until the roll is completed. Roll requests block both pass types.

**Orphaned Characters:** Characters without a user assignment (orphaned) don't count toward "all characters passed" check and won't block phase transition.

### Pass State Reset

When the GM transitions to a new PC Phase:
- All pass states reset (including hard pass)
- All characters start fresh with no pass
- Newly placed characters start without a pass

---

## Posting Rules

There are no limits on how many posts a character can make per phase.

- Users can post as the same character multiple times in a row
- Users can post A → B → A again if they control multiple characters
- Only constraint is the compose lock (one post at a time per scene)
- Previous post locks when new post is created

---

## Intention and Rolls

Players can attach mechanical intention to their posts. The system is **intent-based**, not freeform dice notation.

### Design Principles

- **No direct dice notation input:** Players cannot write arbitrary notation like "2d6+4"
- **Intent-based selection:** Players choose from predefined intentions
- **Automated rolling:** Each intention triggers a predefined roll when the post is submitted
- **System agnostic:** Roll output is mechanical only—interpretation left to GM and players

### System Presets

Each campaign configures a system preset that defines:
- **Intention list:** Available skills/actions (e.g., "Stealth", "Persuasion", "Attack")
- **Dice type:** What die is rolled for checks (from preset)

Presets can be customized per-campaign. Common presets provided for popular systems.

### Supported Dice

D&D 5e reference set (expandable for other systems):
- d4, d6, d8, d10, d12, d20, d100

### Modifier and Dice Limits

- **Max modifier:** ±100
- **Dice count:** Player-configurable per roll (1-100 dice)
- **Max dice per type:** 100 (e.g., 100d20+50 is valid, 101d20 is rejected)
- **Modifier source:** Player inputs modifier in the dice roller UI when composing post
- **Dice count source:** Player inputs count in UI (e.g., "Roll 3d6" or "Roll 2d20")

### Player-Initiated Intention

1. Player composes post narrative (Action/Dialog blocks)
2. Player selects intention from the campaign's intention list (optional)
3. Player enters modifier in UI (e.g., +5 for skill bonus)
4. Roll executes automatically when post is submitted
5. Result logged: dice result + modifier + final total
6. GM receives narrative + result for resolution

**Example:**
```
Post: "I lean in close, letting the firelight catch my
      scarred face. 'You don't want to lie to me.'"
Intention: Intimidation (selected from list)
Modifier: +7 (entered by player)
Roll: 1d20 + 7 = 18
```

### GM-Requested Rolls

1. GM observes a player post that needs a check (during PC Phase)
2. GM requests specific roll from player (e.g., "Roll perception")
3. Player receives notification, pass state is cleared
4. Player clicks dice component on their post to roll
5. Result recorded for GM resolution

**No Auto-Roll:** If the time gate expires before the player rolls:
- Player is locked out (cannot post or roll)
- Roll remains unresolved
- GM must manually resolve before transitioning to PC Phase

### GM Roll Cleanup

Before the GM can click "Move to PC Phase":
- All rolls must be resolved
- Button is **grayed out** if unresolved rolls exist
- For each unresolved roll (including from hard-passed players), GM can:
  - Click the intent button on the post (shows "requested roll" indicator)
  - Add/change the intent on the player's post
  - Execute the roll on behalf of the player (same dice interface)
  - Submit the result (attaches to post like player-resolved rolls)
- Once all rolls are resolved, transition button becomes active

**Hard-Passed Players:** GM resolves rolls for hard-passed players the same way—no player involvement needed. The GM clicks intent → rolls → submits on their behalf.

### GM Override

- GM can swap the intention if they disagree with player's choice
- GM can request a different roll type
- When GM overrides intention:
  - Post.intention is updated to the new value
  - Roll records `wasOverridden: true` and `originalIntention` for history
  - **Player receives notification:** "GM has overridden your intention to [new intent]"
- Original intention preserved in roll history for reference

### Roll Execution

- **Server-side only:** All rolls execute on the server
- **No client-side randomness:** Prevents manipulation
- **Audit trail:** All rolls logged with timestamp and context
- **Output:** Dice result + modifier + final total (no success/failure determination)

### Success and Failure

The system is **mechanical only**:
- Rolls output numbers, not outcomes
- Game rule interpretation is left to GM and players
- No automatic success/failure thresholds
- System remains fully game-system agnostic

---

## Phase State Machine

The campaign maintains a global phase state (all scenes share the same state):

```
┌────────────┐
│  GM_PHASE  │ ←──────────────────────────┐
└─────┬──────┘                            │
      │ GM resolves rolls, posts,         │
      │ moves characters, clicks          │
      │ "Move to PC Phase"                │
      ↓                                   │
┌────────────┐                            │
│  PC_PHASE  │                            │
└─────┬──────┘                            │
      │ All characters passed OR          │
      │ timer expires                     │
      ↓                                   │
      └───────────────────────────────────┘
```

**States:**
- `gm_phase` - GM is reviewing scenes, resolving rolls, posting responses, moving characters
- `pc_phase` - Players can create posts and pass in all scenes (per-character)

### State Constraints

- **Player posting during GM_PHASE:** UI is locked with visual indicator; server rejects post submissions
- **Phase transition with pending rolls:** Not possible—GM cannot transition to PC Phase until all rolls are resolved
- **Character movement:** Only occurs during GM Phase, never during PC Phase
- **Character locked in scene:** Characters cannot leave a scene during PC Phase; GM moves them during GM Phase
- **Empty scene:** If all characters leave during GM Phase, GM can archive the scene

---

## Time Gate Expiration

When the time gate expires during PC Phase:

### What Happens

1. Phase enters "expired" state (no auto-transition)
2. All characters who haven't passed are auto-passed
3. Players see: **"Phase expired. Waiting for GM to transition."**
4. Players cannot post but can read existing posts
5. GM sees: **"Phase transition available"** button (if all rolls resolved)
6. GM clicks button to manually transition to GM Phase

### No Auto-Transition

The system does **not** automatically transition phases. The GM must explicitly click the transition button. This ensures the GM has reviewed all scenes before moving forward.

### If GM Doesn't Return

If the GM doesn't log in after the phase expires:
- Players wait with clear messaging about the situation
- The 30-day inactivity threshold protects players
- After 30 days of no GM posts, any player can claim the GM seat
- New GM can transition the phase and continue the campaign

---

## GM Inactivity

If the GM becomes unresponsive, the campaign can continue.

### Detection

**Fixed at 30 days.** This is not configurable per-campaign.

- Campaign tracks `lastGmActivityAt` timestamp
- **Only GM posting counts as activity** (narrative posts, NPC posts)
- Phase transitions, editing settings, moving characters, and resolving rolls do NOT count
- Players notified as threshold approaches (e.g., 7 days, 3 days, 1 day warning)

**Rationale:** In play-by-post, activity IS posting. A GM who doesn't post isn't actively running the game.

### Role Transfer

- **Voluntary:** GM can transfer ownership to any player at any time
- **Abandonment:** After 30 days of inactivity, GM role becomes claimable
- First player to claim becomes new GM (first-come-first-served)
- Original GM demoted to player if they return
- Campaign settings preserved through transfer

### GM Account Deletion

If the GM deletes their account while the campaign is active:

1. Campaign enters **paused state** (all timers frozen)
2. GM slot becomes **available on first-come-first-served basis**
3. New GM takes seat and can **resume campaign** when ready
4. No data loss—community retains control of campaign
