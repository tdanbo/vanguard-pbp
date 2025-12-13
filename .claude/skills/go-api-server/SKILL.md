---
name: go-api-server
description: Go/Gin REST API patterns for Vanguard PBP backend. Use this skill when implementing API handlers, service layer logic, sqlc database queries, middleware (auth/logging/CORS), request validation, or response formatting. Critical for endpoint development, database interactions, and API architecture.
---

# Go API Server

## Overview

This skill provides implementation patterns for the Vanguard PBP Go backend API server using Gin framework, sqlc for type-safe database queries, and Supabase for authentication. The architecture follows a layered design: HTTP Routes → Middleware → Handlers → Service Layer → Database (sqlc).

## Request Flow Architecture

Every API request flows through these layers in sequence:

```
┌─────────────────────────────────────────────────────────────┐
│  1. HTTP Route (Gin Router)                                 │
│     - Route matching (/api/campaigns/:id)                   │
│     - Method binding (GET, POST, PATCH, DELETE)             │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Middleware Chain                                         │
│     - CORS (allow frontend origin)                          │
│     - Auth (JWT validation via Supabase)                    │
│     - Rate Limiting (per-user, per-endpoint)                │
│     - Request Logging (structured logs with request ID)     │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Handler (Request Processing)                             │
│     - Parse/bind request body (JSON)                        │
│     - Validate input (character limits, UUIDs, etc.)        │
│     - Extract user context (from JWT)                       │
│     - Call service layer                                    │
│     - Format response (JSON)                                │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Service Layer (Business Logic)                           │
│     - Permission checks (GM-only, witness visibility)       │
│     - State validation (phase transitions, locks)           │
│     - Complex operations (witness transactions)             │
│     - Call database queries (sqlc)                          │
└─────────────────────┬───────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Database (sqlc Generated Queries)                        │
│     - Type-safe query execution                             │
│     - Transaction management                                │
│     - Row scanning to Go structs                            │
└─────────────────────────────────────────────────────────────┘
```

## Gin Router Patterns

### Route Organization

Routes are organized by resource in `internal/api/router.go`:

```go
package api

import (
    "github.com/gin-gonic/gin"
    "vanguard-pbp/internal/api/handlers"
    "vanguard-pbp/internal/api/middleware"
)

func SetupRouter(deps *handlers.Dependencies) *gin.Engine {
    r := gin.Default()

    // Middleware
    r.Use(middleware.CORS())
    r.Use(middleware.RequestLogger())

    // Public routes (no auth)
    r.POST("/api/auth/register", handlers.Register(deps))
    r.POST("/api/auth/login", handlers.Login(deps))

    // Protected routes (auth required)
    api := r.Group("/api")
    api.Use(middleware.Auth(deps.SupabaseClient))
    {
        // Campaigns
        campaigns := api.Group("/campaigns")
        {
            campaigns.GET("", handlers.ListCampaigns(deps))
            campaigns.POST("", middleware.RateLimit(5), handlers.CreateCampaign(deps))
            campaigns.GET("/:id", handlers.GetCampaign(deps))
            campaigns.PATCH("/:id", handlers.UpdateCampaign(deps))
            campaigns.DELETE("/:id", handlers.DeleteCampaign(deps))
            campaigns.POST("/:id/join", middleware.RateLimit(5), handlers.JoinCampaign(deps))
            campaigns.POST("/:id/transition", handlers.TransitionPhase(deps))
        }

        // Scenes
        scenes := api.Group("/scenes")
        {
            scenes.GET("/:id", handlers.GetScene(deps))
            scenes.PATCH("/:id", handlers.UpdateScene(deps))
            scenes.POST("/:id/posts", middleware.RateLimit(10), handlers.CreatePost(deps))
            scenes.POST("/:id/compose/acquire", middleware.RateLimit(12), handlers.AcquireComposeLock(deps))
            scenes.POST("/:id/compose/release", handlers.ReleaseComposeLock(deps))
        }

        // Posts
        posts := api.Group("/posts")
        {
            posts.PATCH("/:id", handlers.EditPost(deps))
            posts.DELETE("/:id", handlers.DeletePost(deps))
        }
    }

    return r
}
```

### Handler Dependencies Pattern

Inject dependencies via closure to keep handlers testable:

```go
type Dependencies struct {
    DB              *sql.DB
    Queries         *db.Queries  // sqlc generated
    SupabaseClient  *supabase.Client
    Config          *config.Config
}

// Handler factory pattern
func CreateCampaign(deps *Dependencies) gin.HandlerFunc {
    return func(c *gin.Context) {
        // Handler has access to all dependencies
        userID := c.GetString("user_id") // From auth middleware

        var req CreateCampaignRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(400, ErrorResponse("INVALID_INPUT", "Invalid request body"))
            return
        }

        campaign, err := deps.Queries.CreateCampaign(c.Request.Context(), db.CreateCampaignParams{
            Title:        req.Title,
            Description:  req.Description,
            OwnerID:      sql.NullString{String: userID, Valid: true},
            CurrentPhase: "gm_phase",
        })

        if err != nil {
            c.JSON(500, ErrorResponse("DATABASE_ERROR", "Failed to create campaign"))
            return
        }

        c.JSON(201, campaign)
    }
}
```

## Middleware Patterns

### Authentication Middleware

JWT validation using Supabase:

```go
package middleware

import (
    "strings"
    "github.com/gin-gonic/gin"
    "github.com/supabase-community/supabase-go"
)

func Auth(supabase *supabase.Client) gin.HandlerFunc {
    return func(c *gin.Context) {
        authHeader := c.GetHeader("Authorization")
        if authHeader == "" {
            c.JSON(401, gin.H{"error": "Missing authorization header"})
            c.Abort()
            return
        }

        // Extract Bearer token
        parts := strings.Split(authHeader, " ")
        if len(parts) != 2 || parts[0] != "Bearer" {
            c.JSON(401, gin.H{"error": "Invalid authorization format"})
            c.Abort()
            return
        }

        token := parts[1]

        // Validate JWT with Supabase
        user, err := supabase.Auth.GetUser(token)
        if err != nil {
            c.JSON(401, gin.H{"error": "Invalid or expired token"})
            c.Abort()
            return
        }

        // Store user context for downstream handlers
        c.Set("user_id", user.ID)
        c.Set("user_email", user.Email)
        c.Next()
    }
}
```

### Rate Limiting Middleware

Per-user rate limiting with token bucket algorithm:

```go
package middleware

import (
    "sync"
    "time"
    "github.com/gin-gonic/gin"
)

type rateLimiter struct {
    mu      sync.Mutex
    buckets map[string]*bucket
}

type bucket struct {
    tokens    int
    lastCheck time.Time
}

func RateLimit(requestsPerMinute int) gin.HandlerFunc {
    limiter := &rateLimiter{
        buckets: make(map[string]*bucket),
    }

    return func(c *gin.Context) {
        userID := c.GetString("user_id")

        limiter.mu.Lock()
        defer limiter.mu.Unlock()

        b, exists := limiter.buckets[userID]
        if !exists {
            b = &bucket{
                tokens:    requestsPerMinute,
                lastCheck: time.Now(),
            }
            limiter.buckets[userID] = b
        }

        // Refill tokens based on elapsed time
        now := time.Now()
        elapsed := now.Sub(b.lastCheck)
        tokensToAdd := int(elapsed.Minutes() * float64(requestsPerMinute))
        b.tokens = min(b.tokens+tokensToAdd, requestsPerMinute)
        b.lastCheck = now

        if b.tokens > 0 {
            b.tokens--
            c.Next()
        } else {
            c.JSON(429, gin.H{
                "error": gin.H{
                    "code":    "RATE_LIMIT_EXCEEDED",
                    "message": "You're submitting too fast. Please wait before trying again.",
                },
            })
            c.Abort()
        }
    }
}
```

### Request Logging Middleware

Structured logging with request IDs:

```go
package middleware

import (
    "time"
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "log/slog"
)

func RequestLogger() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Generate request ID
        requestID := uuid.New().String()
        c.Set("request_id", requestID)

        start := time.Now()
        path := c.Request.URL.Path

        // Process request
        c.Next()

        // Log after request completes
        duration := time.Since(start)
        statusCode := c.Writer.Status()

        slog.Info("request completed",
            "request_id", requestID,
            "method", c.Request.Method,
            "path", path,
            "status", statusCode,
            "duration_ms", duration.Milliseconds(),
            "user_id", c.GetString("user_id"),
        )
    }
}
```

### CORS Middleware

Allow frontend origin:

```go
package middleware

import (
    "github.com/gin-gonic/gin"
)

func CORS() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
        c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
        c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
        c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")

        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(204)
            return
        }

        c.Next()
    }
}
```

## Handler Patterns

### Request Validation

Input validation with clear error messages:

```go
type CreatePostRequest struct {
    CharacterID string      `json:"characterId" binding:"required,uuid"`
    Blocks      []PostBlock `json:"blocks" binding:"required,min=1"`
    OOCText     *string     `json:"oocText"`
    Witnesses   []string    `json:"witnesses" binding:"dive,uuid"`
}

type PostBlock struct {
    Type    string `json:"type" binding:"required,oneof=action dialog"`
    Content string `json:"content" binding:"required,min=1,max=10000"`
    Order   int    `json:"order" binding:"required,min=0"`
}

func CreatePost(deps *Dependencies) gin.HandlerFunc {
    return func(c *gin.Context) {
        sceneID := c.Param("id")
        userID := c.GetString("user_id")

        var req CreatePostRequest
        if err := c.ShouldBindJSON(&req); err != nil {
            c.JSON(400, ErrorResponse("INVALID_INPUT",
                "Your post needs valid content. Check that all fields are filled correctly."))
            return
        }

        // Character limit validation (from campaign settings)
        totalChars := 0
        for _, block := range req.Blocks {
            totalChars += len(block.Content)
        }

        campaign, _ := deps.Queries.GetCampaignBySceneID(c.Request.Context(), sceneID)
        if totalChars > int(campaign.Settings.CharacterLimit) {
            c.JSON(400, ErrorResponse("CHARACTER_LIMIT_EXCEEDED",
                fmt.Sprintf("Your post is too long. Maximum %d characters allowed.",
                    campaign.Settings.CharacterLimit)))
            return
        }

        // Delegate to service layer
        post, err := service.CreatePost(c.Request.Context(), deps.Queries, service.CreatePostParams{
            SceneID:     sceneID,
            UserID:      userID,
            CharacterID: req.CharacterID,
            Blocks:      req.Blocks,
            OOCText:     req.OOCText,
            Witnesses:   req.Witnesses,
        })

        if err != nil {
            // Service layer returns typed errors
            handleServiceError(c, err)
            return
        }

        c.JSON(201, post)
    }
}
```

### Response Formatting

Standardized error and success responses:

```go
type ErrorDetail struct {
    Code      string `json:"code"`
    Message   string `json:"message"`
    Timestamp string `json:"timestamp"`
    RequestID string `json:"requestId"`
}

type ErrorResponseBody struct {
    Error ErrorDetail `json:"error"`
}

func ErrorResponse(code, message string) ErrorResponseBody {
    return ErrorResponseBody{
        Error: ErrorDetail{
            Code:      code,
            Message:   message,
            Timestamp: time.Now().UTC().Format(time.RFC3339),
        },
    }
}

func handleServiceError(c *gin.Context, err error) {
    requestID := c.GetString("request_id")

    switch e := err.(type) {
    case *service.ValidationError:
        c.JSON(400, ErrorResponseBody{
            Error: ErrorDetail{
                Code:      e.Code,
                Message:   e.Message,
                Timestamp: time.Now().UTC().Format(time.RFC3339),
                RequestID: requestID,
            },
        })
    case *service.PermissionError:
        c.JSON(403, ErrorResponse(e.Code, e.Message))
    case *service.NotFoundError:
        c.JSON(404, ErrorResponse(e.Code, e.Message))
    default:
        slog.Error("unexpected error", "error", err, "request_id", requestID)
        c.JSON(500, ErrorResponse("INTERNAL_ERROR", "Something went wrong. Please try again."))
    }
}
```

### Context Extraction

Getting user data from middleware context:

```go
func GetCampaign(deps *Dependencies) gin.HandlerFunc {
    return func(c *gin.Context) {
        campaignID := c.Param("id")
        userID := c.GetString("user_id")  // Set by Auth middleware
        requestID := c.GetString("request_id")  // Set by Logger middleware

        // Verify user is member of campaign
        isMember, err := deps.Queries.IsCampaignMember(c.Request.Context(), db.IsCampaignMemberParams{
            CampaignID: campaignID,
            UserID:     userID,
        })

        if err != nil || !isMember {
            c.JSON(403, ErrorResponse("FORBIDDEN", "You don't have access to this campaign"))
            return
        }

        campaign, err := deps.Queries.GetCampaign(c.Request.Context(), campaignID)
        if err != nil {
            c.JSON(404, ErrorResponse("NOT_FOUND", "Campaign not found"))
            return
        }

        c.JSON(200, campaign)
    }
}
```

## Service Layer Architecture

### Service Responsibilities

The service layer contains business logic and orchestrates database queries:

```go
package service

import (
    "context"
    "database/sql"
    "vanguard-pbp/internal/db"
)

type CampaignService struct {
    queries *db.Queries
    db      *sql.DB
}

func NewCampaignService(queries *db.Queries, database *sql.DB) *CampaignService {
    return &CampaignService{
        queries: queries,
        db:      database,
    }
}

// TransitionPhase handles the complex witness transaction
func (s *CampaignService) TransitionPhase(ctx context.Context, campaignID string, userID string) error {
    // 1. Verify user is GM
    isGM, err := s.queries.IsUserGM(ctx, db.IsUserGMParams{
        CampaignID: campaignID,
        UserID:     userID,
    })
    if err != nil || !isGM {
        return &PermissionError{Code: "NOT_GM", Message: "Only the GM can transition phases"}
    }

    // 2. Get current campaign state
    campaign, err := s.queries.GetCampaign(ctx, campaignID)
    if err != nil {
        return err
    }

    // 3. Validate transition rules
    if campaign.CurrentPhase == "gm_phase" {
        // GM → PC: Check all rolls are resolved
        unresolvedRolls, err := s.queries.CountUnresolvedRolls(ctx, campaignID)
        if err != nil {
            return err
        }
        if unresolvedRolls > 0 {
            return &ValidationError{
                Code:    "UNRESOLVED_ROLLS",
                Message: "All rolls must be resolved before moving to PC Phase",
            }
        }
    }

    // 4. Execute transition in transaction
    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    qtx := s.queries.WithTx(tx)

    if campaign.CurrentPhase == "gm_phase" {
        // Witness transaction: assign witnesses to all GM phase posts
        if err := s.executeWitnessTransaction(ctx, qtx, campaignID); err != nil {
            return err
        }
    }

    // Update phase
    newPhase := "pc_phase"
    if campaign.CurrentPhase == "pc_phase" {
        newPhase = "gm_phase"
    }

    err = qtx.UpdateCampaignPhase(ctx, db.UpdateCampaignPhaseParams{
        ID:           campaignID,
        CurrentPhase: newPhase,
    })
    if err != nil {
        return err
    }

    return tx.Commit()
}

func (s *CampaignService) executeWitnessTransaction(ctx context.Context, qtx *db.Queries, campaignID string) error {
    // Get all scenes in campaign
    scenes, err := qtx.ListScenesByCampaign(ctx, campaignID)
    if err != nil {
        return err
    }

    // For each scene, update posts with current character witnesses
    for _, scene := range scenes {
        // Get current characters in scene
        witnesses := scene.Characters  // Already a []string

        // Update all posts with empty witnesses
        err = qtx.UpdatePostWitnesses(ctx, db.UpdatePostWitnessesParams{
            SceneID:   scene.ID,
            Witnesses: witnesses,
        })
        if err != nil {
            return err
        }
    }

    return nil
}
```

### Custom Error Types

Define typed errors for clear error handling:

```go
package service

type ValidationError struct {
    Code    string
    Message string
}

func (e *ValidationError) Error() string {
    return e.Message
}

type PermissionError struct {
    Code    string
    Message string
}

func (e *PermissionError) Error() string {
    return e.Message
}

type NotFoundError struct {
    Code    string
    Message string
}

func (e *NotFoundError) Error() string {
    return e.Message
}
```

## sqlc Query Patterns

### Query File Organization

SQL queries are organized by resource in `internal/db/queries/`:

```
internal/db/queries/
├── campaigns.sql
├── scenes.sql
├── posts.sql
├── characters.sql
├── rolls.sql
└── users.sql
```

### Basic Queries

Example queries in `campaigns.sql`:

```sql
-- name: GetCampaign :one
SELECT * FROM campaigns
WHERE id = $1;

-- name: ListUserCampaigns :many
SELECT c.* FROM campaigns c
INNER JOIN campaign_members cm ON c.id = cm.campaign_id
WHERE cm.user_id = $1
ORDER BY c.updated_at DESC;

-- name: CreateCampaign :one
INSERT INTO campaigns (
    id, title, description, owner_id, current_phase, settings
) VALUES (
    gen_random_uuid(), $1, $2, $3, 'gm_phase', $4
)
RETURNING *;

-- name: UpdateCampaignPhase :exec
UPDATE campaigns
SET current_phase = $2,
    current_phase_expires_at = $3,
    updated_at = now()
WHERE id = $1;

-- name: IsUserGM :one
SELECT EXISTS(
    SELECT 1 FROM campaign_members
    WHERE campaign_id = $1 AND user_id = $2 AND role = 'gm'
) AS is_gm;
```

### Complex Queries with Joins

Example witness visibility filtering:

```sql
-- name: GetWitnessedPosts :many
SELECT p.* FROM posts p
WHERE p.scene_id = $1
  AND p.submitted = true
  AND (
    -- User is GM (sees everything)
    EXISTS(
        SELECT 1 FROM scenes s
        INNER JOIN campaigns c ON s.campaign_id = c.id
        INNER JOIN campaign_members cm ON c.id = cm.campaign_id
        WHERE s.id = $1 AND cm.user_id = $2 AND cm.role = 'gm'
    )
    OR
    -- User's character witnessed the post
    EXISTS(
        SELECT 1 FROM unnest(p.witnesses) AS witness_id
        INNER JOIN character_assignments ca ON witness_id = ca.character_id
        WHERE ca.user_id = $2
    )
  )
ORDER BY p.created_at ASC;
```

### Transaction Support

Using sqlc with transactions:

```go
// Generated by sqlc
type DBTX interface {
    ExecContext(context.Context, string, ...interface{}) (sql.Result, error)
    PrepareContext(context.Context, string) (*sql.Stmt, error)
    QueryContext(context.Context, string, ...interface{}) (*sql.Rows, error)
    QueryRowContext(context.Context, string, ...interface{}) *sql.Row
}

type Queries struct {
    db DBTX
}

func (q *Queries) WithTx(tx *sql.Tx) *Queries {
    return &Queries{
        db: tx,
    }
}

// Usage in service layer
tx, err := s.db.BeginTx(ctx, nil)
if err != nil {
    return err
}
defer tx.Rollback()

qtx := s.queries.WithTx(tx)

// Execute multiple queries in transaction
err = qtx.CreatePost(ctx, params)
err = qtx.LockPreviousPost(ctx, sceneID)

return tx.Commit()
```

### JSON Column Handling

Working with JSONB columns (campaign settings):

```sql
-- name: UpdateCampaignSettings :exec
UPDATE campaigns
SET settings = $2,
    updated_at = now()
WHERE id = $1;

-- name: GetCampaignTimeGate :one
SELECT (settings->>'timeGatePreset')::text AS time_gate_preset
FROM campaigns
WHERE id = $1;
```

```go
// Go struct for JSON unmarshaling
type CampaignSettings struct {
    TimeGatePreset      string       `json:"timeGatePreset"`
    FogOfWar            bool         `json:"fogOfWar"`
    HiddenPosts         bool         `json:"hiddenPosts"`
    OOCVisibility       string       `json:"oocVisibility"`
    CharacterLimit      int          `json:"characterLimit"`
    RollRequestTimeout  int          `json:"rollRequestTimeoutHours"`
    SystemPreset        SystemPreset `json:"systemPreset"`
}

// sqlc will generate this
type Campaign struct {
    ID           string
    Title        string
    Settings     json.RawMessage  // or pgtype.JSON
    // ...
}

// Unmarshal in handler/service
var settings CampaignSettings
json.Unmarshal(campaign.Settings, &settings)
```

## Project Structure Conventions

```
backend/
├── cmd/
│   └── server/
│       └── main.go               # Entry point: setup router, start server
├── internal/
│   ├── api/
│   │   ├── router.go             # Route definitions
│   │   ├── middleware/
│   │   │   ├── auth.go           # JWT validation
│   │   │   ├── cors.go           # CORS headers
│   │   │   ├── ratelimit.go      # Per-user rate limiting
│   │   │   └── logger.go         # Request logging
│   │   └── handlers/
│   │       ├── campaigns.go      # Campaign CRUD
│   │       ├── scenes.go         # Scene management
│   │       ├── posts.go          # Post creation/editing
│   │       ├── rolls.go          # Dice rolls
│   │       ├── characters.go     # Character management
│   │       └── users.go          # User settings
│   ├── service/
│   │   ├── campaign.go           # Campaign business logic
│   │   ├── scene.go              # Scene operations
│   │   ├── post.go               # Post validation/locking
│   │   ├── roll.go               # Dice rolling logic
│   │   ├── notification.go       # Notification dispatch
│   │   └── errors.go             # Custom error types
│   ├── db/
│   │   ├── queries/              # SQL files for sqlc
│   │   │   ├── campaigns.sql
│   │   │   ├── scenes.sql
│   │   │   ├── posts.sql
│   │   │   ├── characters.sql
│   │   │   └── rolls.sql
│   │   └── generated/            # sqlc output (DO NOT EDIT)
│   │       ├── db.go
│   │       ├── models.go
│   │       └── *.sql.go
│   └── config/
│       └── config.go             # Env var loading
├── migrations/
│   └── *.sql                     # Supabase migrations
├── go.mod
├── go.sum
└── sqlc.yaml                     # sqlc configuration
```

## Common Implementation Patterns

### Pattern 1: Creating a New Endpoint

1. **Define the route** in `internal/api/router.go`
2. **Create the handler** in `internal/api/handlers/`
3. **Add service logic** in `internal/service/`
4. **Write SQL queries** in `internal/db/queries/`
5. **Run sqlc generate** to create type-safe functions

### Pattern 2: Adding Middleware

1. Create middleware function in `internal/api/middleware/`
2. Return `gin.HandlerFunc`
3. Add to router globally or per-route group

### Pattern 3: Complex Transaction

1. Start transaction in service layer
2. Use `queries.WithTx(tx)` for transactional queries
3. Execute all operations
4. Commit or rollback based on errors

### Pattern 4: Permission Checking

1. Extract user_id from context (set by Auth middleware)
2. Query membership/role via sqlc
3. Return PermissionError if unauthorized
4. Proceed with operation if authorized

### Pattern 5: Input Validation

1. Define request struct with binding tags
2. Use `c.ShouldBindJSON()` to parse and validate
3. Add custom business logic validation
4. Return clear error messages on failure

## Testing Patterns

### Handler Testing

```go
func TestCreateCampaign(t *testing.T) {
    // Setup test database
    db := setupTestDB(t)
    defer db.Close()

    queries := db.New(db)
    deps := &handlers.Dependencies{
        DB:      db,
        Queries: queries,
    }

    // Create test router
    r := gin.Default()
    r.POST("/campaigns", handlers.CreateCampaign(deps))

    // Make request
    body := `{"title": "Test Campaign", "description": "Test"}`
    req := httptest.NewRequest("POST", "/campaigns", strings.NewReader(body))
    req.Header.Set("Content-Type", "application/json")

    w := httptest.NewRecorder()
    r.ServeHTTP(w, req)

    // Assert response
    assert.Equal(t, 201, w.Code)
}
```

### Service Testing

```go
func TestTransitionPhase(t *testing.T) {
    ctx := context.Background()
    db := setupTestDB(t)
    defer db.Close()

    queries := db.New(db)
    service := service.NewCampaignService(queries, db)

    // Setup: Create campaign and GM user
    campaign := createTestCampaign(t, queries)
    gmUser := createTestUser(t, queries)

    // Execute
    err := service.TransitionPhase(ctx, campaign.ID, gmUser.ID)

    // Assert
    assert.NoError(t, err)

    updated, _ := queries.GetCampaign(ctx, campaign.ID)
    assert.Equal(t, "pc_phase", updated.CurrentPhase)
}
```

## Error Handling Best Practices

1. **Service layer returns typed errors** (ValidationError, PermissionError, NotFoundError)
2. **Handlers map errors to HTTP status codes** (400, 403, 404, 500)
3. **Always include user-friendly messages** ("Your post is too long" not "Character limit exceeded")
4. **Log unexpected errors with request ID** for debugging
5. **Never expose internal details** in error responses

## Configuration Management

```go
package config

import (
    "os"
)

type Config struct {
    DatabaseURL      string
    SupabaseURL      string
    SupabaseKey      string
    Port             string
    FrontendURL      string
    ResendAPIKey     string
}

func Load() *Config {
    return &Config{
        DatabaseURL:  os.Getenv("DATABASE_URL"),
        SupabaseURL:  os.Getenv("SUPABASE_URL"),
        SupabaseKey:  os.Getenv("SUPABASE_SERVICE_KEY"),
        Port:         getEnvOrDefault("PORT", "8080"),
        FrontendURL:  getEnvOrDefault("FRONTEND_URL", "http://localhost:5173"),
        ResendAPIKey: os.Getenv("RESEND_API_KEY"),
    }
}

func getEnvOrDefault(key, defaultVal string) string {
    if val := os.Getenv(key); val != "" {
        return val
    }
    return defaultVal
}
```

## Main Entry Point

```go
package main

import (
    "database/sql"
    "log"
    "vanguard-pbp/internal/api"
    "vanguard-pbp/internal/api/handlers"
    "vanguard-pbp/internal/config"
    "vanguard-pbp/internal/db"

    _ "github.com/lib/pq"
    "github.com/supabase-community/supabase-go"
)

func main() {
    // Load config
    cfg := config.Load()

    // Connect to database
    database, err := sql.Open("postgres", cfg.DatabaseURL)
    if err != nil {
        log.Fatal("Failed to connect to database:", err)
    }
    defer database.Close()

    // Initialize sqlc queries
    queries := db.New(database)

    // Initialize Supabase client
    supabaseClient, err := supabase.NewClient(cfg.SupabaseURL, cfg.SupabaseKey, nil)
    if err != nil {
        log.Fatal("Failed to create Supabase client:", err)
    }

    // Setup dependencies
    deps := &handlers.Dependencies{
        DB:             database,
        Queries:        queries,
        SupabaseClient: supabaseClient,
        Config:         cfg,
    }

    // Setup router
    router := api.SetupRouter(deps)

    // Start server
    log.Printf("Server starting on port %s", cfg.Port)
    if err := router.Run(":" + cfg.Port); err != nil {
        log.Fatal("Failed to start server:", err)
    }
}
```
