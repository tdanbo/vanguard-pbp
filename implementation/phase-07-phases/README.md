# Phase 7: Phase Management & Pass System

## Overview

Phase Management implements the global state machine that controls turn flow across the entire campaign. The Pass System tracks player readiness to proceed, enabling coordinated phase transitions.

## Core Concept

Vanguard PBP uses a **global phase system**: all scenes in a campaign share the same phase state (PC Phase or GM Phase). The GM controls phase transitions, but players signal readiness via the Pass System.

## PRD References

- **Turn Structure**: Global phase state, pass mechanics, time gates
- **Core Concepts**: Player-initiated pass, hard pass, auto-clear on post
- **Technical**: State machine patterns, atomic transitions, notification triggers

## Key Skills

- **state-machine** - Phase transitions, state validation, global synchronization
- **notification-system** - Time gate warnings, phase transition alerts, pass notifications

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Campaign Phase State                       │
│                  (pc_phase | gm_phase)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  GM Clicks Transition → Validate Guards → Update State      │
│                                                              │
│  Pass System: Character Pass → Check All Passed → Ready     │
│                                                              │
│  Time Gate: GM→PC → Start Timer → Warnings → Expire         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Sequence

1. **State Machine** (`01-state-machine.md`)
   - Campaign-level phase state
   - Transition guards and validation
   - UI indicators

2. **Pass System** (`02-pass-system.md`)
   - Per-character pass tracking
   - Pass vs Hard Pass distinction
   - Auto-clear on post

3. **Time Gates** (`03-time-gates.md`)
   - Configurable countdown timers
   - Warning notifications
   - Auto-pass on expiration

## Database Schema

```sql
-- Campaign phase state
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gm_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  current_phase TEXT NOT NULL DEFAULT 'gm_phase' CHECK (current_phase IN ('pc_phase', 'gm_phase')),
  time_gate_duration INTERVAL,  -- NULL = no time gate
  time_gate_started_at TIMESTAMPTZ,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Character pass state
CREATE TABLE character_passes (
  character_id UUID PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,
  is_passed BOOLEAN NOT NULL DEFAULT false,
  is_hard_pass BOOLEAN NOT NULL DEFAULT false,
  passed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phase transition history (optional, for auditing)
CREATE TABLE phase_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  from_phase TEXT NOT NULL,
  to_phase TEXT NOT NULL,
  triggered_by UUID NOT NULL REFERENCES users(id),
  transition_time TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Success Criteria

- ✅ Global phase state synchronized across all scenes
- ✅ Phase transitions are atomic and validated
- ✅ Pass system tracks per-character, not per-user
- ✅ Hard Pass prevents auto-clear and notifications
- ✅ Time gates countdown correctly and auto-pass on expiration
- ✅ Pending rolls block phase transition
- ✅ Orphaned characters excluded from pass counting
- ✅ All UI indicators update in real-time

## Testing Strategy

### Unit Tests
- Phase state transitions
- Pass state management
- Time gate calculations
- Orphan character exclusion

### Integration Tests
- Transition guard validation
- Real-time phase updates
- Notification delivery
- Multi-scene synchronization

### E2E Tests
- GM transitions phase → all scenes update
- Player passes → indicator updates
- Time gate expires → auto-pass triggers
- Roll blocks transition → error shown

## Edge Cases Covered

1. **Orphaned characters** - Excluded from pass counting
2. **Deleted characters** - Pass state cleaned up
3. **Multi-character players** - Separate pass per character
4. **Campaign pause** - Freezes time gate countdown
5. **Concurrent transitions** - Prevented by database locks
6. **Partial passes** - Some characters passed, some not
7. **Hard pass notification spam** - Suppressed

## Performance Requirements

- Phase transition: < 500ms (atomic update + notifications)
- Pass state update: < 100ms
- Time gate calculation: < 50ms
- Real-time phase sync: < 100ms latency

## Dependencies

- **Phase 3**: Scenes
- **Phase 4**: Characters
- **Phase 6**: Witness system (for atomic witness transactions)
- **Phase 8**: Dice rolls (blocking transitions)

## Enables

- **Future**: Turn order within phases
- **Future**: Phase-specific actions and permissions
- **Future**: Advanced time gate configurations
