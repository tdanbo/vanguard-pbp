# 6.3 Reduced Motion

**Skill**: `shadcn-react`

## Goal

Respect user's motion preferences by disabling or reducing animations.

---

## Design References

- [13-accessibility.md](../../product-design-system/13-accessibility.md) - Lines 283-311 for motion preferences

---

## Overview

Some users experience motion sickness or vestibular disorders. When they enable "Reduce motion" in their OS:
- Disable non-essential animations
- Replace with instant transitions
- Keep essential feedback (loading spinners)

---

## Implementation

### Global Motion Settings

Add to `index.css`:

```css
@layer base {
  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}
```

### Tailwind Utilities

Use Tailwind's motion utilities:

```tsx
// Animation that respects motion preference
<div className="motion-safe:animate-fade-in motion-reduce:animate-none">
  Content
</div>

// Transition that respects motion preference
<div className="motion-safe:transition-transform motion-reduce:transition-none">
  Content
</div>
```

---

## Specific Components

### Card Hover Effect

```tsx
// Original
<Card className="card-interactive">

// Update card-interactive in CSS
.card-interactive {
  @apply transition-all duration-200;
}
.card-interactive:hover {
  @apply -translate-y-0.5;
  /* ... */
}

@media (prefers-reduced-motion: reduce) {
  .card-interactive {
    transition-duration: 0.01ms;
  }
  .card-interactive:hover {
    transform: none;
  }
}
```

### Skeleton Loading

```tsx
// Original
<div className="animate-skeleton">

// With motion preference
<div className="motion-safe:animate-skeleton motion-reduce:bg-secondary">
```

### Bouncing Dots (Typing Indicator)

```tsx
// Original
<span className="animate-bounce">

// With motion preference
<span className="motion-safe:animate-bounce motion-reduce:animate-none">

// Or use opacity pulse instead
@media (prefers-reduced-motion: reduce) {
  .typing-dot {
    animation: none;
    opacity: 0.5;
  }
}
```

### Lock Timer Bar

Keep the progress bar (it's informational), but remove animation:

```tsx
<div
  className={cn(
    "h-full motion-safe:transition-all motion-reduce:transition-none",
    colorClass
  )}
  style={{ width: `${percentage}%` }}
/>
```

---

## Keep Essential Animations

Some animations provide critical feedback:

### Loading Spinners

Keep spinners for loading states:

```css
@media (prefers-reduced-motion: reduce) {
  /* Exception: keep loading spinners */
  .animate-spin {
    animation-duration: 1s !important;
  }
}
```

### Progress Indicators

Keep progress bars moving (reduce speed):

```css
@media (prefers-reduced-motion: reduce) {
  .animate-drain {
    /* Keep drain animation but simplify */
    animation-timing-function: linear;
  }
}
```

---

## Testing Reduced Motion

### Enable in OS

**macOS**: System Preferences → Accessibility → Display → Reduce motion

**Windows**: Settings → Ease of Access → Display → Show animations

**iOS**: Settings → Accessibility → Motion → Reduce Motion

**Android**: Settings → Accessibility → Remove animations

### CSS Media Query Test

In browser DevTools:
1. Open Command Palette (Cmd/Ctrl + Shift + P)
2. Type "Rendering"
3. Find "Emulate CSS media feature prefers-reduced-motion"

---

## Audit Components

Check these components for motion:

| Component | Animation | Reduced Motion Behavior |
|-----------|-----------|------------------------|
| Card hover | translateY | Disable transform |
| Skeleton | Shimmer | Static gray |
| Accordion | Expand/collapse | Instant |
| Dialog | Fade/scale | Instant |
| Dropdown | Fade/slide | Instant |
| Toast | Slide in | Instant appear |
| Typing dots | Bounce | Static dots |
| Progress bar | Width change | Reduce transition |

---

## Success Criteria

- [ ] Global reduced motion media query added
- [ ] Card hover animation disabled in reduced motion
- [ ] Skeleton uses static background in reduced motion
- [ ] Typing indicator doesn't bounce in reduced motion
- [ ] Loading spinners still animate (essential)
- [ ] Dialogs open instantly in reduced motion
- [ ] Toast notifications appear instantly
