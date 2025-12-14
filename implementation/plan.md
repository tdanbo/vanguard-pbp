# Vanguard PBP Implementation Plan

A comprehensive 10-phase implementation plan for the Vanguard Play-by-Post RPG platform.

---

## Quick Links

- [Manual Setup Guide](./manual_setup.md) - Environment setup, API keys, deployment
- [PRD Documentation](../prd/index.md) - Product requirements
- [Skills Reference](../.claude/skills/) - Implementation guidance

---

## Project Structure

This is a **monorepo** with a shared `.env` file at the repository root:

```
vanguard-pbp/
├── .env                    # Shared environment variables
├── services/
│   ├── backend/            # Go API server (Gin)
│   └── frontend/           # React application (Vite)
├── supabase/               # Database migrations
├── implementation/         # This implementation plan
└── prd/                    # Product requirements
```

See [manual_setup.md](./manual_setup.md) for detailed environment configuration.

---

## Implementation Progress

### Legend
- [ ] Not started
- [~] In progress
- [x] Completed

---

## Phase Overview

| Phase | Name | Description | Status |
|-------|------|-------------|--------|
| 1 | [Foundation & Infrastructure](#phase-1-foundation--infrastructure) | Project scaffolding, database, CI/CD | [ ] |
| 2 | [Authentication](#phase-2-authentication--user-management) | Supabase Auth, JWT, login/register | [ ] |
| 3 | [Campaigns](#phase-3-campaign-core) | Campaign CRUD, settings, invites | [ ] |
| 4 | [Characters & Scenes](#phase-4-characters--scenes) | Character management, scenes, images | [ ] |
| 5 | [Posts](#phase-5-post-composition-system) | Compose locks, drafts, post submission | [ ] |
| 6 | [Visibility](#phase-6-visibility--witness-system) | Witness filtering, RLS, hidden posts | [ ] |
| 7 | [Phases](#phase-7-phase-management--pass-system) | State machine, passes, time gates | [ ] |
| 8 | [Dice](#phase-8-dice-rolling-system) | Intentions, rolls, GM overrides | [ ] |
| 9 | [Real-time](#phase-9-real-time-sync--notifications) | Subscriptions, notifications | [ ] |
| 10 | [Production](#phase-10-polish--production) | GM tools, game log, deployment | [ ] |

---

## Phase 1: Foundation & Infrastructure

**Goal**: Set up project scaffolding, database schema, and CI/CD pipeline.

**Skills**: `go-api-server`, `supabase-integration`, `shadcn-react`

**PRD References**: [technical.md](../prd/technical.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 1.1 | Go backend scaffolding | [01-go-backend.md](./phase-01-foundation/01-go-backend.md) | [ ] |
| 1.2 | React frontend scaffolding | [02-react-frontend.md](./phase-01-foundation/02-react-frontend.md) | [ ] |
| 1.3 | Supabase project setup | [03-supabase-setup.md](./phase-01-foundation/03-supabase-setup.md) | [ ] |
| 1.4 | Database schema design | [04-database-schema.md](./phase-01-foundation/04-database-schema.md) | [ ] |
| 1.5 | CI/CD pipeline | [05-ci-cd.md](./phase-01-foundation/05-ci-cd.md) | [ ] |

### Deliverables
- [ ] Go server running on port 8080
- [ ] React app running on port 5173
- [ ] Supabase project configured
- [ ] All database tables created with RLS enabled
- [ ] GitHub Actions pipeline (lint, test, deploy)

---

## Phase 2: Authentication & User Management

**Goal**: Implement user authentication with Supabase Auth.

**Skills**: `supabase-integration`, `go-api-server`, `shadcn-react`

**PRD References**: [technical.md](../prd/technical.md), [settings.md](../prd/settings.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 2.1 | Supabase Auth configuration | [01-supabase-auth.md](./phase-02-authentication/01-supabase-auth.md) | [ ] |
| 2.2 | Backend JWT middleware | [02-backend-jwt.md](./phase-02-authentication/02-backend-jwt.md) | [ ] |
| 2.3 | Frontend auth flows | [03-frontend-auth.md](./phase-02-authentication/03-frontend-auth.md) | [ ] |

### Deliverables
- [ ] Email/password registration with verification
- [ ] OAuth login (Google, Discord)
- [ ] JWT validation middleware
- [ ] Protected API routes
- [ ] Login/Register/Logout UI
- [ ] Session persistence

---

## Phase 3: Campaign Core

**Goal**: Implement campaign management, settings, and invitations.

**Skills**: `go-api-server`, `supabase-integration`, `shadcn-react`

**PRD References**: [overview.md](../prd/overview.md), [scope.md](../prd/scope.md), [settings.md](../prd/settings.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 3.1 | Campaign CRUD | [01-campaign-crud.md](./phase-03-campaigns/01-campaign-crud.md) | [ ] |
| 3.2 | Campaign settings | [02-campaign-settings.md](./phase-03-campaigns/02-campaign-settings.md) | [ ] |
| 3.3 | Invite link system | [03-invite-system.md](./phase-03-campaigns/03-invite-system.md) | [ ] |
| 3.4 | Membership management | [04-membership.md](./phase-03-campaigns/04-membership.md) | [ ] |

### Deliverables
- [ ] Create/edit/delete campaigns (GM)
- [ ] Campaign settings configuration
- [ ] Invite link generation (24h expiry)
- [ ] Join campaign via invite
- [ ] Campaign member list
- [ ] GM ownership transfer
- [ ] Campaign pause/resume

---

## Phase 4: Characters & Scenes

**Goal**: Implement character and scene management with image uploads.

**Skills**: `go-api-server`, `supabase-integration`, `shadcn-react`, `image-upload`

**PRD References**: [core-concepts.md](../prd/core-concepts.md), [information-architecture.md](../prd/information-architecture.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 4.1 | Character management | [01-characters.md](./phase-04-characters-scenes/01-characters.md) | [ ] |
| 4.2 | Scene management | [02-scenes.md](./phase-04-characters-scenes/02-scenes.md) | [ ] |
| 4.3 | Image upload system | [03-image-upload.md](./phase-04-characters-scenes/03-image-upload.md) | [ ] |

### Deliverables
- [ ] Character CRUD (PC/NPC types)
- [ ] Character assignment to users
- [ ] Character archival/orphaning
- [ ] Scene CRUD with header images
- [ ] Character-scene assignment
- [ ] Avatar uploads (square, cropped)
- [ ] Scene header uploads (16:9)
- [ ] Storage quota tracking (500MB/campaign)

---

## Phase 5: Post Composition System

**Goal**: Implement compose locks, drafts, and post submission.

**Skills**: `compose-lock`, `go-api-server`, `shadcn-react`

**PRD References**: [turn-structure.md](../prd/turn-structure.md), [core-concepts.md](../prd/core-concepts.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 5.1 | Compose lock system | [01-compose-lock.md](./phase-05-posts/01-compose-lock.md) | [ ] |
| 5.2 | Draft persistence | [02-drafts.md](./phase-05-posts/02-drafts.md) | [ ] |
| 5.3 | Post submission | [03-post-submission.md](./phase-05-posts/03-post-submission.md) | [ ] |

### Deliverables
- [ ] Lock acquisition with "Take Post" button
- [ ] 10-minute timeout with heartbeat
- [ ] Visual drain bar countdown
- [ ] Server-side draft persistence
- [ ] Cross-device draft sync
- [ ] Post blocks (Action/Dialog)
- [ ] Character limit enforcement
- [ ] OOC text field
- [ ] Post locking after next post
- [ ] Narrator posts (GM, null character)

---

## Phase 6: Visibility & Witness System

**Goal**: Implement witness-based post visibility and Fog of War.

**Skills**: `visibility-filter`, `supabase-integration`

**PRD References**: [information-architecture.md](../prd/information-architecture.md), [core-concepts.md](../prd/core-concepts.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 6.1 | Witness system | [01-witness-system.md](./phase-06-visibility/01-witness-system.md) | [ ] |
| 6.2 | RLS policies | [02-rls-policies.md](./phase-06-visibility/02-rls-policies.md) | [ ] |
| 6.3 | Hidden posts | [03-hidden-posts.md](./phase-06-visibility/03-hidden-posts.md) | [ ] |

### Deliverables
- [ ] Witness list on post creation
- [ ] Character-based visibility filtering
- [ ] RLS policies for witness enforcement
- [ ] Scene visibility (witnessed posts)
- [ ] Hidden posts (GM only)
- [ ] GM unhide (retroactive witnesses)
- [ ] Fog of War setting
- [ ] Multi-character view separation

---

## Phase 7: Phase Management & Pass System

**Goal**: Implement global phase state machine, passes, and time gates.

**Skills**: `state-machine`, `notification-system`

**PRD References**: [turn-structure.md](../prd/turn-structure.md), [core-concepts.md](../prd/core-concepts.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 7.1 | State machine | [01-state-machine.md](./phase-07-phases/01-state-machine.md) | [ ] |
| 7.2 | Pass system | [02-pass-system.md](./phase-07-phases/02-pass-system.md) | [ ] |
| 7.3 | Time gates | [03-time-gates.md](./phase-07-phases/03-time-gates.md) | [ ] |

### Deliverables
- [ ] Global phase state (PC Phase / GM Phase)
- [ ] Phase transition button (GM)
- [ ] Transition guards (pending rolls, etc.)
- [ ] Per-character pass/hard pass
- [ ] Auto-clear pass on new post
- [ ] "All passed" detection
- [ ] Time gate presets (24h-5d)
- [ ] Time gate countdown display
- [ ] Auto-pass on expiration
- [ ] Atomic witness transaction

---

## Phase 8: Dice Rolling System

**Goal**: Implement intent-based dice rolling with GM controls.

**Skills**: `dice-roller`, `go-api-server`

**PRD References**: [turn-structure.md](../prd/turn-structure.md), [settings.md](../prd/settings.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 8.1 | System presets | [01-system-presets.md](./phase-08-dice/01-system-presets.md) | [ ] |
| 8.2 | Roll execution | [02-roll-execution.md](./phase-08-dice/02-roll-execution.md) | [ ] |
| 8.3 | GM overrides | [03-gm-overrides.md](./phase-08-dice/03-gm-overrides.md) | [ ] |

### Deliverables
- [ ] System preset configuration (D&D 5e, Pathfinder, Custom)
- [ ] Intention selection UI
- [ ] Modifier input (-100 to +100)
- [ ] Server-side roll execution
- [ ] Roll result display
- [ ] GM roll request
- [ ] GM intention override
- [ ] Roll blocking (prevents pass)
- [ ] Unresolved rolls UI (GM)
- [ ] GM manual resolution

---

## Phase 9: Real-time Sync & Notifications

**Goal**: Implement real-time updates and notification system.

**Skills**: `real-time-sync`, `notification-system`

**PRD References**: [notifications.md](../prd/notifications.md), [technical.md](../prd/technical.md)

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 9.1 | Real-time subscriptions | [01-subscriptions.md](./phase-09-realtime/01-subscriptions.md) | [ ] |
| 9.2 | Notification triggers | [02-notifications.md](./phase-09-realtime/02-notifications.md) | [ ] |
| 9.3 | Quiet hours | [03-quiet-hours.md](./phase-09-realtime/03-quiet-hours.md) | [ ] |

### Deliverables
- [ ] Supabase Real-time subscriptions
- [ ] Live post updates
- [ ] Compose lock state broadcast
- [ ] Phase transition broadcast
- [ ] Pass state updates
- [ ] Player notifications (phase, posts, rolls)
- [ ] GM notifications (passes, hidden posts)
- [ ] Email delivery (immediate/digest)
- [ ] In-app notification center
- [ ] Quiet hours (timezone-aware)
- [ ] Notification preferences UI

---

## Phase 10: Polish & Production

**Goal**: Finalize features, optimize, and deploy to production.

**Skills**: All skills

**PRD References**: All PRD documents

### Sub-phases

| # | Task | File | Status |
|---|------|------|--------|
| 10.1 | GM moderation tools | [01-gm-tools.md](./phase-10-production/01-gm-tools.md) | [ ] |
| 10.2 | Game log & bookmarks | [02-game-log.md](./phase-10-production/02-game-log.md) | [ ] |
| 10.3 | Rate limiting | [03-rate-limiting.md](./phase-10-production/03-rate-limiting.md) | [ ] |
| 10.4 | Production deployment | [04-deployment.md](./phase-10-production/04-deployment.md) | [ ] |

### Deliverables
- [ ] GM post edit/delete
- [ ] GM force-release lock
- [ ] Character-filtered game log
- [ ] Infinite scroll with jump to recent
- [ ] Bookmark system (NPC, scene, post)
- [ ] GM inactivity tracking (30 days)
- [ ] Voluntary GM transfer
- [ ] Abandonment claiming
- [ ] Rate limiting (all endpoints)
- [ ] Error handling standardization
- [ ] Performance optimization
- [ ] Railway deployment
- [ ] Production monitoring

---

## Database Schema Overview

See [Phase 1.4: Database Schema](./phase-01-foundation/04-database-schema.md) for complete schema.

### Core Tables
- `users` - User accounts (via Supabase Auth)
- `campaigns` - Campaign configuration and state
- `campaign_members` - User-campaign relationships
- `invite_links` - Invitation management
- `characters` - Player and NPC characters
- `character_assignments` - User-character relationships
- `scenes` - Campaign locations/situations
- `posts` - Character posts with blocks
- `compose_locks` - Active composition sessions
- `compose_drafts` - Server-persisted drafts
- `rolls` - Dice roll records
- `bookmarks` - Character-scoped bookmarks
- `notifications` - Notification history
- `notification_preferences` - User settings
- `quiet_hours` - Notification scheduling

---

## Testing Strategy

### Unit Tests
- Service layer business logic
- Validation functions
- State machine transitions

### Integration Tests
- API endpoint tests with real database
- RLS policy verification
- Real-time subscription tests

### Manual Testing Checklist
- [ ] Complete user registration flow
- [ ] Campaign creation and invitation
- [ ] Multi-character posting
- [ ] Witness visibility verification
- [ ] Phase transitions
- [ ] Dice rolling workflow
- [ ] Real-time updates
- [ ] Notification delivery

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  React + TypeScript + Tailwind + shadcn/ui + Lucide Icons   │
│                    + Supabase Client                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST + WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Go API Server                         │
│         Gin + JWT Middleware + Service Layer + sqlc         │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ PostgreSQL + Real-time
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Supabase                            │
│    PostgreSQL + Auth + Real-time + Storage + RLS Policies   │
└─────────────────────────────────────────────────────────────┘
```

---

## Getting Started

1. Complete [Manual Setup](./manual_setup.md)
2. Start with [Phase 1: Foundation](./phase-01-foundation/README.md)
3. Progress through phases sequentially
4. Mark tasks complete in this file as you go

---

## Notes

- Each phase builds on previous phases
- Do not skip phases unless explicitly noted
- Reference skills (`.claude/skills/`) when implementing
- Reference PRD (`prd/`) for requirements
- Update status checkboxes as you complete tasks
