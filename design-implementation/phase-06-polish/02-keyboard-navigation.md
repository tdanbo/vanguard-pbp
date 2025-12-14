# 6.2 Keyboard Navigation

**Skill**: `shadcn-react`

## Goal

Ensure full keyboard navigation with visible focus states and logical tab order.

---

## Design References

- [13-accessibility.md](../../product-design-system/13-accessibility.md) - Lines 48-108 for keyboard patterns

---

## Overview

Keyboard requirements:
- All interactive elements reachable via Tab
- Visible focus indicators
- Escape closes modals/dropdowns
- Enter/Space activates buttons
- Arrow keys navigate within components
- Skip link for main content

---

## Focus Visible Styles

Ensure focus states are visible. Add to `index.css`:

```css
/* Focus ring utilities */
@layer utilities {
  .focus-gold:focus-visible {
    outline: 2px solid hsl(var(--gold));
    outline-offset: 2px;
  }

  /* Ensure all focusable elements have visible focus */
  :focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: 2px;
  }

  /* Remove default outline for non-keyboard focus */
  :focus:not(:focus-visible) {
    outline: none;
  }
}
```

---

## Skip Link

Add skip link for keyboard users to bypass navigation:

```tsx
// In App.tsx or layout
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md"
    >
      Skip to main content
    </a>
  )
}

// Usage
function Layout({ children }) {
  return (
    <>
      <SkipLink />
      <Navigation />
      <main id="main-content">
        {children}
      </main>
    </>
  )
}
```

---

## Tab Order

Ensure logical tab order:

### Correct Order

```
Skip link → Navigation → Main content → Sidebar → Footer
```

### Fixing Tab Order Issues

If elements are out of order:

```tsx
// Use tabIndex to adjust (sparingly)
<div tabIndex={0}>...</div>  // Make focusable
<div tabIndex={-1}>...</div> // Remove from tab order
```

### Modal Focus Trap

shadcn dialogs handle this automatically. Verify:

```tsx
<Dialog>
  <DialogContent>
    {/* Tab should cycle within modal */}
    {/* Escape should close */}
  </DialogContent>
</Dialog>
```

---

## Keyboard Interactions

### Buttons

- **Enter/Space**: Activate

```tsx
// Automatic with <button> or Button component
<Button onClick={handleClick}>Submit</Button>
```

### Links

- **Enter**: Navigate

```tsx
<a href="/page">Link</a>
// or
<Link to="/page">Link</Link>
```

### Custom Clickable Elements

If using div/span as clickable:

```tsx
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      handleClick()
    }
  }}
>
  Clickable content
</div>
```

### Dropdowns/Menus

- **Enter/Space**: Open menu
- **Arrow keys**: Navigate options
- **Enter**: Select option
- **Escape**: Close menu

shadcn DropdownMenu handles this automatically.

### Tabs

- **Arrow keys**: Navigate tabs
- **Enter/Space**: Activate tab

shadcn Tabs handles this automatically.

---

## Testing Keyboard Navigation

Test each page by:

1. Press Tab repeatedly through page
2. Verify all interactive elements receive focus
3. Verify focus is visible
4. Verify Enter/Space activates buttons
5. Verify Escape closes modals
6. Verify no focus traps (except modals)

### Testing Checklist

- [ ] **Navigation**: All links focusable
- [ ] **Campaign cards**: Focusable and activatable
- [ ] **Tabs**: Arrow keys navigate
- [ ] **Forms**: Tab moves through fields
- [ ] **Dialogs**: Focus trapped, Escape closes
- [ ] **Dropdowns**: Arrow keys navigate, Escape closes
- [ ] **Buttons**: Enter/Space activates
- [ ] **Scene roster**: All controls accessible
- [ ] **Composer**: All controls accessible

---

## Common Issues

### Missing Focus States

```tsx
// Add focus-visible classes
<Button className="focus-visible:ring-2 focus-visible:ring-gold">
```

### Non-interactive Elements Receiving Focus

```tsx
// Remove from tab order
<div tabIndex={-1}>Decorative content</div>
```

### Focus Not Returned After Modal Closes

```tsx
const triggerRef = useRef<HTMLButtonElement>(null)

<Dialog>
  <DialogTrigger ref={triggerRef} asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent onCloseAutoFocus={() => triggerRef.current?.focus()}>
    ...
  </DialogContent>
</Dialog>
```

---

## Success Criteria

- [ ] Skip link visible on focus
- [ ] All interactive elements focusable via Tab
- [ ] Focus indicator visible on all elements
- [ ] Tab order logical on all pages
- [ ] Escape closes all modals/dropdowns
- [ ] Enter/Space activates all buttons
- [ ] Arrow keys work in tabs and menus
