# 1.4 Utility Classes

**Skill**: `shadcn-react`

## Goal

Add custom utility and component classes for the design system (`.font-display`, `.text-gold`, `.bg-panel`, `.scene-title`, etc.).

---

## Design References

- [01-shadcn-theme-reference.md](../../product-design-system/01-shadcn-theme-reference.md) - Lines 336-473 for complete utility classes
- [07-components.md](../../product-design-system/07-components.md) - Component-specific patterns

---

## Overview

While Tailwind config exposes tokens, some patterns need custom CSS classes for:
- Complex multi-property styles (`.scene-title`)
- Pseudo-element styles (`.flourish`)
- Backdrop-filter combinations (`.bg-panel`)
- Interactive effects (`.card-interactive`)

---

## Implementation Steps

### Step 1: Add Component Layer Classes

Add to `services/frontend/src/index.css` in `@layer components`:

```css
@layer components {
  /* Gold accent utilities */
  .text-gold { color: hsl(var(--gold)); }
  .text-gold-dim { color: hsl(var(--gold-dim)); }
  .text-gold-bright { color: hsl(var(--gold-bright)); }
  .bg-gold { background-color: hsl(var(--gold)); }
  .border-gold { border-color: hsl(var(--gold)); }
  .border-gold-dim { border-color: hsl(var(--gold-dim)); }
  .ring-gold { --tw-ring-color: hsl(var(--gold)); }

  /* Panel transparency for immersive views */
  .bg-panel {
    background-color: hsl(var(--panel));
    backdrop-filter: blur(10px);
  }
  .bg-panel-solid {
    background-color: hsl(var(--panel-solid));
    backdrop-filter: blur(10px);
  }

  /* Text hierarchy utilities */
  .text-hierarchy-primary { color: hsl(var(--text-primary)); }
  .text-hierarchy-secondary { color: hsl(var(--text-secondary)); }
  .text-hierarchy-muted { color: hsl(var(--text-muted)); }

  /* Small caps treatment for labels */
  .label-caps {
    @apply text-sm font-medium tracking-wider uppercase;
    color: hsl(var(--text-secondary));
  }

  /* Display font utility */
  .font-display {
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
  }

  /* Scene title treatment */
  .scene-title {
    @apply font-display text-4xl font-semibold tracking-tight;
    text-shadow: 0 2px 20px rgba(0, 0, 0, 0.8);
  }

  /* Character name treatment */
  .character-name {
    @apply font-display text-xl font-semibold;
    color: hsl(var(--gold));
  }

  /* Card with hover lift effect */
  .card-interactive {
    @apply transition-all duration-200;
  }
  .card-interactive:hover {
    @apply -translate-y-0.5;
    border-color: hsl(var(--gold-dim));
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.5);
  }

  /* Subtle gold border for emphasis */
  .border-emphasis {
    border-color: hsl(var(--gold) / 0.3);
  }

  /* Glow effects */
  .glow-gold {
    box-shadow: 0 0 20px hsl(var(--gold) / 0.3);
  }
  .glow-gold-sm {
    box-shadow: 0 0 10px hsl(var(--gold) / 0.2);
  }

  /* Portrait sizing utilities */
  .portrait-sm {
    @apply w-12 rounded-lg object-cover;
    height: 3.75rem;
    border: 1px solid hsl(var(--border));
  }
  .portrait-md {
    @apply w-20 rounded-lg object-cover;
    height: 6.25rem;
    border: 2px solid hsl(var(--border));
  }
  .portrait-lg {
    @apply rounded-xl object-cover;
    width: 7.5rem;
    height: 9.375rem;
    border: 2px solid hsl(var(--border));
  }
}
```

### Step 2: Add Utility Layer Classes

Add to `@layer utilities`:

```css
@layer utilities {
  /* Scene header gradient overlay */
  .scene-gradient {
    background: linear-gradient(to bottom, transparent, hsl(var(--background)));
  }

  /* Atmospheric gradient for scenes without images */
  .scene-atmosphere {
    background: radial-gradient(ellipse at top, hsl(240 5% 12%), hsl(var(--background)));
  }

  /* Skeleton loading animation */
  .skeleton {
    background: linear-gradient(
      90deg,
      hsl(var(--secondary)) 25%,
      hsl(240 4% 18%) 50%,
      hsl(var(--secondary)) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s infinite;
  }

  @keyframes skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Decorative flourish divider */
  .flourish {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .flourish::before,
  .flourish::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, hsl(var(--gold-dim)), transparent);
  }

  /* Focus ring for gold theme */
  .focus-gold:focus-visible {
    outline: 2px solid hsl(var(--gold));
    outline-offset: 2px;
  }

  /* Post sidebar gradient fade */
  .gradient-fade-right {
    background: linear-gradient(to right, transparent, hsl(var(--card)));
  }

  /* Hide scrollbar but keep functionality */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
}
```

---

## Usage Examples

```tsx
// Scene view header
<div className="relative">
  <img src={sceneImage} className="w-full h-96 object-cover" />
  <div className="absolute inset-0 scene-gradient" />
  <h1 className="scene-title absolute bottom-8 left-8">The Dark Forest</h1>
</div>

// Scene without image
<div className="scene-atmosphere min-h-96">
  <h1 className="scene-title">The Dark Forest</h1>
</div>

// Character display
<div className="flex items-center gap-4">
  <img src={avatar} className="portrait-md" />
  <span className="character-name">Sir Aldric</span>
</div>

// Transparent panel over scene
<div className="bg-panel rounded-lg p-6">
  Panel content floats over scene image
</div>

// Section divider
<div className="flourish my-8">
  <span className="text-gold-dim text-sm">Chapter II</span>
</div>

// Interactive card
<div className="bg-card border rounded-lg p-4 card-interactive">
  Hover to lift
</div>

// Loading skeleton
<div className="skeleton h-4 w-48 rounded" />
```

---

## Key Points

- **Layer order**: `@layer components` for complex patterns, `@layer utilities` for single-purpose
- **HSL references**: Use `hsl(var(--token))` for CSS variable colors
- **Composability**: Classes can combine with Tailwind utilities
- **Backdrop blur**: `.bg-panel` requires transparent CSS variable value

---

## Success Criteria

- [ ] `.text-gold`, `.text-gold-dim`, `.text-gold-bright` classes work
- [ ] `.bg-panel` shows transparent background with blur
- [ ] `.scene-title` applies serif font + text shadow
- [ ] `.character-name` displays gold serif text
- [ ] `.card-interactive` lifts on hover with gold border
- [ ] `.portrait-sm/md/lg` size portraits correctly
- [ ] `.flourish` renders decorative divider
- [ ] `.scene-gradient` fades to background
- [ ] `.skeleton` animates with shimmer effect
