---
name: accessibility
description: WCAG AA accessibility patterns for the Vanguard PBP system. Use this skill when implementing keyboard navigation, ARIA attributes, screen reader support, color contrast requirements, focus management, reduced motion handling, or accessible form patterns. Critical for ensuring all users can interact with the application effectively.
---

# Accessibility

## Overview

This skill provides WCAG AA accessibility patterns for the Vanguard PBP frontend. All components must be perceivable, operable, understandable, and robust to support users with disabilities.

## Color Contrast Standards

**WCAG AA Requirements:**
- Normal text (<18px or <14px bold): **4.5:1** minimum contrast ratio
- Large text (18px+ or 14px+ bold): **3:1** minimum contrast ratio
- UI components and graphics: **3:1** minimum contrast ratio

**Current Theme Achieves:**
- Body text: ~12:1 ratio (exceeds requirement)
- Muted text: ~5:1 ratio (meets AA)
- Phase colors validated against backgrounds

**Verification Pattern:**
```tsx
// Use browser DevTools or axe to verify contrast
// Or programmatic check:
function meetsContrastRatio(foreground: string, background: string, ratio: number): boolean {
  // Calculate relative luminance and compare
  // Tools: WebAIM Contrast Checker, axe DevTools
}
```

## Keyboard Navigation

### Tab Order

Follow logical reading order: header → main content → sidebar → footer.

```tsx
// Natural tab order follows DOM order
// Use tabIndex only when necessary:
tabIndex={0}    // Add to tab order (for custom interactive elements)
tabIndex={-1}   // Remove from tab order but focusable via JS

// NEVER use positive tabIndex values (tabIndex={1}, etc.)
```

### Focus Ring

Standard focus ring for all interactive elements:

```tsx
// Tailwind focus-visible pattern (shadcn default)
className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// For dark backgrounds, adjust offset:
className="focus-visible:ring-offset-background"
```

### Skip Links

Provide skip navigation for keyboard users:

```tsx
// At top of layout, before header
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md"
>
  Skip to main content
</a>

// Target element
<main id="main-content" tabIndex={-1}>
  {/* Main content */}
</main>
```

### Focus Trapping (Dialogs)

shadcn Dialog handles focus trapping automatically. For custom modals:

```tsx
import { useEffect, useRef } from 'react';

function useFocusTrap(isOpen: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const container = containerRef.current;
    const focusableElements = container?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements?.[0] as HTMLElement;
    const lastElement = focusableElements?.[focusableElements.length - 1] as HTMLElement;

    firstElement?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return containerRef;
}
```

### Keyboard Shortcuts

Standard patterns for custom components:

| Key | Action |
|-----|--------|
| Tab | Move focus to next element |
| Shift+Tab | Move focus to previous element |
| Enter / Space | Activate button/link |
| Escape | Close modal/dropdown |
| Arrow keys | Navigate within menus, tabs, listboxes |

## ARIA Attributes

### Icon-Only Buttons

Always provide accessible labels:

```tsx
// Using aria-label
<Button variant="ghost" size="icon" aria-label="Delete post">
  <Trash2 className="h-4 w-4" />
</Button>

// Using title (shows tooltip)
<Button variant="ghost" size="icon" title="Edit character">
  <Pencil className="h-4 w-4" />
</Button>

// Using sr-only text
<Button variant="ghost" size="icon">
  <Settings className="h-4 w-4" />
  <span className="sr-only">Open settings</span>
</Button>
```

### Form Labels

Always associate labels with inputs:

```tsx
// Using htmlFor (preferred)
<label htmlFor="campaign-title" className="text-sm font-medium">
  Campaign Title
</label>
<Input id="campaign-title" {...field} />

// Using aria-label for hidden labels
<Input aria-label="Search campaigns" placeholder="Search..." />

// Using aria-labelledby for complex labels
<div id="modifier-label">Roll modifier</div>
<div id="modifier-desc">Enter a value between -100 and +100</div>
<Input
  aria-labelledby="modifier-label"
  aria-describedby="modifier-desc"
  type="number"
/>
```

### Required Fields

```tsx
// Visual indicator + screen reader text
<label htmlFor="title">
  Campaign Title
  <span className="text-destructive ml-1" aria-hidden="true">*</span>
  <span className="sr-only">(required)</span>
</label>
<Input id="title" aria-required="true" {...field} />
```

### Error States

```tsx
// Invalid input with error message
<Input
  id="email"
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? "email-error" : undefined}
  {...field}
/>
{errors.email && (
  <p id="email-error" role="alert" className="text-sm text-destructive mt-1">
    {errors.email.message}
  </p>
)}
```

### Live Regions

For dynamic content updates:

```tsx
// Polite announcement (waits for user to finish current action)
<div aria-live="polite" aria-atomic="true">
  {status === 'saving' && 'Saving draft...'}
  {status === 'saved' && 'Draft saved'}
</div>

// Assertive announcement (interrupts immediately for urgent messages)
<div aria-live="assertive" role="alert">
  {error && `Error: ${error.message}`}
</div>

// Status updates
<div role="status" aria-live="polite">
  {isLoading ? 'Loading posts...' : `${posts.length} posts loaded`}
</div>
```

### Expandable Content

```tsx
// Accordion/collapsible pattern
<button
  aria-expanded={isOpen}
  aria-controls="panel-content"
  onClick={() => setIsOpen(!isOpen)}
>
  <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
  Settings
</button>
<div
  id="panel-content"
  hidden={!isOpen}
  role="region"
  aria-labelledby="panel-button"
>
  {/* Expandable content */}
</div>
```

### Dialog/Modal

```tsx
// shadcn Dialog handles this automatically, but for reference:
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description"
>
  <h2 id="dialog-title">Confirm Delete</h2>
  <p id="dialog-description">This action cannot be undone.</p>
</div>
```

### Tabs

```tsx
// Proper tab roles (shadcn Tabs handles this)
<div role="tablist" aria-label="Campaign sections">
  <button
    role="tab"
    aria-selected={activeTab === 'scenes'}
    aria-controls="scenes-panel"
    id="scenes-tab"
  >
    Scenes
  </button>
</div>
<div
  role="tabpanel"
  id="scenes-panel"
  aria-labelledby="scenes-tab"
  tabIndex={0}
>
  {/* Tab content */}
</div>
```

## Screen Reader Patterns

### Visually Hidden Text

```tsx
// sr-only class for screen-reader-only content
<span className="sr-only">Loading content</span>

// Tailwind sr-only equivalent:
// position: absolute; width: 1px; height: 1px;
// padding: 0; margin: -1px; overflow: hidden;
// clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
```

### Decorative Elements

```tsx
// Hide decorative images/icons from screen readers
<div aria-hidden="true" className="flourish" />

// Decorative image
<img src="/divider.png" alt="" aria-hidden="true" />

// Meaningful icon with adjacent text (icon is redundant)
<Button>
  <Check className="h-4 w-4 mr-2" aria-hidden="true" />
  Confirm
</Button>
```

### Image Alt Text

```tsx
// Meaningful image - describe content
<img src={character.avatarUrl} alt={`Avatar of ${character.name}`} />

// Informative image - describe information
<img src="/phase-diagram.png" alt="Diagram showing PC Phase flowing to GM Phase and back" />

// Decorative image - empty alt
<img src="/border-flourish.png" alt="" />

// Complex image - use aria-describedby for longer descriptions
<figure>
  <img src="/map.jpg" alt="Campaign world map" aria-describedby="map-desc" />
  <figcaption id="map-desc" className="sr-only">
    Detailed description of the map showing...
  </figcaption>
</figure>
```

### Tables

```tsx
// Accessible table pattern
<table>
  <caption className="sr-only">Character roster for The Tavern scene</caption>
  <thead>
    <tr>
      <th scope="col">Character</th>
      <th scope="col">Player</th>
      <th scope="col">Pass State</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">Garrett</th>
      <td>John</td>
      <td>Passed</td>
    </tr>
  </tbody>
</table>
```

### Loading States

```tsx
// Announce loading state
<div aria-busy={isLoading} aria-live="polite">
  {isLoading ? (
    <>
      <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
      <span className="sr-only">Loading posts...</span>
    </>
  ) : (
    <PostList posts={posts} />
  )}
</div>
```

## Form Accessibility

### Error Summary

Display error summary before form for screen readers:

```tsx
{Object.keys(errors).length > 0 && (
  <div role="alert" className="mb-4 p-4 border border-destructive rounded-md">
    <h2 className="text-sm font-semibold text-destructive mb-2">
      Please fix the following errors:
    </h2>
    <ul className="list-disc pl-4 space-y-1">
      {Object.entries(errors).map(([field, error]) => (
        <li key={field}>
          <a href={`#${field}`} className="text-sm text-destructive underline">
            {error.message}
          </a>
        </li>
      ))}
    </ul>
  </div>
)}
```

### Inline Validation

```tsx
// Password field with requirements
<div>
  <label htmlFor="password">Password</label>
  <Input
    id="password"
    type="password"
    aria-describedby="password-requirements"
    {...field}
  />
  <ul id="password-requirements" className="text-xs text-muted-foreground mt-1">
    <li className={hasMinLength ? 'text-green-600' : ''}>
      At least 8 characters {hasMinLength && <Check className="inline h-3 w-3" />}
    </li>
    <li className={hasNumber ? 'text-green-600' : ''}>
      Contains a number {hasNumber && <Check className="inline h-3 w-3" />}
    </li>
  </ul>
</div>
```

## Reduced Motion

Respect user preference for reduced motion:

```tsx
// Tailwind motion-safe and motion-reduce
<Loader2 className="h-4 w-4 motion-safe:animate-spin motion-reduce:animate-none" />

// CSS approach
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

// JavaScript check
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```

## Touch Target Sizing

Minimum touch targets for mobile accessibility:

```tsx
// Minimum 44x44px for iOS, 48x48dp for Android
// Use h-11 (44px) for buttons on mobile

// Button heights
<Button className="h-11">Submit</Button>

// Icon buttons (44x44 minimum)
<Button variant="ghost" size="icon" className="h-11 w-11">
  <Settings className="h-5 w-5" />
</Button>

// Form inputs
<Input className="h-11" />

// Spacing between touch targets: minimum 8px
<div className="flex gap-2">
  <Button className="h-11">Cancel</Button>
  <Button className="h-11">Confirm</Button>
</div>
```

## Testing Checklist

### Keyboard Testing
- [ ] All interactive elements reachable via Tab
- [ ] Visible focus indicator on all focusable elements
- [ ] No keyboard traps (can always Tab out)
- [ ] Escape closes modals/dropdowns
- [ ] Enter/Space activates buttons and links
- [ ] Arrow keys work in menus and dropdowns

### Screen Reader Testing
- [ ] All images have appropriate alt text
- [ ] Form labels properly associated
- [ ] Error messages announced
- [ ] Dynamic content updates announced (aria-live)
- [ ] Buttons and links have accessible names
- [ ] Headings create logical document outline

### Visual Testing
- [ ] Content readable at 200% zoom
- [ ] Color contrast meets WCAG AA
- [ ] Focus indicators visible
- [ ] Motion can be reduced

### Tools
- **axe DevTools** (Chrome extension) - Automated accessibility testing
- **WAVE** (WebAIM) - Visual accessibility checker
- **VoiceOver** (macOS) - Screen reader testing
- **NVDA** (Windows) - Free screen reader
- **Lighthouse** - Accessibility audit in Chrome DevTools

## Common Patterns

### Accessible Card Component

```tsx
function CharacterCard({ character, onClick }: CharacterCardProps) {
  return (
    <article
      className="rounded-lg border p-4 cursor-pointer hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`View ${character.name}'s details`}
    >
      <img
        src={character.avatarUrl}
        alt=""
        aria-hidden="true"
        className="h-12 w-12 rounded-full"
      />
      <h3 className="font-semibold">{character.name}</h3>
      <p className="text-sm text-muted-foreground">{character.description}</p>
    </article>
  );
}
```

### Accessible Dropdown Menu

```tsx
// shadcn DropdownMenu handles this automatically
// For custom implementations:
function AccessibleMenu({ trigger, items }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="relative">
      <button
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
      >
        {trigger}
      </button>

      {isOpen && (
        <ul
          role="menu"
          aria-label="Actions"
          className="absolute mt-1 rounded-md border bg-popover"
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              role="menuitem"
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={item.action}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```
