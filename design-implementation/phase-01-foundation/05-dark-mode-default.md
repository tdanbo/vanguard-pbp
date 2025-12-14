# 1.5 Dark Mode Default

**Skill**: `shadcn-react`

## Goal

Force dark mode as the application default and remove the light/dark toggle.

---

## Design References

- [01-shadcn-theme-reference.md](../../product-design-system/01-shadcn-theme-reference.md) - Lines 325-328 for color-scheme
- [00-overview.md](../../product-design-system/00-overview.md) - Design philosophy on dark-first

---

## Overview

Vanguard PBP is designed as a **dark-first** application. The warm charcoal background with gold accents creates an immersive, premium feel that supports the "portal into fiction" design goal.

Light mode exists for accessibility edge cases but is not the primary experience.

---

## Implementation Steps

### Step 1: Add Color Scheme to CSS

In `services/frontend/src/index.css`, update the base layer:

```css
@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  /* Force dark mode by default */
  :root {
    color-scheme: dark;
  }
}
```

### Step 2: Add Dark Class to HTML Element

In `services/frontend/index.html`, ensure the `<html>` element has the dark class:

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <!-- ... -->
  </head>
  <body>
    <!-- ... -->
  </body>
</html>
```

### Step 3: Remove or Simplify Theme Toggle (If Present)

If there's a light/dark mode toggle in the app:

**Option A: Remove completely**
Delete the toggle component and associated state management.

**Option B: Hide but keep functional**
Keep the toggle for development/accessibility but hide from normal users:

```tsx
// Only show in development or with URL param
{(process.env.NODE_ENV === 'development' || searchParams.get('theme') === 'debug') && (
  <ThemeToggle />
)}
```

### Step 4: Update Theme Provider (If Using One)

If using a theme provider (e.g., next-themes), configure it for dark default:

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="dark"
  enableSystem={false}
  disableTransitionOnChange
>
  {children}
</ThemeProvider>
```

Or if using a simpler approach with localStorage:

```ts
// Remove any localStorage theme preference logic
// Or default to dark:
const theme = localStorage.getItem('theme') || 'dark'
document.documentElement.classList.add(theme)
```

### Step 5: Verify No Flash of Light Theme

Test page load to ensure no FOUC (flash of unstyled content) shows light mode briefly:

1. Hard refresh the page (Ctrl+Shift+R)
2. Confirm background is immediately dark
3. Check with browser dev tools "Disable cache" + reload

If there's a flash, ensure the `dark` class is in the HTML (not added by JavaScript after load).

---

## Key Points

- **color-scheme: dark**: Tells browsers to use dark scrollbars, form controls
- **HTML class="dark"**: Ensures dark styles apply before JS loads
- **No FOUC**: Dark mode should be immediate, not applied after hydration
- **Accessibility**: Light mode can remain available for users who need it

---

## Testing Checklist

After implementation:

1. **Fresh load test**:
   - Open in incognito window
   - Page should load dark immediately

2. **Preference persistence**:
   - If toggle exists, dark should be default
   - localStorage should not override to light

3. **Form controls**:
   - Check that inputs, selects use dark variants
   - Scrollbars should be dark (Chrome, Edge)

4. **Media queries**:
   - `prefers-color-scheme: dark` media queries should match

---

## Success Criteria

- [ ] `:root` has `color-scheme: dark`
- [ ] `<html>` element has `class="dark"`
- [ ] Page loads with dark background immediately (no flash)
- [ ] Browser scrollbars are dark
- [ ] Form controls match dark theme
- [ ] Theme toggle removed or hidden
- [ ] No JavaScript required for initial dark mode
