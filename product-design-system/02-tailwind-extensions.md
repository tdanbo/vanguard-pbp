# Tailwind Extensions

This file documents Tailwind CSS configuration extensions for Vanguard PBP.

**Implementation File**: `services/frontend/tailwind.config.js`

---

## Current Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Phase colors | Implemented | `gm-phase`, `pc-phase`, `passed`, `hard-passed` |
| Border radius | Implemented | `lg`, `md`, `sm` using `--radius` variable |
| Container config | Implemented | Centered, max-width 1400px |
| Drain animation | Implemented | For time gate countdown |
| Accordion animations | Implemented | For collapsible UI |
| Custom fonts | NOT IMPLEMENTED | Aspirational |
| Gold color palette | NOT IMPLEMENTED | Aspirational |
| Custom spacing (portraits) | NOT IMPLEMENTED | Aspirational |
| Custom shadows | NOT IMPLEMENTED | Aspirational |
| Skeleton animation | NOT IMPLEMENTED | Aspirational |

---

## Currently Implemented Config

This is what exists in `services/frontend/tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Standard shadcn tokens
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // Vanguard-specific (implemented)
        "gm-phase": "hsl(var(--gm-phase))",
        "pc-phase": "hsl(var(--pc-phase))",
        "passed": "hsl(var(--passed))",
        "hard-passed": "hsl(var(--hard-passed))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "drain": {
          from: { width: "100%" },
          to: { width: "0%" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "drain": "drain var(--drain-duration) linear",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

---

## Using Current Extensions

### Phase Colors

```tsx
// Background colors
<div className="bg-gm-phase">GM Phase indicator</div>
<div className="bg-pc-phase">PC Phase indicator</div>
<div className="bg-passed">Passed state</div>
<div className="bg-hard-passed">Hard passed state</div>

// Text colors
<span className="text-gm-phase">GM Phase text</span>
<span className="text-pc-phase">PC Phase text</span>
```

### Drain Animation (Time Gate)

Used for the time gate countdown progress bar:

```tsx
<div
  className="animate-drain bg-primary h-1 rounded-full"
  style={{ '--drain-duration': '86400s' } as React.CSSProperties}
/>
```

### Container

Centered container with max-width and padding:

```tsx
<div className="container">
  {/* Max-width 1400px, centered, 2rem padding */}
</div>
```

### Border Radius

Use the token-based radius values:

```tsx
<div className="rounded-lg">Large radius (0.5rem default)</div>
<div className="rounded-md">Medium radius (0.5rem - 2px)</div>
<div className="rounded-sm">Small radius (0.5rem - 4px)</div>
```

---

## Aspirational: Full Theme Extensions

The following extensions are the **target configuration** for Vanguard PBP. These are NOT yet implemented but represent the desired theme.

### Font Loading Requirement

Add to `services/frontend/index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Target Tailwind Extensions (NOT YET IMPLEMENTED)

```javascript
// Merge into tailwind.config.js theme.extend
{
  // Font families
  fontFamily: {
    display: ["Cormorant Garamond", "Playfair Display", "Georgia", "serif"],
    body: ["Source Sans 3", "Open Sans", "system-ui", "sans-serif"],
    mono: ["JetBrains Mono", "Fira Code", "monospace"],
  },

  // Extended colors
  colors: {
    gold: {
      DEFAULT: "hsl(var(--gold))",
      dim: "hsl(var(--gold-dim))",
      bright: "hsl(var(--gold-bright))",
    },
    "warm-brown": "hsl(var(--warm-brown))",
    success: "hsl(var(--success))",
    warning: "hsl(var(--warning))",
    info: "hsl(var(--info))",
  },

  // Custom spacing for portraits
  spacing: {
    "15": "3.75rem",   // 60px - portrait-sm height
    "18": "4.5rem",    // 72px
    "22": "5.5rem",    // 88px
    "30": "7.5rem",    // 120px - portrait-lg width
  },

  // Extended border radius
  borderRadius: {
    xl: "calc(var(--radius) + 4px)",
    "2xl": "calc(var(--radius) + 8px)",
  },

  // Typography scale
  fontSize: {
    "2xs": ["0.625rem", { lineHeight: "0.875rem" }],  // 10px
  },

  // Letter spacing
  letterSpacing: {
    tighter: "-0.025em",
    wide: "0.05em",
    wider: "0.1em",
  },

  // Shadows for dark theme (heavier for visibility)
  boxShadow: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.3)",
    DEFAULT: "0 4px 6px rgba(0, 0, 0, 0.4)",
    md: "0 4px 6px rgba(0, 0, 0, 0.4)",
    lg: "0 10px 15px rgba(0, 0, 0, 0.5)",
    xl: "0 20px 25px rgba(0, 0, 0, 0.6)",
    "glow-gold": "0 0 20px hsl(43 50% 57% / 0.3)",
    "glow-soft": "0 0 40px rgba(0, 0, 0, 0.5)",
  },

  // Animation durations
  transitionDuration: {
    "250": "250ms",
    "350": "350ms",
  },

  // Backdrop blur
  backdropBlur: {
    xs: "2px",
  },

  // Additional keyframes
  keyframes: {
    "skeleton-shimmer": {
      "0%": { backgroundPosition: "200% 0" },
      "100%": { backgroundPosition: "-200% 0" },
    },
    "fade-in": {
      "0%": { opacity: "0" },
      "100%": { opacity: "1" },
    },
    "slide-up": {
      "0%": { opacity: "0", transform: "translateY(10px)" },
      "100%": { opacity: "1", transform: "translateY(0)" },
    },
  },

  // Additional animations
  animation: {
    "skeleton-shimmer": "skeleton-shimmer 1.5s infinite",
    "fade-in": "fade-in 0.3s ease-out",
    "slide-up": "slide-up 0.4s ease-out",
  },
}
```

---

## Usage Examples (Once Aspirational Extensions Are Implemented)

### Scene Title

```tsx
<h1 className="font-display text-5xl font-semibold tracking-tight text-foreground">
  The Shadow Fortress
</h1>
```

### Character Name with Gold Accent

```tsx
<span className="font-display text-xl font-semibold text-gold">
  Doravar Redbraid
</span>
```

### Label with Small Caps

```tsx
<span className="text-sm font-medium tracking-wider uppercase text-muted-foreground">
  CHARACTERISTICS
</span>
```

### Transparent Card (Immersive View)

```tsx
<Card className="bg-card/85 backdrop-blur-md border-border">
  ...
</Card>
```

### Interactive Card with Hover

```tsx
<Card className="transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-dim hover:shadow-lg">
  ...
</Card>
```

---

## Quick Reference

### Implemented Classes

| Class | Purpose |
|-------|---------|
| `bg-gm-phase` | GM phase purple background |
| `bg-pc-phase` | PC phase green background |
| `bg-passed` | Passed state background |
| `bg-hard-passed` | Hard passed state background |
| `text-gm-phase` | GM phase text color |
| `text-pc-phase` | PC phase text color |
| `animate-drain` | Linear width drain animation |
| `animate-accordion-down` | Accordion expand |
| `animate-accordion-up` | Accordion collapse |
| `container` | Centered max-width container |

### Aspirational Classes (NOT YET AVAILABLE)

| Category | Classes |
|----------|---------|
| **Fonts** | `font-display`, `font-body`, `font-mono` |
| **Gold Colors** | `text-gold`, `text-gold-dim`, `text-gold-bright`, `bg-gold`, `border-gold` |
| **Spacing** | `w-15`, `h-15`, `w-18`, `h-18`, `w-22`, `h-22`, `w-30`, `h-30` |
| **Shadows** | `shadow-glow-gold`, `shadow-glow-soft` |
| **Animations** | `animate-skeleton-shimmer`, `animate-fade-in`, `animate-slide-up` |
| **Typography** | `text-2xs`, `tracking-wide`, `tracking-wider` |
