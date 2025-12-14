# 2.1 Button Patterns

**Skill**: `shadcn-react`

## Goal

Ensure button variants use the gold accent theme and establish consistent usage guidelines.

---

## Design References

- [07-components.md](../../product-design-system/07-components.md) - Lines 72-157 for button patterns

---

## Overview

The button component should automatically use gold as the primary color due to CSS variable changes. This task documents usage patterns and ensures all variants work correctly.

---

## Button Variants

### Primary (Default)

For main CTAs: "Create", "Post", "Save", "Submit"

```tsx
import { Button } from "@/components/ui/button"

<Button>Post</Button>
<Button>Create Scene</Button>
<Button>Save Changes</Button>
```

The primary button uses:
- `bg-primary` → gold (#c9a55c)
- `text-primary-foreground` → dark background color
- `hover:bg-primary/90` → slightly transparent on hover

### Secondary (Outline)

For secondary actions: "Cancel", "Edit", "Archive"

```tsx
<Button variant="outline">Cancel</Button>
<Button variant="outline">Edit Character</Button>
```

### Ghost

For tertiary actions, often in toolbars:

```tsx
<Button variant="ghost">Settings</Button>
<Button variant="ghost" size="sm">Archive</Button>
```

### Destructive

For dangerous actions:

```tsx
<Button variant="destructive">Delete Campaign</Button>
<Button variant="destructive">Remove Character</Button>
```

### Link

For navigation-style buttons:

```tsx
<Button variant="link">View All</Button>
```

---

## Button Sizes

| Size | Height | Padding | Usage |
|------|--------|---------|-------|
| `sm` | 36px | `px-3` | Compact UI, tables |
| `default` | 40px | `px-4 py-2` | Most buttons |
| `lg` | 44px | `px-8` | Hero CTAs |
| `icon` | 40px | `h-10 w-10` | Icon-only buttons |

```tsx
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Plus className="h-4 w-4" /></Button>
```

---

## Common Patterns

### Button with Icon

```tsx
import { Send, Pencil, Trash2, Plus } from "lucide-react"

// Icon before text
<Button>
  <Send className="h-4 w-4 mr-2" />
  Post
</Button>

// Icon after text
<Button variant="outline">
  Edit
  <Pencil className="h-4 w-4 ml-2" />
</Button>
```

### Loading State

```tsx
import { Loader2 } from "lucide-react"

<Button disabled={isLoading}>
  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
  {isLoading ? "Posting..." : "Post"}
</Button>
```

### Icon Button (Floating)

For buttons floating over scene images:

```tsx
<Button
  variant="ghost"
  size="icon"
  className="rounded-full bg-panel backdrop-blur-sm border border-border"
>
  <ChevronLeft className="h-5 w-5" />
</Button>
```

### Destructive Outline

For dangerous but secondary actions:

```tsx
<Button
  variant="outline"
  className="border-destructive text-destructive hover:bg-destructive hover:text-foreground"
>
  Transfer GM Role
</Button>
```

---

## Usage Guidelines

| Action Type | Variant | Example |
|-------------|---------|---------|
| Primary CTA | `default` | Post, Create, Save |
| Cancel/Close | `outline` | Cancel, Close |
| Navigation | `ghost` or `link` | Back, View All |
| Danger (primary) | `destructive` | Delete Campaign |
| Danger (secondary) | `outline` + destructive classes | Transfer Role |
| Toolbar action | `ghost` + `size="icon"` | Settings, Menu |

---

## Accessibility

All icon-only buttons need accessible names:

```tsx
<Button variant="ghost" size="icon" aria-label="Close dialog">
  <X className="h-4 w-4" />
</Button>

<Button variant="ghost" size="icon" aria-label="Delete post">
  <Trash2 className="h-4 w-4" />
</Button>
```

---

## Implementation Steps

### Step 1: Verify Primary Button Color

After Phase 1 theme changes, primary buttons should automatically use gold. Test:

```tsx
<Button>Test Gold Button</Button>
```

If not gold, check that `--primary: 43 50% 57%` is set in `.dark` CSS.

### Step 2: Document Usage in Components

Ensure existing components use correct variants:

- Forms: Primary for submit, Outline for cancel
- Dialogs: Primary for confirm, Outline for cancel, Destructive for danger
- Toolbars: Ghost for actions

### Step 3: Create Loading Button Helper (Optional)

```tsx
// components/ui/loading-button.tsx
import { Button, ButtonProps } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean
  loadingText?: string
}

export function LoadingButton({
  children,
  loading,
  loadingText,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <Button disabled={loading || disabled} {...props}>
      {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
      {loading && loadingText ? loadingText : children}
    </Button>
  )
}
```

---

## Success Criteria

- [ ] Primary button displays gold background
- [ ] All variant buttons render correctly
- [ ] Icon buttons have proper sizing
- [ ] Loading state shows spinner
- [ ] Accessible names on all icon buttons
- [ ] Floating buttons work over scene images with bg-panel
