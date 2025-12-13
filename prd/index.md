# Play-by-Post RPG Platform

## Product Requirements Document

A system-agnostic communication platform for play-by-post tabletop roleplaying games. The platform handles narrative flow, turn management, and scene organization while leaving game mechanics and character management to the groups themselves.

---

## Document Structure

| Document | Description |
|----------|-------------|
| [Overview](./overview.md) | Executive summary and problems addressed |
| [Core Concepts](./core-concepts.md) | Campaigns, players, characters, scenes, posts, witness system |
| [Phase Structure](./turn-structure.md) | Phase flow, composing, pass mechanics, intents and rolls |
| [Settings](./settings.md) | Time gates, fog of war, hidden posts |
| [Information Architecture](./information-architecture.md) | Visibility matrix, GM role, game log |
| [Notifications](./notifications.md) | Player and GM notification triggers |
| [Scope](./scope.md) | What's included in v1 and what's deferred |
| [Technical](./technical.md) | Tech stack, architecture, and data models |

---

## Quick Reference

**Core Innovation:** Eliminating metagaming through architectural design rather than relying on player honor.

**Key Concepts:**
- **Witness System** - Characters only see posts they were present for
- **Compose Locks** - Sequential post creation prevents race conditions
- **Time Gates** - Fixed preset windows (24h to 5 days) balance async and active players
- **Fog of War** - Scene and location visibility is emergent from presence
- **Global Phase Sync** - All scenes advance together (PC Phase → GM Phase)
- **Multi-Character Support** - Users can control multiple characters in the same campaign
- **Character Types** - PCs and NPCs are identical except for UI presentation

**Platform Provides:**
- Campaigns as top-level containers
- Scenes for parallel narrative threads (max 25 per campaign)
- Structured phase flow (PC Phase → GM Phase)
- Intent-based rolling with predefined system presets
- Game log filtered by character witness history
- GM moderation tools (edit/delete posts, move characters)
- GM witness selection for posts (all/specific/hidden)

**Groups Provide:**
- Game system rules
- Character sheets and management
- Social norms and moderation standards

---

## Glossary

| Term | Definition |
|------|------------|
| **PC Phase** | The active window where players create posts. Ends when all characters pass or time gate expires. |
| **GM Phase** | The phase where GM reviews scenes, resolves rolls, posts responses, and moves characters. |
| **Post** | One character's submission during a PC Phase (or GM during GM Phase). Contains action blocks, dialog blocks, and optional OOC. |
| **Pass** | Signal that character is done for now (per-character per-scene). Auto-clears if another player posts. Can be undone. |
| **Pass (Hard)** | Signal to skip this phase entirely (per-character per-scene). Does NOT auto-clear. Useful for stepping away. |
| **Compose Lock** | Per-character lock required to post. 10-minute timeout. Released on post submission. |
| **Witness** | A character who can see a post. Only witnesses can see that post in their game log. |
| **Character** | An in-game identity owned by a campaign. One character = one scene at a time. Can be PC or NPC. |
| **Character Type** | Either `pc` (player character) or `npc` (non-player character). Affects UI presentation only. |
| **Character Assignment** | Links a character to the user who controls it. Orphaned when user leaves. |
| **Narrator** | GM posting with no character (characterId = null). Used for scene descriptions. |
| **OOC** | Out-of-character text on a post. Visibility controlled by campaign setting (default: GM only). |
| **Intention** | A mechanical action type (e.g., "Stealth", "Persuasion") that triggers a roll. |
| **Post Locking** | Posts become locked (uneditable) when the next post is created. GM can still edit for moderation. |
| **Orphaned Character** | A character whose user assignment has been deleted. Cannot post/pass but posts are preserved. |
| **Archived Character** | A character marked inactive by GM. Invisible to players, greyed out for GM, can be un-archived. |
| **Witness Transaction** | Atomic operation when GM transitions to PC Phase that adds witnesses to all GM Phase posts. |
| **Draft** | A Post with `submitted: false`. Server-persisted, syncs across tabs. |
