# Notifications

When and how users are notified of events.

## Player Notifications

### Immediate Triggers

| Event | Notification |
|-------|--------------|
| GM transitions to PC Phase | "PC Phase started" (campaign-wide) |
| Another player posts in your scene | "New post in [Scene Name]" |
| GM requests a roll from you | "[GM] requests a [intention] roll" |
| GM overrides your intention | "GM has overridden your intention to [new intent]" |
| Your character is added to a scene | "[Character] entered [Scene Name]" |
| Compose lock released (you were waiting) | "You can now post in [Scene Name]" |
| Time gate warning | "24h/6h/1h remaining" |
| GM role available | "GM role is available in [Campaign]" |
| Your pass state cleared (new post) | "New activity in [Scene Name]" (Pass only, not Hard Pass) |

### Batched Triggers

These can be grouped into digests:
- Summary of activity in your scenes
- Recap of completed posts
- Campaign announcements

### Suppressed

- Posts in scenes you're not present in (you can't see them anyway)
- Hidden posts by other players
- GM-to-GM notes

---

## GM Notifications

### Immediate Triggers

| Event | Notification |
|-------|--------------|
| All characters have passed (campaign-wide) | "All scenes ready for GM Phase" |
| Time gate expired | "PC Phase ended (timeout)" |
| Hidden post submitted | "Hidden post from [Character] in [Scene Name]" |
| New player joined campaign | "[Player] joined your campaign" |
| Player roll submitted | "[Character] rolled [result] for [intention]" |
| Unresolved rolls exist | "Resolve [N] pending rolls before transitioning" |
| Campaign at player limit | "Campaign has reached 50 players" |
| Scene limit warning | "You have [N] of 25 scenes" (at 20, 23, 24) |

### Scene Dashboard

GMs should have a dashboard view showing:
- All active scenes with status
- Which scenes need resolution
- Which scenes have pending hidden posts
- Time remaining on PC Phase
- Unresolved rolls that need manual resolution
- Character activity summary
- Scene count (X/25) with warning colors
- Campaign storage usage (of 500 MB limit)

---

## Notification Channels

### In-App

- Always available
- Badge counts on scenes/campaigns
- Real-time updates via WebSocket
- Notification center with history

### Email

- Configurable per-user
- Options: immediate, hourly digest, daily digest, off
- Includes direct links to relevant scenes
- Plain text and HTML versions

### Push (Future)

- Mobile app push notifications
- Same triggers as email
- Respects quiet hours

---

## Quiet Hours

Players can set quiet hours during which non-critical notifications are held.

### Configuration

- Start time and end time (in player's timezone)
- Days of week (optional)
- Override for urgent (e.g., time gate about to expire)

### Behavior

- Notifications generated but not delivered
- Delivered as batch when quiet hours end
- Urgent notifications always delivered

---

## Notification Content

### Principles

- **Minimal spoilers:** Don't include post content in notification
- **Actionable:** Include what the player should do
- **Linked:** Direct URL to the relevant view
- **Contextual:** Include scene and campaign name

### Example Notification

```
Subject: PC Phase started

The GM has completed their review and opened the PC Phase.
You have [campaign.timeGate] to post.

[View Campaign] [Pass All Characters]

--
Campaign: Shadows of Eldoria
Your Active Characters: Garrett (The Tavern), Thorne (Forest Path)
```

**Note:** Time gate duration is dynamically inserted based on campaign settings (e.g., "24 hours", "2 days", "3 days").
