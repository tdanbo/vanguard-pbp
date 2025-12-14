# shadcn Theme Reference

This file documents the CSS theme that maps design tokens to shadcn/ui's CSS variable system.

**Implementation File**: `services/frontend/src/index.css`

---

## Current Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Core shadcn tokens | Implemented | Standard color variables |
| Phase colors | Implemented | `--gm-phase`, `--pc-phase`, `--passed`, `--hard-passed` |
| Dark mode | Implemented | Via `.dark` class |
| Drain animation | Implemented | For time gate countdown |
| Gold accent palette | NOT IMPLEMENTED | Aspirational |
| Transparency variants | NOT IMPLEMENTED | Aspirational |
| Custom utility classes | NOT IMPLEMENTED | Aspirational |

---

## Currently Implemented CSS

This is what exists in `services/frontend/src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;

    /* Vanguard-specific */
    --gm-phase: 280 60% 50%;
    --pc-phase: 142 76% 36%;
    --passed: 210 40% 60%;
    --hard-passed: 215 20% 50%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;

    /* Vanguard-specific (dark) */
    --gm-phase: 280 60% 60%;
    --pc-phase: 142 76% 46%;
    --passed: 210 40% 70%;
    --hard-passed: 215 20% 60%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

---

## Tailwind Config Extensions

Currently in `tailwind.config.js`:

```js
// Colors
colors: {
  // Standard shadcn tokens (all implemented)
  border: "hsl(var(--border))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
  secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
  destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
  muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
  accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
  popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
  card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },

  // Vanguard-specific (implemented)
  "gm-phase": "hsl(var(--gm-phase))",
  "pc-phase": "hsl(var(--pc-phase))",
  "passed": "hsl(var(--passed))",
  "hard-passed": "hsl(var(--hard-passed))",
}

// Animations (implemented)
animation: {
  "accordion-down": "accordion-down 0.2s ease-out",
  "accordion-up": "accordion-up 0.2s ease-out",
  "drain": "drain var(--drain-duration) linear",  // For time gate countdown
}
```

---

## Using Current Tokens

### Phase Colors

Use the implemented Vanguard tokens for phase indicators:

```tsx
// Background colors
<div className="bg-gm-phase">GM Phase</div>
<div className="bg-pc-phase">PC Phase</div>
<div className="bg-passed">Passed</div>
<div className="bg-hard-passed">Hard Passed</div>

// Text colors
<span className="text-gm-phase">GM Phase</span>
<span className="text-pc-phase">PC Phase</span>
```

### Drain Animation (Time Gate)

The drain animation is used for time gate countdown:

```tsx
// Set duration via CSS variable, then apply animation
<div
  className="animate-drain bg-primary h-1"
  style={{ '--drain-duration': '86400s' } as React.CSSProperties}
/>
```

### Standard shadcn Patterns

For most styling, use standard shadcn/Tailwind patterns:

```tsx
// Cards
<div className="bg-card text-card-foreground rounded-lg border p-4">
  Card content
</div>

// Muted text
<p className="text-muted-foreground text-sm">Secondary text</p>

// Destructive elements
<Button variant="destructive">Delete</Button>

// Backgrounds
<div className="bg-background">Main background</div>
<div className="bg-muted">Muted background</div>
<div className="bg-secondary">Secondary background</div>
```

---

## Aspirational: Warm Gold Theme

The following is the **target theme** for Vanguard PBP. This represents the desired aesthetic but is NOT yet implemented. When implementing, replace the current CSS with this.

### Design Goals

- **Warm charcoal backgrounds** instead of cool slate
- **Gold accent color** instead of neutral gray
- **Text hierarchy** with warm cream tones
- **Transparency variants** for immersive scene views

### Target CSS (NOT YET IMPLEMENTED)

```css
@layer base {
  :root {
    /* Light mode - kept minimal, app is primarily dark */
    --background: 40 10% 96%;
    --foreground: 20 10% 10%;
    --card: 40 10% 98%;
    --card-foreground: 20 10% 10%;
    --popover: 40 10% 98%;
    --popover-foreground: 20 10% 10%;
    --primary: 43 50% 45%;
    --primary-foreground: 40 10% 98%;
    --secondary: 40 8% 90%;
    --secondary-foreground: 20 10% 15%;
    --muted: 40 8% 90%;
    --muted-foreground: 20 5% 45%;
    --accent: 43 50% 45%;
    --accent-foreground: 40 10% 98%;
    --destructive: 0 65% 50%;
    --destructive-foreground: 40 10% 98%;
    --border: 40 8% 85%;
    --input: 40 8% 85%;
    --ring: 43 50% 45%;
    --radius: 0.75rem;

    /* Vanguard-specific */
    --gm-phase: 280 45% 50%;
    --pc-phase: 142 50% 40%;
    --passed: 40 20% 50%;
    --hard-passed: 40 10% 40%;

    /* Extended palette (aspirational) */
    --gold: 43 50% 57%;
    --gold-dim: 40 44% 42%;
    --gold-bright: 43 65% 69%;
    --warm-brown: 30 30% 35%;
  }

  .dark {
    /* Background scale - warm charcoal */
    --background: 240 6% 7%;
    --foreground: 40 10% 96%;

    /* Card/elevated surfaces */
    --card: 240 5% 10%;
    --card-foreground: 40 10% 96%;

    /* Popover */
    --popover: 240 5% 10%;
    --popover-foreground: 40 10% 96%;

    /* Primary - Gold accent */
    --primary: 43 50% 57%;
    --primary-foreground: 240 6% 7%;

    /* Secondary - Elevated surface */
    --secondary: 240 4% 14%;
    --secondary-foreground: 40 10% 90%;

    /* Muted */
    --muted: 240 4% 14%;
    --muted-foreground: 40 5% 55%;

    /* Accent - Gold */
    --accent: 43 50% 57%;
    --accent-foreground: 240 6% 7%;

    /* Destructive - Muted red */
    --destructive: 0 50% 35%;
    --destructive-foreground: 40 10% 96%;

    /* Borders - subtle warm */
    --border: 240 5% 18%;
    --input: 240 4% 14%;

    /* Focus ring - gold */
    --ring: 43 50% 57%;

    /* Vanguard-specific (dark mode) */
    --gm-phase: 280 50% 60%;
    --pc-phase: 142 55% 50%;
    --passed: 40 25% 60%;
    --hard-passed: 40 15% 50%;

    /* Extended palette (aspirational) */
    --gold: 43 50% 57%;
    --gold-dim: 40 44% 42%;
    --gold-bright: 43 65% 69%;
    --warm-brown: 30 30% 40%;

    /* Transparency variants for immersive views (aspirational) */
    --panel: 240 6% 7% / 0.85;
    --panel-solid: 240 6% 7% / 0.95;
    --overlay: 240 6% 4% / 0.7;

    /* Text hierarchy (aspirational) */
    --text-primary: 40 10% 96%;
    --text-secondary: 40 5% 65%;
    --text-muted: 40 3% 42%;

    /* Semantic colors - muted variants (aspirational) */
    --success: 140 30% 35%;
    --warning: 43 70% 45%;
    --info: 210 25% 45%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  /* Force dark mode by default */
  :root {
    color-scheme: dark;
  }
}
```

### Target Utility Classes (NOT YET IMPLEMENTED)

When the warm gold theme is implemented, add these utility classes:

```css
@layer components {
  /* Gold accent utilities */
  .text-gold { color: hsl(var(--gold)); }
  .text-gold-dim { color: hsl(var(--gold-dim)); }
  .text-gold-bright { color: hsl(var(--gold-bright)); }
  .bg-gold { background-color: hsl(var(--gold)); }
  .border-gold { border-color: hsl(var(--gold)); }
  .border-gold-dim { border-color: hsl(var(--gold-dim)); }
  .ring-gold { --tw-ring-color: hsl(var(--gold)); }

  /* Panel transparency for immersive views */
  .bg-panel {
    background-color: hsl(var(--panel));
    backdrop-filter: blur(10px);
  }
  .bg-panel-solid {
    background-color: hsl(var(--panel-solid));
    backdrop-filter: blur(10px);
  }

  /* Text hierarchy utilities */
  .text-hierarchy-primary { color: hsl(var(--text-primary)); }
  .text-hierarchy-secondary { color: hsl(var(--text-secondary)); }
  .text-hierarchy-muted { color: hsl(var(--text-muted)); }

  /* Phase indicators */
  .bg-gm-phase { background-color: hsl(var(--gm-phase)); }
  .bg-pc-phase { background-color: hsl(var(--pc-phase)); }
  .text-gm-phase { color: hsl(var(--gm-phase)); }
  .text-pc-phase { color: hsl(var(--pc-phase)); }

  /* Small caps treatment for labels */
  .label-caps {
    @apply text-sm font-medium tracking-wider uppercase;
    color: hsl(var(--text-secondary));
  }

  /* Display font (requires Google Font import) */
  .font-display {
    font-family: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;
  }

  /* Scene title treatment */
  .scene-title {
    @apply font-display text-4xl font-semibold tracking-tight;
    text-shadow: 0 2px 20px rgba(0, 0, 0, 0.8);
  }

  /* Character name treatment */
  .character-name {
    @apply font-display text-xl font-semibold;
    color: hsl(var(--gold));
  }

  /* Card with hover lift effect */
  .card-interactive {
    @apply transition-all duration-200;
  }
  .card-interactive:hover {
    @apply -translate-y-0.5;
    border-color: hsl(var(--gold-dim));
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.5);
  }

  /* Subtle gold border for emphasis */
  .border-emphasis {
    border-color: hsl(var(--gold) / 0.3);
  }

  /* Glow effects */
  .glow-gold {
    box-shadow: 0 0 20px hsl(var(--gold) / 0.3);
  }

  /* Portrait sizing utilities */
  .portrait-sm {
    @apply w-12 h-15 rounded-lg object-cover;
    border: 1px solid hsl(var(--border));
  }
  .portrait-md {
    @apply w-20 rounded-lg object-cover;
    height: 100px;
    border: 2px solid hsl(var(--border));
  }
  .portrait-lg {
    @apply w-30 rounded-xl object-cover;
    height: 150px;
    border: 2px solid hsl(var(--border));
  }
}

@layer utilities {
  /* Custom height for portraits */
  .h-15 { height: 3.75rem; }
  .w-30 { width: 7.5rem; }

  /* Scene header gradient overlay */
  .scene-gradient {
    background: linear-gradient(to bottom, transparent, hsl(var(--background)));
  }

  /* Atmospheric gradient for scenes without images */
  .scene-atmosphere {
    background: radial-gradient(ellipse at top, hsl(240 5% 12%), hsl(var(--background)));
  }

  /* Skeleton loading animation */
  .skeleton {
    background: linear-gradient(
      90deg,
      hsl(var(--secondary)) 25%,
      hsl(240 4% 18%) 50%,
      hsl(var(--secondary)) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s infinite;
  }

  @keyframes skeleton-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  /* Decorative flourish divider */
  .flourish {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .flourish::before,
  .flourish::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, hsl(var(--gold-dim)), transparent);
  }
}
```

### Font Requirements (Aspirational)

When implementing the warm theme, add these fonts to `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600&display=swap" rel="stylesheet">
```

---

## Quick Reference

### Implemented Tailwind Classes

| Class | Purpose |
|-------|---------|
| `bg-gm-phase` | GM phase purple background |
| `bg-pc-phase` | PC phase green background |
| `bg-passed` | Passed state blue background |
| `bg-hard-passed` | Hard passed muted blue background |
| `text-gm-phase` | GM phase purple text |
| `text-pc-phase` | PC phase green text |
| `animate-drain` | Linear width drain animation |

### Standard shadcn Classes (Always Available)

| Class | Purpose |
|-------|---------|
| `bg-background` | Main page background |
| `bg-card` | Card/panel background |
| `bg-muted` | Muted/secondary background |
| `bg-secondary` | Alternative background |
| `bg-destructive` | Error/danger background |
| `text-foreground` | Primary text color |
| `text-muted-foreground` | Secondary/muted text |
| `border-border` | Standard border color |
| `text-destructive` | Error/danger text |

### Aspirational Classes (NOT YET AVAILABLE)

| Class | Purpose |
|-------|---------|
| `.font-display` | Cormorant Garamond serif font |
| `.character-name` | Gold serif text for character names |
| `.scene-title` | Large serif heading with text-shadow |
| `.label-caps` | Small caps treatment for labels |
| `.text-gold` / `.text-gold-dim` / `.text-gold-bright` | Gold accent text |
| `.bg-panel` | 85% opacity background with blur |
| `.bg-panel-solid` | 95% opacity background with blur |
| `.card-interactive` | Hover lift effect with gold border |
| `.portrait-sm` / `.portrait-md` / `.portrait-lg` | Character portrait sizes |
| `.flourish` | Decorative gold divider lines |
| `.scene-gradient` | Bottom fade for scene headers |
| `.scene-atmosphere` | Radial gradient for imageless scenes |
| `.glow-gold` | Gold box-shadow glow effect |
