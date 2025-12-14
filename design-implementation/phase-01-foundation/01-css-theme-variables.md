# 1.1 CSS Theme Variables

**Skill**: `shadcn-react`

## Goal

Replace the current cool blue/slate CSS variables with warm gold/charcoal theme variables.

---

## Design References

- [01-shadcn-theme-reference.md](../../product-design-system/01-shadcn-theme-reference.md) - Lines 206-330 contain the complete target CSS
- [03-design-tokens.md](../../product-design-system/03-design-tokens.md) - Token definitions and rationale

---

## Overview

The current theme uses cool blue/slate colors (`222.2 84% 4.9%` for background). The target warm gold theme uses:

| Token | Current (Cool) | Target (Warm) |
|-------|---------------|---------------|
| `--background` | `222.2 84% 4.9%` | `240 6% 7%` |
| `--card` | `222.2 84% 4.9%` | `240 5% 10%` |
| `--primary` | `210 40% 98%` | `43 50% 57%` |
| `--border` | `217.2 32.6% 17.5%` | `240 5% 18%` |

---

## Implementation Steps

### Step 1: Back Up Current CSS

Before making changes, note the current values in `services/frontend/src/index.css` for reference.

### Step 2: Replace `:root` Variables (Light Mode)

Update the `:root` section in `services/frontend/src/index.css`:

```css
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

  /* Extended palette */
  --gold: 43 50% 57%;
  --gold-dim: 40 44% 42%;
  --gold-bright: 43 65% 69%;
  --warm-brown: 30 30% 35%;
}
```

### Step 3: Replace `.dark` Variables

Update the `.dark` section with warm charcoal values:

```css
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

  /* Extended palette */
  --gold: 43 50% 57%;
  --gold-dim: 40 44% 42%;
  --gold-bright: 43 65% 69%;
  --warm-brown: 30 30% 40%;

  /* Transparency variants for immersive views */
  --panel: 240 6% 7% / 0.85;
  --panel-solid: 240 6% 7% / 0.95;
  --overlay: 240 6% 4% / 0.7;

  /* Text hierarchy */
  --text-primary: 40 10% 96%;
  --text-secondary: 40 5% 65%;
  --text-muted: 40 3% 42%;

  /* Semantic colors */
  --success: 140 30% 35%;
  --warning: 43 70% 45%;
  --info: 210 25% 45%;
}
```

### Step 4: Verify No Hardcoded Colors

Search the codebase for any hardcoded color values that bypass the theme:

```bash
grep -r "bg-\[#" services/frontend/src/
grep -r "text-\[#" services/frontend/src/
grep -r "border-\[#" services/frontend/src/
```

Replace any found with theme tokens.

---

## Key Points

- **HSL format**: All colors use HSL without the `hsl()` wrapper (Tailwind adds it)
- **Opacity support**: Variables like `--panel` include opacity for transparency
- **Warm undertones**: The charcoal `240 6% 7%` has warm undertones vs cool slate
- **Gold as primary**: `43 50% 57%` is a warm gold, not neutral gray

---

## Visual Reference

| Element | Color | HSL |
|---------|-------|-----|
| Background (dark) | #101012 | `240 6% 7%` |
| Card (dark) | #18181b | `240 5% 10%` |
| Primary Gold | #c9a55c | `43 50% 57%` |
| Gold Dim | #9a7b3c | `40 44% 42%` |
| Gold Bright | #e4c67a | `43 65% 69%` |
| GM Phase | #9966cc | `280 50% 60%` |
| PC Phase | #3eb370 | `142 55% 50%` |

---

## Success Criteria

- [ ] `:root` updated with light mode warm palette
- [ ] `.dark` updated with warm charcoal + gold theme
- [ ] Extended palette variables (`--gold`, `--panel`, etc.) added
- [ ] Text hierarchy variables added
- [ ] No hardcoded color values in components
- [ ] Application renders with warm charcoal background
