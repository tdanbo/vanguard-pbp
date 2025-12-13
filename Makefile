# Vanguard PBP - Makefile

.PHONY: help types frontend-lint backend-lint backend-test frontend-build backend-build
.PHONY: backend-sqlc backend-swag frontend-types validate

# Default target
help:
	@echo "Available Commands:"
	@echo "  make validate      - Run all validation checks"
	@echo "  make types         - Regenerate all types (SQLC, Swagger, Frontend)"
	@echo "  make frontend-lint - Lint frontend code"
	@echo "  make backend-lint  - Lint backend code"
	@echo "  make backend-test  - Run backend tests"
	@echo "  make frontend-build - Build frontend"
	@echo "  make backend-build - Build backend"

# Full validation (matches codebase-validate.md)
validate: types frontend-lint backend-lint backend-test frontend-build backend-build
	@echo "✓ All validation checks passed"

# Type Generation
types: backend-sqlc backend-swag frontend-types
	@echo "✓ All types regenerated"

backend-sqlc:
	cd services/backend && sqlc generate

backend-swag:
	cd services/backend && swag init -g ./cmd/server/main.go

frontend-types:
	cd services/frontend && npm run generate-api

# Linting
frontend-lint:
	cd services/frontend && npm run lint

backend-lint:
	cd services/backend && golangci-lint run --max-issues-per-linter 0

# Testing
backend-test:
	cd services/backend && CGO_ENABLED=0 go test ./...

# Building
frontend-build:
	cd services/frontend && npm run build

backend-build:
	cd services/backend && CGO_ENABLED=0 go build -o ./cmd/server/server ./cmd/server
