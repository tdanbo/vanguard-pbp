# Phase 2: Component Patterns

**Goal**: Update core UI components to use the new warm gold theme and establish consistent patterns.

---

## Overview

This phase applies the new theme to shadcn/ui components and establishes reusable patterns. By the end, you'll have:
- Button variants using gold accents
- Card components with interactive and transparent variants
- CharacterPortrait component with fallback system
- Badge variants for all states (phase, role, pass, roll)
- EmptyState component with thematic messaging

---

## Skills to Activate

When implementing this phase, activate this skill for guidance:

| Skill | Purpose |
|-------|---------|
| `shadcn-react` | Component patterns, forms, dialogs, Tailwind styling |

---

## Sub-phases

| # | Task | File | Description |
|---|------|------|-------------|
| 2.1 | Button Patterns | [01-button-patterns.md](./01-button-patterns.md) | Primary, secondary, ghost, destructive variants |
| 2.2 | Card Variants | [02-card-variants.md](./02-card-variants.md) | Base, interactive, transparent cards |
| 2.3 | Portrait & Avatar | [03-portrait-avatar.md](./03-portrait-avatar.md) | CharacterPortrait with fallback |
| 2.4 | Badge Variants | [04-badge-variants.md](./04-badge-variants.md) | Phase, role, pass, roll state badges |
| 2.5 | Empty State | [05-empty-state.md](./05-empty-state.md) | Thematic empty state component |

---

## Design References

- [07-components.md](../../product-design-system/07-components.md) - Complete component patterns

---

## Prerequisites

Before starting this phase, ensure:

1. Phase 1 completed:
   - [x] Warm gold/charcoal CSS variables
   - [x] Tailwind extensions configured
   - [x] Google Fonts loading
   - [x] Utility classes defined

2. shadcn/ui components installed:
   ```bash
   npx shadcn@latest add button card badge avatar
   ```

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `src/components/ui/button.tsx` | Verify theme application |
| `src/components/ui/card.tsx` | Verify theme application |
| `src/components/ui/badge.tsx` | Add variant extensions |
| `src/components/character/CharacterPortrait.tsx` | Create new |
| `src/components/ui/EmptyState.tsx` | Create new |

---

## Completion Checklist

- [ ] Primary button uses gold accent color
- [ ] Button loading states with Loader2 spinner
- [ ] Card interactive variant lifts on hover
- [ ] Card transparent variant works with backdrop blur
- [ ] CharacterPortrait shows image or fallback initials
- [ ] Badge variants for phase states (gm, pc, paused)
- [ ] Badge variants for pass states (passed, hard_passed)
- [ ] Badge variants for roll states (pending, completed, invalidated)
- [ ] EmptyState component with icon, title, description
- [ ] All components render correctly with new theme

---

## Next Phase

After completing Phase 2, proceed to [Phase 3: Campaign View](../phase-03-campaign-view/README.md).
