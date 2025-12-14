# View Architecture

> **Theme Reference**: Background and panel classes are defined in [01-shadcn-theme-reference.md](./01-shadcn-theme-reference.md). Use `bg-background`, `bg-card`, `bg-panel`, `bg-panel-solid` utility classes.

---

## The Fundamental Split

Vanguard has two categories of views that require different design treatments:

```
┌─────────────────────────────────────────────────────────────────┐
│                     MANAGEMENT VIEWS                            │
│  You're looking AT your campaigns, characters, settings         │
│  ─────────────────────────────────────────────────────────────  │
│  • Solid dark backgrounds                                       │
│  • Full UI chrome visible                                       │
│  • Cards, tables, forms                                         │
│  • Efficient, functional layout                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     IMMERSIVE VIEWS                             │
│  You're IN the scene, experiencing the narrative                │
│  ─────────────────────────────────────────────────────────────  │
│  • Scene imagery visible behind panels                          │
│  • Minimal UI chrome, mostly hidden                             │
│  • Content flows freely                                         │
│  • Atmospheric, distraction-free                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## View Classification

### Management Views

| View | Purpose | Key Elements |
|------|---------|--------------|
| Campaign List | Browse/create campaigns | Campaign cards, create button |
| Campaign Dashboard | Manage single campaign | Scene list, members, settings tabs |
| Character List | View all characters | Character cards grid |
| Character Sheet | View/edit character | Form fields, stats, equipment |
| Settings | Configure campaign/account | Forms, toggles, danger zone |
| Invites/Members | Manage access | User list, invite form |

**Design treatment:**

```tsx
// Management view wrapper
<div className="min-h-screen bg-background">
  <div className="container mx-auto max-w-4xl px-4 py-8">
    <Card className="bg-card">
      {/* Content */}
    </Card>
  </div>
</div>
```

- Solid `bg-background` background
- Standard card layouts with `bg-card`
- Full navigation visible
- Tables, grids, forms as needed
- Focus on clarity and efficiency

### Immersive Views

| View | Purpose | Key Elements |
|------|---------|--------------|
| Scene View | Read/write narrative | Scene header, post stream, composer |
| Scene Reading | Read-only past scene | Archived posts, no composer |
| Character Portrait | View character in-fiction | Large portrait, narrative description |

**Design treatment:**

```tsx
// Immersive view wrapper
<div className="min-h-screen relative">
  {/* Background image */}
  <div
    className="absolute inset-0 bg-cover bg-center"
    style={{ backgroundImage: `url(${sceneImage})` }}
  />

  {/* Gradient fade */}
  <div className="absolute inset-0 scene-gradient" />

  {/* Content with transparent panels */}
  <div className="relative z-10">
    <Card className="bg-panel backdrop-blur-md">
      {/* Post content */}
    </Card>
  </div>
</div>
```

- Scene image as background (full-bleed or hero)
- Transparent panels using `bg-panel` (85% opacity + blur)
- Minimal navigation (back button, hidden menus)
- Focus on content: posts, portraits, narrative
- Composer is prominent but unobtrusive

---

## Navigation Architecture

```
Landing / Home
    │
    ├── Campaign List (management)
    │       │
    │       └── Campaign Dashboard (management)
    │               │
    │               ├── Scene List tab
    │               │       │
    │               │       └── Scene View (IMMERSIVE) ← Primary experience
    │               │
    │               ├── Characters tab
    │               │       │
    │               │       └── Character Sheet (management)
    │               │
    │               ├── Members tab (management)
    │               │
    │               └── Settings tab (management)
    │
    └── My Characters (management)
            │
            └── Character Sheet (management)
```

**Key insight:** Scene View is the destination. Everything else exists to get you there or configure the experience.

---

## Transition Between Modes

When entering an immersive view from a management view:

1. **Visual transition**: Background fades from solid to scene imagery
2. **Chrome reduction**: Navigation minimizes or hides
3. **Layout shift**: From structured cards to flowing content
4. **Focus shift**: From browsing to reading/writing

```tsx
// Use animate-fade-in for smooth transitions
<div className="animate-fade-in">
  {/* Immersive content */}
</div>
```

Consider smooth transitions (300-500ms) to make the mode shift feel intentional.

---

## Layout Principles by Mode

### Management View Layout

```
┌─────────────────────────────────────────────────┐
│  Header: Navigation, breadcrumbs, actions       │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │  Content area (cards, forms, tables)    │   │
│  │  Max-width container, centered          │   │
│  │  Generous padding                       │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
└─────────────────────────────────────────────────┘
```

```tsx
<div className="container mx-auto max-w-4xl px-4 py-8">
  {/* Content */}
</div>
```

- Constrained content width (max ~900-1000px)
- Centered container
- Clear header with navigation
- Standard component patterns

### Immersive View Layout

```
┌─────────────────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░ SCENE IMAGE / ATMOSPHERE ░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░  ┌─────────────────────────────────────┐  ░░│
│░░  │      SCENE TITLE                    │  ░░│
│░░  │      Location / Description         │  ░░│
│░░  └─────────────────────────────────────┘  ░░│
│░░                                           ░░│
│░░  ┌─────────────────────────────────────┐  ░░│
│░░  │  Post 1                             │  ░░│
│░░  └─────────────────────────────────────┘  ░░│
│░░  ┌─────────────────────────────────────┐  ░░│
│░░  │  Post 2                             │  ░░│
│░░  └─────────────────────────────────────┘  ░░│
│░░                                           ░░│
│░░  ┌─────────────────────────────────────┐  ░░│
│░░  │  COMPOSER                           │  ░░│
│░░  └─────────────────────────────────────┘  ░░│
└─────────────────────────────────────────────────┘
   ░░ = Scene imagery visible through transparency
```

- Full viewport utilization
- Scene imagery as background or hero
- Content centered but can be wider (max ~800px for posts)
- Minimal chrome (tiny back button, hamburger menu)
- Composer fixed or at natural scroll position

---

## Responsive Considerations

### Management Views
- Standard responsive: stack columns on mobile
- Cards become full-width
- Tables become card lists
- Navigation collapses to hamburger

### Immersive Views
- **Priority: Posts and Composer always visible**
- Scene header may shrink but stays impactful
- Side panels (if any) hide behind toggles on mobile
- Portrait images resize proportionally
- Composer should be thumb-friendly on mobile
