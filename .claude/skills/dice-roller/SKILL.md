---
name: dice-roller
description: Intent-based dice rolling system for the Vanguard PBP platform. Use this skill when implementing or debugging dice rolls, the intention selection system, roll execution, GM override mechanics, roll status lifecycle, or roll-blocking behavior in phase transitions. Critical for player-initiated rolls, GM-requested rolls, and server-side roll validation.
---

# Dice Roller

## Overview

This skill provides patterns and implementation guidance for the Vanguard PBP dice rolling system, which uses intent-based rolling rather than freeform dice notation. The system is mechanical-only (no success/failure interpretation), server-side executed (no client randomness), and fully integrated with the phase state machine to prevent phase transitions when rolls are unresolved.

## Workflow: Roll Lifecycle

### 1. Intention Selection (Player-Initiated)

**When:** Player is composing a post and wants to attach a mechanical action.

**Process:**
1. Player composes narrative in post editor (Action/Dialog blocks)
2. Player selects intention from campaign's predefined intention list (e.g., "Stealth", "Persuasion", "Attack")
3. Player enters modifier in UI (range: ±100)
4. Player optionally adjusts dice count (1-100 dice per roll type)
5. Roll executes automatically on post submission

**Key Constraints:**
- No freeform dice notation (no "2d6+4" input)
- Intention list is campaign-specific (configured via system preset)
- Dice type determined by campaign's system preset
- Max modifier: ±100
- Max dice count per type: 100 (e.g., 100d20+50 valid, 101d20 rejected)

**Example:**
```typescript
interface PlayerRollRequest {
  postId: string;
  intention: string;           // Selected from campaign's intention list
  modifier: number;            // Player-entered, -100 to +100
  diceCount?: number;          // Optional, defaults to 1, max 100
  rollType: DiceType;          // From campaign preset (e.g., 'd20')
}

// Example submission:
{
  postId: "post_123",
  intention: "Intimidation",
  modifier: 7,
  diceCount: 1,
  rollType: "d20"
}
// Executes: 1d20 + 7 → Result: 18
```

**State After Submission:**
- Roll status: `pending` (awaiting server execution)
- Post locked (cannot edit until roll completes)
- Character cannot pass until roll resolves

### 2. GM-Requested Rolls

**When:** GM observes a player post that requires a check (during PC Phase).

**Process:**
1. GM clicks "Request Roll" on player's post
2. GM selects intention from campaign's intention list
3. System creates roll request attached to post
4. Player receives notification ("GM has requested [intention] roll")
5. Player's pass state auto-clears if previously passed
6. Player clicks dice component on their post to open roll UI
7. Player enters modifier and confirms
8. Roll executes server-side

**State Transitions:**
```
Post (no roll) → GM requests roll → Roll (pending)
                                      ↓
Player receives notification → Pass state cleared
                                      ↓
Player opens roll UI → Enters modifier → Submits
                                      ↓
Roll executes server-side → Roll (completed)
```

**Timeout Behavior:**
- If time gate expires before player rolls: Player locked out (cannot post or roll)
- Roll remains in `pending` state
- GM must manually resolve during GM Phase before transitioning back to PC Phase

**Key Constraints:**
- Roll requests block pass (both regular and hard pass)
- GM cannot transition to PC Phase while `pending` rolls exist
- Player cannot edit post while roll is `pending`

### 3. Server Execution

**When:** Roll is submitted (player-initiated or GM-requested).

**Server-Side Process:**
1. Validate roll request:
   - Modifier in range (-100 to +100)
   - Dice count in range (1-100)
   - Intention exists in campaign's intention list
   - Roll type matches campaign preset
2. Generate cryptographically secure random values
3. Calculate result: `(dice rolls) + modifier = total`
4. Create audit trail entry (timestamp, context, result)
5. Update roll status to `completed`
6. Unlock post for editing (if needed)
7. Notify witnesses in scene

**No Client-Side Randomness:**
- All dice rolls execute on server
- Client receives result only (no local computation)
- Prevents manipulation and ensures fairness

**Output Format:**
```typescript
interface RollResult {
  rollId: string;
  postId: string;
  intention: string;
  diceType: DiceType;
  diceCount: number;
  modifier: number;
  diceResults: number[];       // Individual die results
  total: number;               // Sum of dice + modifier
  wasOverridden: boolean;
  originalIntention?: string;  // If GM overrode
  timestamp: string;
  executedBy: 'player' | 'gm';
}

// Example:
{
  rollId: "roll_456",
  postId: "post_123",
  intention: "Intimidation",
  diceType: "d20",
  diceCount: 1,
  modifier: 7,
  diceResults: [11],
  total: 18,
  wasOverridden: false,
  timestamp: "2025-12-13T10:30:00Z",
  executedBy: "player"
}
```

**System Agnosticism:**
- Rolls output numbers only (no success/failure determination)
- No automatic interpretation of results
- GM and players interpret outcomes based on their game system

### 4. Result Display

**When:** Roll completes execution.

**UI Presentation:**
1. Dice result displayed inline with post (e.g., "1d20 + 7 = 18")
2. Individual die results shown on hover/expand (e.g., "[11] + 7 = 18")
3. Intention label shown (e.g., "Intimidation")
4. Override indicator if GM changed intention (e.g., "GM overrode to Intimidation")
5. Roll becomes part of post's permanent record

**Witness Visibility:**
- All witnesses in scene see roll results immediately
- Roll results are immutable (cannot be edited or deleted)
- Audit trail preserved for campaign history

## GM Override

**When:** GM disagrees with player's intention choice or needs to change roll type.

**Process:**
1. GM clicks "Override Intention" on player's post
2. GM selects new intention from campaign's intention list
3. System updates post intention
4. Roll record updated:
   - `wasOverridden: true`
   - `originalIntention: <player's choice>`
5. Player receives notification: "GM has overridden your intention to [new intent]"
6. If roll already executed, GM can invalidate and re-request

**State Transitions:**
```
Post (intention: Stealth) → GM overrides → Post (intention: Perception)
                                             ↓
Roll record preserves:     wasOverridden: true
                          originalIntention: "Stealth"
                                             ↓
Player notified of change
```

**Audit Trail:**
- Original intention preserved in roll history
- Override timestamp recorded
- GM identity logged
- Player notification logged

## Roll Status Lifecycle

### Status States

```typescript
type RollStatus = 'pending' | 'completed' | 'invalidated';

interface Roll {
  rollId: string;
  status: RollStatus;
  createdAt: string;
  completedAt?: string;
  invalidatedAt?: string;
  invalidatedBy?: 'gm' | 'system';
  invalidationReason?: string;
}
```

### State Transitions

```
pending → completed        // Normal flow (player or GM executes roll)
pending → invalidated      // GM cancels roll request
completed → invalidated    // GM invalidates result (rare, for corrections)
```

**Pending:**
- Roll requested but not yet executed
- Blocks character pass (both regular and hard)
- Blocks post editing
- Player can see roll UI to enter modifier and submit

**Completed:**
- Roll executed and result recorded
- Unblocks character pass
- Unblocks post editing (if applicable)
- Result is immutable (cannot be changed, only invalidated)

**Invalidated:**
- Roll cancelled or result voided
- Unblocks character pass
- Does not count toward phase transition checks
- Reason logged for audit trail

### Invalidation Scenarios

**GM Cancellation (Pending Roll):**
```typescript
// GM decides roll is not needed
invalidateRoll({
  rollId: "roll_789",
  invalidatedBy: "gm",
  invalidationReason: "Roll no longer needed"
});
// Result: Character can pass again, roll UI removed from post
```

**GM Correction (Completed Roll):**
```typescript
// GM realizes wrong intention was used
invalidateRoll({
  rollId: "roll_789",
  invalidatedBy: "gm",
  invalidationReason: "Incorrect intention, re-rolling"
});
// Result: Old result voided, new roll can be requested
```

**System Invalidation:**
- Character removed from campaign (orphaned)
- Post deleted by player (if allowed)
- Scene archived with unresolved rolls

## Roll-Blocking Behavior

### Pass Blocking

**Rule:** Characters with `pending` rolls cannot pass (regular or hard pass).

**Rationale:** Ensures all mechanical actions are resolved before phase transition.

**UI Behavior:**
```typescript
interface CharacterPassState {
  canPass: boolean;
  blockingReason?: string;
}

// Example:
{
  canPass: false,
  blockingReason: "You have pending roll requests"
}
```

**Visual Indicators:**
- Pass button disabled with tooltip: "Complete your rolls before passing"
- Roll indicator badge on character avatar (e.g., "1 pending roll")
- Dice icon on post with pending roll

### Phase Transition Blocking

**Rule:** GM cannot transition to PC Phase while any `pending` rolls exist in any scene.

**Enforcement:**
```typescript
interface PhaseTransitionGuard {
  canTransition: boolean;
  blockingRolls: Roll[];
  blockedScenes: string[];
}

// Example:
{
  canTransition: false,
  blockingRolls: [
    { rollId: "roll_123", postId: "post_456", sceneId: "scene_001" },
    { rollId: "roll_789", postId: "post_012", sceneId: "scene_002" }
  ],
  blockedScenes: ["scene_001", "scene_002"]
}
```

**GM UI Behavior:**
- "Move to PC Phase" button grayed out
- Tooltip: "Resolve all pending rolls before transitioning (2 rolls in 2 scenes)"
- Scene list shows which scenes have unresolved rolls
- GM can click through to resolve each roll

## GM Roll Cleanup (GM Phase)

**When:** GM Phase begins with unresolved rolls from PC Phase.

**Process:**
1. GM sees list of all `pending` rolls across all scenes
2. For each unresolved roll:
   - GM clicks dice component on player's post
   - GM reviews player's narrative and intended action
   - GM can change intention if needed (override)
   - GM enters modifier (or accepts player's modifier if already set)
   - GM executes roll on behalf of player
   - Result recorded with `executedBy: 'gm'`
3. Once all rolls resolved, "Move to PC Phase" button becomes active

**Hard-Passed Players:**
- GM resolves rolls for hard-passed players the same way
- No player involvement required
- Player NOT notified (they hard-passed to step away)
- Roll executed by GM with reasonable modifier interpretation

**Example Flow:**
```typescript
// Player hard-passed with pending roll
{
  characterId: "char_123",
  passType: "hard",
  pendingRolls: ["roll_456"]
}

// GM resolves during GM Phase:
executeRollAsGM({
  rollId: "roll_456",
  modifier: 5,              // GM's best judgment
  executedBy: "gm",
  note: "Resolved for hard-passed player"
});

// Result:
{
  rollId: "roll_456",
  status: "completed",
  total: 15,
  executedBy: "gm"
}
```

## Modifier Handling

### Input Validation

```typescript
interface ModifierValidation {
  isValid: boolean;
  error?: string;
}

function validateModifier(modifier: number): ModifierValidation {
  if (modifier < -100 || modifier > 100) {
    return {
      isValid: false,
      error: "Modifier must be between -100 and +100"
    };
  }
  return { isValid: true };
}
```

### UI Constraints

- Number input field with min/max constraints (-100 to +100)
- Client-side validation before submission
- Server-side validation on execution
- Clear error messaging for out-of-range values

### Display Format

```typescript
// Positive modifier
"1d20 + 7 = 18"

// Negative modifier
"1d20 - 3 = 12"

// Zero modifier
"1d20 = 15"

// Multiple dice
"3d6 + 5 = 14" // [3, 4, 2] + 5 = 14
```

## Dice Count Limits

### Validation Rules

```typescript
interface DiceCountValidation {
  isValid: boolean;
  error?: string;
}

function validateDiceCount(count: number, diceType: DiceType): DiceCountValidation {
  if (count < 1) {
    return {
      isValid: false,
      error: "Must roll at least 1 die"
    };
  }
  if (count > 100) {
    return {
      isValid: false,
      error: "Cannot roll more than 100 dice of the same type"
    };
  }
  return { isValid: true };
}
```

### UI Behavior

- Number input field (default: 1, min: 1, max: 100)
- Client-side validation on input
- Server-side validation on execution
- Example: "Roll 5d20+10" → executes 5 twenty-sided dice with +10 modifier

### Performance Considerations

- Server can handle up to 100 dice per roll without performance issues
- Results array size: max 100 integers
- Response payload remains small even at max dice count

## Supported Dice Types

### D&D 5e Reference Set

```typescript
type DiceType = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';

interface DiceTypeConfig {
  type: DiceType;
  sides: number;
  commonUses: string[];
}

const DICE_TYPES: DiceTypeConfig[] = [
  { type: 'd4', sides: 4, commonUses: ['Small weapon damage', 'Minor spells'] },
  { type: 'd6', sides: 6, commonUses: ['Medium weapon damage', 'Stat rolls'] },
  { type: 'd8', sides: 8, commonUses: ['Weapon damage', 'Hit dice'] },
  { type: 'd10', sides: 10, commonUses: ['Heavy weapons', 'Percentile (d100)'] },
  { type: 'd12', sides: 12, commonUses: ['Great weapon damage'] },
  { type: 'd20', sides: 20, commonUses: ['Ability checks', 'Attack rolls', 'Saving throws'] },
  { type: 'd100', sides: 100, commonUses: ['Percentile rolls', 'Random tables'] }
];
```

### System Presets

**Campaign Configuration:**
```typescript
interface SystemPreset {
  name: string;
  diceType: DiceType;          // Primary die for ability checks
  intentions: Intention[];     // Available skills/actions
  customRules?: string;        // Optional system-specific rules
}

interface Intention {
  id: string;
  name: string;                // Display name (e.g., "Stealth")
  category?: string;           // Optional grouping (e.g., "Skills", "Combat")
  description?: string;        // Optional tooltip/help text
}

// Example: D&D 5e preset
{
  name: "D&D 5e",
  diceType: "d20",
  intentions: [
    { id: "acrobatics", name: "Acrobatics", category: "Skills" },
    { id: "stealth", name: "Stealth", category: "Skills" },
    { id: "persuasion", name: "Persuasion", category: "Skills" },
    { id: "attack", name: "Attack", category: "Combat" },
    // ... etc
  ]
}
```

### Expandability

- System supports any polyhedral die type
- Presets can be added for other game systems (Pathfinder, OSR, etc.)
- Custom dice types configurable per campaign (with admin permission)

## System Agnosticism

### Mechanical Output Only

**No Interpretation:**
- Rolls output numbers, not outcomes
- No automatic success/failure determination
- No DC (Difficulty Class) comparison
- No critical hit/fumble detection

**Example:**
```typescript
// What the system DOES output:
{
  intention: "Stealth",
  roll: "1d20 + 5",
  result: 18
}

// What the system DOES NOT output:
{
  success: true,              // ❌ Not determined by system
  criticalSuccess: false,     // ❌ Not determined by system
  outcome: "You succeed"      // ❌ Not determined by system
}
```

### Interpretation Left to GM and Players

**GM's Role:**
- Compare roll result to DC (if applicable to their game system)
- Determine success/failure based on game rules
- Narrate outcome in response post
- Apply mechanical effects (damage, status, etc.) as needed

**Player's Role:**
- Understand their own modifier calculations
- Trust server-side randomness
- Accept GM's interpretation of results

### Multi-System Support

The mechanical-only approach allows the same platform to support:
- D&D 5e (d20 + modifier vs. DC)
- Pathfinder (d20 + modifier vs. DC with degrees of success)
- OSR games (roll-under systems)
- Narrative games (dice pools, success counting)
- Custom/homebrew systems

**Campaign Admin chooses:**
- System preset (defines dice type and intention list)
- Custom rules documentation (linked in campaign settings)
- How to interpret results (documented in campaign guidelines)

## Error Handling

### Client-Side Validation

```typescript
interface RollValidationError {
  field: 'modifier' | 'diceCount' | 'intention';
  message: string;
}

// Example errors:
{
  field: "modifier",
  message: "Modifier must be between -100 and +100"
}
{
  field: "diceCount",
  message: "Cannot roll more than 100 dice"
}
{
  field: "intention",
  message: "This intention is not available in your campaign"
}
```

### Server-Side Validation

```typescript
interface RollExecutionError {
  code: string;
  message: string;
  retryable: boolean;
}

// Example errors:
{
  code: "INVALID_MODIFIER",
  message: "Modifier 150 exceeds maximum allowed value of 100",
  retryable: false
}
{
  code: "ROLL_ALREADY_COMPLETED",
  message: "This roll has already been executed",
  retryable: false
}
{
  code: "PHASE_MISMATCH",
  message: "Cannot execute roll during GM Phase",
  retryable: true
}
```

### Network Errors

**Retry Logic:**
- Roll submission failures are retryable
- Client retries up to 3 times with exponential backoff
- If all retries fail, roll remains `pending` and user can manually retry
- Server idempotency ensures duplicate submissions don't create multiple rolls

**User Feedback:**
```typescript
// Loading state
"Executing roll..."

// Success
"Roll completed: 1d20 + 7 = 18"

// Retryable error
"Roll failed to execute. Retrying... (Attempt 2/3)"

// Fatal error
"Roll failed: Invalid modifier. Please check your input and try again."
```

## Security Considerations

### Server-Side Randomness

- All dice rolls use cryptographically secure random number generation
- No client-side randomness (prevents manipulation)
- Audit trail for every roll (timestamp, executor, context)

### Validation

- All roll parameters validated server-side
- Client-side validation is UX only (not security)
- Malicious requests rejected with appropriate error codes

### Audit Trail

```typescript
interface RollAuditEntry {
  rollId: string;
  timestamp: string;
  executedBy: 'player' | 'gm';
  playerId?: string;
  gmId?: string;
  intention: string;
  originalIntention?: string;  // If overridden
  wasOverridden: boolean;
  diceType: DiceType;
  diceCount: number;
  modifier: number;
  diceResults: number[];
  total: number;
  ipAddress?: string;          // Optional, for fraud detection
  userAgent?: string;          // Optional, for fraud detection
}
```

**Audit Trail Uses:**
- Fraud detection (unusual roll patterns)
- Dispute resolution (player claims roll was wrong)
- Campaign history (review past rolls)
- Analytics (roll distribution, modifier usage)

## Integration with Phase State Machine

### Roll Status Check (Phase Transition Guard)

```typescript
interface PhaseTransitionCheck {
  canTransition: boolean;
  blockingRolls: Roll[];
  message?: string;
}

function checkPhaseTransition(campaignId: string): PhaseTransitionCheck {
  const pendingRolls = getRollsByStatus(campaignId, 'pending');

  if (pendingRolls.length > 0) {
    return {
      canTransition: false,
      blockingRolls: pendingRolls,
      message: `Cannot transition: ${pendingRolls.length} pending roll(s) must be resolved`
    };
  }

  return { canTransition: true, blockingRolls: [] };
}
```

### Character Pass Check (Pass Guard)

```typescript
interface PassCheck {
  canPass: boolean;
  blockingRolls: Roll[];
  message?: string;
}

function checkCharacterPass(characterId: string): PassCheck {
  const pendingRolls = getCharacterPendingRolls(characterId);

  if (pendingRolls.length > 0) {
    return {
      canPass: false,
      blockingRolls: pendingRolls,
      message: "Complete your pending rolls before passing"
    };
  }

  return { canPass: true, blockingRolls: [] };
}
```

### Automatic State Updates

**On Roll Completion:**
```typescript
async function onRollComplete(rollId: string) {
  // 1. Update roll status
  await updateRollStatus(rollId, 'completed');

  // 2. Unlock post editing (if applicable)
  const roll = await getRoll(rollId);
  await unlockPost(roll.postId);

  // 3. Check if character can now pass
  const character = await getCharacterForPost(roll.postId);
  const passCheck = checkCharacterPass(character.id);

  // 4. Notify witnesses
  await notifyWitnesses(roll.postId, {
    type: 'ROLL_COMPLETED',
    rollId,
    result: roll.total
  });

  // 5. Check if phase can transition (if all passes)
  const campaign = await getCampaign(roll.campaignId);
  if (allCharactersPassed(campaign.id)) {
    const transitionCheck = checkPhaseTransition(campaign.id);
    if (transitionCheck.canTransition) {
      await notifyGM(campaign.id, 'PHASE_TRANSITION_READY');
    }
  }
}
```

**On Roll Invalidation:**
```typescript
async function onRollInvalidate(rollId: string, reason: string) {
  // 1. Update roll status
  await updateRollStatus(rollId, 'invalidated', reason);

  // 2. Unlock character pass (if applicable)
  const roll = await getRoll(rollId);
  const character = await getCharacterForPost(roll.postId);
  await clearPassBlocker(character.id, rollId);

  // 3. Unlock post editing
  await unlockPost(roll.postId);

  // 4. Notify player (if not hard-passed)
  const passState = await getCharacterPassState(character.id);
  if (passState.type !== 'hard') {
    await notifyPlayer(character.playerId, {
      type: 'ROLL_INVALIDATED',
      rollId,
      reason
    });
  }
}
```

## Common Implementation Patterns

### Pattern: Player Roll Submission

```typescript
async function submitPlayerRoll(request: PlayerRollRequest): Promise<RollResult> {
  // 1. Validate phase
  const campaign = await getCampaign(request.campaignId);
  if (campaign.currentPhase !== 'pc_phase') {
    throw new Error('Can only submit rolls during PC Phase');
  }

  // 2. Validate parameters
  validateModifier(request.modifier);
  validateDiceCount(request.diceCount, request.rollType);
  validateIntention(request.intention, campaign.systemPreset);

  // 3. Create roll record
  const roll = await createRoll({
    postId: request.postId,
    intention: request.intention,
    modifier: request.modifier,
    diceCount: request.diceCount,
    rollType: request.rollType,
    status: 'pending',
    executedBy: 'player'
  });

  // 4. Execute roll server-side
  const result = await executeRoll(roll.id);

  // 5. Update status and notify
  await onRollComplete(roll.id);

  return result;
}
```

### Pattern: GM Roll Override

```typescript
async function overrideRollIntention(
  rollId: string,
  newIntention: string,
  gmId: string
): Promise<void> {
  // 1. Get existing roll
  const roll = await getRoll(rollId);

  // 2. Validate GM permission
  const campaign = await getCampaign(roll.campaignId);
  if (campaign.gmId !== gmId) {
    throw new Error('Only GM can override intentions');
  }

  // 3. Validate new intention
  validateIntention(newIntention, campaign.systemPreset);

  // 4. Update roll with override
  await updateRoll(rollId, {
    intention: newIntention,
    wasOverridden: true,
    originalIntention: roll.intention,
    overriddenBy: gmId,
    overriddenAt: new Date().toISOString()
  });

  // 5. Notify player
  const post = await getPost(roll.postId);
  await notifyPlayer(post.authorId, {
    type: 'INTENTION_OVERRIDDEN',
    rollId,
    oldIntention: roll.intention,
    newIntention
  });

  // 6. If roll already completed, invalidate and re-execute
  if (roll.status === 'completed') {
    await invalidateRoll(rollId, 'Intention overridden by GM');
    await executeRoll(rollId);
    await onRollComplete(rollId);
  }
}
```

### Pattern: GM Cleanup Workflow

```typescript
async function getUnresolvedRolls(campaignId: string): Promise<GroupedRolls> {
  const pendingRolls = await getRollsByStatus(campaignId, 'pending');

  // Group by scene for GM workflow
  const grouped: Record<string, Roll[]> = {};
  for (const roll of pendingRolls) {
    const post = await getPost(roll.postId);
    const scene = await getScene(post.sceneId);

    if (!grouped[scene.id]) {
      grouped[scene.id] = [];
    }
    grouped[scene.id].push(roll);
  }

  return grouped;
}

async function resolveRollAsGM(
  rollId: string,
  gmId: string,
  modifier?: number
): Promise<RollResult> {
  // 1. Validate GM permission
  const roll = await getRoll(rollId);
  const campaign = await getCampaign(roll.campaignId);
  if (campaign.gmId !== gmId) {
    throw new Error('Only GM can resolve player rolls');
  }

  // 2. Validate phase
  if (campaign.currentPhase !== 'gm_phase') {
    throw new Error('Can only resolve rolls as GM during GM Phase');
  }

  // 3. Apply modifier if provided
  if (modifier !== undefined) {
    validateModifier(modifier);
    await updateRoll(rollId, { modifier });
  }

  // 4. Execute roll
  const result = await executeRoll(rollId);

  // 5. Mark as GM-executed
  await updateRoll(rollId, { executedBy: 'gm' });

  // 6. Complete roll (no player notification if hard-passed)
  await onRollComplete(rollId);

  return result;
}
```

## Testing Considerations

### Unit Tests

- Modifier validation (-100 to +100 range)
- Dice count validation (1-100 range)
- Roll execution (cryptographic randomness)
- State transitions (pending → completed → invalidated)
- Pass blocking logic (pending rolls block pass)
- Phase transition blocking (pending rolls block transition)

### Integration Tests

- Player roll submission flow
- GM roll request flow
- GM override flow
- Roll cleanup during GM Phase
- Network failure recovery (retry logic)
- Concurrent roll submissions (race conditions)

### Security Tests

- Server-side validation (reject malicious parameters)
- Client-side manipulation attempts (all rejected)
- Audit trail completeness (all rolls logged)
- Idempotency (duplicate submissions handled correctly)
