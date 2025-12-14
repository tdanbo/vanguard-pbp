# Phase 3: Campaign View

**Goal**: Implement management view patterns for the Campaign Dashboard.

---

## Overview

This phase builds the Campaign Dashboard — the primary management interface. By the end, you'll have:
- Management view wrapper with solid background
- Campaign header with title, GM badge, and phase indicator
- Tab navigation with gold active indicator
- Scene cards grid with hover effects
- Settings page with forms and danger zone

---

## Skills to Activate

| Skill | Purpose |
|-------|---------|
| `shadcn-react` | Component patterns, tabs, forms |
| `state-machine` | Phase indicator integration |

---

## Sub-phases

| # | Task | File | Description |
|---|------|------|-------------|
| 3.1 | Management Wrapper | [01-management-wrapper.md](./01-management-wrapper.md) | Solid background layout wrapper |
| 3.2 | Campaign Header | [02-campaign-header.md](./02-campaign-header.md) | Title, badges, stats |
| 3.3 | Tab Navigation | [03-tab-navigation.md](./03-tab-navigation.md) | Scenes, Characters, Members, Settings |
| 3.4 | Scene Cards | [04-scene-cards.md](./04-scene-cards.md) | Grid with images and hover effects |
| 3.5 | Settings Tab | [05-settings-tab.md](./05-settings-tab.md) | Forms and danger zone |

---

## Design References

- [04-view-architecture.md](../../product-design-system/04-view-architecture.md) - Management vs immersive patterns
- [06-campaign-view.md](../../product-design-system/06-campaign-view.md) - Complete campaign view specs

---

## Prerequisites

Before starting this phase, ensure:

1. Phase 1 and 2 completed:
   - [x] Warm gold theme active
   - [x] Button and card patterns established
   - [x] Badge variants created

2. Campaign data structures exist in frontend

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `src/pages/campaigns/CampaignDashboard.tsx` | Modify |
| `src/components/campaign/CampaignHeader.tsx` | Modify/Create |
| `src/components/campaign/SceneCard.tsx` | Modify/Create |
| `src/pages/campaigns/CampaignSettings.tsx` | Modify |

---

## Completion Checklist

- [ ] Management wrapper uses solid bg-background
- [ ] Campaign header shows title with font-display
- [ ] GM badge and phase indicator display correctly
- [ ] Tab navigation has gold active indicator
- [ ] Scene cards grid is responsive (1/2/3 columns)
- [ ] Scene cards have hover lift effect
- [ ] Scene cards show image or gradient fallback
- [ ] Settings forms validate correctly
- [ ] Danger zone has destructive styling

---

## Next Phase

After completing Phase 3, proceed to [Phase 4: Scene View](../phase-04-scene-view/README.md).
