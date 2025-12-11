# Notifications

When and how users are notified of events.

## Player Notifications

### Immediate Triggers

| Event | Notification |
|-------|--------------|
| GM opens new player window | "New turn window open" (campaign-wide) |
| Another player posts in your scene | "New turn in [Scene Name]" |
| GM requests a roll from you | "[GM] requests a [intention] roll" |
| You are added to a scene | "You've entered [Scene Name]" |
| Compose lock released (you were waiting) | "You can now post in [Scene Name]" |
| Time gate warning | "24h/6h/1h remaining" |
| GM role available | "GM role is available in [Campaign]" |

### Batched Triggers

These can be grouped into digests:
- Summary of activity in your scenes
- Recap of completed turns
- Campaign announcements

### Suppressed

- Turns in scenes you're not present in (you can't see them anyway)
- Hidden turns by other players
- GM-to-GM notes

---

## GM Notifications

### Immediate Triggers

| Event | Notification |
|-------|--------------|
| All players have passed (campaign-wide) | "All scenes ready for resolution" |
| Time gate expired | "Turn window closed (timeout)" |
| Hidden turn submitted | "Hidden turn from [Player] in [Scene Name]" |
| New player joined campaign | "[Player] joined your campaign" |
| Player roll submitted | "[Player] rolled [result] for [intention]" |
| Roll request timeout | "[Player] auto-rolled (timeout)" |
| Campaign at player limit | "Campaign has reached 50 players" |

### Scene Dashboard

GMs should have a dashboard view showing:
- All active scenes with status
- Which scenes need resolution
- Which scenes have pending hidden turns
- Time remaining on turn gate
- Player activity summary
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

- **Minimal spoilers:** Don't include turn content in notification
- **Actionable:** Include what the player should do
- **Linked:** Direct URL to the relevant view
- **Contextual:** Include scene and campaign name

### Example Notification

```
Subject: New turn window open

The GM has posted resolutions and opened the player window.
You have 2 days to post your turn.

[View Campaign] [Pass All]

--
Campaign: Shadows of Eldoria
Active Scenes: The Tavern, Forest Path
```
