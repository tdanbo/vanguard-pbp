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

---

## Backend

### Go

The backend language. Compiles to a single binary with no runtime dependencies. Excellent performance and low memory footprint. Strong concurrency model with goroutines for handling many simultaneous WebSocket connections. Static typing catches errors early. Simple deployment—just copy the binary.

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
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │  HTTP Routes  │  │  Auth         │  │  WebSocket Hub    │   │
│  │  /api/*       │  │  (Supabase)   │  │  (goroutines)     │   │
│  └───────┬───────┘  └───────┬───────┘  └─────────┬─────────┘   │
│          │                  │                    │              │
│          └──────────────────┼────────────────────┘              │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │                    Service Layer                         │   │
│  │  Campaign │ Scene │ Action │ Witness │ Roll │ Notify    │   │
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
│  users │ campaigns │ scenes │ actions │ witnesses │ rolls      │
│                                                                 │
│  Row-Level Security │ Real-time │ Storage │ Auth               │
└─────────────────────────────────────────────────────────────────┘
```

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
  status: 'active' | 'paused' | 'archived';
  currentTurn: number;     // Global turn counter
  storageUsedBytes: number; // Track storage for 500MB limit
  createdAt: Date;
  updatedAt: Date;
}

interface InviteLink {
  id: string;              // UUID
  campaignId: string;      // FK to Campaign
  code: string;            // Cryptographically random
  expiresAt: Date;         // 24 hours from creation
  usedAt: Date | null;     // Null until consumed
  usedBy: string | null;   // FK to User who joined
}

interface CampaignSettings {
  timeGatePreset: '24h' | '2d' | '3d' | '4d' | '5d';  // Fixed presets only
  fogOfWar: boolean;
  hiddenTurns: boolean;
  composeLockMinutes: number;
  oocVisibility: 'all' | 'gm_only';
  characterLimit: 1000 | 3000 | 6000 | 10000;
  gmInactivityDays: number | null;  // null = disabled
  rollRequestTimeoutHours: number;  // For GM-requested rolls
  systemPreset: SystemPreset;
}

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
  displayName: string;     // Character/player name
  avatarUrl: string | null;
  role: 'gm' | 'player';
  status: 'active' | 'removed';
  joinedAt: Date;
}
```

### Scenes

```typescript
interface Scene {
  id: string;              // UUID
  campaignId: string;      // FK to Campaign
  title: string;
  description: string;     // Opening narrative
  timeGateHours: number | null;  // Override campaign default
  status: 'active' | 'paused' | 'archived';
  turnState: 'gm_turn' | 'player_window' | 'resolving';
  windowStartedAt: Date | null;  // When current window opened
  createdAt: Date;
  updatedAt: Date;
}
```

### Scene Presence

```typescript
interface ScenePresence {
  id: string;              // UUID
  sceneId: string;         // FK to Scene
  memberId: string;        // FK to CampaignMember
  status: 'present' | 'departed';
  passState: 'none' | 'passed' | 'hard_passed';
  enteredAt: Date;
  departedAt: Date | null;
}
```

### Turns

```typescript
interface Turn {
  id: string;              // UUID
  sceneId: string;         // FK to Scene
  authorId: string;        // FK to CampaignMember
  blocks: TurnBlock[];     // Structured content blocks
  isHidden: boolean;       // Only GM can see
  intention: string | null; // e.g., "intimidation", "stealth"
  modifier: number | null; // Player-provided modifier for roll
  createdAt: Date;
  updatedAt: Date;
  lockedAt: Date | null;   // When next turn witnessed this
  editedByGm: boolean;     // Shows "Edited by GM" badge if true
}

interface TurnBlock {
  type: 'action' | 'dialog';
  content: string;
  order: number;           // Sequence within turn
}
```

### Witnesses

```typescript
interface TurnWitness {
  id: string;              // UUID
  turnId: string;          // FK to Turn
  memberId: string;        // FK to CampaignMember
  witnessedAt: Date;
}
```

### Rolls

```typescript
interface Roll {
  id: string;              // UUID
  turnId: string | null;   // FK to Turn (if player-initiated)
  sceneId: string;         // FK to Scene
  memberId: string;        // FK to CampaignMember (roller)
  requestedBy: string | null;  // FK to CampaignMember (GM) if requested
  intention: string;       // Selected from system preset
  modifier: number;        // Player-provided modifier (max ±100)
  diceType: string;        // From system preset (e.g., "d20")
  diceCount: number;       // Number of dice (max 100)
  result: number[];        // Individual die results
  total: number;           // Sum with modifiers
  gmOverrideIntention: string | null;  // If GM swapped intention
  status: 'pending' | 'completed' | 'invalidated';
  createdAt: Date;
}
```

**Notes:**
- All rolls execute server-side only
- GM can invalidate suspicious rolls
- Original intention preserved even if GM overrides
- Supported dice: d4, d6, d8, d10, d12, d20, d100
- Max modifier: ±100, max dice per type: 100

### Compose Locks

```typescript
interface ComposeLock {
  sceneId: string;         // FK to Scene (unique)
  memberId: string;        // FK to CampaignMember
  acquiredAt: Date;
  lastActivityAt: Date;
}
```

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
POST   /api/campaigns/:id/claim-gm       Claim GM role (if available)
GET    /api/campaigns/:id/members        List members
PATCH  /api/campaigns/:id/members/:mid   Update member (name, avatar)
DELETE /api/campaigns/:id/members/:mid   Remove member
```

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

### Turns

```
GET    /api/scenes/:id/turns             Get witnessed turns
POST   /api/scenes/:id/turns             Post turn
PATCH  /api/turns/:id                    Edit turn (if not locked, or GM edit)
DELETE /api/turns/:id                    Delete turn (GM only)
```

**GM Moderation:**
- GM can edit any turn at any point (sets `editedByGm: true`)
- GM can delete any turn at any point
- Edits show small "Edited by GM" badge, no version history

### Turn Flow

```
POST   /api/scenes/:id/pass              Pass turn
POST   /api/scenes/:id/hard-pass         Hard pass
POST   /api/campaigns/:id/resolve        GM resolution for all scenes (opens new window)
```

### Rolls

```
POST   /api/scenes/:id/rolls             Execute roll (with turn submission)
POST   /api/scenes/:id/roll-request      GM requests roll from player
GET    /api/scenes/:id/rolls             Get scene rolls (witnessed)
```

**Roll Request Timeout:**
- GM-requested rolls have configurable timeout
- If player doesn't respond, auto-roll with zero modifier

### Compose Lock

```
POST   /api/scenes/:id/compose/acquire   Acquire compose lock
POST   /api/scenes/:id/compose/release   Release compose lock
POST   /api/scenes/:id/compose/heartbeat Keep lock alive
```

---

## Real-time Events

Using Supabase Realtime or custom WebSocket:

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
// New turn posted
{ event: 'turn:new', turn: Turn, witnesses: string[] }

// Turn edited
{ event: 'turn:edit', turn: Turn }

// Turn deleted (GM moderation)
{ event: 'turn:delete', turnId: string }

// Player started typing
{ event: 'compose:start', sceneId: string, memberId: string }

// Player stopped typing / lock released
{ event: 'compose:end', sceneId: string }

// Player passed
{ event: 'window:pass', sceneId: string, memberId: string }

// Window closed (all passed or timeout) - campaign-wide
{ event: 'window:closed', campaignId: string }

// GM posted resolution, new window opened - campaign-wide
{ event: 'window:opened', campaignId: string, turnNumber: number }

// Member added to scene
{ event: 'presence:add', sceneId: string, member: CampaignMember }

// Member left scene
{ event: 'presence:remove', sceneId: string, memberId: string }

// Roll result
{ event: 'roll:result', roll: Roll }

// GM role available (GM deleted account or inactivity)
{ event: 'gm:available', campaignId: string }

// Campaign paused/resumed
{ event: 'campaign:status', campaignId: string, status: string }
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
│   │   ├── turn/                 # Turn display and composer
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
│   │       ├── turns.go
│   │       └── rolls.go
│   ├── service/
│   │   ├── campaign.go
│   │   ├── scene.go
│   │   ├── turn.go
│   │   ├── witness.go
│   │   ├── roll.go
│   │   └── notification.go
│   ├── websocket/
│   │   ├── hub.go                # Connection manager
│   │   ├── client.go             # Client handling
│   │   └── events.go             # Event types
│   ├── db/
│   │   ├── queries/              # SQL files for sqlc
│   │   │   ├── campaigns.sql
│   │   │   ├── scenes.sql
│   │   │   ├── turns.sql
│   │   │   └── witnesses.sql
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

- Input validation in Go handlers
- Turn content validated via UI components (Action, Dialog blocks)
- Character limits enforced per campaign setting
- File uploads (avatars, scene headers) validated and processed via Supabase Storage
- Image constraints: 20MB max, 4000x4000px max, PNG/JPG/WebP only

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
- Campaign characters become orphaned (retain display name, avatar, turns)
- GM can reassign orphaned characters to new players
- Turns remain immutable—game history preserved
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
  1. Run tests (unit + integration)
  2. On success: auto-deploy both services

```yaml
name: CI/CD
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test && go test ./...
  deploy:
    needs: test
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

1. Turn mechanics and synchronization
2. Dice roll calculation
3. Permission checks (witness visibility, GM-only routes)
4. Scene transitions and state machine
5. Player/GM state management
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
