---
name: responsive-design
description: Mobile-first responsive design patterns for the Vanguard PBP system. Use this skill when implementing responsive layouts, breakpoint strategies, touch-friendly interfaces, component scaling across device sizes, or optimizing for mobile/tablet/desktop views.
---

# Responsive Design

## Overview

This skill provides mobile-first responsive patterns using Tailwind CSS breakpoints. All layouts start with mobile constraints and progressively enhance for larger screens.

## Tailwind Breakpoints

| Breakpoint | Prefix | Min Width | Common Devices |
|------------|--------|-----------|----------------|
| Default | (none) | 0px | Phones (portrait) |
| Small | `sm:` | 640px | Phones (landscape), small tablets |
| Medium | `md:` | 768px | Tablets (portrait) |
| Large | `lg:` | 1024px | Tablets (landscape), laptops |
| Extra Large | `xl:` | 1280px | Desktops |
| 2XL | `2xl:` | 1536px | Large desktops |

**Focus breakpoints:** Default (mobile), `md:` (tablet), `lg:` (desktop) for most components.

## Mobile-First Approach

Always start with mobile styles, then add breakpoint modifiers:

```tsx
// CORRECT: Mobile-first (progressive enhancement)
<div className="p-4 md:p-6 lg:p-8">
<div className="flex-col md:flex-row">
<div className="text-base md:text-lg lg:text-xl">

// INCORRECT: Desktop-first (requires overrides)
<div className="p-8 md:p-6 sm:p-4">  // Don't do this
```

## Layout Patterns

### Responsive Grid

Scene cards, character cards, campaign cards:

```tsx
// 1 column mobile → 2 tablet → 3 desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
  {items.map(item => <Card key={item.id} />)}
</div>

// 1 column mobile → 2 desktop (skip tablet middle state)
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
```

### Stack to Row

Form buttons, action groups, header layouts:

```tsx
// Buttons stack vertically on mobile, row on tablet+
<div className="flex flex-col sm:flex-row gap-2">
  <Button variant="outline">Cancel</Button>
  <Button>Confirm</Button>
</div>

// Header with title and actions
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
  <h1 className="text-2xl font-bold">{title}</h1>
  <div className="flex gap-2">
    <Button>Action 1</Button>
    <Button>Action 2</Button>
  </div>
</div>
```

### Two-Column with Collapsible Sidebar

Campaign dashboard, scene view with roster:

```tsx
// Sidebar hidden on mobile, visible on desktop
<div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
  <main>{/* Main content always visible */}</main>
  <aside className="hidden lg:block">{/* Sidebar hidden on mobile */}</aside>
</div>

// With mobile toggle for sidebar
<div className="relative">
  <main className="lg:mr-[300px]">{/* Main content */}</main>
  <aside className={cn(
    "fixed inset-y-0 right-0 w-[300px] bg-background border-l transform transition-transform lg:translate-x-0",
    isSidebarOpen ? "translate-x-0" : "translate-x-full"
  )}>
    {/* Sidebar */}
  </aside>
</div>
```

### Container Pattern

Page-level content constraints:

```tsx
// Standard container with responsive padding
<div className="container mx-auto px-4 md:px-6 lg:px-8">
  {/* Page content */}
</div>

// Container with max-width variants
<div className="container mx-auto max-w-6xl px-4">  {/* 1152px max */}
<div className="container mx-auto max-w-4xl px-4">  {/* 896px max */}
<div className="container mx-auto max-w-2xl px-4">  {/* 672px max - forms */}
<div className="container mx-auto max-w-md px-4">   {/* 448px max - auth */}
```

### Full-Height Layout

App shell with header, main, footer:

```tsx
<div className="flex min-h-screen flex-col">
  <header className="sticky top-0 z-50 border-b bg-background">
    {/* Navigation */}
  </header>
  <main className="flex-1">
    {/* Page content */}
  </main>
  <footer className="border-t">
    {/* Footer */}
  </footer>
</div>
```

## Touch Target Sizing

Ensure all interactive elements are touch-friendly:

### Minimum Sizes

- **iOS Human Interface Guidelines:** 44 × 44pt minimum
- **Android Material Design:** 48 × 48dp minimum

```tsx
// Button heights (use h-11 on mobile, h-10 acceptable on desktop)
<Button className="h-11">Submit</Button>
<Button className="h-10 md:h-11">Submit</Button>

// Icon buttons (44x44 minimum)
<Button variant="ghost" size="icon" className="h-11 w-11 md:h-10 md:w-10">
  <Settings className="h-5 w-5" />
</Button>

// Form inputs
<Input className="h-11" />
<Select className="h-11" />
```

### Touch Target Spacing

Minimum 8px between adjacent touch targets:

```tsx
// Button groups with adequate spacing
<div className="flex gap-2">
  <Button className="h-11">Cancel</Button>
  <Button className="h-11">Confirm</Button>
</div>

// Icon button toolbar
<div className="flex gap-1">
  <Button variant="ghost" size="icon" className="h-11 w-11">
    <Bold className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="icon" className="h-11 w-11">
    <Italic className="h-4 w-4" />
  </Button>
</div>
```

## Responsive Typography

Scale text sizes across breakpoints:

```tsx
// Page titles
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
  Campaign Title
</h1>

// Section headings
<h2 className="text-xl md:text-2xl font-semibold">
  Section Title
</h2>

// Card titles
<h3 className="text-lg md:text-xl font-medium">
  Card Title
</h3>

// Body text (usually consistent)
<p className="text-base">Body content</p>

// Small text (consistent)
<span className="text-sm text-muted-foreground">Helper text</span>
```

## Component-Specific Patterns

### Campaign Header

```tsx
<div className="p-4 md:p-6 lg:p-8 bg-card border-b">
  {/* Back link */}
  <Link className="inline-flex items-center text-sm text-muted-foreground mb-4">
    <ChevronLeft className="h-4 w-4 mr-1" />
    <span className="hidden sm:inline">Back to campaigns</span>
    <span className="sm:hidden">Back</span>
  </Link>

  {/* Title and badge stack on mobile, row on desktop */}
  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
    <h1 className="text-2xl md:text-3xl font-semibold">{title}</h1>
    {isGM && <Badge className="w-fit">GM</Badge>}
  </div>

  {/* Stats wrap on mobile */}
  <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-4 text-sm text-muted-foreground">
    <PhaseIndicator phase={phase} />
    <span>{sceneCount} scenes</span>
    <span>{memberCount} players</span>
  </div>
</div>
```

### Tabs (Horizontal Scroll on Mobile)

```tsx
// Scrollable tabs on mobile, full-width on desktop
<div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
  <Tabs className="w-max md:w-full">
    <TabsList>
      <TabsTrigger value="scenes">Scenes</TabsTrigger>
      <TabsTrigger value="characters">Characters</TabsTrigger>
      <TabsTrigger value="members">Members</TabsTrigger>
      <TabsTrigger value="settings">Settings</TabsTrigger>
    </TabsList>
  </Tabs>
</div>
```

### Dialog/Modal

```tsx
<Dialog>
  <DialogContent className={cn(
    // Mobile: nearly full width with padding
    "w-[calc(100%-2rem)] max-w-lg",
    // Desktop: centered with max-width
    "md:w-full"
  )}>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      {/* Content */}
    </div>
    {/* Footer buttons stack on mobile */}
    <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
      <Button variant="outline" className="w-full sm:w-auto">Cancel</Button>
      <Button className="w-full sm:w-auto">Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Cards

```tsx
// Card stacks full-width on mobile, grid on larger screens
<div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 lg:gap-6">
  {scenes.map(scene => (
    <Card key={scene.id} className="overflow-hidden">
      {/* Image scales to fill */}
      {scene.headerImageUrl ? (
        <img
          src={scene.headerImageUrl}
          alt=""
          className="w-full h-32 md:h-40 object-cover"
        />
      ) : (
        <div className="w-full h-32 md:h-40 bg-muted flex items-center justify-center">
          <BookOpen className="h-8 w-8 text-muted-foreground" />
        </div>
      )}
      <div className="p-4">
        <h3 className="font-semibold truncate">{scene.title}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {scene.description}
        </p>
      </div>
    </Card>
  ))}
</div>
```

### Post Cards (Portrait Layout)

```tsx
// Grid adjusts portrait sidebar width
<div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] rounded-xl border overflow-hidden bg-card">
  {/* Portrait sidebar */}
  <div className="relative min-h-[100px] md:min-h-[120px]">
    <img
      src={character.avatarUrl}
      alt=""
      className="absolute inset-0 w-full h-full object-cover"
    />
    {/* Gradient fade */}
    <div
      className="absolute inset-y-0 right-0 w-1/2"
      style={{ background: 'linear-gradient(to right, transparent, hsl(var(--card)))' }}
    />
  </div>

  {/* Content area */}
  <div className="p-3 md:p-4">
    <h3 className="font-semibold text-base md:text-lg">{character.name}</h3>
    <div className="text-sm md:text-base mt-2">{content}</div>
  </div>
</div>
```

### Navigation (Mobile Sheet)

```tsx
// Desktop: visible nav bar
// Mobile: hamburger with slide-out sheet
<>
  {/* Desktop navigation */}
  <nav className="hidden md:flex items-center gap-4">
    <Link href="/campaigns">Campaigns</Link>
    <Link href="/settings">Settings</Link>
    <UserMenu />
  </nav>

  {/* Mobile hamburger */}
  <Sheet>
    <SheetTrigger className="md:hidden">
      <Menu className="h-6 w-6" />
    </SheetTrigger>
    <SheetContent side="left">
      <nav className="flex flex-col gap-4 mt-8">
        <Link href="/campaigns" className="text-lg">Campaigns</Link>
        <Link href="/settings" className="text-lg">Settings</Link>
        <Separator />
        <UserMenu />
      </nav>
    </SheetContent>
  </Sheet>
</>
```

### Tables (Card View on Mobile)

```tsx
// Desktop: horizontal table with scroll
// Mobile: transform to stacked cards
<>
  {/* Desktop table view */}
  <div className="hidden md:block overflow-x-auto">
    <table className="w-full min-w-[600px]">
      <thead>
        <tr className="border-b">
          <th className="text-left p-3">Character</th>
          <th className="text-left p-3">Player</th>
          <th className="text-left p-3">Status</th>
          <th className="text-right p-3">Actions</th>
        </tr>
      </thead>
      <tbody>
        {characters.map(char => (
          <tr key={char.id} className="border-b">
            <td className="p-3">{char.name}</td>
            <td className="p-3">{char.playerName}</td>
            <td className="p-3"><PassBadge state={char.passState} /></td>
            <td className="p-3 text-right"><ActionMenu /></td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>

  {/* Mobile card view */}
  <div className="md:hidden space-y-3">
    {characters.map(char => (
      <Card key={char.id} className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{char.name}</p>
            <p className="text-sm text-muted-foreground">{char.playerName}</p>
          </div>
          <PassBadge state={char.passState} />
        </div>
        <div className="flex justify-end mt-3">
          <ActionMenu />
        </div>
      </Card>
    ))}
  </div>
</>
```

## Image Handling

### Aspect Ratio Containers

```tsx
// 16:9 scene headers
<div className="aspect-video w-full overflow-hidden rounded-lg">
  <img src={scene.headerUrl} alt="" className="h-full w-full object-cover" />
</div>

// Square avatars
<div className="aspect-square w-12 overflow-hidden rounded-full">
  <img src={character.avatarUrl} alt="" className="h-full w-full object-cover" />
</div>
```

### Responsive Image Sizes

```tsx
// Avatar sizing by context
<Avatar className="h-8 w-8 md:h-10 md:w-10">          {/* Inline/compact */}
<Avatar className="h-10 w-10 md:h-12 md:w-12">        {/* List items */}
<Avatar className="h-16 w-16 md:h-20 md:w-20">        {/* Profile/featured */}

// Hide decorative images on mobile
<img
  src="/decoration.png"
  alt=""
  className="hidden md:block"
/>
```

## Spacing Patterns

### Container Padding

```tsx
// Page container
<div className="px-4 md:px-6 lg:px-8">

// Card content
<div className="p-4 md:p-6">

// Compact padding
<div className="p-3 md:p-4">
```

### Section Spacing

```tsx
// Major sections
<section className="py-8 md:py-12 lg:py-16">

// Between cards/items
<div className="space-y-4 md:space-y-6">

// Grid gaps
<div className="gap-4 md:gap-6 lg:gap-8">
```

## Testing Targets

### Device Breakpoints to Test

| Device | Width | Key Considerations |
|--------|-------|-------------------|
| iPhone SE | 375px | Minimum supported width |
| iPhone 14 | 390px | Common phone size |
| iPad | 768px | `md:` breakpoint |
| iPad Pro | 1024px | `lg:` breakpoint |
| Desktop | 1280px+ | Full desktop layout |

### Testing Checklist

- [ ] **Content readable** at all sizes without horizontal scroll
- [ ] **Touch targets** minimum 44px on mobile
- [ ] **Forms usable** with on-screen keyboard
- [ ] **Navigation** accessible on mobile (sheet/hamburger)
- [ ] **Images** scale appropriately, don't overflow
- [ ] **Tables** transform to cards or scroll horizontally
- [ ] **Modals** don't overflow viewport
- [ ] **Text** doesn't truncate unexpectedly
- [ ] **Portrait orientation** tested
- [ ] **Landscape orientation** tested
