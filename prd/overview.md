# Overview

## Executive Summary

A system-agnostic communication platform for play-by-post tabletop roleplaying games. The platform handles narrative flow, turn management, and scene organization while leaving game mechanics and character management to the groups themselves.

The core innovation is **eliminating metagaming through architectural design** rather than relying on player honor. Players literally cannot see information their characters don't have access to.

---

## Problems Addressed

### Player Engagement Balance

Preventing single players from dominating the narrative while others get left behind. The structured turn system with compose locks ensures everyone gets a chance to contribute before the story moves forward. Global turn synchronization keeps all scenes moving together.

### Story Flow

Keeping games moving with time gates and structured turn-taking. Async play-by-post games often stall when waiting on players—the platform provides configurable time gates that auto-advance when needed.

### Scene Organization

Managing parallel scenes, character locations, and narrative threads. Split party scenarios, private conversations, and multiple simultaneous locations are first-class features.

### Metagaming

Players acting on information their characters don't have. Traditional solutions rely on player honor. This platform makes metagaming architecturally impossible—the information simply isn't available to players who shouldn't have it.

---

## Design Philosophy

**System Agnostic:** The platform makes no assumptions about game rules. Groups bring their own systems (D&D, Pathfinder, FATE, homebrew, etc.) and apply meaning to roll results themselves.

**Communication First:** The platform is a structured communication tool, not a virtual tabletop. No maps, tokens, character sheets, or automated mechanics.

**Async Native:** Built for play-by-post where players contribute hours or days apart. Time gates and pass mechanics balance fast and slow players.

**Trust Through Architecture:** Rather than asking players to ignore information they can see, the platform simply doesn't show it to them.
