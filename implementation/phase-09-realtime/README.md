# Phase 9: Real-time Sync & Notifications

## Overview

Phase 9 implements real-time synchronization and notification delivery for the Vanguard PBP system. This phase enables live updates, presence tracking, and comprehensive notification management to keep players and GMs informed of game state changes.

## Skills

This phase leverages the following skills:

- **real-time-sync**: Real-time event synchronization using Supabase Real-time subscriptions for WebSocket connections, presence tracking, typing indicators, phase transition broadcasts, post visibility filtering, campaign-wide events, and JWT-authenticated real-time connections.

- **notification-system**: Notification delivery patterns for email notifications (realtime, digest_daily, digest_weekly, off), in-app notifications, quiet hours (timezone-aware queuing), batch/digest logic, notification triggers (phase transitions, posts, rolls, time gates), badge counts, and notification history.

## PRD References

- **prd/technical.md**: Real-time sync architecture, Supabase Real-time integration
- **prd/notifications.md**: Notification triggers, delivery preferences, quiet hours
- **prd/core-concepts.md**: Witness-based visibility, identity protection
- **prd/turn-structure.md**: Phase transitions, time gates, pass state

## Implementation Files

1. **01-subscriptions.md** - Supabase Real-time subscriptions for live updates
2. **02-notifications.md** - Notification triggers and delivery mechanisms
3. **03-quiet-hours.md** - Timezone-aware quiet hours implementation

## Key Features

### Real-time Synchronization

- Supabase Real-time subscriptions (no custom WebSocket hub)
- JWT-authenticated connections
- Campaign-level and scene-level channels
- Presence tracking (typing indicators, online status)
- Client-side witness filtering for defense in depth
- Identity protection for compose locks
- Automatic subscription cleanup

### Notification System

- Player notifications (PC Phase start, new posts, roll requests, time gates)
- GM notifications (passes, time gates, hidden posts, roll submissions)
- In-app notification center with badge counts
- Email delivery with preference management
- 90-day notification history retention

### Quiet Hours

- User-configurable quiet hours with timezone support
- Notification queuing during quiet periods
- Delivery after quiet hours end
- Optional urgent notification bypass

## Dependencies

- Supabase Real-time client library
- JWT authentication from Phase 1
- Database schema from Phase 2
- Visibility filtering from Phase 3
- Phase transition logic from Phase 5

## Success Criteria

- [ ] Real-time updates delivered within 500ms
- [ ] Presence tracking shows accurate online status
- [ ] Notifications respect witness-based visibility
- [ ] Compose lock identity remains protected in broadcasts
- [ ] Email notifications delivered according to user preferences
- [ ] Quiet hours correctly queue and deliver notifications
- [ ] Notification history queryable and paginated
- [ ] Badge counts accurately reflect unread notifications

## Testing Strategy

- Unit tests for notification trigger logic
- Integration tests for real-time event delivery
- E2E tests for presence tracking
- Timezone tests for quiet hours
- Load tests for concurrent subscriptions
- Email delivery verification
- Notification history retention tests

## Security Considerations

- JWT validation for all real-time connections
- Client-side witness filtering (defense in depth)
- Identity protection in compose lock broadcasts
- Email address verification before notification delivery
- Rate limiting on notification endpoints

## Performance Considerations

- Efficient channel subscription management
- Batching for digest email notifications
- Indexed queries for notification history
- Connection cleanup to prevent memory leaks
- Heartbeat mechanism for presence tracking
