# Phase 1: Foundation & Infrastructure

**Goal**: Set up project scaffolding, database schema, and CI/CD pipeline.

---

## Overview

This phase establishes the technical foundation for Vanguard PBP. By the end, you'll have:
- A running Go backend with Gin framework
- A running React frontend with Vite, TypeScript, and Tailwind
- A configured Supabase project with database tables
- A GitHub Actions CI/CD pipeline

---

## Skills to Activate

When implementing this phase, activate these skills for guidance:

| Skill | Purpose |
|-------|---------|
| `go-api-server` | Backend scaffolding, Gin setup, project structure |
| `supabase-integration` | Database setup, Supabase configuration |
| `shadcn-react` | Frontend scaffolding, component setup |

---

## Sub-phases

| # | Task | File | Description |
|---|------|------|-------------|
| 1.1 | Go Backend | [01-go-backend.md](./01-go-backend.md) | Gin server, project structure, sqlc |
| 1.2 | React Frontend | [02-react-frontend.md](./02-react-frontend.md) | Vite, TypeScript, Tailwind, shadcn/ui |
| 1.3 | Supabase Setup | [03-supabase-setup.md](./03-supabase-setup.md) | Project creation, initial config |
| 1.4 | Database Schema | [04-database-schema.md](./04-database-schema.md) | All tables, RLS policies |
| 1.5 | CI/CD Pipeline | [05-ci-cd.md](./05-ci-cd.md) | GitHub Actions workflow |

---

## PRD References

- [technical.md](../../prd/technical.md) - Technology stack requirements
- [scope.md](../../prd/scope.md) - System limits and constraints

---

## Prerequisites

Before starting this phase:

1. Complete [Manual Setup](../manual_setup.md):
   - [ ] Supabase account created
   - [ ] GitHub repository created
   - [ ] Railway account created (for deployment)

2. Development environment:
   - Go 1.21+ installed
   - Bun 1.0+ installed
   - Git configured
   - IDE with Go and TypeScript support

---

## Directory Structure

This is a **monorepo** with both services under the `services/` directory and a shared `.env` at the root.

After completing this phase:

```
vanguard-pbp/
├── .env                        # Shared environment variables (root level)
├── .env.example                # Template for .env (commit this)
├── .gitignore
├── services/
│   ├── backend/                # Go API server
│   │   ├── cmd/
│   │   │   └── server/
│   │   │       └── main.go
│   │   ├── internal/
│   │   │   ├── config/
│   │   │   ├── database/
│   │   │   ├── handlers/
│   │   │   ├── middleware/
│   │   │   ├── models/
│   │   │   └── services/
│   │   ├── db/
│   │   │   ├── migrations/
│   │   │   ├── queries/
│   │   │   └── sqlc.yaml
│   │   ├── go.mod
│   │   ├── go.sum
│   │   └── Makefile
│   └── frontend/               # React application
│       ├── src/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── lib/
│       │   ├── pages/
│       │   ├── stores/
│       │   ├── types/
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── public/
│       ├── index.html
│       ├── package.json
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       └── vite.config.ts
├── supabase/                   # Supabase migrations
│   └── migrations/
├── .github/
│   └── workflows/
│       └── ci.yml
├── implementation/
└── prd/
```

**Note**: Both frontend and backend load environment variables from the root `.env` file. See [manual_setup.md](../manual_setup.md) for configuration details.

---

## Completion Checklist

- [ ] Go server starts and responds to health check
- [ ] React app loads in browser
- [ ] Supabase project accessible
- [ ] Database tables created
- [ ] RLS policies enabled on all tables
- [ ] CI pipeline runs on push
- [ ] Both apps connect to Supabase

---

## Next Phase

After completing Phase 1, proceed to [Phase 2: Authentication](../phase-02-authentication/README.md).
