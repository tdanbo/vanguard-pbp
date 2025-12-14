# Design Tokens

This document defines the conceptual design tokens for Vanguard PBP. These tokens establish the visual language and are implemented via CSS variables and Tailwind utilities.

**Related Files**:
- [01-shadcn-theme-reference.md](./01-shadcn-theme-reference.md) - CSS variable implementation
- [02-tailwind-extensions.md](./02-tailwind-extensions.md) - Tailwind utility mappings

---

## Implementation Status

| Category | Status | Notes |
|----------|--------|-------|
| shadcn core tokens | Implemented | Standard light/dark mode |
| Phase colors | Implemented | GM/PC phase, pass states |
| Gold palette | NOT IMPLEMENTED | Aspirational |
| Transparency variants | NOT IMPLEMENTED | Aspirational |
| Custom fonts | NOT IMPLEMENTED | Aspirational |
| Custom spacing | NOT IMPLEMENTED | Aspirational |

---

## Core Color Tokens (IMPLEMENTED)

These are the standard shadcn tokens currently in use:

### Background Colors

| Token | Light Mode | Dark Mode | Tailwind |
|-------|------------|-----------|----------|
| `--background` | `0 0% 100%` (white) | `222.2 84% 4.9%` (dark blue) | `bg-background` |
| `--card` | `0 0% 100%` | `222.2 84% 4.9%` | `bg-card` |
| `--popover` | `0 0% 100%` | `222.2 84% 4.9%` | `bg-popover` |
| `--muted` | `210 40% 96.1%` | `217.2 32.6% 17.5%` | `bg-muted` |
| `--secondary` | `210 40% 96.1%` | `217.2 32.6% 17.5%` | `bg-secondary` |
| `--accent` | `210 40% 96.1%` | `217.2 32.6% 17.5%` | `bg-accent` |

### Text Colors

| Token | Light Mode | Dark Mode | Tailwind |
|-------|------------|-----------|----------|
| `--foreground` | `222.2 84% 4.9%` | `210 40% 98%` | `text-foreground` |
| `--muted-foreground` | `215.4 16.3% 46.9%` | `215 20.2% 65.1%` | `text-muted-foreground` |
| `--card-foreground` | `222.2 84% 4.9%` | `210 40% 98%` | `text-card-foreground` |

### Action Colors

| Token | Light Mode | Dark Mode | Tailwind |
|-------|------------|-----------|----------|
| `--primary` | `222.2 47.4% 11.2%` | `210 40% 98%` | `bg-primary`, `text-primary` |
| `--destructive` | `0 84.2% 60.2%` | `0 62.8% 30.6%` | `bg-destructive`, `text-destructive` |

### Border & Input

| Token | Light Mode | Dark Mode | Tailwind |
|-------|------------|-----------|----------|
| `--border` | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` | `border-border` |
| `--input` | `214.3 31.8% 91.4%` | `217.2 32.6% 17.5%` | `bg-input` |
| `--ring` | `222.2 84% 4.9%` | `212.7 26.8% 83.9%` | `ring-ring` |

---

## Vanguard-Specific Tokens (IMPLEMENTED)

### Phase Colors

Used for game phase indicators:

| Token | Light Mode | Dark Mode | Tailwind | Usage |
|-------|------------|-----------|----------|-------|
| `--gm-phase` | `280 60% 50%` | `280 60% 60%` | `bg-gm-phase`, `text-gm-phase` | GM phase indicator (purple) |
| `--pc-phase` | `142 76% 36%` | `142 76% 46%` | `bg-pc-phase`, `text-pc-phase` | PC phase indicator (green) |
| `--passed` | `210 40% 60%` | `210 40% 70%` | `bg-passed`, `text-passed` | Soft pass state (blue) |
| `--hard-passed` | `215 20% 50%` | `215 20% 60%` | `bg-hard-passed`, `text-hard-passed` | Hard pass state (muted blue) |

### Base Radius

| Token | Value | Tailwind |
|-------|-------|----------|
| `--radius` | `0.5rem` (8px) | `rounded-lg`, `rounded-md`, `rounded-sm` |

---

## Aspirational Tokens (NOT YET IMPLEMENTED)

The following tokens represent the target design for Vanguard PBP. They are documented here as the "north star" but require implementation in CSS and Tailwind.

### Target Background Colors (Warm Charcoal)

```css
/* Replace current cool slate with warm charcoal */
--background: 240 6% 7%;        /* #101012 - Warm near-black */
--card: 240 5% 10%;             /* #18181b - Elevated surface */
--muted: 240 4% 14%;            /* #222225 - Muted background */
--secondary: 240 4% 14%;        /* Same as muted */
```

### Target Gold Accent Palette

```css
--gold: 43 50% 57%;             /* #c9a55c - Primary gold accent */
--gold-dim: 40 44% 42%;         /* #9a7b3c - Subdued gold */
--gold-bright: 43 65% 69%;      /* #e4c67a - Hover/highlight gold */
--warm-brown: 30 30% 40%;       /* #8b6b4a - Secondary warm accent */
```

**Target Tailwind usage**: `text-gold`, `text-gold-dim`, `text-gold-bright`, `bg-gold`, `border-gold`

### Target Transparency Variants

For immersive views with background images:

```css
--panel: 240 6% 7% / 0.85;      /* 85% opacity panel */
--panel-solid: 240 6% 7% / 0.95; /* 95% opacity for readability */
--overlay: 240 6% 4% / 0.7;      /* Modal/overlay backdrop */
```

**Target Tailwind usage**: `bg-panel`, `bg-panel-solid`

### Target Text Hierarchy

```css
--text-primary: 40 10% 96%;     /* #f5f5f4 - High contrast cream */
--text-secondary: 40 5% 65%;    /* #a8a8a4 - Secondary text */
--text-muted: 40 3% 42%;        /* #6b6b68 - Disabled/placeholder */
```

**Target Tailwind usage**: `text-hierarchy-primary`, `text-hierarchy-secondary`, `text-hierarchy-muted`

### Target Semantic Colors

```css
--success: 140 30% 35%;         /* Muted green */
--warning: 43 70% 45%;          /* Dark goldenrod */
--info: 210 25% 45%;            /* Slate blue */
```

**Note**: `--destructive` is already implemented in shadcn.

---

## Typography

### Font Families (ASPIRATIONAL)

```css
--font-display: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
--font-body: 'Source Sans 3', 'Open Sans', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

**Usage guidance**:

| Font | Use For |
|------|---------|
| Display | Scene titles, character names, section headers, campaign titles |
| Body | Post content, UI labels, buttons, form inputs |
| Mono | Code blocks, roll results, timestamps |

### Type Scale (Standard Tailwind)

These are standard Tailwind classes, always available:

| Class | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px | Timestamps, fine print |
| `text-sm` | 14px | Secondary labels, captions |
| `text-base` | 16px | Body text |
| `text-lg` | 18px | Emphasized body |
| `text-xl` | 20px | Section headers |
| `text-2xl` | 24px | Card titles |
| `text-3xl` | 30px | Page headers |
| `text-4xl` | 36px | Scene titles |
| `text-5xl` | 48px | Hero titles |

### Font Weights

| Class | Weight | Usage |
|-------|--------|-------|
| `font-normal` | 400 | Body text |
| `font-medium` | 500 | Labels, emphasis |
| `font-semibold` | 600 | Headings, names |
| `font-bold` | 700 | Strong emphasis |

### Letter Spacing

| Class | Value | Usage |
|-------|-------|-------|
| `tracking-tighter` | -0.05em | Display headings |
| `tracking-tight` | -0.025em | Large text |
| `tracking-normal` | 0 | Body text |
| `tracking-wide` | 0.025em | Small caps, labels |
| `tracking-wider` | 0.05em | All-caps labels |

### Small Caps Treatment

For labels, navigation, and category headers:

```tsx
// Recommended pattern
<span className="text-sm font-medium tracking-wider uppercase text-muted-foreground">
  CHARACTERISTICS
</span>
```

---

## Spacing

### Base Unit: 4px

Tailwind uses a 4px base unit. Use standard Tailwind spacing classes:

| Class | Value | Pixels |
|-------|-------|--------|
| `p-1`, `m-1`, `gap-1` | 0.25rem | 4px |
| `p-2`, `m-2`, `gap-2` | 0.5rem | 8px |
| `p-3`, `m-3`, `gap-3` | 0.75rem | 12px |
| `p-4`, `m-4`, `gap-4` | 1rem | 16px |
| `p-6`, `m-6`, `gap-6` | 1.5rem | 24px |
| `p-8`, `m-8`, `gap-8` | 2rem | 32px |
| `p-10`, `m-10`, `gap-10` | 2.5rem | 40px |
| `p-12`, `m-12`, `gap-12` | 3rem | 48px |

### Contextual Spacing Guidelines

| Context | Recommended | Classes |
|---------|-------------|---------|
| Content padding (inside cards) | 24px | `p-6` |
| Section gap (between major sections) | 32px | `gap-8`, `space-y-8` |
| Element gap (between related elements) | 16px | `gap-4`, `space-y-4` |
| Tight gap (between coupled items) | 8px | `gap-2`, `space-y-2` |

---

## Border Radius (IMPLEMENTED)

| Class | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | `calc(--radius - 4px)` | Small elements |
| `rounded-md` | `calc(--radius - 2px)` | Buttons, inputs |
| `rounded-lg` | `--radius` (0.5rem) | Cards, modals |
| `rounded-xl` | 0.75rem | Large cards (aspirational) |
| `rounded-2xl` | 1rem | Hero cards (aspirational) |
| `rounded-full` | 9999px | Pills, avatars |

---

## Shadows

### Current (Standard Tailwind)

Use standard Tailwind shadow classes. For dark themes, shadows need to be heavier:

```tsx
<div className="shadow-sm">Subtle shadow</div>
<div className="shadow">Default shadow</div>
<div className="shadow-md">Medium shadow</div>
<div className="shadow-lg">Large shadow</div>
<div className="shadow-xl">Extra large shadow</div>
```

### Target Shadows (ASPIRATIONAL)

Heavier shadows optimized for dark backgrounds:

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.6);

/* Glow effects */
--glow-gold: 0 0 20px rgba(201, 165, 92, 0.3);
--glow-soft: 0 0 40px rgba(0, 0, 0, 0.5);
```

---

## Transitions

### Standard Tailwind Durations

| Class | Duration | Usage |
|-------|----------|-------|
| `duration-150` | 150ms | Fast interactions (hovers) |
| `duration-200` | 200ms | Standard transitions |
| `duration-300` | 300ms | Slower transitions |
| `duration-500` | 500ms | Slow transitions (modals) |

### Recommended Patterns

```tsx
// Hover effects
<div className="transition-colors duration-200 hover:bg-muted">
  Hover me
</div>

// Transform effects
<div className="transition-transform duration-200 hover:-translate-y-0.5">
  Lift on hover
</div>

// Combined
<div className="transition-all duration-200 hover:shadow-lg hover:border-primary">
  Interactive card
</div>
```

---

## Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| Base | 0 | Normal content |
| Elevated | 10 | Cards, dropdowns |
| Sticky | 20 | Sticky headers |
| Overlay | 30 | Modal backdrops |
| Modal | 40 | Modal content |
| Tooltip | 50 | Tooltips, popovers |
| Toast | 60 | Toast notifications |

**Tailwind classes**: `z-0`, `z-10`, `z-20`, `z-30`, `z-40`, `z-50`

---

## Roll State Colors (In Use But Not Tokenized)

The codebase currently uses inline Tailwind colors for roll states. These should be tokenized:

| State | Current Usage | Recommended Token |
|-------|---------------|-------------------|
| Pending | `bg-yellow-500/10 text-yellow-600` | `--roll-pending` |
| Success | `bg-green-500/10 text-green-600` | `--roll-success` |
| Failure | `bg-red-500/10 text-red-600` | `--roll-failure` |
| Invalidated | `bg-muted text-muted-foreground` | Use existing tokens |

---

## Quick Reference

### What's Available Now

```tsx
// Backgrounds
bg-background, bg-card, bg-muted, bg-secondary, bg-accent, bg-destructive

// Text
text-foreground, text-muted-foreground, text-card-foreground, text-destructive

// Phase colors
bg-gm-phase, bg-pc-phase, bg-passed, bg-hard-passed
text-gm-phase, text-pc-phase

// Borders
border-border, border-input

// Radius
rounded-sm, rounded-md, rounded-lg, rounded-full
```

### What's Aspirational

```tsx
// Gold palette
text-gold, text-gold-dim, text-gold-bright, bg-gold, border-gold

// Transparency
bg-panel, bg-panel-solid

// Text hierarchy
text-hierarchy-primary, text-hierarchy-secondary, text-hierarchy-muted

// Fonts
font-display, font-body, font-mono

// Custom shadows
shadow-glow-gold, shadow-glow-soft
```
