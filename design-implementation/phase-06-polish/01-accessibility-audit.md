# 6.1 Accessibility Audit

**Skill**: `shadcn-react`

## Goal

Audit and fix color contrast, ARIA labels, and form accessibility.

---

## Design References

- [13-accessibility.md](../../product-design-system/13-accessibility.md) - Lines 1-200 for contrast and ARIA

---

## Overview

WCAG AA requires:
- 4.5:1 contrast ratio for normal text
- 3:1 contrast ratio for large text (18px+)
- All interactive elements have accessible names
- Form inputs have associated labels

---

## Color Contrast Audit

### Check These Color Combinations

| Foreground | Background | Required | Status |
|------------|------------|----------|--------|
| `text-foreground` | `bg-background` | 4.5:1 | ✓ |
| `text-muted-foreground` | `bg-background` | 4.5:1 | Check |
| `text-gold` | `bg-background` | 4.5:1 | Check |
| `text-gold-dim` | `bg-background` | 4.5:1 | Check |
| `text-primary-foreground` | `bg-primary` | 4.5:1 | ✓ |
| `text-destructive-foreground` | `bg-destructive` | 4.5:1 | Check |
| `text-white` | badge backgrounds | 4.5:1 | Check |

### Testing Tools

Use these tools to verify contrast:

```bash
# Browser DevTools
# Chrome: Inspect element → Accessibility tab → Contrast

# Online tools
# https://webaim.org/resources/contrastchecker/
```

### Fixing Low Contrast

If `text-muted-foreground` is too light:

```css
/* In index.css, increase lightness */
.dark {
  --muted-foreground: 40 5% 60%; /* was 55% */
}
```

---

## ARIA Labels Audit

### Icon Buttons

All icon-only buttons need `aria-label`:

```tsx
// Wrong
<Button variant="ghost" size="icon">
  <X className="h-4 w-4" />
</Button>

// Correct
<Button variant="ghost" size="icon" aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>
```

### Common Icon Buttons to Check

- Close dialog (X)
- Back navigation (ChevronLeft)
- Menu toggle (MoreHorizontal)
- Delete actions (Trash2)
- Edit actions (Pencil)
- Settings (Settings)
- Notifications (Bell)
- Search (Search)

### Interactive Elements Without Labels

Search the codebase:

```bash
# Find buttons without aria-label
grep -r 'size="icon"' --include="*.tsx" | grep -v "aria-label"
```

---

## Form Accessibility

### All Inputs Need Labels

```tsx
// Wrong - placeholder only
<Input placeholder="Email" />

// Correct - with Label
<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" placeholder="you@example.com" />
</div>

// Or with FormField (react-hook-form)
<FormField
  control={form.control}
  name="email"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Email</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Error Messages

Errors should be associated with inputs:

```tsx
<FormItem>
  <FormLabel>Password</FormLabel>
  <FormControl>
    <Input type="password" aria-describedby="password-error" {...field} />
  </FormControl>
  <FormMessage id="password-error" />
</FormItem>
```

### Required Fields

Mark required fields:

```tsx
<FormLabel>
  Email <span className="text-destructive">*</span>
</FormLabel>
<Input required aria-required="true" />
```

---

## Live Regions

Dynamic content needs announcement:

```tsx
// Status messages
<div role="status" aria-live="polite">
  {isLoading ? "Loading..." : "Content loaded"}
</div>

// Alert messages
<div role="alert" aria-live="assertive">
  {error && `Error: ${error.message}`}
</div>

// Toast notifications use this automatically
```

---

## Screen Reader Only Text

For context not visible on screen:

```tsx
// Add sr-only helper
<span className="sr-only">Loading content</span>

// Example: Icon with hidden text
<Button>
  <Plus className="h-4 w-4" />
  <span className="sr-only">Add item</span>
</Button>
```

---

## Audit Checklist

Run through each page:

- [ ] **Home**: Check navigation links have accessible names
- [ ] **Login/Register**: All form fields have labels
- [ ] **Campaign List**: Cards are focusable and have names
- [ ] **Campaign Dashboard**: Tabs are keyboard accessible
- [ ] **Scene View**: Posts have proper structure
- [ ] **Composer**: All controls have labels
- [ ] **Dialogs**: Focus is trapped, close is labeled
- [ ] **Dropdowns**: Options are announced

---

## Success Criteria

- [ ] All color combinations meet contrast requirements
- [ ] All icon buttons have aria-label
- [ ] All form inputs have associated labels
- [ ] Required fields are marked
- [ ] Error messages are associated with fields
- [ ] Dynamic content uses live regions
