# 2.2 Card Variants

**Skill**: `shadcn-react`

## Goal

Establish card component patterns including base, interactive, and transparent variants.

---

## Design References

- [07-components.md](../../product-design-system/07-components.md) - Lines 243-286 for card patterns

---

## Overview

Cards are the primary container for content. Three variants are needed:

| Variant | Usage | Background |
|---------|-------|------------|
| **Base** | Forms, settings panels | Solid `bg-card` |
| **Interactive** | Scene cards, campaign cards | Solid + hover effects |
| **Transparent** | Posts over scene images | Semi-transparent `bg-panel` |

---

## Card Variants

### Base Card

Standard card for forms and content panels:

```tsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle className="font-display">Scene Settings</CardTitle>
    <CardDescription>Configure scene visibility and options</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Form fields */}
  </CardContent>
  <CardFooter className="flex justify-end gap-2">
    <Button variant="outline">Cancel</Button>
    <Button>Save</Button>
  </CardFooter>
</Card>
```

### Interactive Card

Clickable cards with hover lift effect:

```tsx
<Card
  className="card-interactive cursor-pointer"
  onClick={() => navigate(`/scene/${scene.id}`)}
>
  <CardContent className="p-4">
    <h3 className="font-display text-lg font-semibold">{scene.title}</h3>
    <p className="text-sm text-muted-foreground">{scene.postCount} posts</p>
  </CardContent>
</Card>
```

The `card-interactive` class provides:
- `transition-all duration-200`
- `hover:-translate-y-0.5` (subtle lift)
- `hover:border-gold-dim` (gold border on hover)
- `hover:shadow-card-hover` (enhanced shadow)

### Transparent Card (Immersive)

For content floating over scene images:

```tsx
<Card className="bg-panel backdrop-blur-md border-border/50">
  <CardContent className="p-6">
    {/* Post content that floats over scene imagery */}
  </CardContent>
</Card>
```

For higher readability:

```tsx
<Card className="bg-panel-solid backdrop-blur-lg border-border/50">
  <CardContent className="p-6">
    {/* Content requiring more contrast */}
  </CardContent>
</Card>
```

---

## Implementation Steps

### Step 1: Verify Base Card Styling

Ensure the base Card component uses theme variables:

```tsx
// The Card component should automatically use:
// bg-card → warm charcoal elevated surface
// border-border → subtle warm border
// text-card-foreground → warm cream text
```

### Step 2: Test Interactive Variant

Create a test to verify `card-interactive` class:

```tsx
<div className="grid grid-cols-3 gap-4">
  {scenes.map(scene => (
    <Card key={scene.id} className="card-interactive cursor-pointer">
      <CardContent className="p-4">
        <h3 className="font-display">{scene.title}</h3>
      </CardContent>
    </Card>
  ))}
</div>
```

Verify:
- Cards lift slightly on hover
- Border changes to gold-dim
- Shadow enhances

### Step 3: Test Transparent Variant

Test over a background image:

```tsx
<div className="relative">
  <img src="/scene-bg.jpg" className="w-full h-96 object-cover" />
  <div className="absolute inset-0 flex items-center justify-center p-8">
    <Card className="bg-panel backdrop-blur-md border-border/50 max-w-md">
      <CardContent className="p-6">
        <p>This card floats over the scene image with blur.</p>
      </CardContent>
    </Card>
  </div>
</div>
```

---

## Card with Image Header

For scene cards with header images:

```tsx
<Card className="card-interactive overflow-hidden">
  <div className="aspect-video relative">
    {scene.headerImage ? (
      <img
        src={scene.headerImage}
        alt={scene.title}
        className="w-full h-full object-cover"
      />
    ) : (
      <div className="w-full h-full scene-atmosphere" />
    )}
    <div className="absolute inset-0 scene-gradient" />
  </div>
  <CardContent className="p-4">
    <h3 className="font-display text-lg font-semibold">{scene.title}</h3>
    <p className="text-sm text-muted-foreground">{scene.description}</p>
  </CardContent>
</Card>
```

---

## Card Footer Patterns

### Actions Aligned Right

```tsx
<CardFooter className="flex justify-end gap-2">
  <Button variant="outline">Cancel</Button>
  <Button>Save</Button>
</CardFooter>
```

### Actions Split

```tsx
<CardFooter className="flex justify-between">
  <Button variant="ghost" className="text-destructive">Delete</Button>
  <div className="flex gap-2">
    <Button variant="outline">Cancel</Button>
    <Button>Save</Button>
  </div>
</CardFooter>
```

### Minimal Footer

```tsx
<CardFooter className="pt-0">
  <span className="text-xs text-muted-foreground">Last updated 2h ago</span>
</CardFooter>
```

---

## Success Criteria

- [ ] Base Card uses warm charcoal background
- [ ] CardTitle with `font-display` uses Cormorant Garamond
- [ ] Interactive cards lift and glow on hover
- [ ] Transparent cards blur background correctly
- [ ] Cards with images use `scene-gradient` overlay
- [ ] Cards without images use `scene-atmosphere` gradient
