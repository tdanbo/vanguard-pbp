# Accessibility

This document defines accessibility standards and patterns for Vanguard PBP.

---

## Design Principles

1. **Perceivable** - Information must be presentable in ways users can perceive
2. **Operable** - UI components must be operable via various input methods
3. **Understandable** - Information and operation must be understandable
4. **Robust** - Content must work with assistive technologies

---

## Color Contrast

### Minimum Contrast Ratios

| Text Type | Ratio | Standard |
|-----------|-------|----------|
| Normal text | 4.5:1 | WCAG AA |
| Large text (18px+ or 14px+ bold) | 3:1 | WCAG AA |
| UI components and graphics | 3:1 | WCAG AA |

### Current Theme Contrast

| Element | Foreground | Background | Ratio |
|---------|------------|------------|-------|
| Body text | `foreground` | `background` | ~12:1 |
| Muted text | `muted-foreground` | `background` | ~5:1 |
| Primary button | `primary-foreground` | `primary` | ~8:1 |
| Destructive | `destructive-foreground` | `destructive` | ~4.5:1 |

### Testing Contrast

Always verify contrast when:
- Adding new color combinations
- Overlaying text on images
- Using transparency

Tools:
- Chrome DevTools color picker shows contrast ratio
- WebAIM Contrast Checker

---

## Keyboard Navigation

### Focus Management

All interactive elements must be focusable and operable via keyboard.

#### Focus Ring

```tsx
// Default shadcn focus styling
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
```

#### Tab Order

Elements should follow logical reading order:
1. Header/navigation
2. Main content (left to right, top to bottom)
3. Sidebar (if any)
4. Footer

### Common Keyboard Patterns

| Key | Action |
|-----|--------|
| `Tab` | Move focus to next focusable element |
| `Shift+Tab` | Move focus to previous element |
| `Enter` | Activate button, submit form |
| `Space` | Toggle checkbox, activate button |
| `Escape` | Close modal/dropdown |
| `Arrow keys` | Navigate within menus, tabs |

### Skip Links

Provide skip link for keyboard users:

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:border focus:rounded"
>
  Skip to main content
</a>

<main id="main-content">
  {/* Page content */}
</main>
```

### Focus Trapping

Modals and dialogs should trap focus within:

```tsx
// shadcn Dialog handles this automatically
<Dialog>
  <DialogContent>
    {/* Focus trapped here */}
  </DialogContent>
</Dialog>
```

---

## ARIA Attributes

### Buttons

```tsx
// Icon-only buttons need accessible names
<Button variant="ghost" size="icon" aria-label="Edit">
  <Pencil className="h-4 w-4" />
</Button>

// Or use title (shown on hover)
<Button variant="ghost" size="icon" title="Edit">
  <Pencil className="h-4 w-4" />
</Button>
```

### Forms

```tsx
// Label association
<Label htmlFor="title">Title</Label>
<Input id="title" name="title" />

// Required fields
<Label htmlFor="name">
  Name <span className="text-destructive">*</span>
</Label>
<Input id="name" required aria-required="true" />

// Error states
<Input
  id="email"
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? "email-error" : undefined}
/>
{errors.email && (
  <p id="email-error" className="text-sm text-destructive" role="alert">
    {errors.email.message}
  </p>
)}
```

### Live Regions

For dynamic content updates:

```tsx
// Polite announcements (non-urgent)
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>

// Assertive announcements (urgent)
<div aria-live="assertive" role="alert">
  {errorMessage}
</div>

// Screen reader only announcements
<div className="sr-only" aria-live="polite">
  {loadingComplete ? "Content loaded" : "Loading..."}
</div>
```

### Expandable Content

```tsx
<Button
  aria-expanded={isOpen}
  aria-controls="panel-content"
  onClick={() => setIsOpen(!isOpen)}
>
  {isOpen ? "Hide" : "Show"} Details
</Button>
<div id="panel-content" hidden={!isOpen}>
  {/* Content */}
</div>
```

### Dialogs

```tsx
<Dialog>
  <DialogContent
    aria-labelledby="dialog-title"
    aria-describedby="dialog-description"
  >
    <DialogTitle id="dialog-title">Title</DialogTitle>
    <DialogDescription id="dialog-description">
      Description text
    </DialogDescription>
  </DialogContent>
</Dialog>
```

### Tabs

```tsx
<Tabs>
  <TabsList role="tablist">
    <TabsTrigger role="tab" aria-selected={active} aria-controls="tab-panel-1">
      Tab 1
    </TabsTrigger>
  </TabsList>
  <TabsContent role="tabpanel" id="tab-panel-1" aria-labelledby="tab-1">
    Content
  </TabsContent>
</Tabs>
```

### Loading States

```tsx
// Loading button
<Button disabled aria-busy="true">
  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
  <span>Loading...</span>
</Button>

// Loading region
<div aria-busy={isLoading} aria-live="polite">
  {isLoading ? <Skeleton /> : content}
</div>
```

---

## Screen Reader Text

### Visually Hidden Content

Use for content that should only be read by screen readers:

```tsx
// Using Tailwind
<span className="sr-only">Close dialog</span>

// Full definition
<span className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0">
  Screen reader only text
</span>
```

### Icon Buttons

```tsx
// Option 1: sr-only text
<Button variant="ghost" size="icon">
  <Trash2 className="h-4 w-4" />
  <span className="sr-only">Delete post</span>
</Button>

// Option 2: aria-label
<Button variant="ghost" size="icon" aria-label="Delete post">
  <Trash2 className="h-4 w-4" />
</Button>
```

### Decorative Elements

Mark purely decorative elements as hidden from assistive tech:

```tsx
// Decorative icon
<Crown className="h-4 w-4" aria-hidden="true" />

// Decorative image
<img src={decoration} alt="" aria-hidden="true" />
```

---

## Reduced Motion

Respect user preferences for reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### In Tailwind

```tsx
// Only animate when motion is preferred
<div className="motion-safe:animate-spin">
  {/* Animated content */}
</div>

// Or disable when reduced motion preferred
<div className="animate-bounce motion-reduce:animate-none">
  {/* Content */}
</div>
```

---

## Focus Visible

Use `focus-visible` instead of `focus` for keyboard-only focus styles:

```tsx
// Only show focus ring for keyboard navigation
className="focus-visible:ring-2 focus-visible:ring-ring"

// Not mouse clicks
// Avoid: className="focus:ring-2"
```

---

## Image Accessibility

### Alternative Text

```tsx
// Meaningful image
<img
  src={character.avatar}
  alt={`${character.name}'s portrait`}
/>

// Decorative image
<img src={decoration} alt="" aria-hidden="true" />

// Complex image (use figure)
<figure>
  <img src={diagram} alt="" aria-describedby="diagram-desc" />
  <figcaption id="diagram-desc">
    Detailed description of the diagram...
  </figcaption>
</figure>
```

### Avatar Fallbacks

```tsx
<Avatar>
  <AvatarImage src={user.avatar} alt={user.name} />
  <AvatarFallback aria-label={user.name}>
    {getInitials(user.name)}
  </AvatarFallback>
</Avatar>
```

---

## Table Accessibility

```tsx
<table>
  <caption className="sr-only">Campaign members list</caption>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Role</th>
      <th scope="col">Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Player Name</td>
      <td>GM</td>
      <td>
        <Button aria-label="Edit Player Name">Edit</Button>
      </td>
    </tr>
  </tbody>
</table>
```

---

## Color Independence

Never rely on color alone to convey information:

### Good Patterns

```tsx
// Color + icon
<Badge variant="destructive">
  <AlertTriangle className="mr-1 h-3 w-3" />
  Error
</Badge>

// Color + text
<span className="text-destructive">Error: Invalid input</span>

// Color + pattern (for charts)
// Use different shapes/patterns in addition to colors
```

### Bad Patterns

```tsx
// Don't: Color alone
<span className="text-green-500">Valid</span>
<span className="text-red-500">Invalid</span>

// Instead: Include text or icon
<span className="text-green-500">
  <Check className="inline mr-1 h-4 w-4" />
  Valid
</span>
```

---

## Form Patterns

### Required Fields

```tsx
<FormField>
  <FormLabel>
    Email
    <span className="text-destructive ml-1" aria-hidden="true">*</span>
    <span className="sr-only">(required)</span>
  </FormLabel>
  <FormControl>
    <Input type="email" required aria-required="true" />
  </FormControl>
</FormField>
```

### Error Summary

For forms with multiple errors, provide a summary:

```tsx
{Object.keys(errors).length > 0 && (
  <Alert variant="destructive" role="alert">
    <AlertTitle>Please fix the following errors:</AlertTitle>
    <AlertDescription>
      <ul className="list-disc pl-4">
        {Object.entries(errors).map(([field, error]) => (
          <li key={field}>
            <a href={`#${field}`}>{error.message}</a>
          </li>
        ))}
      </ul>
    </AlertDescription>
  </Alert>
)}
```

### Inline Validation

```tsx
<FormField>
  <FormLabel htmlFor="password">Password</FormLabel>
  <FormControl>
    <Input
      id="password"
      type="password"
      aria-describedby="password-requirements password-error"
    />
  </FormControl>
  <p id="password-requirements" className="text-xs text-muted-foreground">
    Must be at least 8 characters
  </p>
  {errors.password && (
    <p id="password-error" className="text-sm text-destructive" role="alert">
      {errors.password.message}
    </p>
  )}
</FormField>
```

---

## Testing Checklist

### Keyboard Testing

- [ ] All interactive elements reachable via Tab
- [ ] Visible focus indicator on all elements
- [ ] Escape closes all modals/dropdowns
- [ ] Arrow keys work in menus and selects
- [ ] No keyboard traps

### Screen Reader Testing

- [ ] All images have appropriate alt text
- [ ] Form fields have associated labels
- [ ] Error messages are announced
- [ ] Dynamic content updates are announced
- [ ] Headings create logical document outline

### Visual Testing

- [ ] Content readable at 200% zoom
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible
- [ ] Animations respect reduced motion preference

### Tools

- **axe DevTools** - Browser extension for automated testing
- **WAVE** - Web accessibility evaluation tool
- **VoiceOver** (Mac) / **NVDA** (Windows) - Screen reader testing
- **Lighthouse** - Chrome DevTools accessibility audit

---

## Common Components Checklist

### Button
- [ ] Has accessible name (text or aria-label)
- [ ] Disabled state uses `disabled` attribute
- [ ] Loading state indicates busy

### Dialog
- [ ] Focus moves to dialog on open
- [ ] Escape closes dialog
- [ ] Focus returns to trigger on close
- [ ] Has aria-labelledby

### Form
- [ ] All inputs have labels
- [ ] Errors are announced
- [ ] Required fields indicated
- [ ] Submit/cancel buttons clearly labeled

### Navigation
- [ ] Current page indicated
- [ ] Keyboard navigable
- [ ] Skip link available

### Toast
- [ ] Uses role="alert" for errors
- [ ] Uses aria-live for status messages
- [ ] Dismissible via keyboard
