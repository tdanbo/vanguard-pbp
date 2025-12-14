# Vanguard PBP Design System

## Design Philosophy

Vanguard is a play-by-post RPG platform. The UI should be a **portal into fiction**, not a barrier to it. Players should feel they are *in* the world, not *managing* a tool.

### Core Principle: Immersion Over Administration

The interface exists to serve the narrative. Every design decision should ask: "Does this pull the player deeper into the story, or does it remind them they're using software?"

## The Two Modes

The application has fundamentally different contexts that require different design languages:

| Mode | Purpose | Feel |
|------|---------|------|
| **Management Views** | Campaign setup, character creation, settings | Clean, functional, still themed but utilitarian |
| **Immersive Views** | Scene view, reading posts, composing narrative | Atmospheric, distraction-free, fiction-first |

**Scene View is sacred.** It receives the most design attention and the least UI chrome.

## Design Pillars

### 1. Warm, Premium Aesthetic
- Deep charcoal backgrounds with warm undertones
- Gold/amber accents for emphasis and interactive elements
- Elegant serif typography for headings
- Feeling: expensive tabletop book, not web app

### 2. Transparency & Atmosphere
- UI panels "float" over scene imagery
- Semi-transparent backgrounds let the world show through
- The scene is always present, never fully occluded

### 3. Character Prominence
- Large portraits, not tiny avatars
- Characters are the stars — their presence should be felt
- Generous space allocated to character imagery

### 4. Distraction-Free Scene Experience
- Scene view focuses on: Scene header → Posts → Composer
- Everything else recedes or hides
- One clear reading line down the center

### 5. Generous Space
- Let elements breathe
- Avoid cramped, dense layouts
- White space (dark space) is a feature, not waste

---

## Quick Start (Implementation)

1. **Copy CSS theme** from `01-shadcn-theme-reference.md` to `services/frontend/src/index.css`

2. **Merge Tailwind extensions** from `02-tailwind-extensions.md` into `services/frontend/tailwind.config.ts`

3. **Add Google Fonts** to `services/frontend/index.html`:
   ```html
   <link rel="preconnect" href="https://fonts.googleapis.com">
   <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
   <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Source+Sans+Pro:wght@400;500;600;700&display=swap" rel="stylesheet">
   ```

4. **Use utility classes** documented in each file:
   - `font-display` for scene titles, character names
   - `text-gold` for accent text
   - `bg-panel` for transparent panels over imagery
   - `portrait-md` for character portraits
   - `card-interactive` for hoverable cards

---

## Document Index

### Foundation

| Document | Purpose |
|----------|---------|
| [01-SHADCN-THEME-REFERENCE](./01-shadcn-theme-reference.md) | CSS variables and theme tokens |
| [02-TAILWIND-EXTENSIONS](./02-tailwind-extensions.md) | Tailwind config customizations |
| [03-DESIGN-TOKENS](./03-design-tokens.md) | Color, typography, spacing concepts |

### Views

| Document | Purpose |
|----------|---------|
| [04-VIEW-ARCHITECTURE](./04-view-architecture.md) | Management vs immersive view patterns |
| [05-SCENE-VIEW](./05-scene-view.md) | The immersive scene experience (posts, composer) |
| [06-CAMPAIGN-VIEW](./06-campaign-view.md) | Campaign management (tabs, settings, members) |

### Components & Patterns

| Document | Purpose |
|----------|---------|
| [07-COMPONENTS](./07-components.md) | Shared component patterns & utilities |
| [08-ROLLS-SYSTEM](./08-rolls-system.md) | Dice rolling UI (forms, cards, GM actions) |
| [09-PHASE-SYSTEM](./09-phase-system.md) | Phase indicators, transitions, time gates |
| [10-NOTIFICATIONS](./10-notifications.md) | Notification center and settings |
| [11-IMAGE-UPLOAD](./11-image-upload.md) | Avatar and scene header uploads |
| [12-REAL-TIME-INDICATORS](./12-real-time-indicators.md) | Compose locks, typing, live updates |

### Cross-Cutting

| Document | Purpose |
|----------|---------|
| [13-ACCESSIBILITY](./13-accessibility.md) | ARIA, keyboard navigation, contrast |
| [14-RESPONSIVE-DESIGN](./14-responsive-design.md) | Breakpoints, mobile patterns |

---

## Quick Reference: Where to Find

| Question | Document |
|----------|----------|
| "What color should this button be?" | [07-COMPONENTS](./07-components.md#button-usage-guidelines) |
| "How do I style a pending roll?" | [08-ROLLS-SYSTEM](./08-rolls-system.md#roll-states) |
| "What's the mobile layout?" | [14-RESPONSIVE-DESIGN](./14-responsive-design.md) |
| "What ARIA attributes do I need?" | [13-ACCESSIBILITY](./13-accessibility.md) |
| "Is this token implemented?" | [03-DESIGN-TOKENS](./03-design-tokens.md) |
| "How does the phase indicator look?" | [09-PHASE-SYSTEM](./09-phase-system.md#phase-indicator) |
| "What toast message should I show?" | [07-COMPONENTS](./07-components.md#toast-messages) |
| "How do I show a loading state?" | [07-COMPONENTS](./07-components.md#loading-boundaries) |
| "What dialog size should I use?" | [07-COMPONENTS](./07-components.md#dialog-sizes) |
| "How does compose lock work?" | [12-REAL-TIME-INDICATORS](./12-real-time-indicators.md#compose-lock-indicator) |

---

## Implementation Checklist

When implementing a new feature, follow this checklist:

### Pre-Implementation

- [ ] Read relevant design system docs for the feature type
- [ ] Identify which view type (management or immersive)
- [ ] Check if similar patterns exist in the codebase

### During Implementation

- [ ] Use existing shadcn/ui components (don't rebuild)
- [ ] Apply correct button variants per [07-COMPONENTS](./07-components.md#button-usage-guidelines)
- [ ] Include loading states for async operations
- [ ] Add error handling with appropriate toast messages
- [ ] Ensure mobile responsiveness (test at 375px)

### Component Checklist

- [ ] **Forms**: Use react-hook-form + zod validation
- [ ] **Buttons**: Correct variant, loading state, disabled state
- [ ] **Dialogs**: Appropriate size, keyboard accessible
- [ ] **Lists**: Consistent item pattern, empty state
- [ ] **Badges**: Correct variant for status type

### Accessibility

- [ ] Icon buttons have accessible names
- [ ] Form inputs have labels
- [ ] Focus states visible
- [ ] Error messages announced

### Polish

- [ ] Empty states have thematic messaging
- [ ] Skeleton loading for content areas
- [ ] Success/error toasts for actions
- [ ] Responsive at all breakpoints

---

## Anti-Patterns (What to Avoid)

- White/light backgrounds in immersive views
- Small avatars when portraits could be large
- Cramming multiple concerns into one view
- Utility-first styling that looks like admin software
- Competing visual elements in scene view
- Accordion/collapse patterns for primary content
- Generic component library defaults without theming
- Color alone to convey status (always add icon or text)
- Missing loading states for async operations
- Toast messages without context

---

## Implementation Status

### Tokens

| Category | Status |
|----------|--------|
| shadcn core tokens | Implemented |
| Phase colors | Implemented |
| Gold palette | NOT IMPLEMENTED (aspirational) |
| Custom fonts | NOT IMPLEMENTED (aspirational) |

See [03-DESIGN-TOKENS](./03-design-tokens.md) for full status.

### Components

All documented components are implemented in `services/frontend/src/components/`.
