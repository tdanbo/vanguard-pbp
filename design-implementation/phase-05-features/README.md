# Phase 5: Feature Components

**Goal**: Implement specialized UI for dice rolling, phases, notifications, images, and real-time indicators.

---

## Overview

This phase builds the game-specific feature components. By the end, you'll have:
- Complete dice rolling UI with all states
- Phase indicators with time gate countdown
- Notification center with settings
- Image upload with storage indicators
- Real-time indicators (compose lock, typing)

---

## Skills to Activate

| Skill | Purpose |
|-------|---------|
| `dice-roller` | Roll forms, badges, GM actions |
| `state-machine` | Phase transitions, time gates |
| `notification-system` | Notification center, preferences |
| `image-upload` | Avatar/scene uploads, storage |
| `real-time-sync` | Live indicators, presence |
| `compose-lock` | Lock timer, acquisition |

---

## Sub-phases

| # | Task | File | Description |
|---|------|------|-------------|
| 5.1 | Rolls Components | [01-rolls-components.md](./01-rolls-components.md) | RollBadge, RollCard, RollForm |
| 5.2 | Phase Components | [02-phase-components.md](./02-phase-components.md) | PhaseIndicator, TimeGateCountdown |
| 5.3 | Notification Components | [03-notification-components.md](./03-notification-components.md) | NotificationCenter, Settings |
| 5.4 | Image Upload | [04-image-upload.md](./04-image-upload.md) | AvatarUploader, StorageIndicator |
| 5.5 | Real-time Indicators | [05-realtime-indicators.md](./05-realtime-indicators.md) | LockTimerBar, TypingIndicator |

---

## Design References

- [08-rolls-system.md](../../product-design-system/08-rolls-system.md) - Dice rolling UI
- [09-phase-system.md](../../product-design-system/09-phase-system.md) - Phase indicators
- [10-notifications.md](../../product-design-system/10-notifications.md) - Notification center
- [11-image-upload.md](../../product-design-system/11-image-upload.md) - Image handling
- [12-real-time-indicators.md](../../product-design-system/12-real-time-indicators.md) - Live updates

---

## Prerequisites

Before starting this phase, ensure:

1. Phases 1-4 completed:
   - [x] Theme foundation
   - [x] Component patterns
   - [x] Campaign view
   - [x] Scene view structure

2. Backend APIs ready for:
   - Dice rolls
   - Phase transitions
   - Notifications
   - Image uploads
   - Real-time subscriptions

---

## Completion Checklist

- [ ] RollBadge shows pending/completed/invalidated states
- [ ] RollCard displays in GM dashboard with actions
- [ ] IntentionSelector dropdown works
- [ ] PhaseIndicator with size variants
- [ ] TimeGateCountdown with color states
- [ ] PhaseTransitionButton with blocking states
- [ ] NotificationCenter dropdown with badge count
- [ ] NotificationSettings dialog complete
- [ ] AvatarUploader with preview and remove
- [ ] StorageIndicator with warning levels
- [ ] LockTimerBar as slim progress bar
- [ ] TypingIndicator with bouncing dots

---

## Next Phase

After completing Phase 5, proceed to [Phase 6: Accessibility & Polish](../phase-06-polish/README.md).
