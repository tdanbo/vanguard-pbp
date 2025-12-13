---
name: state-machine
description: State machine patterns for game flow management in the Vanguard PBP system. Use this skill when implementing or debugging phase transitions, state validation, global phase synchronization, time gate handling, and state persistence. Critical for campaign lifecycle, scene state management, and turn-based gameplay.
---

# State Machine

## Overview

This skill provides patterns and implementation guidance for the Vanguard PBP state machine, which manages the global phase cycle (PC Phase ↔ GM Phase) across all scenes in a campaign. The state machine enforces transition guards, handles time gate expiration, maintains pass states, and ensures data consistency during phase changes.

## Core State Machine

### Phase States

The campaign maintains a global phase state shared by all scenes:

```typescript
type PhaseState = '"pc_phase"' | '"gm_phase"';

interface Campaign {
  currentPhase: PhaseState;           // Global phase (all scenes sync)
  currentPhaseE