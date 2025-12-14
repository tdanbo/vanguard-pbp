# Vanguard PBP - Makefile

.PHONY: help dev dev-backend dev-frontend
.PHONY: types backend-sqlc frontend-types
.PHONY: frontend-lint backend-lint backend-test frontend-build backend-build
.PHONY: migrate tools clean validate

# Default target
help:
	@echo "Available Commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev            - Start full dev environment (Supabase + backend + frontend)"
	@echo "  make dev-backend    - Start backend with hot reload (Air)"
	@echo "  make dev-frontend   - Start frontend dev server"
	@echo ""
	@echo "Validation:"
	@echo "  make validate       - Run all validation checks"
	@echo "  make frontend-lint  - Lint frontend code"
	@echo "  make backend-lint   - Lint backend code"
	@echo "  make backend-test   - Run backend tests"
	@echo ""
	@echo "Build:"
	@echo "  make frontend-build - Build frontend for production"
	@echo "  make backend-build  - Build backend binary"
	@echo ""
	@echo "Code Generation:"
	@echo "  make types          - Regenerate all types (sqlc + Supabase)"
	@echo "  make backend-sqlc   - Generate Go types from SQL queries"
	@echo "  make frontend-types - Generate TypeScript types from Supabase"
	@echo ""
	@echo "Database:"
	@echo "  make migrate        - Push migrations to Supabase"
	@echo ""
	@echo "Setup:"
	@echo "  make tools          - Install development tools (sqlc, golangci-lint, air)"
	@echo "  make clean          - Remove build artifacts"

# ===========================================
# Development
# ===========================================

dev:
	@echo "Starting development environment..."
	@echo "Starting Supabase..."
	@supabase start
	@echo "Starting backend and frontend..."
	@trap 'kill 0' EXIT; \
		(cd services/backend && air) & \
		(cd services/frontend && ~/.bun/bin/bun run dev) & \
		wait

dev-backend:
	cd services/backend && air

dev-frontend:
	cd services/frontend && ~/.bun/bin/bun run dev

# ===========================================
# Validation
# ===========================================

validate: types frontend-lint backend-lint backend-test frontend-build backend-build
	@echo "✓ All validation checks passed"

frontend-lint:
	cd services/frontend && ~/.bun/bin/bun run lint

backend-lint:
	cd services/backend && golangci-lint run --max-issues-per-linter 0

backend-test:
	cd services/backend && CGO_ENABLED=0 go test ./...

# ===========================================
# Build
# ===========================================

frontend-build:
	cd services/frontend && ~/.bun/bin/bun run build

backend-build:
	cd services/backend && CGO_ENABLED=0 go build -o ./bin/server ./cmd/server

# ===========================================
# Code Generation
# ===========================================

types: backend-sqlc frontend-types
	@echo "✓ All types regenerated"

backend-sqlc:
	cd services/backend/db && sqlc generate

frontend-types:
	supabase gen types typescript --local > services/frontend/src/types/database.types.ts

# ===========================================
# Database
# ===========================================

migrate:
	supabase db push

# ===========================================
# Setup & Cleanup
# ===========================================

tools:
	go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install github.com/air-verse/air@latest
	@echo "✓ Development tools installed"

clean:
	rm -rf services/backend/bin/
	rm -rf services/backend/tmp/
	rm -rf services/frontend/dist/
	@echo "✓ Build artifacts cleaned"
