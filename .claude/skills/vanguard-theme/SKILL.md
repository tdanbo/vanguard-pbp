---
name: vanguard-theme
description: Vanguard PBP design system tokens, colors, typography, and view architecture patterns. Use this skill when styling components, choosing colors, implementing the gold theme aesthetic, deciding between management and immersive view patterns, or applying the warm premium visual language.
---

# Vanguard Theme

## Overview

This skill provides design tokens, color palettes, typography, and architectural patterns for the Vanguard PBP visual language. The aesthetic is "warm premium" - like an expensive tabletop book with deep charcoal backgrounds and gold accents.

## Design Philosophy

### Core Principles

1. **Immersion Over Administration** - The UI is a portal into fiction, not a barrier. Scene View receives maximum design attention with minimal UI chrome.

2. **Two-Mode System** - Clear distinction between functional management and atmospheric immersion.

3. **Warm Premium Aesthetic** - Deep charcoal backgrounds, gold/amber accents, elegant serif typography.

### Two-Mode System

| Aspect | Management Views | Immersive Views |
|--------|-----------------|-----------------|
| Background | Solid `bg-background` | Transparent panels over imagery |
| Chrome | Full navigation, tabs, cards | Minimal, floating elements |
| Typography | Functional, readable | Atmospheric, cinematic |
| Purpose | Organize, configure, manage | Read, write, experience |
| Examples | Campaign Dashboard, Settings | Scene View, Post Reading |

## Design Tokens

### Currently Implemented

**Core shadcn tokens** (both light and dark modes):

```css
/* Base colors */
--background: /* Page background */
--foreground: /* Primary text */
--card: /* Card/elevated surfaces */
--card-foreground: /* Card text */
--popover: /* Dropdown/popover backgrounds */
--popover-foreground: /* Dropdown text */

/* Interactive colors */
--primary: /* Primary buttons/actions */
--primary-foreground: /* Text on primary */
--secondary: /* Secondary buttons */
--secondary-foreground: /* Text on secondary */
--muted: /* Muted backgrounds */
--muted-foreground: /* Muted/helper text */
--accent: /* Accent highlights */
--accent-foreground: /* Text on accent */
--destructive: /* Delete/error actions */
--destructive-foreground: /* Text on destructive */

/* Utility colors */
--border: /* Borders */
--input: /* Input borders */
--ring: /* Focus rings */
--radius: 0.5rem; /* 8px border radius */
```

**Phase colors** (Vanguard-specific):

```css
/* Light mode */
--gm-phase: 280 60% 50%;     /* Purple */
--pc-phase: 142 76% 36%;     /* Green */
--passed: 210 40% 60%;       /* Soft blue */
--hard-passed: 215 20% 50%;  /* Muted blue */

/* Dark mode */
--gm-phase: 280 60% 60%;
--pc-phase: 142 76% 46%;
--passed: 210 40% 70%;
--hard-passed: 215 20% 60%;
```

**Tailwind usage:**

```tsx
<div className="bg-gm-phase text-gm-phase">
<div className="bg-pc-phase text-pc-phase">
<Badge className="bg-passed">Passed</Badge>
<Badge className="bg-hard-passed">Hard Passed</Badge>
```

### Aspirational Gold Theme (Future Implementation)

When implemented, this creates the warm charcoal + gold aesthetic:

```css
:root {
  /* Base - warm near-black */
  --background: 240 6% 7%;           /* #101012 */
  --foreground: 40 10% 96%;          /* Cream text */
  --card: 240 5% 10%;                /* #18181b elevated surface */
  --card-foreground: 40 10% 96%;

  /* Gold palette */
  --gold: 43 50% 57%;                /* Primary gold #c9a55c */
  --gold-dim: 40 44% 42%;            /* Subdued #9a7b3c */
  --gold-bright: 43 65% 69%;         /* Hover/emphasis #e4c67a */
  --warm-brown: 30 30% 40%;          /* Secondary warm accent */

  /* Primary mapped to gold */
  --primary: 43 50% 57%;
  --primary-foreground: 240 6% 7%;
  --accent: 43 50% 57%;
  --accent-foreground: 240 6% 7%;

  /* Transparency variants (for immersive views) */
  --panel: 240 6% 7% / 0.85;         /* 85% opacity + blur */
  --panel-solid: 240 6% 7% / 0.95;   /* 95% opacity + blur */
  --overlay: 240 6% 4% / 0.7;        /* Modal backdrop */

  /* Text hierarchy */
  --text-primary: 40 10% 96%;        /* High contrast cream */
  --text-secondary: 40 5% 65%;       /* Secondary text */
  --text-muted: 40 3% 42%;           /* Disabled/placeholder */
}
```

**Tailwind config for gold theme:**

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        gold: "hsl(var(--gold))",
        "gold-dim": "hsl(var(--gold-dim))",
        "gold-bright": "hsl(var(--gold-bright))",
        "warm-brown": "hsl(var(--warm-brown))",
        panel: "hsl(var(--panel))",
        "panel-solid": "hsl(var(--panel-solid))",
      },
      boxShadow: {
        "glow-gold": "0 0 20px hsl(43 50% 57% / 0.3)",
      },
    },
  },
};
```

**Gold theme usage:**

```tsx
<Button className="bg-gold hover:bg-gold-bright text-background">
  Primary Action
</Button>

<div className="border-gold/30 glow-gold">
  Emphasized element
</div>

<span className="text-gold">Character Name</span>
<span className="text-gold-dim">Secondary gold text</span>
```

## Typography

### Font Families

**Aspirational fonts** (add to index.html when implementing gold theme):

```html
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
```

**Tailwind config:**

```javascript
fontFamily: {
  display: ["Cormorant Garamond", "serif"],  // Titles, character names
  body: ["Source Sans 3", "sans-serif"],      // Body text, UI
}
```

### Typography Utility Classes

```css
/* Scene titles - cinematic, large */
.scene-title {
  @apply font-display text-4xl font-semibold tracking-tight;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}

/* Character names - gold, prominent */
.character-name {
  @apply font-display text-xl font-semibold text-gold;
}

/* Label text - small caps style */
.label-caps {
  @apply text-sm font-medium tracking-wider uppercase;
}
```

**Usage:**

```tsx
<h1 className="scene-title">{scene.title}</h1>
<h3 className="character-name">{character.name}</h3>
<span className="label-caps text-muted-foreground">GM Phase</span>
```

## View Architecture

### Management Views

Used for: Campaign Dashboard, Campaign Settings, Character Management, Scene List

**Characteristics:**
- Solid `bg-background`
- Full navigation chrome
- Card-based layouts with `bg-card`
- Functional, readable typography
- Standard spacing and borders

```tsx
// Management view layout
<div className="min-h-screen bg-background">
  <header className="sticky top-0 z-50 border-b bg-background">
    <Navigation />
  </header>
  <main className="container mx-auto max-w-6xl px-4 py-8">
    <div className="space-y-6">
      <PageHeader title={title} actions={actions} />
      <Tabs>
        <TabsList>
          <TabsTrigger>Scenes</TabsTrigger>
          <TabsTrigger>Characters</TabsTrigger>
          <TabsTrigger>Settings</TabsTrigger>
        </TabsList>
        <TabsContent>
          <Card className="bg-card p-6">
            {/* Content */}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  </main>
</div>
```

### Immersive Views

Used for: Scene View, Post Reading, Narrative Experience

**Characteristics:**
- Scene imagery visible as background
- Transparent panels (`bg-panel backdrop-blur-md`)
- Minimal navigation
- Atmospheric typography
- Fixed bottom composer (messenger-style)

```tsx
// Immersive view layout
<div className="relative min-h-screen">
  {/* Scene header with image */}
  <div className="relative w-full min-h-[40vh]">
    <div
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: `url(${scene.headerImageUrl})` }}
    />
    <div className="absolute inset-x-0 bottom-0 h-1/2 scene-gradient" />
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
      <h1 className="scene-title">{scene.title}</h1>
    </div>
  </div>

  {/* Posts with transparent cards */}
  <div className="max-w-[800px] mx-auto px-4 py-8 space-y-4">
    {posts.map(post => (
      <div key={post.id} className="bg-panel backdrop-blur-md rounded-xl border p-4">
        {/* Post content */}
      </div>
    ))}
  </div>

  {/* Fixed bottom composer */}
  <div className="fixed bottom-0 left-0 right-0 p-4 pointer-events-none">
    <div className="mx-auto max-w-[800px] pointer-events-auto">
      <div className="rounded-2xl bg-panel-solid backdrop-blur-md border p-3">
        <Composer />
      </div>
    </div>
  </div>
</div>
```

**Scene gradient (fade image to background):**

```css
.scene-gradient {
  background: linear-gradient(to bottom, transparent, hsl(var(--background)));
}

/* Fallback for scenes without images */
.scene-atmosphere {
  background: radial-gradient(ellipse at top, hsl(var(--muted)), hsl(var(--background)));
}
```

## Reusable Patterns

### Post Card Grid Layout

Portrait sidebar with gradient fade into content:

```tsx
<div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] rounded-xl border overflow-hidden bg-card">
  {/* Portrait Sidebar */}
  <div className="relative min-h-[120px]">
    <img
      src={post.characterAvatar}
      alt=""
      className="absolute inset-0 w-full h-full object-cover"
    />
    {/* Gradient fade to content */}
    <div
      className="absolute inset-y-0 right-0 w-1/2"
      style={{ background: 'linear-gradient(to right, transparent, hsl(var(--card)))' }}
    />
  </div>

  {/* Content Area */}
  <div className="relative p-4">
    <h3 className="character-name mb-2">{post.characterName}</h3>
    <div className="text-base leading-relaxed">{post.content}</div>
    <div className="text-xs text-muted-foreground mt-3 text-right">
      {formatDate(post.createdAt)}
    </div>
  </div>
</div>
```

### Transparent Panel Over Imagery

For floating UI elements in immersive views:

```tsx
<div className="bg-panel backdrop-blur-md rounded-xl border border-border/50 p-4">
  {/* Content that floats over scene imagery */}
</div>

// More solid variant for forms/composer
<div className="bg-panel-solid backdrop-blur-md rounded-2xl border p-4">
  {/* Form/composer content */}
</div>
```

### Card Interactive Pattern

Hover effect for clickable cards:

```css
.card-interactive {
  @apply transition-all duration-200;
  @apply hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-lg;
}
```

```tsx
<Card className="card-interactive cursor-pointer" onClick={onClick}>
  {/* Card content */}
</Card>
```

### Phase Indicator Pattern

Color-coded phase badges:

```tsx
function PhaseIndicator({ phase, size = 'md' }: PhaseIndicatorProps) {
  const isGMPhase = phase === 'gm_phase';

  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-1.5',
    lg: 'text-base gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <div className={cn(
      "inline-flex items-center font-medium",
      sizeClasses[size],
      isGMPhase ? "text-gm-phase" : "text-pc-phase"
    )}>
      {isGMPhase ? (
        <Crown className={iconSizes[size]} />
      ) : (
        <Users className={iconSizes[size]} />
      )}
      <span className="uppercase tracking-wider">
        {isGMPhase ? 'GM Phase' : 'PC Phase'}
      </span>
    </div>
  );
}
```

### Phase Banner

For scene roster header:

```tsx
<div className={cn(
  "text-center py-3 border-b",
  isGMPhase
    ? "bg-gm-phase/10 border-gm-phase/30 text-gm-phase"
    : "bg-pc-phase/10 border-pc-phase/30 text-pc-phase"
)}>
  <div className="flex items-center justify-center gap-2">
    {isGMPhase ? <Crown className="h-4 w-4" /> : <Users className="h-4 w-4" />}
    <span className="label-caps">
      {isGMPhase ? 'GM Phase' : 'PC Phase'}
    </span>
  </div>
</div>
```

### Decorative Flourish

Section dividers with gold accents:

```css
.flourish {
  @apply relative my-8 flex items-center justify-center;
}

.flourish::before,
.flourish::after {
  content: '';
  @apply flex-1 h-px bg-border;
}

.flourish::before {
  background: linear-gradient(to right, transparent, hsl(var(--gold) / 0.3));
}

.flourish::after {
  background: linear-gradient(to left, transparent, hsl(var(--gold) / 0.3));
}
```

```tsx
<div className="flourish">
  <Sparkles className="h-4 w-4 text-gold mx-4" />
</div>
```

### Portrait Sizes

Consistent avatar/portrait sizing:

```tsx
// Small - inline mentions, compact lists
<Avatar className="h-6 w-6">  {/* 24px */}

// Medium - post cards, list items
<Avatar className="h-10 w-10">  {/* 40px */}

// Large - profile, featured
<Avatar className="h-20 w-20">  {/* 80px */}
```

For portrait rectangles (4:5 aspect ratio):

```tsx
// Small
<div className="w-12 h-15">  {/* 48x60px */}

// Medium
<div className="w-20 h-25">  {/* 80x100px */}

// Large
<div className="w-[120px] h-[150px]">
```

### Empty States

Thematic empty states (not generic):

```tsx
function EmptyScenes() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No scenes yet</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        Create your first scene to begin the adventure.
      </p>
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        Create Scene
      </Button>
    </div>
  );
}
```

### Skeleton Loading

Match real content dimensions:

```tsx
// Post card skeleton
<div className="grid grid-cols-[80px_1fr] md:grid-cols-[120px_1fr] rounded-xl border overflow-hidden bg-card">
  <Skeleton className="min-h-[120px]" />
  <div className="p-4 space-y-3">
    <Skeleton className="h-5 w-32" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
  </div>
</div>
```

## Color Usage Guidelines

### When to Use Each Color

| Color | Use For |
|-------|---------|
| `primary` | Main actions, primary buttons |
| `secondary` | Secondary actions, less prominent buttons |
| `muted` | Backgrounds for subtle sections |
| `accent` | Highlights, hover states |
| `destructive` | Delete, error states |
| `gold` | Character names, emphasis, premium accents |
| `gm-phase` | GM phase indicators, badges |
| `pc-phase` | PC phase indicators, badges |
| `passed` | Soft pass state |
| `hard-passed` | Hard pass state |

### Semantic Token Usage

```tsx
// GOOD - semantic tokens
<div className="bg-background text-foreground">
<div className="bg-card border">
<span className="text-muted-foreground">
<Button variant="destructive">

// AVOID - raw colors
<div className="bg-gray-900 text-white">
<div className="bg-zinc-800 border-zinc-700">
<span className="text-gray-400">
<Button className="bg-red-500">
```

## Icons Reference

Common icons for Vanguard UI (Lucide React):

```tsx
// Navigation & Actions
import {
  ChevronLeft, ChevronRight, ChevronDown,
  MoreHorizontal, Plus, X, Check,
  Trash2, Pencil, Copy, ExternalLink
} from "lucide-react"

// Game-specific
import {
  Crown,         // GM indicator
  Users,         // Players/PC phase
  Dices,         // Dice rolling
  Eye, EyeOff,   // Visibility
  MessageSquare, // Posts/OOC
  Swords,        // Actions/narrative
  BookOpen,      // Scenes
  Bookmark,      // Bookmarks
  Bell,          // Notifications
  Lock, Unlock,  // Compose lock
} from "lucide-react"

// Status & Feedback
import {
  AlertCircle, AlertTriangle,
  CheckCircle, Info,
  Loader2,      // With animate-spin
  Clock,
} from "lucide-react"
```
