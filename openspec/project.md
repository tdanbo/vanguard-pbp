# Project Context

## Purpose

Vanguard PBP is a system-agnostic communication platform for play-by-post tabletop roleplaying games. The platform handles narrative flow, turn management, and scene organization while leaving game mechanics to the groups themselves.

**Core Innovation:** Eliminating metagaming through architectural design rather than player honor. Players literally cannot see information their characters don't have access to. The witness system ensures visibility is character-based and post-based.

**Key Goals:**
- Prevent single players from dominating narrative (compose locks, phase structure)
- Keep games moving with time gates and structured phases
- Manage parallel scenes, character locations, and narrative threads
- Make metagaming architecturally impossible via witness filtering

## Tech Stack

### Frontend
- **React 19** - UI framework with TypeScript
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Accessible component library (Radix UI primitives)
- **Zustand** - State management
- **Supabase JS** - Real-time subscriptions and auth client
- **Lucide React** - Icon library
- **react-hook-form + zod** - Form handling and validation
- **Bun** - Package manager and runtime

### Backend
- **Go 1.25** - Backend language
- **Gin** - HTTP web framework
- **sqlc** - Type-safe SQL code generation
- **pgx** - PostgreSQL driver
- **JWT/JWKS** - Authentication via Supabase tokens

### Infrastructure
- **PostgreSQL** - Database via Supabase
- **Supabase** - Auth, real-time, storage, RLS
- **Railway** - Hosting platform
- **GitHub Actions** - CI/CD pipeline

## Project Conventions

### Code Style

**Frontend:**
- Use `bun` instead of `npm` for all commands
- TypeScript strict mode enabled
- ESLint for linting with React hooks plugins
- Prefer functional components with hooks
- Use shadcn/ui components from `@/components/ui/`
- Tailwind for styling, no separate CSS files
- Zustand for global state, local state for component-specific data

**Backend:**
- golangci-lint for static analysis
- sqlc for type-safe database queries (no raw SQL in handlers)
- Service layer between handlers and database
- Handlers in `internal/api/handlers/`
- Services in `internal/service/`
- Generated queries in `internal/db/generated/`

### Architecture Patterns

**Frontend Structure:**
```
services/frontend/src/
├── components/      # UI components by domain
│   ├── ui/          # shadcn/ui primitives
│   ├── campaign/    # Campaign-specific
│   ├── scene/       # Scene view
│   ├── post/        # Post display/composer
│   └── character/   # Character management
├── hooks/           # Custom React hooks
├── stores/          # Zustand stores
├── lib/             # Utilities, API client, Supabase
├── pages/           # Route components
└── types/           # TypeScript types (generated + custom)
```

**Backend Structure:**
```
services/backend/
├── cmd/server/      # Entry point
└── internal/
    ├── api/
    │   ├── handlers/ # HTTP handlers
    │   └── middleware/
    ├── service/      # Business logic
    ├── db/
    │   ├── queries/  # SQL files for sqlc
    │   └── generated/ # sqlc output
    └── config/
```

**Key Patterns:**
- Witness-based visibility filtering (posts carry witness lists)
- Compose lock system for sequential post ordering
- Global phase synchronization across all scenes
- Real-time updates via Supabase subscriptions (no custom WebSocket hub)
- Row-level security as additional authorization layer

### Testing Strategy

- Unit + Integration tests only (no E2E)
- No mocking - real database/service interactions
- Focus on core game logic:
  - Post creation and locking mechanics
  - Dice roll calculation
  - Permission checks (witness visibility, GM-only routes)
  - Phase transitions and state machine
  - Character assignment and orphaning

**Commands:**
```bash
cd services/frontend && bun test
cd services/backend && go test ./...
```

### Git Workflow

- Main branch deploys directly to production
- Test locally before pushing
- CI pipeline runs linters and tests on push
- No staging environment

## Domain Context

**Core Entities:**
- **Campaign** - Top-level container with GM owner, settings, and global phase state
- **Scene** - Location/situation where play happens (max 25 per campaign)
- **Character** - In-game identity (PC or NPC), campaign-owned and immutable
- **Post** - Single character submission with structured blocks (Action, Dialog)
- **Witness** - Characters who can see a post (determines visibility)

**Phase System:**
- **PC Phase** - Players post as their characters
- **GM Phase** - GM posts, moves characters, manages scenes
- Phases are global across all scenes in a campaign
- Time gates auto-expire but GM must manually transition

**Key Mechanics:**
- Compose locks prevent simultaneous posting (10-minute timeout)
- Pass/hard-pass system for turn completion
- Hidden posts (GM only until revealed)
- Intent-based dice rolling system

## Important Constraints

**Limits:**
- 50 players per campaign
- 25 scenes per campaign (auto-delete oldest archived at 26)
- 500MB storage per campaign (images only)
- 5 campaigns per user (as owner)
- Character limits: 1000/3000/6000/10000 per post (configurable)

**Immutability:**
- Characters cannot be deleted (only archived)
- Posts are locked after next post is created
- Game history is preserved regardless of account status

**Security:**
- All visibility filtered by witness rules
- Server-side validation mirrors frontend rules
- RLS policies enforce visibility at database level
- No usernames exposed - character-based identity only

## External Dependencies

- **Supabase** - Auth, database, real-time, storage
- **Railway** - Hosting and deployment
- **GitHub Actions** - CI/CD
- **Resend** (optional) - Email notifications
