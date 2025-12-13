# Phase 5: Post Composition System

## Overview

Phase 5 implements the sequential post composition system with compose locks, draft persistence, and post submission. This ensures ordered narrative and prevents race conditions.

## Skills Required

- **compose-lock**: Lock acquisition, heartbeat, timeout handling
- **go-api-server**: Draft persistence, post submission, validation
- **shadcn-react**: Composer UI, lock indicators, draft sync

## Deliverables

### Compose Lock System
- Lock acquisition ("Take Post" button)
- Per-character per-scene locking
- 10-minute timeout (fixed)
- Heartbeat mechanism (2-second debounce)
- Visual drain bar (final minute)
- Lock release on submission
- Auto-release on timeout
- GM force-release
- UI showing lock holder (name + avatar)
- Rate limiting (5 seconds between operations)

### Draft Persistence
- Server-side draft storage
- Auto-save on typing (debounced)
- Cross-device sync
- Draft cleanup on submission
- Draft preservation on timeout
- Draft structure (blocks, OOC, intention, modifier)

### Post Submission
- Post blocks (Action, Dialog)
- Block validation (at least one required)
- Character limit enforcement
- OOC text field
- Witness list assignment (present characters)
- Hidden post option (empty witnesses)
- Post locking (when next post created)
- Narrator posts (GM, null character_id)
- Post editing (own draft only)
- GM post editing (any post)

## PRD References

- [Turn Structure](/home/tobiasd/github/vanguard-pbp/prd/turn-structure.md) - Sequential composing, compose lock
- [Technical](/home/tobiasd/github/vanguard-pbp/prd/technical.md) - Post model, compose session model
- [Settings](/home/tobiasd/github/vanguard-pbp/prd/settings.md) - Character limits, compose lock timeout

## Implementation Files

1. [01-compose-lock.md](./01-compose-lock.md) - Compose lock system
2. [02-drafts.md](./02-drafts.md) - Draft persistence
3. [03-post-submission.md](./03-post-submission.md) - Post creation and editing

## Success Criteria

- [ ] Player can acquire compose lock for character
- [ ] Only one lock per character per scene
- [ ] Lock timeout at 10 minutes
- [ ] Heartbeat keeps lock alive
- [ ] Visual drain bar in final minute
- [ ] Lock releases on post submission
- [ ] GM can force-release locks
- [ ] Lock holder visible to all players
- [ ] Rate limit enforced (5 sec between ops)
- [ ] Drafts persist server-side
- [ ] Drafts sync across devices
- [ ] Posts require at least one block
- [ ] Character limit enforced
- [ ] Hidden posts work (empty witnesses)
- [ ] Post locks when next post created
- [ ] GM can edit any post

## Testing Checklist

- [ ] Acquire lock as player
- [ ] Block concurrent lock acquisition
- [ ] Lock timeout after 10 minutes
- [ ] Heartbeat resets timeout
- [ ] Drain bar appears at 1 minute remaining
- [ ] Lock releases on submission
- [ ] GM force-release works
- [ ] Lock holder UI updates in real-time
- [ ] Rate limit blocks rapid operations
- [ ] Draft auto-saves on typing
- [ ] Draft survives timeout
- [ ] Draft syncs across tabs
- [ ] Submit post with action block
- [ ] Submit post with dialog block
- [ ] Block empty post submission
- [ ] Character limit enforced
- [ ] Hidden post creates empty witnesses
- [ ] Post locks when next post submitted
- [ ] GM edit any post works
- [ ] Player can only edit own draft
