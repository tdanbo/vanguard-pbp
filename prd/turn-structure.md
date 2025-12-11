# Turn Structure

Play alternates between player windows and GM resolution. **All scenes in a campaign sync globally at turn boundaries.**

## Turn Flow

```
┌─────────────────────────────────────────────────────────────┐
│  1. Turn N window opens across ALL scenes simultaneously    │
│                         ↓                                   │
│  2. Players in ALL scenes post turns (compose locking)      │
│                         ↓                                   │
│  3. Players select intentions for rolls as needed           │
│                         ↓                                   │
│  4. Players pass when satisfied with their contribution     │
│                         ↓                                   │
│  5. All windows close (all passed OR timer expires)         │
│                         ↓                                   │
│  6. Rolls resolve across all scenes                         │
│                         ↓                                   │
│  7. GM resolves ALL scenes together in one batch            │
│                         ↓                                   │
│  8. Turn N+1 window opens across ALL scenes                 │
│                         ↓                                   │
│  [Repeat from step 1]                                       │
└─────────────────────────────────────────────────────────────┘
```

## Global Turn Synchronization

All scenes in a campaign operate on a unified turn counter, not independent timers.

### Key Properties

- **Campaign-wide turns:** Turn counter is global, not per-scene
- **Simultaneous windows:** All scenes open and close player windows together
- **Batch resolution:** GM resolves all ready scenes before any new window opens
- **Group dependency:** Players in Scene A wait for players in Scene B at the same turn boundary

### Implications

- Parallel narrative threads remain synchronized
- Scene A's window cannot open while Scene B is unresolved
- Players experience a unified turn rhythm across the entire campaign
- Prevents cross-scene timing exploits

---

## Sequential Composing

To maintain action ordering and prevent race conditions, composing is sequential within each scene.

### Compose Lock Behavior

- Player clicks "Take Turn" button to explicitly acquire the compose lock
- UI shows who currently has the turn (name and avatar)
- No other player can acquire lock while held
- Lock releases when the player submits their action
- The submitted action is immediately witnessed by all present players

### Lock Timeout

- Timer starts on lock acquisition
- Keystrokes reset the inactivity timer
- Visual drain bar appears in final minute of timeout
- After timeout, lock releases automatically
- Draft persists locally—player can reacquire and continue

### Lock Acquisition

- Server arbitrates all lock requests
- First request wins; subsequent requests queue or fail gracefully
- UI shows loading state while acquiring lock
- On conflict, losing request receives immediate feedback

### Network Disconnection

- Client sends periodic heartbeats while holding lock
- Missed heartbeats (e.g., 3 consecutive) trigger automatic lock release
- Disconnected player's draft remains local; they can reacquire lock on reconnect
- Other players see turn indicator update when lock releases

### Multi-Device Behavior

- Drafts live locally per device (not synced)
- Lock is per-session—same user on different devices competes for lock
- Visual drain bar shows remaining lock time
- GM can force-release any lock to keep game moving

### GM Lock Priority

The GM can bypass or override the compose lock when necessary for pacing or moderation purposes.

### Scope

The compose lock is **per-scene, not global**. Players can compose in different scenes simultaneously. A player in two active scenes can write in both without conflict.

---

## Pass Mechanics

Passing signals readiness to move on to GM resolution.

### Pass Types

Both options are visible in the scene interface:

- **Pass:** "I'm satisfied with my contribution to this beat"
- **Hard pass:** "Skip me for this window—don't wait for me"

**Hard Pass Behavior:**
- Lasts for current window only
- Player automatically re-engaged when next turn starts
- No manual re-engagement needed

### Window Closure

The player window closes when:
- All present players have passed, OR
- The time gate expires (auto-pass for everyone)

This allows fast groups to move quickly while protecting async players with guaranteed windows.

### Pass State Reset

When the GM posts a resolution and opens a new player window:
- All pass states reset (including hard pass)
- All present players start fresh with no pass
- Newly added players (joined at turn boundary) start without a pass

---

## Intention and Rolls

Players can attach mechanical intention to their turns. The system is **intent-based**, not freeform dice notation.

### Design Principles

- **No direct dice notation input:** Players cannot write arbitrary notation like "2d6+4"
- **Intent-based selection:** Players choose from predefined intentions
- **Automated rolling:** Each intention triggers a predefined roll when the turn is submitted
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
- **Max dice per type:** 100 (e.g., 100d20+50 is valid, 101d20 is rejected)
- **Modifier source:** Player inputs modifier in the dice roller UI when composing turn

### Player-Initiated Intention

1. Player composes turn narrative (Action/Dialog blocks)
2. Player selects intention from the campaign's intention list (optional)
3. Player enters modifier in UI (e.g., +5 for skill bonus)
4. Roll executes automatically when turn is submitted
5. Result logged: dice result + modifier + final total
6. GM receives narrative + result for resolution

**Example:**
```
Turn: "I lean in close, letting the firelight catch my
      scarred face. 'You don't want to lie to me.'"
Intention: Intimidation (selected from list)
Modifier: +7 (entered by player)
Roll: 1d20 + 7 = 18
```

### GM-Requested Rolls

1. GM observes a player turn that needs a check
2. GM requests specific roll from player (e.g., "Roll perception")
3. Player receives notification
4. **Timeout handling:** If player doesn't respond within configurable timeout, system auto-rolls with zero modifier
5. Result factored into GM resolution

### GM Override

- GM can swap the intention if they disagree with player's choice
- GM can request a different roll type
- Original roll preserved in log, override noted

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

## Turn State Machine

The campaign maintains a global turn state (all scenes share the same state):

```
┌────────────┐
│  GM_TURN   │ ←──────────────────────────┐
└─────┬──────┘                            │
      │ GM posts resolution (all scenes)  │
      ↓                                   │
┌────────────┐                            │
│  PLAYER    │                            │
│  WINDOW    │                            │
└─────┬──────┘                            │
      │ All passed OR timer expires       │
      ↓                                   │
┌────────────┐                            │
│  RESOLVING │ ───────────────────────────┘
└────────────┘   Rolls complete, GM notified
```

**States:**
- `GM_TURN` - Waiting for GM to post resolutions across all scenes
- `PLAYER_WINDOW` - Players can post turns and pass in all scenes
- `RESOLVING` - Processing rolls across all scenes, preparing for GM

### State Constraints

- **Player posting during GM_TURN:** UI is locked with visual indicator; server rejects any turn submissions
- **Archiving with pending rolls:** Not possible—campaign cannot transition to `GM_TURN` until all rolls in `RESOLVING` state complete
- **Scene membership changes:** Only occur at turn boundaries (during `GM_TURN`), never mid-window
- **Player locked in scene:** Players cannot leave a scene mid-turn; at turn boundary they can choose to leave
- **Empty scene:** If all players leave at turn boundary, scene is auto-archived immediately

---

## GM Inactivity

If the GM becomes unresponsive, the campaign can continue.

### Detection

- Configurable inactivity threshold per campaign (e.g., 7 days, 14 days)
- Threshold measured from last GM action in any scene
- Players notified when threshold approaches

### Role Transfer

- **Voluntary:** GM can transfer ownership to any player at any time
- **Abandonment:** After threshold expires, GM role becomes claimable
- First player to claim becomes new GM (first-come-first-served)
- Original GM demoted to player if they return
- Campaign settings preserved through transfer

### GM Account Deletion

If the GM deletes their account while the campaign is active:

1. Campaign enters **paused state** (all timers frozen)
2. GM slot becomes **available on first-come-first-served basis**
3. New GM takes seat and can **resume campaign** when ready
4. No data loss—community retains control of campaign
