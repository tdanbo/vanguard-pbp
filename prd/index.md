# Play-by-Post RPG Platform

## Product Requirements Document

A system-agnostic communication platform for play-by-post tabletop roleplaying games. The platform handles narrative flow, turn management, and scene organization while leaving game mechanics and character management to the groups themselves.

---

## Document Structure

| Document | Description |
|----------|-------------|
| [Overview](./overview.md) | Executive summary and problems addressed |
| [Core Concepts](./core-concepts.md) | Campaigns, players, scenes, actions, witness system |
| [Turn Structure](./turn-structure.md) | Turn flow, composing, pass mechanics, intents and rolls |
| [Settings](./settings.md) | Time gates, fog of war, hidden actions |
| [Information Architecture](./information-architecture.md) | Visibility matrix, GM role, game log |
| [Notifications](./notifications.md) | Player and GM notification triggers |
| [Scope](./scope.md) | What's included in v1 and what's deferred |
| [Technical](./technical.md) | Tech stack, architecture, and data models |

---

## Quick Reference

**Core Innovation:** Eliminating metagaming through architectural design rather than relying on player honor.

**Key Concepts:**
- **Witness System** - You only see turns you were present for
- **Compose Locks** - Sequential turn posting prevents race conditions
- **Time Gates** - Fixed preset windows (24h to 5 days) balance async and active players
- **Fog of War** - Scene and location visibility is emergent from presence
- **Global Turn Sync** - All scenes advance together at turn boundaries

**Platform Provides:**
- Campaigns as top-level containers
- Scenes for parallel narrative threads
- Structured turn flow (player windows → GM resolution)
- Intent-based rolling with predefined system presets
- Game log filtered by personal witness history
- GM moderation tools (edit/delete turns)

**Groups Provide:**
- Game system rules
- Character sheets and management
- Social norms and moderation standards
