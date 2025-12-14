# 6.4 Mobile Responsive

**Skill**: `shadcn-react`

## Goal

Ensure all views work on mobile devices with proper touch targets and responsive layouts.

---

## Design References

- [14-responsive-design.md](../../product-design-system/14-responsive-design.md) - Complete responsive specs

---

## Overview

Mobile requirements:
- Touch targets minimum 44px
- No horizontal scroll
- Readable text without zooming
- Stack layouts on small screens
- Accessible from 375px width

---

## Breakpoints

Tailwind default breakpoints:

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Large phones |
| `md` | 768px | Tablets |
| `lg` | 1024px | Laptops |
| `xl` | 1280px | Desktops |
| `2xl` | 1536px | Large screens |

Test at these widths:
- 375px (iPhone SE)
- 390px (iPhone 14)
- 768px (iPad Mini)
- 1024px (iPad Pro)

---

## Touch Targets

Minimum 44×44px for touch targets:

```tsx
// Wrong - too small
<Button size="icon" className="h-8 w-8">
  <Icon className="h-4 w-4" />
</Button>

// Correct - 44px minimum
<Button size="icon" className="h-11 w-11">
  <Icon className="h-5 w-5" />
</Button>

// Or use padding for larger hit area
<Button size="sm" className="min-h-[44px] px-4">
  Action
</Button>
```

---

## Responsive Patterns

### Stack on Mobile

```tsx
<div className="flex flex-col sm:flex-row gap-4">
  <div className="flex-1">Column 1</div>
  <div className="flex-1">Column 2</div>
</div>
```

### Grid Columns

```tsx
// 1 column mobile → 2 tablet → 3 desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id}>{item}</Card>)}
</div>
```

### Hide on Mobile

```tsx
// Hide sidebar on mobile
<aside className="hidden lg:block">
  Sidebar content
</aside>

// Show as sheet on mobile
<Sheet>
  <SheetTrigger asChild className="lg:hidden">
    <Button>Menu</Button>
  </SheetTrigger>
  <SheetContent>
    Sidebar content
  </SheetContent>
</Sheet>
```

### Responsive Text

```tsx
<h1 className="text-2xl md:text-3xl lg:text-4xl font-display">
  Title
</h1>
```

---

## Component-Specific Responsive

### Campaign Dashboard Tabs

On mobile, tabs may need horizontal scroll:

```tsx
<TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
  {/* Tabs scroll horizontally */}
</TabsList>
```

Or convert to dropdown:

```tsx
{isMobile ? (
  <Select value={tab} onValueChange={setTab}>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="scenes">Scenes</SelectItem>
      <SelectItem value="characters">Characters</SelectItem>
    </SelectContent>
  </Select>
) : (
  <Tabs value={tab} onValueChange={setTab}>
    <TabsList>...</TabsList>
  </Tabs>
)}
```

### Scene View

Post card portrait sizing:

```tsx
<div className="grid grid-cols-[60px_1fr] md:grid-cols-[80px_1fr] lg:grid-cols-[120px_1fr]">
  {/* Portrait column shrinks on mobile */}
</div>
```

Scene roster as bottom sheet:

```tsx
// Desktop: sidebar
<aside className="hidden lg:block w-64">
  <SceneRoster />
</aside>

// Mobile: bottom sheet
<Sheet>
  <SheetTrigger className="lg:hidden fixed bottom-4 right-4">
    <Button size="icon" className="rounded-full">
      <Users className="h-5 w-5" />
    </Button>
  </SheetTrigger>
  <SheetContent side="bottom" className="h-[60vh]">
    <SceneRoster />
  </SheetContent>
</Sheet>
```

### Composer

Fixed at bottom, adjust for keyboard:

```tsx
<div className="fixed bottom-0 left-0 right-0 p-2 sm:p-4">
  <div className="max-w-4xl mx-auto">
    {/* Composer content */}
  </div>
</div>
```

### Dialogs

Full-width on mobile:

```tsx
<DialogContent className="max-w-md sm:max-w-lg w-[calc(100%-2rem)] sm:w-full">
  {/* Dialog content */}
</DialogContent>
```

---

## Forms on Mobile

### Stacked Form Fields

```tsx
<div className="space-y-4">
  <FormField name="title" />
  <FormField name="description" />
  {/* Stack on mobile, side-by-side optional on desktop */}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <FormField name="field1" />
    <FormField name="field2" />
  </div>
</div>
```

### Input Sizing

Use default height for mobile touch:

```tsx
<Input className="h-12 sm:h-10" />
```

---

## Testing Mobile

### Browser DevTools

1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select iPhone SE (375px)
4. Test all pages

### Check for Issues

- [ ] No horizontal scroll
- [ ] All content visible
- [ ] Touch targets large enough
- [ ] Text readable without zoom
- [ ] Forms usable
- [ ] Modals fit on screen
- [ ] Navigation accessible

---

## Success Criteria

- [ ] All touch targets minimum 44px
- [ ] No horizontal scroll at 375px
- [ ] Scene cards stack on mobile
- [ ] Post cards readable with smaller portraits
- [ ] Scene roster uses bottom sheet on mobile
- [ ] Tabs scroll or convert to dropdown
- [ ] Dialogs fit mobile screens
- [ ] Forms usable on touch
