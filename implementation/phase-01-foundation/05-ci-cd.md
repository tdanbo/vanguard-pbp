# 1.5 CI/CD Pipeline

**Goal**: Set up GitHub Actions for continuous integration and deployment.

---

## Overview

The CI/CD pipeline automates:
- Code linting (ESLint, golangci-lint)
- Type checking
- Unit and integration tests
- Deployment to Railway

---

## PRD References

From [technical.md](../../prd/technical.md):
- GitHub Actions for CI/CD
- golangci-lint for Go
- ESLint for TypeScript
- Auto-deploy on main branch

---

## Workflow Files

### Main CI Workflow

Create **.github/workflows/ci.yml**:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  GO_VERSION: '1.21'
  BUN_VERSION: '1.0'

jobs:
  # ============================================
  # Backend Jobs
  # ============================================

  backend-lint:
    name: Backend Lint
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/backend

    steps:
      - uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: ${{ env.GO_VERSION }}

      - name: Install golangci-lint
        uses: golangci/golangci-lint-action@v4
        with:
          version: latest
          working-directory: services/backend
          args: --timeout=5m

  backend-test:
    name: Backend Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/backend

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: vanguard_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: ${{ env.GO_VERSION }}

      - name: Install dependencies
        run: go mod download

      - name: Run tests
        run: go test -v -race -coverprofile=coverage.out ./...
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/vanguard_test?sslmode=disable
          # Tests use mock JWKS server, no real JWKS URL needed

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          file: services/backend/coverage.out
          flags: backend
        if: github.event_name == 'push'

  backend-build:
    name: Backend Build
    runs-on: ubuntu-latest
    needs: [backend-lint, backend-test]
    defaults:
      run:
        working-directory: services/backend

    steps:
      - uses: actions/checkout@v4

      - name: Set up Go
        uses: actions/setup-go@v5
        with:
          go-version: ${{ env.GO_VERSION }}

      - name: Build
        run: go build -v -o bin/server ./cmd/server

  # ============================================
  # Frontend Jobs
  # ============================================

  frontend-lint:
    name: Frontend Lint
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/frontend

    steps:
      - uses: actions/checkout@v4

      - name: Set up Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: Install dependencies
        run: bun install

      - name: Run ESLint
        run: bun run lint

  frontend-typecheck:
    name: Frontend Type Check
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/frontend

    steps:
      - uses: actions/checkout@v4

      - name: Set up Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: Install dependencies
        run: bun install

      - name: Type check
        run: bun run typecheck

  frontend-test:
    name: Frontend Test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/frontend

    steps:
      - uses: actions/checkout@v4

      - name: Set up Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: Install dependencies
        run: bun install

      - name: Run tests
        run: bun run test
        env:
          VITE_SUPABASE_URL: https://test.supabase.co
          VITE_SUPABASE_ANON_KEY: test-key

  frontend-build:
    name: Frontend Build
    runs-on: ubuntu-latest
    needs: [frontend-lint, frontend-typecheck, frontend-test]
    defaults:
      run:
        working-directory: services/frontend

    steps:
      - uses: actions/checkout@v4

      - name: Set up Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: Install dependencies
        run: bun install

      - name: Build
        run: bun run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}
          VITE_API_URL: ${{ secrets.VITE_API_URL }}

  # ============================================
  # Deploy Jobs (only on main)
  # ============================================

  deploy-backend:
    name: Deploy Backend
    runs-on: ubuntu-latest
    needs: [backend-build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Railway
        uses: bervProject/railway-deploy@v1.0.0
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend

  deploy-frontend:
    name: Deploy Frontend
    runs-on: ubuntu-latest
    needs: [frontend-build]
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Railway
        uses: bervProject/railway-deploy@v1.0.0
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: frontend
```

### Database Migration Workflow

Create **.github/workflows/db-migrate.yml**:

```yaml
name: Database Migration

on:
  push:
    branches: [main]
    paths:
      - 'supabase/migrations/**'

jobs:
  migrate:
    name: Run Migrations
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Link Supabase project
        run: supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Run migrations
        run: supabase db push
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

---

## Package.json Scripts

Add to **services/frontend/package.json**:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext ts,tsx --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:types": "supabase gen types typescript --project-id $SUPABASE_PROJECT_REF > src/types/database.types.ts"
  }
}
```

---

## ESLint Configuration

Create **services/frontend/.eslintrc.cjs**:

```js
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
}
```

---

## golangci-lint Configuration

Create **services/backend/.golangci.yml**:

```yaml
run:
  timeout: 5m
  modules-download-mode: readonly

linters:
  enable:
    - errcheck
    - gosimple
    - govet
    - ineffassign
    - staticcheck
    - typecheck
    - unused
    - gofmt
    - goimports
    - misspell
    - unconvert
    - unparam
    - gosec

linters-settings:
  errcheck:
    check-type-assertions: true
  govet:
    check-shadowing: true
  goimports:
    local-prefixes: github.com/yourusername/vanguard-pbp

issues:
  exclude-use-default: false
  max-issues-per-linter: 0
  max-same-issues: 0
```

---

## GitHub Secrets

Configure these secrets in GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `RAILWAY_TOKEN` | Railway deployment token |
| `SUPABASE_PROJECT_REF` | Supabase project reference |
| `SUPABASE_ACCESS_TOKEN` | Supabase personal access token |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (or `VITE_SUPABASE_ANON_KEY` for legacy) |
| `VITE_API_URL` | Production API URL |
| `SUPABASE_JWKS_URL` | JWKS URL for JWT verification (backend) |
| `SUPABASE_SECRET_KEY` | Supabase secret key for backend (or `SUPABASE_SERVICE_ROLE_KEY` for legacy) |

---

## Test Setup

### Backend Tests

Create **services/backend/internal/handlers/health_test.go** (example from earlier).

### Frontend Tests

Install Vitest:

```bash
cd services/frontend
bun add -d vitest @testing-library/react @testing-library/jest-dom jsdom
```

Create **services/frontend/vitest.config.ts**:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Create **services/frontend/src/test/setup.ts**:

```ts
import '@testing-library/jest-dom'
```

Example test **services/frontend/src/lib/utils.test.ts**:

```ts
import { describe, it, expect } from 'vitest'
import { cn, truncate } from './utils'

describe('utils', () => {
  describe('cn', () => {
    it('merges class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('handles conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    })
  })

  describe('truncate', () => {
    it('truncates long strings', () => {
      expect(truncate('hello world', 5)).toBe('hello...')
    })

    it('returns short strings unchanged', () => {
      expect(truncate('hi', 5)).toBe('hi')
    })
  })
})
```

---

## Verification

1. Push to a feature branch and verify CI runs
2. Create PR and verify all checks pass
3. Merge to main and verify deployment triggers
4. Check Railway dashboard for successful deployment

---

## Workflow Diagram

```
┌─────────────┐     ┌─────────────┐
│   Push PR   │────▶│   Backend   │
└─────────────┘     │    Lint     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Backend   │
                    │    Test     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Backend   │
                    │    Build    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Deploy    │ (main only)
                    │   Backend   │
                    └─────────────┘

┌─────────────┐     ┌─────────────┐
│   Push PR   │────▶│  Frontend   │
└─────────────┘     │    Lint     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Frontend   │
                    │  Typecheck  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Frontend   │
                    │    Test     │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Frontend   │
                    │    Build    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Deploy    │ (main only)
                    │  Frontend   │
                    └─────────────┘
```

---

## Edge Cases

1. **Test database unavailable**: Tests fail fast with clear error
2. **Deployment failure**: Rollback to previous version (Railway handles)
3. **Migration failure**: Blocked deploy, manual intervention required
4. **Secrets missing**: Build fails with clear message

---

## Phase 1 Complete

With CI/CD configured, Phase 1 is complete. You now have:
- Go backend scaffolding
- React frontend scaffolding
- Supabase project configured
- Database schema created
- CI/CD pipeline running

Proceed to [Phase 2: Authentication](../phase-02-authentication/README.md).
