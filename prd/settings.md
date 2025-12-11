# Campaign Settings

Configurable options that shape how a campaign operates.

## Time Gate

Duration of player windows before automatic turn pass. Configured per-campaign using preset options only.

### Presets

| Duration | Use Case |
|----------|----------|
| 24 hours | Committed pace—daily check-ins |
| 2 days | Active game—regular engagement expected |
| 3 days | Standard pace—reasonable buffer |
| 4 days | Relaxed pace—weekend flexibility |
| 5 days | Casual pace—life happens |

**No custom values allowed.** Preset-only selection prevents edge cases (0 seconds, 999 hours, etc.).

### Behavior

- Timer starts when GM opens player window (across all scenes simultaneously)
- Players receive notifications at configurable intervals (e.g., 24h remaining, 6h remaining)
- When timer expires, all players who haven't passed are auto-passed
- GM is notified that window has closed

### Edge Cases

- **Paused campaign:** Timer pauses when campaign is paused, resumes when unpaused
- **New players:** Characters only join/leave scenes at turn boundaries (during GM_TURN)
- **Window duration:** All players get the full window duration regardless of when they join
- **Timezone display:** Time remaining shown in player's local timezone

### Global Sync

All scenes in a campaign sync at turn boundaries:
- Turn counter is campaign-wide, not per-scene
- All scenes open and close player windows together
- GM resolves all scenes before any new player window opens
- Players experience unified turn rhythm across the entire campaign

---

## Fog of War

Controls information visibility across scenes. This is the core anti-metagaming feature.

### When Enabled

- Players only see scenes where they have witnessed at least one action
- History before arrival is hidden
- Scene existence is hidden (you don't know other scenes are happening)
- Character locations are hidden (you don't know where others are)
- Player list shows only players you've interacted with in scenes

### When Disabled

- All players can see all scenes
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
  - Thorne and Elara have no idea the upstairs scene exists
  - When Garrett returns, they must ask what happened
  - Garrett can lie—they have no way to verify
```

---

## Hidden Turns

Allows secret turns within a shared scene.

### When Enabled

- Players can mark a turn as "hidden" before posting
- Only the GM sees the hidden turn
- Turn is recorded with witness list of [author, GM] only
- GM can request a roll if needed
- GM decides how the outcome manifests in visible narrative

### Workflow

```
Scene: Bar (Garrett, Thorne, Elara)

1. Garrett posts (hidden): "I slip the letter into Thorne's pocket"
2. Thorne and Elara see nothing—no indication a turn occurred
3. GM requests sleight of hand roll → Garrett rolls → fails
4. GM resolution (visible): "Thorne, you feel something brush
   your coat. Garrett's hand withdraws quickly."
```

### Success vs Failure

- **Success:** Hidden turn remains secret. GM incorporates result subtly or not at all.
- **Failure:** GM decides how and whether to expose the attempt.

### Constraints

- Hidden turns must be in-character actions only
- No sensitive/personal information
- GM has final authority on what's allowed
- Abuse of hidden turns is a moderation issue

---

## Compose Lock Timeout

How long a player can hold the compose lock without typing before it's released.

### Options

| Duration | Use Case |
|----------|----------|
| 2 minutes | Fast-paced games, impatient groups |
| 5 minutes | Default—reasonable thinking time |
| 10 minutes | Complex games, thoughtful posts |
| No timeout | Trust-based, GM can manually release |

### Idle Detection

- Lock acquired when player clicks "Take Turn"
- Idle timer resets on each keystroke
- Visual drain bar appears in final minute
- If idle timer expires, lock releases automatically
- Draft persists locally—player can re-acquire lock and continue

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

Controls who can see out-of-character (`[ooc]`) blocks in actions.

### Options

| Setting | Behavior |
|---------|----------|
| All players | Everyone in the scene sees OOC content |
| GM only | OOC blocks visible only to GM and author |

### Use Cases

- **All players:** Casual games, friendly table talk
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

- **Per-campaign storage:** 500 MB
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

Configurable duration after which an inactive GM's role becomes claimable.

### Options

| Duration | Use Case |
|----------|----------|
| 7 days | Active games, quick succession needed |
| 14 days | Default—reasonable buffer for life events |
| 30 days | Casual games, patient groups |
| Disabled | GM role is permanent |

### Behavior

- Timer resets on any GM action in the campaign
- Players notified as threshold approaches (e.g., 48h warning)
- After expiration, any player can claim GM role
- First claim wins (no voting or selection process)
- GM can voluntarily transfer at any time regardless of threshold
