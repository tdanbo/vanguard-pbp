# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

Vanguard PBP is a play-by-post RPG platform. Implementation is in progress following the phased plan in `implementation/plan.md`.

## Structure

```
vanguard-pbp/
├── .env                    # Shared environment variables
├── services/
│   ├── backend/            # Go API server (Gin)
│   └── frontend/           # React application (Vite)
├── supabase/               # Database migrations
├── implementation/         # Implementation plan and phase docs
└── prd/                    # Product requirements
```

## Build Commands

### Frontend (React/Vite)

**IMPORTANT: Use `bun` instead of `npm` for all frontend commands.**

```bash
cd services/frontend
bun install          # Install dependencies
bun run dev          # Development server
bun run build        # Production build
bun run lint         # Run linter
```

### Backend (Go/Gin)

```bash
cd services/backend
go build ./...       # Build
go run ./cmd/server  # Run server
go test ./...        # Run tests
```

## Key Technologies

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand
- **Backend**: Go, Gin, sqlc, pgx
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth with JWKS validation
