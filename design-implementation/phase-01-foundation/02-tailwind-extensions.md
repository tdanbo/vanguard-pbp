# 1.2 Tailwind Extensions

**Skill**: `shadcn-react`

## Goal

Extend the Tailwind configuration to expose new theme colors, fonts, spacing, and animations.

---

## Design References

- [02-tailwind-extensions.md](../../product-design-system/02-tailwind-extensions.md) - Complete Tailwind config specification
- [01-shadcn-theme-reference.md](../../product-design-system/01-shadcn-theme-reference.md) - Lines 103-137 for current config

---

## Overview

The Tailwind config needs to expose the new CSS variables as usable classes. This includes:

- Gold color palette (`text-gold`, `bg-gold`, etc.)
- Custom font families (`font-display`, `font-body`)
- Portrait sizing utilities
- Dark-optimized shadows
- New animations

---

## Implementation Steps

### Step 1: Update `tailwind.config.js`

Modify `services/frontend/tailwind.config.js`:

```js
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
      // Color extensions
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

        // Vanguard phase colors
        "gm-phase": "hsl(var(--gm-phase))",
        "pc-phase": "hsl(var(--pc-phase))",
        "passed": "hsl(var(--passed))",
        "hard-passed": "hsl(var(--hard-passed))",

        // Gold accent palette (NEW)
        gold: {
          DEFAULT: "hsl(var(--gold))",
          dim: "hsl(var(--gold-dim))",
          bright: "hsl(var(--gold-bright))",
        },
        "warm-brown": "hsl(var(--warm-brown))",

        // Semantic colors (NEW)
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
      },

      // Font family extensions (NEW)
      fontFamily: {
        display: ['"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
        body: ['"Source Sans 3"', '"Source Sans Pro"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },

      // Border radius
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      // Custom spacing for portraits (NEW)
      spacing: {
        '15': '3.75rem',   // 60px - portrait-sm height
        '18': '4.5rem',    // 72px
        '22': '5.5rem',    // 88px
        '30': '7.5rem',    // 120px - portrait-lg width
      },

      // Box shadows - dark optimized (NEW)
      boxShadow: {
        'glow-gold': '0 0 20px hsl(var(--gold) / 0.3)',
        'glow-soft': '0 0 30px hsl(var(--gold) / 0.15)',
        'card-hover': '0 10px 15px rgba(0, 0, 0, 0.5)',
        'inset-gold': 'inset 0 1px 0 hsl(var(--gold) / 0.1)',
      },

      // Keyframe animations
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
        // NEW animations
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "skeleton-shimmer": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "bounce-typing": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },

      // Animation utilities
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "drain": "drain var(--drain-duration) linear",
        // NEW
        "fade-in": "fade-in 0.2s ease-out",
        "slide-up": "slide-up 0.3s ease-out",
        "skeleton": "skeleton-shimmer 1.5s infinite",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "bounce-typing": "bounce-typing 0.6s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

---

## Key Points

- **Gold palette**: Three shades for different contexts (dim for subtle, bright for hover)
- **Font stacks**: Include fallbacks for graceful degradation
- **Portrait spacing**: Custom values for consistent portrait sizing
- **Dark shadows**: Lower opacity, larger blur for dark backgrounds
- **Animation tokens**: Reusable for consistent motion design

---

## Usage Examples

After configuration:

```tsx
// Gold text
<span className="text-gold">Gold accent text</span>
<span className="text-gold-dim">Subdued gold</span>
<span className="text-gold-bright">Bright gold (hover)</span>

// Display font
<h1 className="font-display text-4xl">Scene Title</h1>

// Portrait sizing
<div className="w-20 h-30">Portrait container</div>

// Shadows
<div className="shadow-glow-gold">Glowing card</div>

// Animations
<div className="animate-fade-in">Fading in</div>
<div className="animate-skeleton">Loading skeleton</div>
```

---

## Success Criteria

- [ ] Gold color palette available (`text-gold`, `bg-gold-dim`, etc.)
- [ ] Font families registered (`font-display`, `font-body`)
- [ ] Custom spacing values available (`w-30`, `h-15`)
- [ ] Dark-optimized shadows working
- [ ] New animations available (`animate-fade-in`, `animate-skeleton`)
- [ ] All existing Tailwind classes still function
