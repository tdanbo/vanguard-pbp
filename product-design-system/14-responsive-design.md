# Responsive Design

This document defines responsive design patterns for Vanguard PBP.

---

## Design Principles

1. **Mobile-First** - Start with mobile layout, enhance for larger screens
2. **Content Priority** - Most important content remains accessible at all sizes
3. **Touch-Friendly** - Interactive elements sized for touch on mobile
4. **Progressive Enhancement** - Core functionality works everywhere

---

## Breakpoints

Using Tailwind CSS default breakpoints:

| Breakpoint | Prefix | Min Width | Typical Devices |
|------------|--------|-----------|-----------------|
| Default | (none) | 0px | Phones (portrait) |
| Small | `sm:` | 640px | Phones (landscape), small tablets |
| Medium | `md:` | 768px | Tablets (portrait) |
| Large | `lg:` | 1024px | Tablets (landscape), laptops |
| Extra Large | `xl:` | 1280px | Desktops |
| 2XL | `2xl:` | 1536px | Large desktops |

### Primary Breakpoints

For most components, focus on these:

| Breakpoint | Target |
|------------|--------|
| Default | Mobile phones |
| `md:` | Tablets and up |
| `lg:` | Desktops and up |

---

## Mobile-First Approach

Write base styles for mobile, then add complexity:

```tsx
// Good: Mobile-first
<div className="p-4 md:p-6 lg:p-8">
  <div className="flex flex-col md:flex-row gap-4">
    {/* Content */}
  </div>
</div>

// Avoid: Desktop-first (harder to maintain)
<div className="p-8 sm:p-4">
  {/* ... */}
</div>
```

---

## Layout Patterns

### Container

Standard page container:

```tsx
<div className="container mx-auto px-4">
  {/* Content */}
</div>

// With max width variants
<div className="container mx-auto max-w-4xl px-4">
  {/* Narrower content */}
</div>
```

### Grid Layouts

#### Scene Cards Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
  {scenes.map(scene => <SceneCard key={scene.id} scene={scene} />)}
</div>
```

| Screen | Columns |
|--------|---------|
| Mobile | 1 |
| Tablet | 2 |
| Desktop | 3 |

#### Two-Column Layout

```tsx
<div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
  <main>{/* Main content */}</main>
  <aside className="hidden lg:block">{/* Sidebar */}</aside>
</div>
```

### Stack to Row

Common pattern for form actions:

```tsx
<div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
  <Button className="w-full sm:w-auto">Cancel</Button>
  <Button className="w-full sm:w-auto">Save</Button>
</div>
```

---

## Component Responsive Behavior

### Campaign Header

| Screen | Behavior |
|--------|----------|
| Mobile | Stack vertically, smaller title |
| Desktop | Horizontal layout, larger title |

```tsx
<div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
  <div>
    <h1 className="text-2xl md:text-3xl font-bold">{title}</h1>
    <p className="text-muted-foreground">{description}</p>
  </div>
  <div className="flex flex-wrap gap-2">
    {/* Actions */}
  </div>
</div>
```

### Tabs

| Screen | Behavior |
|--------|----------|
| Mobile | Scrollable horizontal tabs |
| Desktop | Full-width tabs |

```tsx
<TabsList className="w-full overflow-x-auto flex-nowrap md:flex-wrap">
  <TabsTrigger className="flex-shrink-0">Scenes</TabsTrigger>
  <TabsTrigger className="flex-shrink-0">Characters</TabsTrigger>
  <TabsTrigger className="flex-shrink-0">Members</TabsTrigger>
</TabsList>
```

### Dialogs

| Screen | Behavior |
|--------|----------|
| Mobile | Full-width with padding |
| Desktop | Centered, max-width constrained |

```tsx
<DialogContent className="w-full sm:max-w-[500px]">
  {/* Content */}
</DialogContent>
```

### Cards

| Screen | Behavior |
|--------|----------|
| Mobile | Full-width, stacked |
| Desktop | Grid or side-by-side |

```tsx
<Card className="w-full">
  <CardContent className="flex flex-col md:flex-row gap-4 p-4 md:p-6">
    <Avatar className="h-12 w-12 md:h-20 md:w-20" />
    <div className="flex-1">{/* Content */}</div>
  </CardContent>
</Card>
```

### Post Cards

| Screen | Behavior |
|--------|----------|
| Mobile | Portrait above content, smaller text |
| Desktop | Portrait beside content, full layout |

```tsx
<div className="flex flex-col md:flex-row gap-4">
  <div className="flex md:flex-col items-center gap-3">
    <Avatar className="h-10 w-10 md:h-20 md:w-20" />
    <span className="text-sm font-medium md:text-center">{name}</span>
  </div>
  <div className="flex-1">
    {/* Post content */}
  </div>
</div>
```

---

## Touch Targets

### Minimum Sizes

| Platform | Minimum Touch Target |
|----------|---------------------|
| iOS | 44 × 44 px |
| Android | 48 × 48 dp |
| Recommended | 44px minimum, 48px comfortable |

### Button Sizing

```tsx
// Mobile-friendly button
<Button className="h-11 px-6">
  {/* At least 44px tall */}
</Button>

// Icon button
<Button variant="ghost" size="icon" className="h-11 w-11">
  <Icon className="h-5 w-5" />
</Button>
```

### Link Spacing

```tsx
// Adequate spacing for touch targets
<nav className="flex flex-col gap-1">
  <a className="py-3 px-4 -mx-4">Link 1</a>
  <a className="py-3 px-4 -mx-4">Link 2</a>
</nav>
```

### Form Inputs

```tsx
// Mobile-friendly input height
<Input className="h-11" />

// Select with adequate height
<SelectTrigger className="h-11">
  <SelectValue />
</SelectTrigger>
```

---

## Typography Scaling

### Responsive Text Sizes

```tsx
// Page title
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
  Title
</h1>

// Section heading
<h2 className="text-xl md:text-2xl font-semibold">
  Section
</h2>

// Body text (usually consistent)
<p className="text-base">
  Body text
</p>
```

### Reading Width

Limit line length for readability:

```tsx
<div className="max-w-prose mx-auto">
  {/* Text content - max ~65 characters per line */}
</div>

// Or specific max-width
<div className="max-w-2xl mx-auto">
  {/* Content */}
</div>
```

---

## Navigation Patterns

### Mobile Navigation

On mobile, use a slide-out or bottom sheet:

```tsx
// Sheet for mobile nav
<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon" className="md:hidden">
      <Menu className="h-6 w-6" />
    </Button>
  </SheetTrigger>
  <SheetContent side="left" className="w-[280px]">
    <nav className="flex flex-col gap-2">
      <Link>Home</Link>
      <Link>Campaigns</Link>
      <Link>Settings</Link>
    </nav>
  </SheetContent>
</Sheet>

// Desktop nav (hidden on mobile)
<nav className="hidden md:flex items-center gap-4">
  <Link>Home</Link>
  <Link>Campaigns</Link>
  <Link>Settings</Link>
</nav>
```

### Back Navigation

```tsx
<Link
  to="/"
  className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
>
  <ArrowLeft className="mr-1 h-4 w-4" />
  <span className="hidden sm:inline">Back to campaigns</span>
  <span className="sm:hidden">Back</span>
</Link>
```

---

## Image Handling

### Responsive Images

```tsx
// Scene header with aspect ratio
<div className="aspect-video w-full overflow-hidden rounded-lg">
  <img
    src={image}
    alt={alt}
    className="h-full w-full object-cover"
  />
</div>

// Avatar with responsive sizing
<Avatar className="h-10 w-10 md:h-12 md:w-12 lg:h-16 lg:w-16">
  <AvatarImage src={avatar} />
  <AvatarFallback>AB</AvatarFallback>
</Avatar>
```

### Hiding Images on Mobile

If images are decorative or secondary:

```tsx
<img
  src={decoration}
  alt=""
  className="hidden md:block"
/>
```

---

## Table Responsiveness

### Horizontal Scroll

```tsx
<div className="overflow-x-auto">
  <table className="w-full min-w-[600px]">
    {/* Table content */}
  </table>
</div>
```

### Card View on Mobile

Transform tables to cards on mobile:

```tsx
{/* Desktop table */}
<table className="hidden md:table w-full">
  {/* ... */}
</table>

{/* Mobile cards */}
<div className="md:hidden space-y-4">
  {items.map(item => (
    <Card key={item.id}>
      <CardContent className="p-4">
        <div><strong>Name:</strong> {item.name}</div>
        <div><strong>Role:</strong> {item.role}</div>
      </CardContent>
    </Card>
  ))}
</div>
```

---

## Spacing

### Responsive Padding

```tsx
// Container padding
<div className="px-4 md:px-6 lg:px-8">

// Section spacing
<section className="py-8 md:py-12 lg:py-16">

// Card content
<CardContent className="p-4 md:p-6">
```

### Gap Scaling

```tsx
// Grid/flex gaps
<div className="grid gap-4 md:gap-6 lg:gap-8">
```

---

## Hidden and Visible

### Hiding Elements

```tsx
// Hide on mobile only
<div className="hidden sm:block">Desktop only</div>

// Hide on desktop
<div className="sm:hidden">Mobile only</div>

// Hide on specific range
<div className="hidden md:block lg:hidden">Tablet only</div>
```

### Conditional Content

```tsx
// Show different content per breakpoint
<Button className="sm:hidden">
  <Menu className="h-4 w-4" />
</Button>
<Button className="hidden sm:flex">
  <Menu className="mr-2 h-4 w-4" />
  Menu
</Button>
```

---

## Testing Checklist

### Device Testing

- [ ] iPhone SE (375px)
- [ ] iPhone 14 (390px)
- [ ] iPad (768px)
- [ ] Desktop (1280px+)

### Orientation Testing

- [ ] Portrait mode
- [ ] Landscape mode

### Content Testing

- [ ] Long text/names don't break layout
- [ ] Lists with many items scroll properly
- [ ] Forms usable at all sizes
- [ ] Modals accessible on all devices

### Interaction Testing

- [ ] Touch targets adequately sized
- [ ] Swipe gestures work (if used)
- [ ] Hover states have touch alternatives

---

## Common Patterns Summary

### Full-Width Mobile, Constrained Desktop

```tsx
<div className="w-full md:max-w-md">
```

### Stack Mobile, Row Desktop

```tsx
<div className="flex flex-col md:flex-row">
```

### Single Column Mobile, Grid Desktop

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

### Hide Decorative Elements Mobile

```tsx
<div className="hidden md:block">
```

### Larger Touch Targets Mobile

```tsx
<Button className="h-11 md:h-10">
```
