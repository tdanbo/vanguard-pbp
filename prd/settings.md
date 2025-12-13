# Campaign Settings

Configurable options that shape how a campaign operates.

## Time Gate

Duration of PC Phase before automatic pass. Configured per-campaign using preset options only.

### Presets

| Duration | Use Case |
|----------|----------|
| **24 hours** | Committed pace—daily check-ins **(Default)** |
| 2 days | Active game—regular engagement expected |
| 3 days | Standard pace—reasonable buffer |
| 4 days | Relaxed pace—weekend flexibility |
| 5 days | Casual pace—life happens |

**No custom values allowed.** Preset-only selection prevents edge cases (0 seconds, 999 hours, etc.).

### Behavior

- Timer starts when GM transitions to PC Phase (across all scenes simultaneously)
- Players receive notifications at configurable intervals (e.g., 24h remaining, 6h remaining)
- When timer expires, all characters who haven't passed are auto-passed
- **No auto-transition:** GM must manually click "Move to GM Phase" button
- Players see: "Phase expired. Waiting for GM to transition."
- Players cannot post after expiration but can read existing posts

### Why No Auto-Transition

The GM must explicitly transition phases to ensure they've reviewed all scenes. This prevents scenarios where the GM misses important player actions. If the GM doesn't return:
- The 30-day inactivity threshold protects players
- After 30 days of no GM posts, any player can claim the GM seat
- New GM can transition the phase and continue the campaign

### Edge Cases

- **Paused campaign:** Timer pauses when campaign is paused, resumes when unpaused
- **New characters:** Characters only join/leave scenes during GM Phase
- **Window duration:** All characters get the full window duration
- **Timezone display:** Time remaining shown in player's local timezone

### Global Sync

All scenes in a campaign sync at phase boundaries:
- Phase state (`pc_phase` / `gm_phase`) is campaign-wide, not per-scene
- All scenes enter PC Phase and GM Phase together
- GM reviews all scenes before transitioning back to PC Phase
- Players experience unified rhythm across the entire campaign

---

## Fog of War

Controls information visibility across scenes. This is the core anti-metagaming feature.

### When Enabled

- Characters only see scenes where they have witnessed at least one post
- History before arrival is hidden
- Scene existence is hidden (characters don't know other scenes are happening)
- Character locations are hidden (characters don't know where others are)
- Character list shows only characters you've interacted with in scenes

### When Disabled

- All characters can see all scenes
- Full history is visible
- Scene list shows all active scenes
- Character locations are visible

### Purpose

- Eliminates metagaming by architecture, not honor system
- Secrets are genuine—players literally don't have the information
- Split party scenarios work naturally
- Trust and deception become real gameplay elements

### Example: Split Party

```
Scene: Upstairs Room (Garrett, GM)
  - Garrett finds a body, searches it, takes a letter

Scene: Downstairs Bar (Thorne, Elara, GM)
  - Thorne and Elara's players have no idea the upstairs scene exists
  - When GM moves Garrett downstairs, they must ask what happened
  - Garrett can lie—Thorne and Elara have no way to verify
```

**Multi-Character Note:** If a user controls characters in different scenes, each character only sees their own scene. The user cannot use knowledge from one character to inform another's actions.

---

## Hidden Posts

Allows secret posts within a shared scene.

### When Enabled

- Players can mark a post as "hidden" before submitting
- Only the GM sees the hidden post
- Post has no witnesses until GM unhides it
- GM can request a roll if needed
- GM decides how the outcome manifests in visible narrative

### Workflow

```
Scene: Bar (Garrett, Thorne, Elara)

1. Garrett posts (hidden): "I slip the letter into Thorne's pocket"
2. Thorne and Elara see nothing—no indication a post occurred
3. GM requests sleight of hand roll → Garrett rolls → fails
4. GM resolution (visible): "Thorne, you feel something brush
   your coat. Garrett's hand withdraws quickly."
```

### Success vs Failure

- **Success:** Hidden post remains secret. GM incorporates result subtly or not at all.
- **Failure:** GM decides how and whether to expose the attempt.

### Visibility Mechanics

- Hidden posts are completely invisible to other players
- No indicator appears that a post was made
- Posting a hidden post does NOT change pass state
- If GM later unhides, all characters in scene are retroactively added as witnesses
- **Compose Lock:** Hidden posts still require the compose lock, but UI shows generic "Another player is currently posting" (no identity revealed) to prevent information leakage

### Constraints

- Hidden posts must be in-character actions only
- No sensitive/personal information
- GM has final authority on what's allowed
- Abuse of hidden posts is a moderation issue

---

## Compose Lock Timeout

How long a player can hold the compose lock without activity before it's released.

**Fixed at 10 minutes.** This is not configurable per-campaign.

### Behavior

- Lock acquired when player clicks "Take Post"
- Idle timer resets on each keystroke (heartbeat)
- Visual drain bar appears in final minute
- After 10 minutes of inactivity, lock releases automatically
- Draft persists locally—player can re-acquire lock and continue
- GM can force-release any lock if needed

---

## Notification Preferences

Per-player settings for how they receive notifications.

### Channels

- In-app notifications (always on)
- Email notifications (configurable)
- Push notifications (if mobile app, configurable)

### Frequency

- **Immediate:** Every relevant event
- **Batched:** Digest every N hours
- **Minimal:** Only when it's your turn or you're mentioned

### Quiet Hours

Players can set hours during which non-urgent notifications are held.

---

## OOC Visibility

Controls who can see out-of-character text on posts. OOC is metadata on the post, not a block type.

**Default: GM only**

### Options

| Setting | Behavior |
|---------|----------|
| All players | Everyone in the scene sees OOC text on posts |
| GM only | OOC text visible only to GM and author |

### Use Cases

- **All players:** Casual games, friendly table talk, coordination
- **GM only:** Immersive games, keeps narrative focus clean

---

## Image Management

GM controls all images in the campaign. Players do not upload directly.

### File Constraints

| Constraint | Limit |
|------------|-------|
| Per-file size | 20 MB (configurable constant) |
| Max width | 4000 px |
| Max height | 4000 px |
| Supported formats | PNG, JPG/JPEG, WebP |

**Not supported:** GIF, SVG, or other formats.

### Storage Limits

- **Per-campaign storage:** 500 MB (images only, not database records)
- **What counts:** Scene headers, character avatars, any uploaded images
- **What doesn't count:** Posts, scenes, rolls, and other database records
- **Retention policy:** Last 25 scenes kept (for potential future auto-deletion)
- **Upload blocking:** When campaign reaches 500 MB, uploads are blocked until user deletes scenes
- **No server-side compression:** Images stored as-is; users responsible for pre-optimizing

### Scene Deletion

GM can manually delete individual scenes to free up storage space. Deletion frees space immediately for new uploads.

### Avatar Images

- **Upload:** GM uploads and assigns avatars to characters
- **Proposal:** Players propose avatars externally (link, attachment in Discord, etc.)
- **Format:** Square aspect ratio, cropped via UI
- **Defaults:** System provides default avatars for GM, characters, and scenes

### Scene Headers

- **Format:** 16:9 aspect ratio
- **Upload:** GM uploads scene header images
- **Crop UI:** Visual cropper ensures proper dimensions
- **Optional:** Scenes work without header images

### Why GM-Controlled

- Prevents inappropriate uploads
- Ensures visual consistency
- Reduces moderation burden
- Simplifies storage/abuse concerns

---

## GM Inactivity Threshold

Duration after which an inactive GM's role becomes claimable.

**Fixed at 30 days.** This is not configurable per-campaign.

### Behavior

- Timer resets on any GM action in the campaign
- Campaign tracks `lastGmActivityAt` timestamp
- Players notified as threshold approaches (e.g., 7 days, 3 days, 1 day warning)
- After 30 days of inactivity, any player can claim GM role
- First claim wins (no voting or selection process)
- GM can voluntarily transfer at any time regardless of threshold

---

## Scene Limits

Controls how many scenes a campaign can have and what happens at the limit.

### Hard Limit

- **Maximum scenes:** 25 per campaign
- Includes active and archived scenes
- Deleted scenes don't count against limit

**Note:** Campaigns can be paused, but scenes cannot. When a campaign is paused, the time gate freezes across all scenes.

### Warnings

GM receives notifications at these thresholds:
- **20 scenes:** "You have 20 of 25 scenes"
- **23 scenes:** "Approaching scene limit (23/25)"
- **24 scenes:** "Nearly at scene limit (24/25)"

### Auto-Deletion

When creating the 26th scene:
1. System identifies oldest **archived** scene
2. That scene is permanently deleted (removed from game log)
3. New scene is created
4. GM is notified which scene was deleted

**Note:** Only archived scenes are auto-deleted. Active scenes are never auto-deleted.

### Manual Cleanup

GM can proactively manage scenes:
- **Archive:** Mark empty scenes as read-only (still visible in game log)
- **Delete:** Permanently remove scenes to free space (removed from game log)

**Recommendation:** Archive scenes for historical reference, delete only when approaching limits.

---

## Campaign Ownership Limit

Each user can own a maximum of **5 campaigns** as GM.

### Behavior

- Limit applies only to campaigns where user is GM
- Being a player in a campaign doesn't count against limit
- Claiming an abandoned campaign counts against limit
- Deleting or transferring a campaign frees up a slot

---

## Invite Link Management

GM controls invite links for joining the campaign.

### Behavior

- GM can generate multiple invite links (no hard limit, ~100 soft limit)
- Each link expires after 24 hours
- Each link is one-time use (consumed on first join)
- GM can view all links: active, used, expired, and revoked
- GM can revoke any link before it's used

### Link States

| State | Description |
|-------|-------------|
| Active | Valid, not yet used or expired |
| Used | Successfully consumed by a player |
| Expired | Past 24-hour expiration |
| Revoked | Manually invalidated by GM |

### Race Condition Handling

If multiple people attempt to join simultaneously when near the 50-player limit:
- First-come-first-served: first person to complete signup wins the slot
- Second person receives "Campaign is full" error
- GM can kick players to free slots for rejected players

---

## Default Values Summary

Quick reference for all default settings when creating a new campaign.

| Setting | Default Value | Configurable? |
|---------|---------------|---------------|
| Time Gate | 24 hours | Yes (preset options) |
| Fog of War | Enabled | Yes |
| Hidden Posts | Enabled | Yes |
| OOC Visibility | GM only | Yes |
| Character Limit | 3000 | Yes (preset options) |
| Compose Lock Timeout | 10 minutes | No (fixed) |
| GM Inactivity Threshold | 30 days | No (fixed) |
| Scene Limit | 25 scenes | No (fixed) |
| Campaign Limit per User | 5 campaigns | No (fixed) |
| Storage Limit | 500 MB | No (fixed) |

### Initial Campaign State

- New campaigns start in **GM Phase**
- GM can create scenes and place characters before transitioning to PC Phase
- This allows setup time before players begin posting
