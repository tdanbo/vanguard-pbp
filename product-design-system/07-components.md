# Components

This document defines shared component patterns used across Vanguard PBP.

**Related Files**:
- [01-shadcn-theme-reference.md](./01-shadcn-theme-reference.md) - CSS variables
- [02-tailwind-extensions.md](./02-tailwind-extensions.md) - Tailwind utilities

---

All components should feel cohesive with the consistent aesthetic. Use shadcn/ui components with the Vanguard theme applied.

---

## Utility Classes Reference

These pre-built classes are defined in the theme file for common patterns:

### Typography Utilities

| Class | Effect | Usage |
|-------|--------|-------|
| `font-display` | Cormorant Garamond serif | Scene titles, character names, headings |
| `font-body` | Source Sans Pro sans-serif | Body text, UI labels, buttons |
| `scene-title` | 4xl display font, semibold, text-shadow | Scene header titles |
| `character-name` | xl display font, semibold, gold color | Character names in posts |
| `label-caps` | sm, medium weight, tracking-wider, uppercase | Section labels, navigation |
| `flourish` | Decorative pseudo-element divider | Section dividers with gold lines |

### Color Utilities

| Class | Effect |
|-------|--------|
| `text-gold` | Primary gold accent (#c9a55c) |
| `text-gold-dim` | Subdued gold (#9a7b3c) |
| `text-gold-bright` | Bright gold for hover (#e4c67a) |
| `bg-gold`, `bg-gold-dim`, `bg-gold-bright` | Gold backgrounds |
| `border-gold`, `border-gold-dim` | Gold borders |
| `bg-gm-phase` / `text-gm-phase` | GM phase purple |
| `bg-pc-phase` / `text-pc-phase` | PC phase green |
| `bg-passed` / `text-passed` | Passed state gray |
| `bg-hard-passed` / `text-hard-passed` | Hard passed state |

### Surface Utilities

| Class | Effect |
|-------|--------|
| `bg-panel` | 85% opacity background + backdrop-blur |
| `bg-panel-solid` | 95% opacity background + backdrop-blur |
| `bg-overlay` | Dark overlay for modals (70% opacity) |
| `card-interactive` | Hover lift + gold border + shadow-lg |

### Scene Utilities

| Class | Effect |
|-------|--------|
| `scene-gradient` | Linear gradient from transparent to background |
| `scene-atmosphere` | Radial gradient for scenes without images |
| `glow-gold` | Gold box-shadow glow effect |

### Portrait Utilities

| Class | Dimensions |
|-------|------------|
| `portrait-sm` | 48px × 60px |
| `portrait-md` | 80px × 100px |
| `portrait-lg` | 120px × 150px |

---

## Buttons

Using shadcn/ui `<Button>` with Vanguard theme:

### Primary Button (Gold Accent)

For main CTAs: "Create Scene", "Post", "Save"

```tsx
import { Button } from "@/components/ui/button"

// Default primary - uses gold from theme
<Button>Post</Button>

// With icon
<Button>
  <Send className="h-4 w-4 mr-2" />
  Post
</Button>

// Disabled state
<Button disabled>Post</Button>
```

The primary button automatically uses:
- `bg-primary` (gold) background
- `text-primary-foreground` (dark) text
- `hover:bg-primary/90` on hover

### Secondary Button (Outlined)

For secondary actions: "Cancel", "Edit", "Archive"

```tsx
<Button variant="outline">Cancel</Button>
<Button variant="outline">
  <Pencil className="h-4 w-4 mr-2" />
  Edit
</Button>
```

### Ghost Button (Minimal)

For tertiary actions, often with icons:

```tsx
<Button variant="ghost">Settings</Button>
<Button variant="ghost" size="sm">
  <Archive className="h-4 w-4 mr-2" />
  Archive
</Button>
```

### Icon Button

Circular buttons for actions like back, menu, close:

```tsx
<Button variant="ghost" size="icon" className="rounded-full">
  <ChevronLeft className="h-5 w-5" />
</Button>

// With panel background (for floating over scenes)
<Button
  variant="ghost"
  size="icon"
  className="w-10 h-10 rounded-full bg-panel border border-border"
>
  <MoreHorizontal className="h-5 w-5" />
</Button>
```

### Destructive Button

For dangerous actions:

```tsx
<Button variant="destructive">
  <Trash2 className="h-4 w-4 mr-2" />
  Delete
</Button>

// Outlined destructive
<Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-foreground">
  Transfer GM Role
</Button>
```

---

## Form Inputs

Using shadcn/ui form components:

### Text Input

```tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

<div className="space-y-2">
  <Label htmlFor="title">Scene Title</Label>
  <Input
    id="title"
    placeholder="Enter scene title..."
    className="bg-secondary"
  />
</div>
```

Focus state automatically uses gold ring from theme.

### Textarea

```tsx
import { Textarea } from "@/components/ui/textarea"

<Textarea
  placeholder="Write your narrative here..."
  className="min-h-[120px] bg-secondary border-border focus:border-gold focus:ring-gold"
/>
```

### Form with Validation

```tsx
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

<Form {...form}>
  <FormField
    control={form.control}
    name="title"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Title</FormLabel>
        <FormControl>
          <Input placeholder="Scene title" {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
</Form>
```

### Select

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

<Select>
  <SelectTrigger className="bg-secondary">
    <SelectValue placeholder="Select character" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="char1">Doravar Redbraid</SelectItem>
    <SelectItem value="char2">Elena Nightwhisper</SelectItem>
  </SelectContent>
</Select>
```

---

## Cards

Using shadcn/ui `<Card>` components:

### Base Card

```tsx
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle className="font-display">Scene Settings</CardTitle>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    <Button>Save</Button>
  </CardFooter>
</Card>
```

### Interactive Card

Use the `card-interactive` utility class:

```tsx
<Card className="card-interactive cursor-pointer">
  {/* Automatically gets hover:border-gold-dim, hover:-translate-y-0.5, hover:shadow-lg */}
  <CardContent className="p-4">
    <h3 className="font-display text-lg">The Fainted Rose Inn</h3>
    <p className="text-sm text-muted-foreground">12 posts</p>
  </CardContent>
</Card>
```

### Transparent Card (Immersive Views)

```tsx
<Card className="bg-panel backdrop-blur-md border-border">
  {/* Panel floats over scene imagery */}
  <CardContent className="p-6">
    {/* Post content */}
  </CardContent>
</Card>
```

---

## Portraits & Avatars

### Portrait (Character Art - Rectangular)

Use `portrait-*` utility classes:

```tsx
// Small (48×60)
<img src={avatar} alt={name} className="portrait-sm" />

// Medium (80×100) - Default for post cards
<img src={avatar} alt={name} className="portrait-md" />

// Large (120×150)
<img src={avatar} alt={name} className="portrait-lg" />
```

### Avatar (User Profile - Circular)

For user avatars (not character portraits):

```tsx
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

<Avatar>
  <AvatarImage src={user.avatarUrl} />
  <AvatarFallback>DR</AvatarFallback>
</Avatar>

// Sizes via className
<Avatar className="h-8 w-8">...</Avatar>  // Small
<Avatar className="h-10 w-10">...</Avatar> // Medium
<Avatar className="h-14 w-14">...</Avatar> // Large
```

### Portrait with Fallback

```tsx
function CharacterPortrait({ character, size = "md" }: Props) {
  const sizeClass = {
    sm: "portrait-sm",
    md: "portrait-md",
    lg: "portrait-lg"
  }[size]

  if (character.avatarUrl) {
    return (
      <img
        src={character.avatarUrl}
        alt={character.displayName}
        className={sizeClass}
      />
    )
  }

  return (
    <div className={cn(
      sizeClass,
      "bg-gradient-to-br from-secondary to-muted",
      "flex items-center justify-center"
    )}>
      <span className="font-display text-lg text-muted-foreground">
        {character.displayName.substring(0, 2).toUpperCase()}
      </span>
    </div>
  )
}
```

### Portrait Sidebar (Full-Height with Gradient Fade)

For post cards, use a full-height portrait sidebar with a gradient fade that transitions into the content area. This creates an immersive RPG dialog feel.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ ┌──────────┐                                        │
│ │          │  CHARACTER NAME                        │
│ │ PORTRAIT │  ─────────────────────────────────     │
│ │ (full    │  Post content flows here...            │
│ │  height) │                                        │
│ │    ↓     │                                        │
│ │ gradient │                                        │
│ │   fade → │                                        │
│ └──────────┘                                        │
└─────────────────────────────────────────────────────┘
```

**Grid Structure:**
```tsx
<div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] rounded-xl border border-border overflow-hidden bg-card">
  {/* Portrait Sidebar */}
  <div className="relative min-h-[120px]">
    <img
      src={avatarUrl}
      alt={characterName}
      className="absolute inset-0 w-full h-full object-cover"
    />
    {/* Gradient fade into content area */}
    <div
      className="absolute inset-y-0 right-0 w-1/2 portrait-fade"
      style={{ background: 'linear-gradient(to right, transparent, hsl(var(--card)))' }}
    />
  </div>

  {/* Content Area */}
  <div className="relative p-4">
    {/* Content here */}
  </div>
</div>
```

**CSS Utility:**
```css
/* Gradient fade overlay for portrait sidebar */
.portrait-fade {
  background: linear-gradient(to right, transparent, hsl(var(--card)));
}
```

**Key Points:**
- Portrait uses `object-cover` to fill the full height
- Minimum height of `120px` ensures the portrait is visible even for short posts
- Grid column width controls portrait width: `80px` on mobile, `120px` on desktop
- Gradient overlay creates smooth transition from portrait to content
- Content area has relative positioning for absolute-positioned elements like RollBadge

---

## Badges

Using shadcn/ui `<Badge>`:

### Status Badge

```tsx
import { Badge } from "@/components/ui/badge"

// Default (secondary)
<Badge>Draft</Badge>

// Gold accent
<Badge className="bg-gold-dim text-foreground">NEW</Badge>

// Outlined
<Badge variant="outline">Archived</Badge>
```

### Role Badge (GM, Player)

```tsx
// GM Badge with crown icon
<Badge className="bg-gold text-primary-foreground">
  <Crown className="h-3 w-3 mr-1" />
  GM
</Badge>

// Player badge
<Badge variant="outline">Player</Badge>
```

### Phase Badge

```tsx
function PhaseIndicator({ phase }: { phase: 'gm_phase' | 'pc_phase' }) {
  const isGMPhase = phase === 'gm_phase'

  return (
    <Badge className={cn(
      "gap-1.5",
      isGMPhase ? "bg-gm-phase text-foreground" : "bg-pc-phase text-foreground"
    )}>
      {isGMPhase ? <Crown className="h-3 w-3" /> : <Users className="h-3 w-3" />}
      {isGMPhase ? "GM Phase" : "PC Phase"}
    </Badge>
  )
}
```

---

## Tabs

Using shadcn/ui `<Tabs>`:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

<Tabs defaultValue="scenes">
  <TabsList className="border-b border-border bg-transparent">
    <TabsTrigger
      value="scenes"
      className="data-[state=active]:text-gold data-[state=active]:border-b-2 data-[state=active]:border-gold"
    >
      <BookOpen className="h-4 w-4 mr-2" />
      Scenes
    </TabsTrigger>
    <TabsTrigger value="characters">
      <User className="h-4 w-4 mr-2" />
      Characters
    </TabsTrigger>
  </TabsList>

  <TabsContent value="scenes">
    {/* Scene content */}
  </TabsContent>
  <TabsContent value="characters">
    {/* Character content */}
  </TabsContent>
</Tabs>
```

---

## Dialogs & Modals

Using shadcn/ui `<Dialog>`:

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

<Dialog>
  <DialogTrigger asChild>
    <Button>Create Scene</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle className="font-display text-xl">Create New Scene</DialogTitle>
      <DialogDescription>
        Set up a new location for your story.
      </DialogDescription>
    </DialogHeader>

    {/* Form content */}

    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Create</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## Dropdown Menus

Using shadcn/ui `<DropdownMenu>`:

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <MoreHorizontal className="h-5 w-5" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem>
      <Pencil className="h-4 w-4 mr-2" />
      Edit
    </DropdownMenuItem>
    <DropdownMenuItem>
      <Archive className="h-4 w-4 mr-2" />
      Archive
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem className="text-destructive">
      <Trash2 className="h-4 w-4 mr-2" />
      Delete
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Empty States

Empty states should feel thematic, not like error messages:

```tsx
function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      <h3 className="font-display text-xl text-muted-foreground mb-2">
        {title}
      </h3>
      <p className="text-muted-foreground mb-6">
        {description}
      </p>
      {action}
    </div>
  )
}

// Usage
<EmptyState
  icon={BookOpen}
  title="The scene awaits its first moment..."
  description="Begin the narrative below."
/>
```

**Thematic messaging:**

| Instead of | Use |
|------------|-----|
| "No scenes found" | "This campaign awaits its first scene..." |
| "No posts yet" | "The scene awaits its first moment..." |
| "No characters" | "No adventurers have joined this tale..." |

---

## Loading States

### Skeleton

Using shadcn/ui `<Skeleton>`:

```tsx
import { Skeleton } from "@/components/ui/skeleton"

// Text skeleton
<Skeleton className="h-4 w-full" />
<Skeleton className="h-4 w-3/4" />

// Portrait skeleton
<Skeleton className="w-20 h-[100px] rounded-lg" />

// Post card skeleton
function PostSkeleton() {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-4 p-6 bg-panel rounded-xl border border-border">
      <Skeleton className="w-20 h-[100px] rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}
```

---

## Tooltips

Using shadcn/ui `<Tooltip>`:

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="ghost" size="icon">
        <Info className="h-4 w-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>This is helpful information</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

## Section Dividers

Use the `flourish` class for decorative section headers:

```tsx
<h3 className="flourish label-caps">
  <span>General Settings</span>
</h3>
```

This creates:
```
────────────── GENERAL SETTINGS ──────────────
```

The gold gradient pseudo-elements extend from either side of the text.

---

## Button Usage Guidelines

### When to Use Each Variant

| Variant | Use Case | Examples |
|---------|----------|----------|
| `default` (primary) | Main action on the page, positive outcomes | "Create", "Save", "Post", "Submit" |
| `secondary` | Important but not primary action | "Submit Hidden", "Export" |
| `outline` | Secondary/cancel actions | "Cancel", "Edit", "Back" |
| `ghost` | Tertiary actions, icon buttons | "Archive", menu triggers |
| `destructive` | Delete, remove, or dangerous actions | "Delete Campaign", "Remove Member" |
| `link` | Navigation-like actions | "View details", "See more" |

### Button Sizes

| Size | Use Case |
|------|----------|
| `default` | Standard buttons in forms, dialogs |
| `sm` | Compact UI, table rows, card actions |
| `lg` | Hero CTAs, prominent actions |
| `icon` | Icon-only buttons (with title for accessibility) |

### Button States

```tsx
// Loading state
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Creating...
</Button>

// Disabled state
<Button disabled>Create</Button>

// With icon
<Button>
  <Plus className="mr-2 h-4 w-4" />
  Add Scene
</Button>
```

---

## Form Validation States

### Field Error State

```tsx
<FormField
  control={form.control}
  name="title"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Title</FormLabel>
      <FormControl>
        <Input
          {...field}
          className={cn(
            form.formState.errors.title && "border-destructive focus-visible:ring-destructive"
          )}
        />
      </FormControl>
      <FormDescription>This is the name players will see.</FormDescription>
      <FormMessage /> {/* Automatically shows error in red */}
    </FormItem>
  )}
/>
```

### Error Message Styling

`<FormMessage>` automatically applies:
- `text-destructive` (red text)
- `text-sm` size
- Animated appearance

### Common Validation Rules

| Field Type | Rules | Error Message |
|------------|-------|---------------|
| Title | Required, max 255 | "Title is required", "Title is too long" |
| Description | Optional, max 2000 | "Description is too long" |
| Invite Code | Required | "Invite code is required" |
| Email | Valid format | "Invalid email address" |

### Input States

```tsx
// Normal
<Input placeholder="Enter title" />

// Error
<Input className="border-destructive focus-visible:ring-destructive" />

// Disabled
<Input disabled placeholder="Disabled input" />

// With helper text
<div className="space-y-2">
  <Label>Title</Label>
  <Input placeholder="Enter title" />
  <p className="text-xs text-muted-foreground">Maximum 255 characters</p>
</div>
```

---

## Dialog Sizes

### Size Classes

| Size | Class | Use Case |
|------|-------|----------|
| Small | `sm:max-w-[400px]` | Simple confirmations, single input |
| Default | `sm:max-w-[500px]` | Standard forms, 2-4 fields |
| Large | `sm:max-w-[600px]` | Complex forms, multiple sections |
| Full | `sm:max-w-[800px]` | Rich editors, previews |

### Examples by Type

```tsx
// Confirmation dialog (small)
<DialogContent className="sm:max-w-[400px]">
  {/* Delete confirmation, leave campaign */}
</DialogContent>

// Form dialog (default)
<DialogContent className="sm:max-w-[500px]">
  {/* Create campaign, edit scene */}
</DialogContent>

// Complex dialog (large)
<DialogContent className="sm:max-w-[600px]">
  {/* Settings with multiple sections */}
</DialogContent>
```

### Alert Dialogs (Destructive Actions)

Use `AlertDialog` for destructive confirmations:

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction className="bg-destructive text-destructive-foreground">
        Delete
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## List Item Patterns

### Basic List Item

```tsx
<div className="flex items-center justify-between rounded-md border p-3">
  <div className="flex items-center gap-3">
    {/* Icon or avatar */}
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
      <User className="h-4 w-4" />
    </div>
    {/* Content */}
    <div>
      <span className="text-sm font-medium">Item Title</span>
      <p className="text-xs text-muted-foreground">Secondary text</p>
    </div>
  </div>
  {/* Actions */}
  <div className="flex gap-1">
    <Button variant="ghost" size="sm">
      <Pencil className="h-4 w-4" />
    </Button>
  </div>
</div>
```

### List with Selection

```tsx
<div className="space-y-2">
  {items.map((item) => (
    <Button
      key={item.id}
      variant={selected === item.id ? 'default' : 'outline'}
      className="w-full justify-start"
      onClick={() => setSelected(item.id)}
    >
      {item.name}
    </Button>
  ))}
</div>
```

### List Item with Hover Actions

```tsx
<div className="group relative flex items-center justify-between rounded-md border p-3 hover:bg-accent">
  <div>{/* Content */}</div>
  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
    <Button variant="ghost" size="sm">Edit</Button>
    <Button variant="ghost" size="sm">Delete</Button>
  </div>
</div>
```

### Stacked List (Cards)

```tsx
<div className="space-y-2">
  {items.map((item) => (
    <Card key={item.id} className="p-4">
      <div className="flex items-center gap-4">
        <Avatar />
        <div className="flex-1">
          <h4 className="font-medium">{item.title}</h4>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
        <Button variant="outline" size="sm">View</Button>
      </div>
    </Card>
  ))}
</div>
```

---

## Status Badges

### Badge Variants Reference

| Variant | Color | Use Case |
|---------|-------|----------|
| `default` | Primary | Active, enabled states |
| `secondary` | Gray | Neutral states, used items |
| `destructive` | Red | Error, expired, urgent |
| `outline` | Border only | Revoked, archived, disabled |

### Game Status Badges

```tsx
// Phase badges
<Badge className="bg-gm-phase text-foreground">GM Phase</Badge>
<Badge className="bg-pc-phase text-foreground">PC Phase</Badge>

// Pass status
<Badge variant="secondary">Passed</Badge>
<Badge className="bg-muted text-muted-foreground">Hard Passed</Badge>

// Roll states
<Badge className="bg-yellow-500/10 text-yellow-600">Pending</Badge>
<Badge className="bg-green-500/10 text-green-600">Success</Badge>
<Badge className="bg-red-500/10 text-red-600">Failure</Badge>
<Badge variant="outline" className="text-muted-foreground">Invalidated</Badge>
```

### Invite Status Badges

```tsx
<Badge variant="default">Active</Badge>
<Badge variant="secondary">Used</Badge>
<Badge variant="outline">Revoked</Badge>
<Badge variant="destructive">Expired</Badge>
```

### Notification Badge (Count)

```tsx
<Badge
  variant="destructive"
  className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 text-xs"
>
  {count > 99 ? '99+' : count}
</Badge>
```

### Content Badges

```tsx
// New indicator
<Badge className="bg-gold-dim text-foreground text-xs">NEW</Badge>

// Draft
<Badge variant="outline" className="text-xs">Draft</Badge>

// Role badges
<Badge variant="default" className="gap-1">
  <Crown className="h-3 w-3" />
  GM
</Badge>
<Badge variant="secondary">PLAYER</Badge>

// Paused
<Badge variant="secondary">
  <Pause className="mr-1 h-3 w-3" />
  Paused
</Badge>
```

---

## Loading Boundaries

### Page Loading

```tsx
function PageSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-4 h-8 w-32" />
        <Skeleton className="mb-2 h-10 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
      </div>
    </div>
  )
}
```

### Card Loading

```tsx
function CardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </CardContent>
    </Card>
  )
}
```

### List Loading

```tsx
function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}
```

### Inline Loading

```tsx
// Button loading
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading...
</Button>

// Centered spinner
<div className="flex items-center justify-center py-12">
  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
</div>

// With message
<div className="flex items-center justify-center py-12">
  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  <span className="ml-2 text-muted-foreground">Loading campaign...</span>
</div>
```

---

## Toast Messages

Using shadcn/ui toast system for notifications.

### Success Toast

```tsx
toast({
  title: 'Success',
  description: 'Your changes have been saved.',
})
```

### Error Toast

```tsx
toast({
  variant: 'destructive',
  title: 'Error',
  description: error.message,
})
```

### Action Toast

```tsx
toast({
  title: 'Item deleted',
  description: 'The item has been removed.',
  action: (
    <ToastAction altText="Undo">Undo</ToastAction>
  ),
})
```

### Common Toast Patterns

| Action | Title | Description |
|--------|-------|-------------|
| Create | "[Thing] created" | "Your [thing] is ready." |
| Update | "Changes saved" | "[Thing] has been updated." |
| Delete | "[Thing] deleted" | "The [thing] has been permanently removed." |
| Error | "Failed to [action]" | `error.message` |
| Copy | "Copied" | "[Thing] copied to clipboard." |

---

## Switch Component

For binary toggles:

```tsx
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

<div className="flex items-center justify-between">
  <Label htmlFor="hidden-posts">Enable hidden posts</Label>
  <Switch id="hidden-posts" checked={enabled} onCheckedChange={setEnabled} />
</div>

// With description
<div className="flex items-center justify-between rounded-lg border p-3">
  <div className="flex items-center gap-2">
    <EyeOff className="h-4 w-4 text-muted-foreground" />
    <div>
      <Label htmlFor="hidden">Hidden Post</Label>
      <p className="text-xs text-muted-foreground">Only visible to GM until revealed</p>
    </div>
  </div>
  <Switch id="hidden" checked={isHidden} onCheckedChange={setIsHidden} />
</div>
```

---

## Progress Component

For progress indication:

```tsx
import { Progress } from "@/components/ui/progress"

// Basic
<Progress value={66} />

// With color override
<Progress value={95} className="h-2 bg-destructive" />

// With label
<div className="flex items-center gap-3">
  <Progress value={percentage} className="h-2" />
  <span className="text-sm text-muted-foreground">{percentage}%</span>
</div>
```

---

## Alert Component

For important messages:

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// Info alert
<Alert>
  <Info className="h-4 w-4" />
  <AlertTitle>Note</AlertTitle>
  <AlertDescription>This is helpful information.</AlertDescription>
</Alert>

// Warning alert
<Alert variant="destructive">
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>Warning</AlertTitle>
  <AlertDescription>Something needs your attention.</AlertDescription>
</Alert>
```

---

## Accessibility Patterns

### Button Accessibility

```tsx
// Icon-only buttons need title or aria-label
<Button variant="ghost" size="icon" title="Edit">
  <Pencil className="h-4 w-4" />
</Button>

// Or with sr-only text
<Button variant="ghost" size="icon">
  <Pencil className="h-4 w-4" />
  <span className="sr-only">Edit</span>
</Button>
```

### Form Accessibility

```tsx
// Labels linked to inputs
<Label htmlFor="title">Title</Label>
<Input id="title" />

// Error association
<Input aria-invalid={!!error} aria-describedby="title-error" />
<p id="title-error" className="text-destructive">{error}</p>
```

### Keyboard Navigation

- All interactive elements focusable with Tab
- Dialogs trap focus within
- Escape closes modals/dropdowns
- Enter submits forms
