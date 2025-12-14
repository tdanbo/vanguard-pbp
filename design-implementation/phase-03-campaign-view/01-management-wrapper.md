# 3.1 Management Wrapper

**Skill**: `shadcn-react`

## Goal

Create a layout wrapper for management views with solid background and centered content.

---

## Design References

- [04-view-architecture.md](../../product-design-system/04-view-architecture.md) - Lines 50-65 for management view patterns

---

## Overview

Management views (Campaign Dashboard, Settings) use:
- Solid `bg-background` (no transparency)
- Centered container with max width
- Full navigation visible
- Standard page layout

This contrasts with immersive views (Scene View) which use transparent panels.

---

## Implementation

### ManagementLayout Component

Create `src/components/layout/ManagementLayout.tsx`:

```tsx
import { cn } from "@/lib/utils"

interface ManagementLayoutProps {
  children: React.ReactNode
  className?: string
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "6xl"
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
}

export function ManagementLayout({
  children,
  className,
  maxWidth = "4xl",
}: ManagementLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div
        className={cn(
          "container mx-auto px-4 py-8",
          maxWidthClasses[maxWidth],
          className
        )}
      >
        {children}
      </div>
    </div>
  )
}
```

### Usage

```tsx
import { ManagementLayout } from "@/components/layout/ManagementLayout"

export function CampaignDashboard() {
  return (
    <ManagementLayout maxWidth="6xl">
      <CampaignHeader campaign={campaign} />
      <CampaignTabs campaign={campaign} />
    </ManagementLayout>
  )
}
```

---

## Layout Characteristics

| Property | Value | Reason |
|----------|-------|--------|
| Background | `bg-background` | Solid, not transparent |
| Max Width | `max-w-4xl` or `max-w-6xl` | Readable line lengths |
| Padding | `px-4 py-8` | Comfortable spacing |
| Container | Centered | Professional layout |

---

## Comparison: Management vs Immersive

| Aspect | Management | Immersive |
|--------|------------|-----------|
| Background | Solid | Transparent/Scene image |
| Container | Centered, max-width | Full-bleed |
| Chrome | Full navigation | Minimal (back button) |
| Cards | Solid `bg-card` | Transparent `bg-panel` |

---

## Success Criteria

- [ ] ManagementLayout component created
- [ ] Background is solid (no transparency)
- [ ] Content is centered with max-width
- [ ] Responsive padding
- [ ] Used by CampaignDashboard and Settings pages
