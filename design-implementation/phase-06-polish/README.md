# Phase 6: Accessibility & Polish

**Goal**: Ensure WCAG AA compliance and responsive design across all components.

---

## Overview

This phase is the final polish. By the end, you'll have:
- WCAG AA compliant color contrast
- Full keyboard navigation support
- Reduced motion preferences respected
- Mobile-first responsive layouts
- Touch-friendly targets (44px minimum)

---

## Skills to Activate

| Skill | Purpose |
|-------|---------|
| `shadcn-react` | Accessibility patterns, responsive utilities |

---

## Sub-phases

| # | Task | File | Description |
|---|------|------|-------------|
| 6.1 | Accessibility Audit | [01-accessibility-audit.md](./01-accessibility-audit.md) | Color contrast, ARIA labels |
| 6.2 | Keyboard Navigation | [02-keyboard-navigation.md](./02-keyboard-navigation.md) | Focus management, skip links |
| 6.3 | Reduced Motion | [03-reduced-motion.md](./03-reduced-motion.md) | Motion preferences |
| 6.4 | Mobile Responsive | [04-mobile-responsive.md](./04-mobile-responsive.md) | Breakpoints, touch targets |
| 6.5 | Final Polish | [05-final-polish.md](./05-final-polish.md) | Integration testing |

---

## Design References

- [13-accessibility.md](../../product-design-system/13-accessibility.md) - ARIA, keyboard, contrast
- [14-responsive-design.md](../../product-design-system/14-responsive-design.md) - Breakpoints, mobile

---

## Prerequisites

Before starting this phase, ensure:

1. Phases 1-5 completed:
   - [x] All components implemented
   - [x] Theme fully applied
   - [x] Features functional

---

## Completion Checklist

- [ ] All text meets 4.5:1 contrast ratio (normal) or 3:1 (large)
- [ ] All icon buttons have aria-label
- [ ] All form inputs have labels
- [ ] Focus states visible on all interactive elements
- [ ] Tab order logical through all pages
- [ ] Skip link available
- [ ] Escape closes all modals/dropdowns
- [ ] Reduced motion disables animations
- [ ] Touch targets minimum 44px
- [ ] All views work at 375px width
- [ ] No horizontal scroll on mobile

---

## After This Phase

The design system implementation is complete. Perform final testing across:
- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Mobile devices (iOS Safari, Android Chrome)
- Screen readers (VoiceOver, NVDA)
- Keyboard-only navigation
