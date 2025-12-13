# Technical Specification

Tech stack, architecture, and implementation details.

---

## Frontend

### React

The UI framework. React's component model enables building complex, interactive interfaces from reusable pieces. The virtual DOM efficiently updates only what changes, critical for real-time features like typing indicators and live action feeds. Large ecosystem means solutions exist for most problems.

### TypeScript

Type safety for the entire frontend codebase. Catches errors at compile time rather than runtime. Enables confident refactoring and better IDE support with autocomplete and inline documentation. Types are shared with the backend via code generation, ensuring API contracts are always in sync.

### Tailwind CSS

Utility-first CSS framework. Style components directly in JSX without context-switching to separate CSS files. Consistent design tokens (spacing, colors, typography) enforced by the framework. Produces minimal CSS bundles through automatic purging of unused styles.

### shadcn/ui

Pre-built, accessible component library built on Radix UI primitives. Copy-paste components that live in your codebase (not a dependency). Fully customizable with Tailwind. Handles accessibility, keyboard navigation, and focus management correctly out of the box. Includes dialogs, dropdowns, forms, toasts, and other complex UI patterns.

### Bun

JavaScript runtime and package manager. Significantly faster than Node.js for development tasks—installs dependencies in seconds, runs scripts instantly. Native TypeScript support without compilation step. Used for package management and running scripts.

### Vite

Next-generation frontend build tool. Instant dev server startup with native ES modules—no bundling during development. Hot module replacement (HMR) updates components in milliseconds. Optimized production builds with Rollup under the hood. First-class TypeScript and React support out of the box.

### ESLint

Static analysis tool for identifying and fixing problems in JavaScript/TypeScript code. Enforces consistent code style and catches common errors before runtime. Configured with TypeScript-aware rules and React-specific plugins. Integrated into the development workflow via pre-commit hooks and CI pipeline. Provides immediate feedback in IDE with auto-fix capabilities for many issues.

---

## Backend

### Go

The backend language. Compiles to a single binary with no runtime dependencies. Excellent performance and low memory footprint. Strong concurrency model with goroutines for handling concurrent API requests. Static typing catches errors early. Simple deployment—just copy the binary.

### golangci-lint

Fast, configurable Go linter aggregator. Runs multiple linters in parallel (errcheck, staticcheck, gosec, and more) with a single command. Catches bugs, enforces style consistency, and identifies security issues before code review. Configured via `.golangci.yml` for project-specific rules. Integrated into CI pipeline and pre-commit hooks for automated enforcement.

### PostgreSQL

The database. Battle-tested relational database with ACID compliance. Handles complex queries for witness visibility filtering efficiently. JSON column support for flexible data like campaign settings. Row-level security can enforce visibility rules at the database layer.

### Supabase

Backend-as-a-service built on PostgreSQL. Provides:
- Hosted PostgreSQL with connection pooling
- Built-in authentication (email, OAuth providers)
- Real-time subscriptions via WebSocket
- Row-level security policies
- Storage for avatar images
- Auto-generated REST API from database schema

Reduces infrastructure complexity while maintaining full PostgreSQL access.

### Code Generation (sqlc or similar)

Generate type-safe Go code from SQL queries. Write plain SQL, get Go functions with proper types. Eliminates runtime SQL errors and manual result scanning. Keeps database schema as the source of truth. Options include:
- **sqlc**: SQL → Go structs and query functions
- **Supabase CLI**: Generate TypeScript types from database schema
- **OpenAPI Generator**: Generate client code from API spec

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │  React App    │  │  Zustand      │  │  Supabase Client  │   │
│  │  (shadcn/ui)  │  │  (State)      │  │  (Real-time)      │   │
│  └───────┬───────┘  └───────┬───────┘  └─────────┬─────────┘   │
│          │                  │                    │              │
└──────────┼──────────────────┼────────────────────┼──────────────┘
           │ HTTP/REST        │                    │ WebSocket
           ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Go API Server                           │
│  ┌───────────────┐  ┌───────────────┐                          │
│  │  HTTP Routes  │  │  Auth         │                          │
│  │  /api/*       │  │  (Supabase)   │                          │
│  └───────┬───────┘  └───────┬───────┘                          │
│          │                  │                                   │
│          └──────────────────┘                                   │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │                    Service Layer                         │   │
│  │  Campaign │ Scene │ Post │ Character │ Roll │ Notify    │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │               sqlc Generated Queries                     │   │
│  └──────────────────────────┬──────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Supabase (PostgreSQL)                         │
│  users │ campaigns │ scenes │ posts │ characters │ rolls       │
│                                                                 │
│  Row-Level Security │ Real-time │ Storage │ Auth               │
└─────────────────────────────────────────────────────────────────┘
```

**Note:** Real-time updates are handled exclusively by Supabase Real-time subscriptions. The Go backend handles REST API requests only—no WebSocket hub is needed.

---

## Data Models

### Users

```typescript
interface User {
  id: string;              // UUID (from Supabase Auth)
  email: string;           // Unique, for auth
  createdAt: Date;
  updatedAt: Date;
}
```

### Campaigns

```typescript
interface Campaign {
  id: string;              // UUID
  title: string;
  description: string;
  ownerId: string | null;  // FK to User (GM), null if GM deleted account
  settings: CampaignSettings;
  currentPhase: 'pc_phase' | 'gm_phase';  // Global phase state (all scenes sync), defaults to 'gm_phase'
  currentPhaseExpiresAt: Date | null;     // When current PC phase time gate expires (null during GM phase)
  isPaused: boolean;       // When true, time gate is frozen. Only state needed (no status enum).
  lastGmActivityAt: Date;  // For 30-day inactivity tracking (only GM posts count as activity)
  storageUsedBytes: number; // Track storage for 500MB limit (images only)
  sceneCount: number;      // Track for 25-scene limit warnings
  createdAt: Date;
  updatedAt: Date;
}
// Note: Campaigns are either active (isPaused: false) or paused (isPaused: true).
// Campaigns can be deleted but not archived. Users limited to 5 campaigns.
// Note: When time gate expires, phase doesn't auto-transition. GM must manually click transition button.
// Note: Phase expiration is derived: currentPhaseExpiresAt < now (no separate boolean field needed).

interface InviteLink {
  id: string;              // UUID
  campaignId: string;      // FK to Campaign
  code: string;            // Cryptographically random
  createdBy: string;       // FK to User (GM who created it)
  expiresAt: Date;         // 24 hours from creation
  usedAt: Date | null;     // Null until consumed
  usedBy: string | null;   // FK to User who joined
  revokedAt: Date | null;  // Null unless GM revoked the link
  createdAt: Date;
}
// Note: GM can generate multiple links, view all active links, and revoke any link.
// No hard limit on concurrent links (~100 soft limit).

interface CampaignSettings {
  timeGatePreset: '24h' | '2d' | '3d' | '4d' | '5d';  // Fixed presets only (default: 24h)
  fogOfWar: boolean;
  hiddenPosts: boolean;
  oocVisibility: 'all' | 'gm_only';  // Default: gm_only
  characterLimit: 1000 | 3000 | 6000 | 10000;
  rollRequestTimeoutHours: number;  // For GM-requested rolls
  systemPreset: SystemPreset;
}
// Note: Compose lock timeout is fixed at 10 minutes (not configurable).
// Note: GM inactivity threshold is fixed at 30 days (not configurable).

interface SystemPreset {
  name: string;            // e.g., "D&D 5e", "Pathfinder 2e", "Custom"
  intentions: string[];    // e.g., ["Stealth", "Persuasion", "Attack"]
  diceType: 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
}
```

### Campaign Members

```typescript
interface CampaignMember {
  id: string;              // UUID
  campaignId: string;      // FK to Campaign
  userId: string;          // FK to User
  role: 'gm' | 'player';
  joinedAt: Date;
}
```

### Characters

Characters are campaign-owned entities. Assignment to users is separate.

```typescript
interface Character {
  id: string;              // UUID
  campaignId: string;      // FK to Campaign
  displayName: string;     // Character name visible to others
  description: string;     // Character description
  avatarUrl: string | null;
  characterType: 'pc' | 'npc';  // Determines UI presentation only
  isArchived: boolean;     // Archived characters cannot be added to scenes
  createdAt: Date;
  updatedAt: Date;
}
// Note: Characters are owned by campaigns, not users.
// Note: characterType only affects which UI interfaces the character appears in.
// Note: GM can promote/demote between PC and NPC via edit modal (GM Phase only).
// Note: Archived characters are visible to GM (greyed out) but invisible to players.
// Note: GM can un-archive characters at any time. Posts from archived characters remain.
// Note: Characters CANNOT be deleted - only archived or orphaned. This preserves post relationships.
// Note: Character records are immutable anchors linking posts to game history.
```

### Character Assignments

Links characters to the users who control them.

```typescript
interface CharacterAssignment {
  id: string;              // UUID
  characterId: string;     // FK to Character
  userId: string;          // FK to User
  assignedAt: Date;
}
// Unique constraint: one user per character at a time.
// When a user leaves/is kicked, their assignments are deleted.
// Orphaned characters (no assignment) cannot be added to new scenes.
// GM can reassign orphaned characters or take control to write them out.
// Orphaned characters don't count toward "all characters passed" check.
// When re-assigned and re-added to a scene, they see all posts they previously witnessed.
```

### Scenes

```typescript
interface Scene {
  id: string;              // UUID
  campaignId: string;      // FK to Campaign
  title: string;
  description: string;     // Opening narrative (GM can update mid-scene)
  headerImageUrl: string | null;  // Optional 16:9 header image
  characters: string[];    // Character IDs currently in scene (PCs + NPCs)
  passStates: Record<string, 'none' | 'passed' | 'hard_passed'>;  // Per-character pass state
  status: 'active' | 'archived';
  windowStartedAt: Date | null;  // When current PC phase window opened
  createdAt: Date;
  updatedAt: Date;
}
// Note: Phase state is on Campaign, not Scene (global sync).
// Note: Campaigns pause, not scenes. Scene has no 'paused' status.
// Note: Use characterType field on Character to filter PCs vs NPCs in UI.
// Note: passStates is the single source of truth for pass state (no separate ScenePresence table).
// Note: When character added to scene, passStates[characterId] initialized to 'none'.
// Note: When character removed from scene, passStates entry is removed.
```

### Posts

A post is a single character's submission during a PC Phase (or GM during GM Phase).

```typescript
interface Post {
  id: string;              // UUID
  sceneId: string;         // FK to Scene
  characterId: string | null;  // FK to Character, null = Narrator (GM only)
  userId: string;          // FK to User who created this post
  blocks: PostBlock[];     // Structured content blocks (cannot be empty strings)
  oocText: string | null;  // Out-of-character text (visibility per campaign setting)
  witnesses: string[];     // Character IDs who can see this post. Empty = hidden (GM only).
  submitted: boolean;      // false = draft, true = live/visible
  intention: string | null; // e.g., "intimidation", "stealth". Mutable (updated on GM override).
  modifier: number | null; // Player-provided modifier for roll
  isLocked: boolean;       // Becomes true when next post is created
  lockedAt: Date | null;   // When next post locked this one
  editedByGm: boolean;     // Shows "Edited by GM" badge if true
  createdAt: Date;
  updatedAt: Date;
}
// Note: No isHidden field needed. witnesses: [] signals hidden post (GM only).
// Note: Draft lifecycle: acquire lock → create Post with submitted: false → edit → submit (submitted: true, witnesses calculated)
// Note: Drafts are server-persisted, sync across tabs (same DB entry).

interface PostBlock {
  type: 'action' | 'dialog';
  content: string;
  order: number;           // Sequence within post
}
```

**Witness Selection (GM only):**
- **Default:** All PCs currently in scene become witnesses
- **Custom:** GM selects specific characters to witness the post
- **Hidden:** No witnesses until GM unhides (then retroactively adds them)

**Post Locking:**
- Posts lock when the next post is created in the scene
- Locked posts cannot be edited (except by GM for moderation)
- When a post is deleted, the previous post becomes unlocked

**OOC Visibility:**
- Controlled by campaign setting (`all` or `gm_only`)
- OOC is metadata on the post, not a block type

### Rolls

```typescript
interface Roll {
  id: string;              // UUID
  postId: string | null;   // FK to Post (if player-initiated)
  sceneId: string;         // FK to Scene
  characterId: string;     // FK to Character (roller)
  requestedBy: string | null;  // FK to CampaignMember (GM) if requested
  intention: string;       // Selected from system preset (final value after any override)
  modifier: number;        // Player-provided modifier (max ±100)
  diceType: string;        // From system preset (e.g., "d20")
  diceCount: number;       // Number of dice (1-100, player-configurable per roll)
  result: number[];        // Individual die results
  total: number;           // Sum with modifiers
  wasOverridden: boolean;  // True if GM overrode the intention
  originalIntention: string | null;  // Original intention before GM override (if any)
  status: 'pending' | 'completed' | 'invalidated';
  createdAt: Date;
}
// Note: When GM overrides intention, Post.intention is also updated. Player receives notification.
// Note: Roll visibility follows post witness rules (same as post visibility).
// Note: GM can resolve rolls for hard-passed players by clicking intent button → roll → submit.
```

**Notes:**
- All rolls execute server-side only
- Default roll: 1d20 (configurable via system preset)
- GM can invalidate suspicious rolls
- Original intention preserved even if GM overrides
- Supported dice: d4, d6, d8, d10, d12, d20, d100
- Max modifier: ±100, max dice per type: 100
- No auto-roll on timeout: GM must manually resolve unresolved rolls

### Compose Sessions

```typescript
interface ComposeSession {
  id: string;              // UUID
  sceneId: string;         // FK to Scene
  characterId: string;     // FK to Character (lock is per-character)
  userId: string;          // FK to User (who holds the lock)
  acquiredAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;         // acquiredAt + 10 minutes
}
// Lock timeout: Fixed at 10 minutes of inactivity.
// Heartbeat resets lastActivityAt on each keystroke.
// Lock auto-releases when 10-minute inactivity threshold is reached.
// Unique constraint: (sceneId, characterId) - one lock per character per scene.
// Lock is per-character: user must release lock and reacquire for different character.
// Rate limit: lock acquire/release limited to once per 5 seconds.
```

### Bookmarks

Character-scoped memories that create quick links within the game log.

```typescript
interface Bookmark {
  id: string;              // UUID
  characterId: string;     // FK to Character (the character doing the bookmarking)
  type: 'character' | 'scene' | 'post';  // Can bookmark any character (PC or NPC)
  referencedEntityId: string;  // FK to the bookmarked entity
  createdAt: Date;
}
// Unique constraint: (characterId, type, referencedEntityId)
// One bookmark per entity per character.
// Scoped per character per campaign (different characters have different bookmarks).
```

**Functionality:**
- **Characters:** Navigate to first/last encounter with any character (PC or NPC)
- **Scenes:** Navigate directly to the scene
- **Posts:** Navigate to that specific post within a scene

### Notification Preferences

User-level settings for notification delivery.

```typescript
interface NotificationPreferences {
  id: string;              // UUID
  userId: string;          // FK to User
  emailNotifications: boolean;
  inAppNotifications: boolean;  // Always true (cannot disable)
  frequency: 'realtime' | 'digest_daily' | 'digest_weekly' | 'off';
  createdAt: Date;
  updatedAt: Date;
}
```

### Quiet Hours

User-level quiet hours prevent notifications during specified times.

```typescript
interface QuietHours {
  id: string;              // UUID
  userId: string;          // FK to User
  enabled: boolean;
  startTime: string;       // HH:mm format (e.g., "21:00")
  endTime: string;         // HH:mm format (e.g., "08:00")
  timezone: string;        // IANA timezone (e.g., "America/New_York")
  createdAt: Date;
  updatedAt: Date;
}
// During quiet hours, notifications are queued and sent after the quiet period ends.
```

---

## Phase Transitions & Witness Transaction

### GM Phase Setup

During GM Phase, the GM can freely post content, add/remove characters, and rearrange scenes. Posts created during GM Phase have empty witness lists (`witnesses: []`) until the phase transition.

### Witness Transaction (GM Phase → PC Phase)

When the GM clicks "Move to PC Phase", a **witness transaction** occurs:

1. System queries final `Scene.characters` for each scene (all currently present PCs + NPCs)
2. All GM Phase posts receive these characters as witnesses atomically
3. Everything becomes visible to present characters simultaneously

**Character Removal Mid-Setup:**
- If GM removes a character during GM Phase setup, they're not in final `Scene.characters`
- Those characters don't become witnesses to GM Phase posts
- They "weren't there when lights turned on"

**Result:** GM has complete setup flexibility. Players see a coherent snapshot when PC Phase begins.

### Compose Lock for Hidden Posts

Hidden posts (posts with `witnesses: []` during PC Phase) require the compose lock like normal posts. However, the UI shows a generic message to other players: **"Another player is currently posting"** (no name, no character identity revealed).

---

## Scene Limits & Cleanup

### Scene Limit

- **Hard limit:** 25 scenes per campaign
- **Warning thresholds:** Notify GM at 20, 23, 24 scenes
- **Auto-deletion:** When creating 26th scene, oldest archived scene is permanently deleted
- **Manual cleanup:** GM can archive/delete scenes before hitting the limit

### Scene Lifecycle

1. **Active:** Scene is playable, receives posts
2. **Empty:** All characters moved out (GM can archive)
3. **Archived:** Read-only, visible in game log, still consumes storage
4. **Deleted:** Permanently removed, storage freed, removed from game log

### Campaign Cleanup

- **GM inactivity:** After 30 days of no GM activity, GM position becomes claimable
- **Unclaimed campaign:** If no one claims GM within 30 days, campaign enters deletion countdown
- **Deletion warnings:** Days 10, 20, 25, 29
- **Day 30:** Campaign and all data permanently deleted
- **Campaign ownership limit:** Each user can own max 5 campaigns

---

## API Endpoints

### Authentication

Handled by Supabase Auth:
- Email/password signup and login
- OAuth providers (Google, Discord)—email required for all accounts
- Session management via JWT with sliding window expiration (~30 days)
- Password reset flows via email
- **Email verification required:** New users must verify email to activate account
- **Password complexity:** Supabase Auth defaults (no custom rules needed)
- **Multiple sessions allowed:** Users can be logged in on multiple devices simultaneously

### User Identity

- **No usernames in system:** Everyone is anonymous to other players
- **Character-based identity:** Players are tied to characters only within campaigns
- **GM visibility only:** GM sees mapping of user_id → character for administration
- **Privacy by default:** Player email/account details never exposed to other players

### Campaigns

```
GET    /api/campaigns                    List user's campaigns
POST   /api/campaigns                    Create campaign
GET    /api/campaigns/:id                Get campaign details
PATCH  /api/campaigns/:id                Update campaign settings
DELETE /api/campaigns/:id                Permanently delete campaign (requires name confirmation)
POST   /api/campaigns/:id/join           Join via invite code
POST   /api/campaigns/:id/invite         Generate invite link (fails if at 50 players)
GET    /api/campaigns/:id/invites        List all invite links (active, used, expired, revoked)
DELETE /api/campaigns/:id/invites/:code  Revoke an invite link (GM only)
POST   /api/campaigns/:id/claim-gm       Claim GM role (if available)
GET    /api/campaigns/:id/members        List members
DELETE /api/campaigns/:id/members/:mid   Remove member
```

### Characters

```
GET    /api/campaigns/:id/characters              List characters in campaign
POST   /api/campaigns/:id/characters              Create character (player or GM)
GET    /api/characters/:id                        Get character details
PATCH  /api/characters/:id                        Update character (name, avatar, type, archived)
POST   /api/characters/:id/reassign               Reassign character to different player (GM only)
```

**Character Archival:**
- Use `PATCH /api/characters/:id` with `{ archived: true }` to archive
- Use `PATCH /api/characters/:id` with `{ archived: false }` to un-archive
- Archived characters visible to GM (greyed out), invisible to players
- Archived characters cannot be added to scenes
- Posts from archived characters remain accessible

**Character Deletion: NOT SUPPORTED**
- Characters cannot be deleted - they are immutable relationship records
- Characters can only be archived (hidden) or orphaned (user left)
- This design preserves post relationships and game history integrity

**Campaign Deletion:**
- Permanently deletes all data (scenes, turns, images, rolls)
- No recovery possible
- Requires confirmation by typing campaign name

### Scenes

```
GET    /api/campaigns/:id/scenes         List visible scenes
POST   /api/campaigns/:id/scenes         Create scene (GM)
GET    /api/scenes/:id                   Get scene with turns
PATCH  /api/scenes/:id                   Update scene (GM)
DELETE /api/scenes/:id                   Delete scene (GM, frees storage)
POST   /api/scenes/:id/presence          Add member to scene (GM)
DELETE /api/scenes/:id/presence/:mid     Remove member (GM)
```

### Posts

```
GET    /api/scenes/:id/posts             Get witnessed posts
POST   /api/scenes/:id/posts             Create post
PATCH  /api/posts/:id                    Edit post (if not locked, or GM edit)
DELETE /api/posts/:id                    Delete post (GM only)
```

**GM Moderation:**
- GM can edit any post at any point (sets `editedByGm: true`)
- GM can delete any post at any point
- Edits show small "Edited by GM" badge, no version history
- When a post is deleted, the previous post becomes unlocked

### Phase Flow

```
POST   /api/scenes/:id/pass/:characterId       Pass for character
POST   /api/scenes/:id/hard-pass/:characterId  Hard pass for character
POST   /api/scenes/:id/unpass/:characterId     Undo pass for character
POST   /api/campaigns/:id/transition           GM transitions to next phase (pc_phase or gm_phase)
POST   /api/campaigns/:id/pause                Pause campaign (freezes time gate)
POST   /api/campaigns/:id/resume               Resume campaign
```

**Phase Transition:**
- `transition` endpoint validates all rolls are resolved before allowing GM to move to PC phase
- Returns error if unresolved rolls exist

**Posting Rules:**
- No limit on posts per character per phase
- Users can post as the same character multiple times in a row
- Only constraint is post locking (previous post locks when new post is created)

### Rolls

```
GET    /api/scenes/:id/rolls             Get scene rolls (witnessed)
POST   /api/scenes/:id/rolls             Execute roll (with post submission)
POST   /api/scenes/:id/roll-request      GM requests roll from player
POST   /api/posts/:id/rolls              GM executes roll on behalf of player (for hard-passed characters)
```

**Roll Resolution:**
- GM-requested rolls must be resolved before phase transition
- No auto-roll: GM must manually resolve unresolved rolls
- GM can add/change intent and roll on behalf of player using `POST /api/posts/:id/rolls`

### Compose Lock

```
POST   /api/scenes/:id/compose/acquire   Acquire compose lock (requires characterId in body)
POST   /api/scenes/:id/compose/release   Release compose lock
POST   /api/scenes/:id/compose/heartbeat Keep lock alive
GET    /api/scenes/:id/compose/status    Get current lock holder (if any)
```

**Lock Behavior:**
- Lock is per-character, not per-user
- Request body for acquire: `{ characterId: string }`
- User must release and reacquire to post as different character

### Bookmarks

```
GET    /api/campaigns/:id/characters/:charId/bookmarks  List bookmarks for character
POST   /api/bookmarks                                   Create bookmark
DELETE /api/bookmarks/:id                               Delete bookmark
```

**Bookmark Types:**
- `character` - Navigate to first/last encounter with any character (PC or NPC)
- `scene` - Navigate directly to the scene
- `post` - Navigate to that specific post within a scene

### Users

```
GET    /api/users/:id                    Get user details (includes notification preferences, quiet hours)
PATCH  /api/users/:id                    Update user settings
GET    /api/users/:id/campaigns          List user's campaigns
```

**User Settings Payload:**
```typescript
{
  notificationPreferences?: {
    emailNotifications: boolean;
    inAppNotifications: boolean;  // Always true
    frequency: 'realtime' | 'digest_daily' | 'digest_weekly' | 'off';
  };
  quietHours?: {
    enabled: boolean;
    startTime: string;  // HH:mm format
    endTime: string;    // HH:mm format
    timezone: string;   // IANA timezone
  };
}
```

---

## Real-time Events

Using **Supabase Real-Time subscriptions** for campaign-wide and scene-level events. Clients subscribe to table changes (campaigns, scenes, posts) and receive updates automatically. No separate "campaign room" needed—Supabase subscriptions handle all real-time updates atomically.

### Client → Server

```typescript
// Join scene room for real-time updates
{ event: 'scene:join', sceneId: string }

// Leave scene room
{ event: 'scene:leave', sceneId: string }

// Typing indicator (while composing)
{ event: 'scene:typing', sceneId: string }

// Stop typing
{ event: 'scene:typing:stop', sceneId: string }
```

### Server → Client

```typescript
// New post created
{ event: 'post:new', post: Post }

// Post edited
{ event: 'post:edit', post: Post }

// Post deleted (GM moderation)
{ event: 'post:delete', postId: string }

// Post unlocked (previous post deleted)
{ event: 'post:unlocked', postId: string }

// Player started composing (acquired lock)
// Note: UI shows "Another player is currently posting" (no identity) to prevent hidden post leakage
{ event: 'compose:start', sceneId: string }  // No identity exposed - UI shows generic "Another player is posting"

// Player stopped composing / lock released
{ event: 'compose:end', sceneId: string }

// Character passed
{ event: 'pass:update', sceneId: string, characterId: string, passState: string }

// Phase transition - campaign-wide
{ event: 'phase:transition', campaignId: string, newPhase: 'pc_phase' | 'gm_phase' }

// Time gate warning
{ event: 'timegate:warning', campaignId: string, remainingMinutes: number }

// Character added to scene
{ event: 'presence:add', sceneId: string, character: Character }

// Character left scene
{ event: 'presence:remove', sceneId: string, characterId: string }

// Scene limit warning
{ event: 'scene:limit_warning', campaignId: string, currentCount: number, limit: number }

// Roll result
{ event: 'roll:result', roll: Roll }

// GM role available (GM deleted account or inactivity)
{ event: 'gm:available', campaignId: string }

// Campaign paused/resumed
{ event: 'campaign:status', campaignId: string, status: 'active' | 'paused' }
```

---

## Project Structure

### Frontend

```
frontend/
├── src/
│   ├── app/
│   │   ├── routes/               # Route components
│   │   │   ├── index.tsx         # Landing page
│   │   │   ├── auth/
│   │   │   │   ├── login.tsx
│   │   │   │   └── register.tsx
│   │   │   ├── campaigns/
│   │   │   │   ├── index.tsx     # Campaign list
│   │   │   │   ├── new.tsx       # Create campaign
│   │   │   │   └── [id]/
│   │   │   │       ├── index.tsx # Campaign dashboard
│   │   │   │       ├── settings.tsx
│   │   │   │       └── scenes/
│   │   │   │           └── [sceneId].tsx
│   │   │   └── join/
│   │   │       └── [code].tsx    # Join via invite
│   │   └── layout.tsx            # Root layout
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── campaign/             # Campaign-specific components
│   │   ├── scene/                # Scene view components
│   │   ├── post/                 # Post display and composer
│   │   └── roll/                 # Dice rolling UI
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-campaign.ts
│   │   ├── use-scene.ts
│   │   ├── use-realtime.ts
│   │   └── use-compose-lock.ts
│   ├── stores/
│   │   ├── auth-store.ts
│   │   ├── campaign-store.ts
│   │   └── scene-store.ts
│   ├── lib/
│   │   ├── supabase.ts           # Supabase client
│   │   ├── api.ts                # API client
│   │   ├── dice.ts               # Dice notation parser
│   │   └── utils.ts
│   └── types/
│       └── generated.ts          # Generated from database schema
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── bun.lockb
```

### Backend

```
backend/
├── cmd/
│   └── server/
│       └── main.go               # Entry point
├── internal/
│   ├── api/
│   │   ├── router.go             # HTTP router setup
│   │   ├── middleware/
│   │   │   ├── auth.go           # JWT validation
│   │   │   └── cors.go
│   │   └── handlers/
│   │       ├── campaigns.go
│   │       ├── scenes.go
│   │       ├── posts.go
│   │       └── rolls.go
│   ├── service/
│   │   ├── campaign.go
│   │   ├── scene.go
│   │   ├── post.go
│   │   ├── roll.go
│   │   └── notification.go
│   ├── db/
│   │   ├── queries/              # SQL files for sqlc
│   │   │   ├── campaigns.sql
│   │   │   ├── scenes.sql
│   │   │   ├── posts.sql
│   │   │   └── characters.sql
│   │   └── generated/            # sqlc output
│   │       ├── db.go
│   │       ├── models.go
│   │       └── queries.sql.go
│   └── config/
│       └── config.go             # Environment config
├── migrations/
│   └── *.sql                     # Database migrations
├── go.mod
├── go.sum
└── sqlc.yaml                     # sqlc configuration
```

---

## Security Considerations

### Authentication

- Supabase Auth handles password hashing, session management
- JWT tokens validated on every request
- Row-level security in PostgreSQL as additional layer
- Rate limiting on auth endpoints

### Authorization

- All scene/action access filtered by witness rules
- GM-only routes check role at service layer
- Invite codes are cryptographically random
- RLS policies enforce visibility at database level

### Data Validation

- Input validation in Go handlers (mirrors frontend rules)
- Post content validated server-side:
  - Maximum length enforcement per campaign character limit preset
  - UTF-8 validation (reject malformed sequences)
  - HTML/script tag rejection (escape or reject `<script>`, `<img onerror>`, etc.)
- Character limits enforced per campaign setting (1000/3000/6000/10000)
- File uploads (avatars, scene headers) validated and processed via Supabase Storage
- Image constraints: 20MB max, 4000x4000px max, PNG/JPG/WebP only

**Note:** Server-side validation is required to prevent frontend bypass. All content validation rules must be enforced independently of the client.

### Image Handling

- GM-only uploads (players cannot upload directly)
- Per-campaign storage limit: 500 MB
- Per-file size limit: 20 MB
- Avatars: square aspect ratio, cropped via UI
- Scene headers: 16:9 aspect ratio, cropped via UI
- Default images provided for avatars and scenes
- No server-side compression—stored as-is

### Real-time Security

- WebSocket connections require valid JWT
- Room joins verified against membership
- Events filtered by witness visibility before broadcast

### Account Deletion

- User can request account deletion
- Account record removed from auth system
- CharacterAssignments for that user are deleted (characters become orphaned)
- Orphaned characters retain display name, avatar, and all posts
- GM can reassign orphaned characters to new players or write them out of the story
- Posts remain immutable—game history preserved
- If user was GM, campaign enters paused state with GM slot available

---

## Database Migrations

Migrations are managed via Supabase CLI.

```bash
# Create a new migration
supabase migration new <migration_name>

# Apply migrations to local database
supabase db push

# Apply migrations to remote (production)
supabase db push --linked

# View migration status
supabase migration list
```

Migration files live in `migrations/` and are versioned in git. All schema changes must go through migrations—no manual DDL in production.

---

## Development Setup

```bash
# Clone repository
git clone <repo>
cd vanguard-pbp

# Frontend setup
cd frontend
bun install
cp .env.example .env.local
bun dev

# Backend setup
cd backend
go mod download
cp .env.example .env
go run cmd/server/main.go

# Database
# Use Supabase dashboard or CLI for migrations
supabase db push

# Generate types
sqlc generate                    # Go types from SQL
supabase gen types typescript    # TypeScript types from schema

# Linting
cd frontend && bun run lint      # Run ESLint on frontend code
cd backend && golangci-lint run  # Run golangci-lint on backend code
```

---

## Environment Variables

### Frontend

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=http://localhost:8080
```

### Backend

```bash
# Database
DATABASE_URL=postgres://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Server
PORT=8080
FRONTEND_URL=http://localhost:5173

# Optional
RESEND_API_KEY=re_...
```

---

## Error Handling

All API errors use a standardized JSON response format.

### Error Response Format

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "timestamp": "2025-12-12T10:30:00Z",
    "requestId": "req_abc123def456"
  }
}
```

### Field Purposes

- **code:** Machine-readable identifier for logging/aggregation (e.g., `INVALID_DICE`, `ACTION_LOCKED`, `RATE_LIMIT_EXCEEDED`)
- **message:** User-friendly explanation
- **timestamp:** Event timing for debugging
- **requestId:** Correlates frontend errors with backend logs

### User-Facing Message Style

Messages should be friendly and contextual:

| Bad | Good |
|-----|------|
| "Max modifier is ±100" | "That modifier is too high. Try a lower number (max ±100)." |
| "Invalid turn submission" | "Your turn needs either an action or dialogue. Add at least one." |
| "Rate limit exceeded" | "You're submitting too fast. Please wait 30 seconds and try again." |

### Security Errors

For auth/security errors, use generic responses to avoid information leakage:
- Use "Something went wrong. Please try again." instead of "Invalid API key"
- Never expose internal system details in error messages

---

## Rate Limiting

Per-user rate limiting based on authenticated user_id from JWT. Implemented at Gin middleware layer.

### Rate Limit Tiers

| Endpoint Type | Limit | Burst | Rationale |
|---------------|-------|-------|-----------|
| General API (GET) | 60 req/min | 10 | UI polling/refreshes |
| Mutations (POST/PUT/DELETE) | 30 req/min | 5 | Standard writes |
| Turn/Action Submission | 10 req/min | 3 | One action per turn + retries |
| Scene/Campaign Creation | 5 req/min | 2 | Infrequent admin actions |
| Image Upload | 5 req/min | 2 | Resource-heavy |
| Compose Lock (acquire/release) | 12 req/min | 2 | Prevent lock abuse (5 sec between ops) |
| Campaign Join | 5 req/15min per IP | 1 | Prevent invite code brute force |

### Behavior

- Casual gameplay won't hit these limits
- Generous burst allows brief traffic spikes
- Easy to adjust per-endpoint later if needed
- Supabase PostREST has automatic backup rate limiting (100 req/5 min per IP)

### Rate Limit Response

HTTP Status: `429 Too Many Requests`

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "You're submitting too fast. Please wait before trying again.",
    "timestamp": "2025-12-12T10:30:00Z",
    "requestId": "req_abc123def456"
  }
}
```

---

## Deployment

### Hosting

- **Platform:** Railway.app
- **Setup:** Single project handles both frontend and backend
- **Frontend (React):** Deployed to Railway
- **Backend (Go/Gin):** Deployed to Railway
- **Database (PostgreSQL):** Supabase
- **Authentication:** Supabase Auth

### CI/CD Pipeline

- **Platform:** GitHub Actions
- **Trigger:** Push to main branch
- **Steps:**
  1. Run linters (ESLint for frontend, golangci-lint for backend)
  2. Run tests (unit + integration)
  3. On success: auto-deploy both services

```yaml
name: CI/CD
on: [push]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Lint frontend
        run: cd frontend && bun install && bun run lint
      - name: Lint backend
        uses: golangci/golangci-lint-action@v3
        with:
          working-directory: backend
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test && go test ./...
  deploy:
    needs: [lint, test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      # Railway auto-deploys on git push when configured
```

### Environment Strategy

- **Staging:** None—main branch goes straight to production
- **Quality assurance:** Test locally before pushing
- **Secrets:** Managed via GitHub secrets and Railway environment variables

---

## Testing Strategy

### Approach

- **Unit + Integration tests only** (no E2E)
- **No mocking:** Real database/service interactions
- **Focus:** Core game logic

### Test Coverage Priorities

1. Post creation and locking mechanics
2. Dice roll calculation
3. Permission checks (witness visibility, GM-only routes)
4. Phase transitions and state machine
5. Character assignment and orphaning
6. Rate limiting behavior

### Running Tests

```bash
# Frontend
cd frontend && bun test

# Backend
cd backend && go test ./...
```

---

## Logging & Monitoring

### Current Approach

- **Railway built-in logs:** Primary logging mechanism
- **Alert on crashes:** Railway email alerts
- **Request logging:** Standard HTTP request/response logging

### Future Considerations

- Sentry for detailed error tracking (when needed)
- Structured logging with correlation IDs
- Performance metrics dashboard

---

## Backup Strategy

### Supabase Defaults

- Automated daily backups
- Retained 7 days (Pro plan)
- Point-in-time recovery available

### Future Considerations

- Manual export service for campaign data
- User-initiated campaign export

---

## Performance Targets

### Expectations

Play-by-post RPGs are approached casually, not in real-time. Low load expected.

### Target Metrics

| Metric | Target |
|--------|--------|
| Concurrent users | 100-200 |
| Concurrent campaigns | 50+ |
| API response time | <1 second acceptable |
| WebSocket connections | Minimal (turn reminders, not constant sync) |

### Optimization Policy

- Rely on defaults—no custom optimization until bottlenecks identified
- Revisit when needed—monitor usage and adjust only if issues arise
- Supabase free tier handles expected load easily
