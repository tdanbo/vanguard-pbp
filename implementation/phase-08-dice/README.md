# Phase 8: Dice Rolling System

## Overview

The Dice Rolling System implements intent-based rolling where players select their intention (what they're trying to do) before rolling. The system supports multiple game system presets, server-side roll execution, and GM override capabilities.

## Core Concept

Unlike traditional dice rollers, Vanguard PBP uses an **intention-first** approach:
1. Player selects intention from preset list ("Attack", "Defend", "Investigate", etc.)
2. Player adds modifiers and submits with post
3. Server executes roll using cryptographically secure randomness
4. GM can override intention or manually resolve roll

## PRD References

- **Dice Rolling**: System presets, intention-based rolling, server-side execution
- **Turn Structure**: Roll status lifecycle, pending rolls block transitions
- **Technical**: Crypto-secure RNG, roll-blocking mechanics, GM override

## Key Skills

- **dice-roller** - Intention selection, roll execution, GM overrides, roll blocking
- **go-api-server** - Server-side roll logic, validation, roll persistence

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Dice Rolling Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Player: Select Intention → Set Modifier → Submit with Post │
│                                                              │
│  Server: Validate → Execute Roll (crypto RNG) → Save Result │
│                                                              │
│  GM: View Roll → Override Intention → Manually Resolve      │
│                                                              │
│  System: Roll Complete → Unblock Pass → Allow Transition    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Sequence

1. **System Presets** (`01-system-presets.md`)
   - D&D 5e, Pathfinder 2e, custom presets
   - Intention list configuration
   - Dice type selection

2. **Roll Execution** (`02-roll-execution.md`)
   - Server-side roll logic
   - Roll tied to post
   - Status lifecycle

3. **GM Overrides** (`03-gm-overrides.md`)
   - Intention override
   - Manual resolution
   - Unresolved rolls dashboard

## Database Schema

```sql
-- Campaign system presets
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... other fields ...
  dice_system_preset TEXT NOT NULL DEFAULT 'dnd5e'
    CHECK (dice_system_preset IN ('dnd5e', 'pf2e', 'custom')),
  custom_intentions JSONB,  -- For custom preset
  dice_type TEXT NOT NULL DEFAULT 'd20'
    CHECK (dice_type IN ('d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'))
);

-- Rolls table
CREATE TABLE rolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

  -- Roll request
  intention TEXT NOT NULL,             -- "Attack", "Defend", etc.
  modifier INT NOT NULL DEFAULT 0,     -- -100 to +100
  dice_count INT NOT NULL DEFAULT 1,   -- 1 to 100

  -- Roll execution
  dice_results INT[] NOT NULL DEFAULT '{}',  -- Individual die results
  total INT,                                  -- Sum + modifier
  rolled_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'invalidated')),

  -- GM overrides
  original_intention TEXT,             -- Preserved if GM overrides
  overridden_by UUID REFERENCES users(id),
  override_reason TEXT,
  manual_result INT,                   -- If GM manually resolves

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_rolls_post ON rolls(post_id);
CREATE INDEX idx_rolls_character ON rolls(character_id);
CREATE INDEX idx_rolls_status ON rolls(status) WHERE status = 'pending';
```

## Success Criteria

- ✅ System presets (D&D 5e, PF2e) with intention lists
- ✅ Custom preset with user-defined intentions
- ✅ Server-side roll execution with crypto RNG
- ✅ Rolls tied to posts atomically
- ✅ GM can override intentions with history
- ✅ GM can manually resolve rolls
- ✅ Pending rolls block character pass
- ✅ Pending rolls block phase transition
- ✅ Roll results displayed inline with posts

## Testing Strategy

### Unit Tests
- Roll RNG distribution
- Modifier validation
- Status transitions
- GM override permissions

### Integration Tests
- Roll with post creation
- Roll blocking pass
- Roll blocking transition
- GM override workflow

### E2E Tests
- Player creates roll → sees pending
- Server executes → sees result
- GM overrides intention → player notified
- GM manually resolves → roll completed

## Edge Cases Covered

1. **Invalid modifiers** - Clamped to -100 to +100
2. **Invalid dice count** - Clamped to 1 to 100
3. **Roll for deleted character** - Roll persists, character nullable
4. **Multiple rolls per post** - Supported (future enhancement)
5. **Roll without post** - Not allowed (rolls tied to posts)
6. **Pending roll on phase transition** - Blocks transition
7. **Hard-passed character with pending roll** - Cannot hard pass

## Performance Requirements

- Roll execution: < 50ms
- Roll validation: < 10ms
- RNG generation: < 5ms per die
- Roll query: < 100ms for campaign-wide pending

## Dependencies

- **Phase 5**: Post composition (rolls tied to posts)
- **Phase 6**: Visibility (roll visibility follows post)
- **Phase 7**: Pass system (rolls block passing)

## Enables

- **Future**: Dice pool systems (multiple dice types)
- **Future**: Advantage/disadvantage mechanics
- **Future**: Reroll mechanics
- **Future**: Secret rolls (GM-only visibility)
