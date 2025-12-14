# Phase 1: Theme Foundation

**Goal**: Replace the cool blue/slate theme with the warm gold/charcoal theme and establish foundational design tokens.

---

## Overview

This phase transforms the visual foundation of Vanguard PBP. By the end, you'll have:
- Warm charcoal backgrounds instead of cool blue/slate
- Gold accent color palette
- Custom serif fonts for display typography
- Utility classes for immersive scene views
- Dark mode as the default

---

## Skills to Activate

When implementing this phase, activate this skill for guidance:

| Skill | Purpose |
|-------|---------|
| `shadcn-react` | Theme customization, CSS variables, Tailwind patterns |

---

## Sub-phases

| # | Task | File | Description |
|---|------|------|-------------|
| 1.1 | CSS Theme Variables | [01-css-theme-variables.md](./01-css-theme-variables.md) | Replace `:root` and `.dark` CSS variables |
| 1.2 | Tailwind Extensions | [02-tailwind-extensions.md](./02-tailwind-extensions.md) | Extend theme colors, fonts, animations |
| 1.3 | Google Fonts | [03-google-fonts.md](./03-google-fonts.md) | Load Cormorant Garamond and Source Sans 3 |
| 1.4 | Utility Classes | [04-utility-classes.md](./04-utility-classes.md) | Add custom component and utility layers |
| 1.5 | Dark Mode Default | [05-dark-mode-default.md](./05-dark-mode-default.md) | Force dark mode, remove toggle |

---

## Design References

- [01-shadcn-theme-reference.md](../../product-design-system/01-shadcn-theme-reference.md) - Complete CSS theme specification
- [02-tailwind-extensions.md](../../product-design-system/02-tailwind-extensions.md) - Tailwind config extensions
- [03-design-tokens.md](../../product-design-system/03-design-tokens.md) - Token catalog and status

---

## Prerequisites

Before starting this phase, ensure:

1. Frontend is running:
   ```bash
   cd services/frontend && bun run dev
   ```

2. Current implementation has:
   - [x] shadcn/ui components installed
   - [x] Tailwind CSS configured
   - [x] Dark mode support via `.dark` class

---

## Files to Modify

| File | Purpose |
|------|---------|
| `services/frontend/src/index.css` | CSS variables and utility classes |
| `services/frontend/tailwind.config.js` | Theme extensions |
| `services/frontend/index.html` | Font loading |

---

## Completion Checklist

- [ ] Warm charcoal background (#101012) replaces cool blue/slate
- [ ] Gold accent color (#c9a55c) is primary
- [ ] Cormorant Garamond font loading and available
- [ ] Source Sans 3 font loading and available
- [ ] `.font-display`, `.text-gold`, `.bg-panel` classes working
- [ ] `.scene-title`, `.character-name` classes working
- [ ] Phase colors (gm-phase, pc-phase) updated to warmer variants
- [ ] Dark mode is forced by default
- [ ] All existing components still render correctly

---

## Next Phase

After completing Phase 1, proceed to [Phase 2: Component Patterns](../phase-02-components/README.md).
