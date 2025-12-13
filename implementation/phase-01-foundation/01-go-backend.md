# 1.1 Go Backend Scaffolding

**Skill**: `go-api-server`

**Goal**: Create a Go backend using Gin framework with proper project structure.

---

## Overview

The backend serves as the API layer between the React frontend and Supabase. It handles:
- Request validation and authorization
- Business logic orchestration
- Database queries via sqlc
- JWT validation from Supabase Auth

---

## PRD References

From [technical.md](../../prd/technical.md):
- Go as backend language
- Gin HTTP framework
- sqlc for type-safe database queries
- golangci-lint for code quality

---

## Project Structure

The backend lives at `services/backend/` in the monorepo and shares a `.env` file at the repository root.

```
services/backend/
├── cmd/
│   └── server/
│       └── main.go           # Application entry point
├── internal/
│   ├── config/
│   │   └── config.go         # Environment configuration
│   ├── database/
│   │   ├── db.go             # Database connection
│   │   └── generated/        # sqlc generated code
│   ├── handlers/
│   │   ├── campaigns.go      # Campaign endpoints
│   │   ├── characters.go     # Character endpoints
│   │   ├── health.go         # Health check
│   │   ├── posts.go          # Post endpoints
│   │   └── scenes.go         # Scene endpoints
│   ├── middleware/
│   │   ├── auth.go           # JWT validation
│   │   ├── cors.go           # CORS configuration
│   │   ├── logging.go        # Request logging
│   │   └── ratelimit.go      # Rate limiting
│   ├── models/
│   │   ├── campaign.go       # Campaign types
│   │   ├── character.go      # Character types
│   │   ├── errors.go         # Error types
│   │   └── post.go           # Post types
│   └── services/
│       ├── campaign.go       # Campaign business logic
│       ├── character.go      # Character business logic
│       └── post.go           # Post business logic
├── db/
│   ├── migrations/
│   │   └── 001_initial.sql   # Database migrations
│   ├── queries/
│   │   ├── campaigns.sql     # Campaign queries
│   │   ├── characters.sql    # Character queries
│   │   └── posts.sql         # Post queries
│   └── sqlc.yaml             # sqlc configuration
├── go.mod
├── go.sum
└── Makefile
```

**Environment**: The backend loads `.env` from the repository root (`../../.env` relative to `cmd/server/`).

---

## Implementation Steps

### Step 1: Initialize Go Module

```bash
mkdir -p services/backend/cmd/server
cd services/backend
go mod init github.com/yourusername/vanguard-pbp/services/backend
```

### Step 2: Install Dependencies

```bash
go get github.com/gin-gonic/gin
go get github.com/joho/godotenv
go get github.com/jackc/pgx/v5
go get github.com/golang-jwt/jwt/v5
go get golang.org/x/time/rate
```

### Step 3: Create Entry Point

**cmd/server/main.go**:

```go
package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/yourusername/vanguard-pbp/services/backend/internal/config"
	"github.com/yourusername/vanguard-pbp/services/backend/internal/database"
	"github.com/yourusername/vanguard-pbp/services/backend/internal/handlers"
	"github.com/yourusername/vanguard-pbp/services/backend/internal/middleware"
)

func main() {
	// Load environment variables from repository root
	// Try multiple paths to support running from different directories
	envPaths := []string{"../../.env", ".env"}
	for _, path := range envPaths {
		if err := godotenv.Load(path); err == nil {
			log.Printf("Loaded environment from %s", path)
			break
		}
	}

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Initialize database connection
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Set Gin mode
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create router
	router := gin.New()

	// Apply middleware
	router.Use(gin.Recovery())
	router.Use(middleware.Logger())
	router.Use(middleware.CORS(cfg.CORSAllowedOrigins))

	// Health check (no auth required)
	router.GET("/health", handlers.HealthCheck)

	// Initialize JWKS for JWT verification
	jwks, err := middleware.NewJWKS(cfg.SupabaseJWKSURL)
	if err != nil {
		log.Fatalf("Failed to initialize JWKS: %v", err)
	}
	defer jwks.Close()

	// API routes (auth required)
	api := router.Group("/api/v1")
	api.Use(middleware.Auth(jwks))
	{
		// Campaign routes
		api.GET("/campaigns", handlers.ListCampaigns(db))
		api.POST("/campaigns", handlers.CreateCampaign(db))
		api.GET("/campaigns/:id", handlers.GetCampaign(db))
		api.PUT("/campaigns/:id", handlers.UpdateCampaign(db))
		api.DELETE("/campaigns/:id", handlers.DeleteCampaign(db))

		// Additional routes added in later phases...
	}

	// Start server
	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
```

### Step 4: Create Configuration

**internal/config/config.go**:

```go
package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port               string
	Environment        string
	DatabaseURL        string
	SupabaseURL        string
	SupabasePublishableKey string   // Frontend key (safe for browser)
	SupabaseSecretKey      string   // Backend-only key (keep secret!)
	SupabaseJWKSURL        string   // JWKS URL for JWT verification
	CORSAllowedOrigins []string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:               getEnv("PORT", "8080"),
		Environment:        getEnv("GIN_MODE", "debug"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		SupabaseURL:        os.Getenv("SUPABASE_URL"),
		// Support both new and legacy key names
		SupabasePublishableKey: getEnvWithFallback("SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"),
		SupabaseSecretKey:      getEnvWithFallback("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
		SupabaseJWKSURL:        os.Getenv("SUPABASE_JWKS_URL"),
		CORSAllowedOrigins: strings.Split(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173"), ","),
	}

	// Validate required fields
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	if cfg.SupabaseJWKSURL == "" {
		return nil, fmt.Errorf("SUPABASE_JWKS_URL is required")
	}

	return cfg, nil
}

// getEnvWithFallback tries the primary key first, then falls back to the legacy key
func getEnvWithFallback(primary, fallback string) string {
	if value := os.Getenv(primary); value != "" {
		return value
	}
	return os.Getenv(fallback)
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
```

### Step 5: Create Database Connection

**internal/database/db.go**:

```go
package database

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DB struct {
	Pool *pgxpool.Pool
}

func Connect(databaseURL string) (*DB, error) {
	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("unable to ping database: %w", err)
	}

	return &DB{Pool: pool}, nil
}

func (db *DB) Close() {
	db.Pool.Close()
}
```

### Step 6: Create Health Check Handler

**internal/handlers/health.go**:

```go
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type HealthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, HealthResponse{
		Status:  "healthy",
		Version: "1.0.0",
	})
}
```

### Step 7: Create Middleware

**internal/middleware/cors.go**:

```go
package middleware

import (
	"github.com/gin-gonic/gin"
)

func CORS(allowedOrigins []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")

		// Check if origin is allowed
		allowed := false
		for _, o := range allowedOrigins {
			if o == origin || o == "*" {
				allowed = true
				break
			}
		}

		if allowed {
			c.Header("Access-Control-Allow-Origin", origin)
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")
		c.Header("Access-Control-Allow-Credentials", "true")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
```

**internal/middleware/logging.go**:

```go
package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		log.Printf("[%d] %s %s %v", status, c.Request.Method, path, latency)
	}
}
```

### Step 8: Create sqlc Configuration

**db/sqlc.yaml**:

```yaml
version: "2"
sql:
  - engine: "postgresql"
    queries: "queries/"
    schema: "migrations/"
    gen:
      go:
        package: "generated"
        out: "../internal/database/generated"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_prepared_queries: false
        emit_interface: true
        emit_exact_table_names: false
```

### Step 9: Create Makefile

**Makefile**:

```makefile
.PHONY: build run test lint sqlc migrate

# Build the application
build:
	go build -o bin/server ./cmd/server

# Run the application
run:
	go run ./cmd/server

# Run tests
test:
	go test -v ./...

# Run linter
lint:
	golangci-lint run

# Generate sqlc code
sqlc:
	cd db && sqlc generate

# Run migrations (using Supabase CLI)
migrate:
	supabase db push

# Install development tools
tools:
	go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
```

---

## Error Handling

**internal/models/errors.go**:

```go
package models

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type APIError struct {
	Code      string    `json:"code"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	RequestID string    `json:"requestId,omitempty"`
}

func NewAPIError(code, message string) *APIError {
	return &APIError{
		Code:      code,
		Message:   message,
		Timestamp: time.Now().UTC(),
	}
}

// Common error codes
const (
	ErrCodeValidation     = "VALIDATION_ERROR"
	ErrCodeUnauthorized   = "UNAUTHORIZED"
	ErrCodeForbidden      = "FORBIDDEN"
	ErrCodeNotFound       = "NOT_FOUND"
	ErrCodeConflict       = "CONFLICT"
	ErrCodeInternal       = "INTERNAL_ERROR"
	ErrCodeRateLimited    = "RATE_LIMITED"
)

// Helper functions for handlers
func RespondError(c *gin.Context, status int, err *APIError) {
	err.RequestID = c.GetString("requestId")
	c.JSON(status, err)
}

func ValidationError(c *gin.Context, message string) {
	RespondError(c, http.StatusBadRequest, NewAPIError(ErrCodeValidation, message))
}

func UnauthorizedError(c *gin.Context) {
	RespondError(c, http.StatusUnauthorized, NewAPIError(ErrCodeUnauthorized, "Authentication required"))
}

func ForbiddenError(c *gin.Context) {
	RespondError(c, http.StatusForbidden, NewAPIError(ErrCodeForbidden, "Access denied"))
}

func NotFoundError(c *gin.Context, resource string) {
	RespondError(c, http.StatusNotFound, NewAPIError(ErrCodeNotFound, fmt.Sprintf("%s not found", resource)))
}

func InternalError(c *gin.Context) {
	RespondError(c, http.StatusInternalServerError, NewAPIError(ErrCodeInternal, "An internal error occurred"))
}
```

---

## Environment Variables

The backend uses the shared `.env` file at the repository root. See [manual_setup.md](../manual_setup.md) for the complete environment variable reference.

Key backend variables:

```env
# Server
PORT=8080
GIN_MODE=debug                    # Use "release" in production

# Supabase (shared with frontend)
SUPABASE_URL=https://[PROJECT_REF].supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...       # Safe for browser
SUPABASE_SECRET_KEY=sb_secret_...                 # Backend only - keep secret!
SUPABASE_JWKS_URL=https://[PROJECT_REF].supabase.co/auth/v1/.well-known/jwks.json

# Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

> **Note**: The config supports both new key names (`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) and legacy names (`SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) for backward compatibility.

**Note**: The `.env` file is at the repository root, not in `services/backend/`.

---

## Testing

### Health Check Test

**internal/handlers/health_test.go**:

```go
package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/vanguard-pbp/backend/internal/handlers"
)

func TestHealthCheck(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/health", handlers.HealthCheck)

	req, _ := http.NewRequest("GET", "/health", nil)
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.Code)
	}

	var body handlers.HealthResponse
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Errorf("Failed to parse response: %v", err)
	}

	if body.Status != "healthy" {
		t.Errorf("Expected status 'healthy', got '%s'", body.Status)
	}
}
```

---

## Verification

After completing this sub-phase:

```bash
# Start the server (from repository root)
cd services/backend
go run ./cmd/server

# Or from repository root:
go run ./services/backend/cmd/server

# Test health check
curl http://localhost:8080/health
# Expected: {"status":"healthy","version":"1.0.0"}
```

---

## Edge Cases

1. **Missing environment variables**: Server fails fast with clear error message
2. **Database connection failure**: Retry with exponential backoff (implement in Phase 10)
3. **JWKS endpoint unreachable**: Auth middleware initialization fails with clear error
4. **Key rotation**: JWKS automatically refreshes keys hourly, handles rotation gracefully

---

## Next Step

Proceed to [02-react-frontend.md](./02-react-frontend.md) to set up the frontend.
