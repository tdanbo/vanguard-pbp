# 1.3 Google Fonts

**Skill**: `shadcn-react`

## Goal

Load custom fonts (Cormorant Garamond for display, Source Sans 3 for body) from Google Fonts.

---

## Design References

- [01-shadcn-theme-reference.md](../../product-design-system/01-shadcn-theme-reference.md) - Lines 476-484 for font loading
- [03-design-tokens.md](../../product-design-system/03-design-tokens.md) - Typography token definitions

---

## Overview

The design system uses two primary fonts:

| Font | Purpose | Usage |
|------|---------|-------|
| **Cormorant Garamond** | Display/Serif | Scene titles, character names, headings |
| **Source Sans 3** | Body/Sans-serif | UI labels, body text, forms |

---

## Implementation Steps

### Step 1: Add Font Links to index.html

Open `services/frontend/index.html` and add inside `<head>`:

```html
<!-- Google Fonts - Vanguard Typography -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet">
```

### Step 2: Verify Font Loading

After adding the links, verify fonts load correctly:

1. Open browser DevTools
2. Go to Network tab, filter by "Font"
3. Reload page
4. Confirm fonts are downloaded

### Step 3: Test Font Application

Create a test component or modify an existing one:

```tsx
<div>
  <h1 className="font-display text-4xl font-semibold">
    Cormorant Garamond Display
  </h1>
  <p className="font-body text-base">
    Source Sans 3 body text for UI elements.
  </p>
</div>
```

---

## Font Weight Reference

### Cormorant Garamond

| Weight | Usage |
|--------|-------|
| 400 | Italic text |
| 500 | Default headings |
| 600 | Scene titles |
| 700 | Bold emphasis |

### Source Sans 3

| Weight | Usage |
|--------|-------|
| 400 | Body text |
| 500 | Labels, buttons |
| 600 | Emphasis |

---

## Key Points

- **Preconnect first**: The `preconnect` links reduce latency
- **Display swap**: `display=swap` ensures text is visible while fonts load
- **Font subsetting**: Google Fonts automatically subsets for performance
- **Fallback stack**: Tailwind config includes Georgia/system-ui fallbacks

---

## Performance Considerations

The font loading adds approximately:
- ~50KB for Cormorant Garamond (4 weights)
- ~30KB for Source Sans 3 (3 weights)

This is acceptable for the premium aesthetic goal. If needed, weights can be reduced.

---

## Success Criteria

- [ ] Font links added to `index.html`
- [ ] Fonts visible in Network tab loading from Google
- [ ] `font-display` class renders Cormorant Garamond
- [ ] `font-body` class renders Source Sans 3
- [ ] Fallback fonts display if Google Fonts fail to load
