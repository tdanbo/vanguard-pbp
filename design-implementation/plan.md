# Vanguard PBP Design System Implementation Plan

A comprehensive 6-phase implementation plan for the Vanguard PBP design system, transforming the UI from cool blue/slate to warm gold/charcoal with immersive scene experiences.

---

## Quick Links

- [Product Design System](../product-design-system/00-overview.md) - Design specifications
- [Implementation Plan](../implementation/plan.md) - Feature implementation
- [Skills Reference](../.claude/skills/) - Implementation guidance

---

## Design Philosophy

> "The UI should be a portal into fiction, not a barrier to it."

The Vanguard design system has two distinct modes:

| Mode | Purpose | Feel |
|------|---------|------|
| **Management Views** | Campaign setup, settings | Clean, functional, themed |
| **Immersive Views** | Scene view, posts, composer | Atmospheric, fiction-first |

**Scene View is sacred.** It receives the most design attention and the least UI chrome.

---

## Implementation Progress

### Legend
- [ ] Not started
- [~] In progress
- [x] Completed

---

## Phase Overview

| Phase | Name | Design Docs | Skills | Status |
|-------|------|-------------|--------|--------|
| 1 | [Theme Foundation](#phase-1-theme-foundation) | 01, 02, 03 | shadcn-react | [ ] |
| 2 | [Component Patterns](#phase-2-component-patterns) | 07 | shadcn-react | [ ] |
| 3 | [Campaign View](#phase-3-campaign-view) | 04, 06 | shadcn-react, state-machine | [ ] |
| 4 | [Scene View](#phase-4-scene-view) | 05 | shadcn-react, compose-lock, visibility-filter | [ ] |
| 5 | [Feature Components](#phase-5-feature-components) | 08, 09, 10, 11, 12 | dice-roller, state-machine, notification-system, image-upload, real-time-sync | [ ] |
| 6 | [Accessibility & Polish](#phase-6-accessibility--polish) | 13, 14 | shadcn-react | [ ] |

---

## Phase 1: Theme Foundation

**Goal**: Replace cool blue/slate theme with warm gold/charcoal and establish design tokens.

**Skills**: `shadcn-react`

**Design References**:
- [01-shadcn-theme-reference.md](../product-design-system/01-shadcn-theme-reference.md)
- [02-tailwind-extensions.md](../product-design-system/02-tailwind-extensions.md)
- [03-design-tokens.md](../product-design-system/03-design-tokens.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 1.1 | CSS Theme Variables | [01-css-theme-variables.md](./phase-01-foundation/01-css-theme-variables.md) | [ ] |
| 1.2 | Tailwind Extensions | [02-tailwind-extensions.md](./phase-01-foundation/02-tailwind-extensions.md) | [ ] |
| 1.3 | Google Fonts | [03-google-fonts.md](./phase-01-foundation/03-google-fonts.md) | [ ] |
| 1.4 | Utility Classes | [04-utility-classes.md](./phase-01-foundation/04-utility-classes.md) | [ ] |
| 1.5 | Dark Mode Default | [05-dark-mode-default.md](./phase-01-foundation/05-dark-mode-default.md) | [ ] |

### Deliverables
- [ ] Warm gold/charcoal color scheme active
- [ ] Custom fonts (Cormorant Garamond, Source Sans 3) loading
- [ ] All utility classes defined (.font-display, .text-gold, .bg-panel, etc.)
- [ ] Phase colors updated to warmer variants
- [ ] Dark mode forced as default

---

## Phase 2: Component Patterns

**Goal**: Update core UI components to use new theme and establish consistent patterns.

**Skills**: `shadcn-react`

**Design References**:
- [07-components.md](../product-design-system/07-components.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 2.1 | Button Patterns | [01-button-patterns.md](./phase-02-components/01-button-patterns.md) | [ ] |
| 2.2 | Card Variants | [02-card-variants.md](./phase-02-components/02-card-variants.md) | [ ] |
| 2.3 | Portrait & Avatar | [03-portrait-avatar.md](./phase-02-components/03-portrait-avatar.md) | [ ] |
| 2.4 | Badge Variants | [04-badge-variants.md](./phase-02-components/04-badge-variants.md) | [ ] |
| 2.5 | Empty State | [05-empty-state.md](./phase-02-components/05-empty-state.md) | [ ] |

### Deliverables
- [ ] Button variants with gold accent
- [ ] Card interactive and transparent variants
- [ ] CharacterPortrait component with fallback
- [ ] Badge variants for phase, role, pass, roll states
- [ ] EmptyState component with thematic messaging

---

## Phase 3: Campaign View

**Goal**: Implement management view patterns for Campaign Dashboard.

**Skills**: `shadcn-react`, `state-machine`

**Design References**:
- [04-view-architecture.md](../product-design-system/04-view-architecture.md)
- [06-campaign-view.md](../product-design-system/06-campaign-view.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 3.1 | Management Wrapper | [01-management-wrapper.md](./phase-03-campaign-view/01-management-wrapper.md) | [ ] |
| 3.2 | Campaign Header | [02-campaign-header.md](./phase-03-campaign-view/02-campaign-header.md) | [ ] |
| 3.3 | Tab Navigation | [03-tab-navigation.md](./phase-03-campaign-view/03-tab-navigation.md) | [ ] |
| 3.4 | Scene Cards | [04-scene-cards.md](./phase-03-campaign-view/04-scene-cards.md) | [ ] |
| 3.5 | Settings Tab | [05-settings-tab.md](./phase-03-campaign-view/05-settings-tab.md) | [ ] |

### Deliverables
- [ ] Management view wrapper with solid background
- [ ] Campaign header with GM badge and phase indicator
- [ ] Tab navigation with gold active indicator
- [ ] Scene cards grid with hover effects
- [ ] Settings page with danger zone

---

## Phase 4: Scene View

**Goal**: Implement immersive Scene View with transparent panels and messenger-style composer.

**Skills**: `shadcn-react`, `compose-lock`, `visibility-filter`

**Design References**:
- [05-scene-view.md](../product-design-system/05-scene-view.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 4.1 | Immersive Wrapper | [01-immersive-wrapper.md](./phase-04-scene-view/01-immersive-wrapper.md) | [ ] |
| 4.2 | Scene Header | [02-scene-header.md](./phase-04-scene-view/02-scene-header.md) | [ ] |
| 4.3 | Post Card | [03-post-card.md](./phase-04-scene-view/03-post-card.md) | [ ] |
| 4.4 | Composer | [04-composer.md](./phase-04-scene-view/04-composer.md) | [ ] |
| 4.5 | Scene Roster | [05-scene-roster.md](./phase-04-scene-view/05-scene-roster.md) | [ ] |

### Deliverables
- [ ] Immersive view with transparent panels over scene image
- [ ] Scene header with image/gradient and title overlay
- [ ] Post cards with full-height portrait sidebar
- [ ] Messenger-style composer fixed to bottom
- [ ] Scene roster with phase banner and pass controls

---

## Phase 5: Feature Components

**Goal**: Implement specialized UI for dice, phases, notifications, images, and real-time.

**Skills**: `dice-roller`, `state-machine`, `notification-system`, `image-upload`, `real-time-sync`, `compose-lock`

**Design References**:
- [08-rolls-system.md](../product-design-system/08-rolls-system.md)
- [09-phase-system.md](../product-design-system/09-phase-system.md)
- [10-notifications.md](../product-design-system/10-notifications.md)
- [11-image-upload.md](../product-design-system/11-image-upload.md)
- [12-real-time-indicators.md](../product-design-system/12-real-time-indicators.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 5.1 | Rolls Components | [01-rolls-components.md](./phase-05-features/01-rolls-components.md) | [ ] |
| 5.2 | Phase Components | [02-phase-components.md](./phase-05-features/02-phase-components.md) | [ ] |
| 5.3 | Notification Components | [03-notification-components.md](./phase-05-features/03-notification-components.md) | [ ] |
| 5.4 | Image Upload | [04-image-upload.md](./phase-05-features/04-image-upload.md) | [ ] |
| 5.5 | Real-time Indicators | [05-realtime-indicators.md](./phase-05-features/05-realtime-indicators.md) | [ ] |

### Deliverables
- [ ] Complete dice rolling UI with all states
- [ ] Phase indicators with time gate countdown
- [ ] Notification center with settings
- [ ] Image upload with storage indicators
- [ ] Real-time indicators (compose lock, typing)

---

## Phase 6: Accessibility & Polish

**Goal**: Ensure WCAG AA compliance and responsive design across all components.

**Skills**: `shadcn-react`

**Design References**:
- [13-accessibility.md](../product-design-system/13-accessibility.md)
- [14-responsive-design.md](../product-design-system/14-responsive-design.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 6.1 | Accessibility Audit | [01-accessibility-audit.md](./phase-06-polish/01-accessibility-audit.md) | [ ] |
| 6.2 | Keyboard Navigation | [02-keyboard-navigation.md](./phase-06-polish/02-keyboard-navigation.md) | [ ] |
| 6.3 | Reduced Motion | [03-reduced-motion.md](./phase-06-polish/03-reduced-motion.md) | [ ] |
| 6.4 | Mobile Responsive | [04-mobile-responsive.md](./phase-06-polish/04-mobile-responsive.md) | [ ] |
| 6.5 | Final Polish | [05-final-polish.md](./phase-06-polish/05-final-polish.md) | [ ] |

### Deliverables
- [ ] WCAG AA color contrast compliance
- [ ] Full keyboard navigation support
- [ ] Reduced motion preferences respected
- [ ] Mobile-first responsive layouts
- [ ] Touch-friendly targets (44px minimum)

---

## Critical Files

These are the key files modified during design implementation:

| File | Phase | Purpose |
|------|-------|---------|
| `services/frontend/src/index.css` | 1 | CSS variables, utility classes |
| `services/frontend/tailwind.config.js` | 1 | Theme extensions, animations |
| `services/frontend/index.html` | 1 | Font loading |
| `services/frontend/src/components/ui/*` | 2 | Updated shadcn components |
| `services/frontend/src/components/campaign/*` | 3 | Campaign view components |
| `services/frontend/src/components/scene/*` | 4 | Scene view components |
| `services/frontend/src/components/posts/*` | 4 | Post and composer components |
| `services/frontend/src/components/rolls/*` | 5 | Dice rolling UI |
| `services/frontend/src/components/phase/*` | 5 | Phase indicators |
| `services/frontend/src/components/notifications/*` | 5 | Notification center |

---

## Getting Started

1. Read [Product Design System Overview](../product-design-system/00-overview.md)
2. Start with [Phase 1: Theme Foundation](./phase-01-foundation/README.md)
3. Progress through phases sequentially
4. Mark tasks complete in this file as you go
5. Reference skills (`.claude/skills/`) when implementing

---

## Notes

- Each phase builds on previous phases
- Always read the design doc first, then implement
- Reference skills for code patterns and best practices
- Test at mobile (375px) and desktop (1280px+) breakpoints
- Update status checkboxes as you complete tasks
