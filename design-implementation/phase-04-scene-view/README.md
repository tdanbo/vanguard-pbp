# Phase 4: Scene View

**Goal**: Implement the immersive Scene View with transparent panels, post cards, and messenger-style composer.

---

## Overview

Scene View is the **sacred space** — the primary gameplay experience. By the end, you'll have:
- Immersive wrapper with scene image background
- Scene header with gradient overlay
- Post cards with full-height portrait sidebars
- Messenger-style composer fixed at bottom
- Scene roster with phase banner and pass controls

---

## Skills to Activate

| Skill | Purpose |
|-------|---------|
| `shadcn-react` | Component patterns, layout |
| `compose-lock` | Lock timer, composer states |
| `visibility-filter` | Post visibility indicators |

---

## Sub-phases

| # | Task | File | Description |
|---|------|------|-------------|
| 4.1 | Immersive Wrapper | [01-immersive-wrapper.md](./01-immersive-wrapper.md) | Full-bleed background, minimal chrome |
| 4.2 | Scene Header | [02-scene-header.md](./02-scene-header.md) | Image with gradient, title overlay |
| 4.3 | Post Card | [03-post-card.md](./03-post-card.md) | Portrait sidebar with gradient fade |
| 4.4 | Composer | [04-composer.md](./04-composer.md) | Messenger-style fixed bottom |
| 4.5 | Scene Roster | [05-scene-roster.md](./05-scene-roster.md) | Phase banner, character list, pass controls |

---

## Design References

- [05-scene-view.md](../../product-design-system/05-scene-view.md) - Complete scene view specifications

---

## Prerequisites

Before starting this phase, ensure:

1. Phases 1-3 completed:
   - [x] Warm gold theme with transparency tokens
   - [x] CharacterPortrait component
   - [x] Badge variants

2. Backend integration ready for:
   - Posts API
   - Compose lock API
   - Pass state API

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `src/components/scene/SceneView.tsx` | Create |
| `src/components/scene/SceneHeader.tsx` | Create |
| `src/components/posts/PostCard.tsx` | Modify |
| `src/components/posts/PostComposer.tsx` | Modify |
| `src/components/scene/SceneRoster.tsx` | Create |

---

## Completion Checklist

- [ ] Scene background shows full-bleed image
- [ ] Gradient fades image into background
- [ ] Scene title uses scene-title class with text-shadow
- [ ] Post cards have full-height portrait sidebar
- [ ] Portrait has gradient fade into content
- [ ] Composer is fixed at bottom, messenger-style
- [ ] Lock timer shows as progress bar (not badge)
- [ ] Scene roster shows phase banner
- [ ] Pass controls work in roster
- [ ] OOC toggle visible on posts
- [ ] Roll badges positioned in upper-right of posts

---

## Next Phase

After completing Phase 4, proceed to [Phase 5: Feature Components](../phase-05-features/README.md).
