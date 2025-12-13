# 2.2 Backend JWT Middleware

**Skill**: `go-api-server`

**Goal**: Implement JWT validation middleware for protected API routes using JWKS (JSON Web Key Set).

---

## Overview

The backend validates JWTs issued by Supabase Auth using JWKS-based asymmetric verification to:
- Authenticate API requests securely
- Extract user ID for authorization
- Reject expired or invalid tokens
- Automatically handle key rotation

> **Why JWKS?** Supabase now uses asymmetric keys (RS256) for JWT signing. JWKS provides automatic key rotation support and is more secure than shared secrets.

---

## PRD References

From [technical.md](../../prd/technical.md):
- Go backend with Gin framework
- JWT validation from Supabase Auth

---

## Implementation

### Step 1: Install Dependencies

```bash
go get github.com/MicahParks/keyfunc/v2
go get github.com/golang-jwt/jwt/v5
```

### Step 2: JWKS Manager

Create **services/backend/internal/middleware/jwks.go**:

```go
package middleware

import (
	"time"

	"github.com/MicahParks/keyfunc/v2"
)

// JWKS holds the cached JSON Web Key Set for JWT validation
type JWKS struct {
	keyFunc *keyfunc.JWKS
}

// NewJWKS creates a new JWKS validator from a Supabase JWKS URL
// URL format: https://[PROJECT_REF].supabase.co/auth/v1/.well-known/jwks.json
func NewJWKS(jwksURL string) (*JWKS, error) {
	kf, err := keyfunc.Get(jwksURL, keyfunc.Options{
		// Refresh keys every hour
		RefreshInterval: time.Hour,
		// Rate limit refresh attempts to every 5 minutes
		RefreshRateLimit: time.Minute * 5,
		// Timeout for fetching keys
		RefreshTimeout: time.Second * 10,
		// Refresh if an unknown key ID is encountered
		RefreshUnknownKID: true,
	})
	if err != nil {
		return nil, err
	}
	return &JWKS{keyFunc: kf}, nil
}

// Keyfunc returns the jwt.Keyfunc for token validation
func (j *JWKS) Keyfunc() jwt.Keyfunc {
	return j.keyFunc.Keyfunc
}

// Close shuts down the JWKS background refresh goroutine
func (j *JWKS) Close() {
	j.keyFunc.EndBackground()
}
```

### Step 3: JWT Validation Middleware

Create **services/backend/internal/middleware/auth.go**:

```go
package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// ContextKey type for context values
type ContextKey string

const (
	// UserIDKey is the context key for the authenticated user's ID
	UserIDKey ContextKey = "userId"
	// UserEmailKey is the context key for the authenticated user's email
	UserEmailKey ContextKey = "userEmail"
)

// Claims represents the JWT claims from Supabase Auth
type Claims struct {
	jwt.RegisteredClaims
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Phone         string `json:"phone"`
	AppMetadata   struct {
		Provider  string   `json:"provider"`
		Providers []string `json:"providers"`
	} `json:"app_metadata"`
	UserMetadata map[string]interface{} `json:"user_metadata"`
	Role         string                 `json:"role"`
}

// Auth creates a JWT authentication middleware using JWKS
func Auth(jwks *JWKS) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":    "UNAUTHORIZED",
				"message": "Authorization header required",
			})
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":    "UNAUTHORIZED",
				"message": "Invalid authorization format. Use: Bearer <token>",
			})
			return
		}

		tokenString := parts[1]

		// Parse and validate token using JWKS
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, jwks.Keyfunc())
		if err != nil {
			handleTokenError(c, err)
			return
		}

		claims, ok := token.Claims.(*Claims)
		if !ok || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":    "UNAUTHORIZED",
				"message": "Invalid token claims",
			})
			return
		}

		// Store user info in context
		c.Set(string(UserIDKey), claims.Subject)
		c.Set(string(UserEmailKey), claims.Email)

		c.Next()
	}
}

// handleTokenError sends appropriate error response for token validation failures
func handleTokenError(c *gin.Context, err error) {
	var code, message string

	switch {
	case errors.Is(err, jwt.ErrTokenExpired):
		code = "TOKEN_EXPIRED"
		message = "Token has expired"
	case errors.Is(err, jwt.ErrTokenNotValidYet):
		code = "TOKEN_NOT_VALID"
		message = "Token is not valid yet"
	case errors.Is(err, jwt.ErrTokenMalformed):
		code = "TOKEN_MALFORMED"
		message = "Token is malformed"
	case errors.Is(err, jwt.ErrTokenSignatureInvalid):
		code = "TOKEN_SIGNATURE_INVALID"
		message = "Token signature is invalid"
	default:
		code = "UNAUTHORIZED"
		message = "Invalid token"
	}

	c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
		"code":    code,
		"message": message,
	})
}

// GetUserID extracts the user ID from the Gin context
func GetUserID(c *gin.Context) (string, bool) {
	userID, exists := c.Get(string(UserIDKey))
	if !exists {
		return "", false
	}
	return userID.(string), true
}

// GetUserEmail extracts the user email from the Gin context
func GetUserEmail(c *gin.Context) (string, bool) {
	email, exists := c.Get(string(UserEmailKey))
	if !exists {
		return "", false
	}
	return email.(string), true
}

// RequireAuth is a helper that returns 401 if user is not authenticated
func RequireAuth(c *gin.Context) (string, bool) {
	userID, ok := GetUserID(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"code":    "UNAUTHORIZED",
			"message": "Authentication required",
		})
		return "", false
	}
	return userID, true
}
```

### Step 4: Optional Auth Middleware

For routes that work with or without auth (e.g., public campaign info):

```go
// OptionalAuth validates JWT if present but doesn't require it
func OptionalAuth(jwks *JWKS) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			c.Next()
			return
		}

		tokenString := parts[1]

		// Parse and validate token using JWKS
		token, err := jwt.ParseWithClaims(tokenString, &Claims{}, jwks.Keyfunc())
		if err != nil {
			// Don't abort, just don't set user context
			c.Next()
			return
		}

		claims, ok := token.Claims.(*Claims)
		if !ok || !token.Valid {
			c.Next()
			return
		}

		c.Set(string(UserIDKey), claims.Subject)
		c.Set(string(UserEmailKey), claims.Email)
		c.Next()
	}
}
```

### Step 5: Apply Middleware to Routes

Update **services/backend/cmd/server/main.go**:

```go
func setupRoutes(router *gin.Engine, cfg *config.Config, db *database.DB) {
	// Public routes (no auth)
	router.GET("/health", handlers.HealthCheck)

	// Initialize JWKS for JWT verification
	jwks, err := middleware.NewJWKS(cfg.SupabaseJWKSURL)
	if err != nil {
		log.Fatalf("Failed to initialize JWKS: %v", err)
	}
	// Note: In production, call jwks.Close() on shutdown

	// API v1 routes
	api := router.Group("/api/v1")

	// Public API routes (optional auth)
	publicAPI := api.Group("")
	publicAPI.Use(middleware.OptionalAuth(jwks))
	{
		// Invite link lookup (before joining)
		publicAPI.GET("/invites/:code", handlers.GetInviteLink(db))
	}

	// Protected API routes (auth required)
	protected := api.Group("")
	protected.Use(middleware.Auth(jwks))
	{
		// User routes
		protected.GET("/me", handlers.GetCurrentUser(db))

		// Campaign routes
		protected.GET("/campaigns", handlers.ListCampaigns(db))
		protected.POST("/campaigns", handlers.CreateCampaign(db))
		protected.GET("/campaigns/:id", handlers.GetCampaign(db))
		protected.PUT("/campaigns/:id", handlers.UpdateCampaign(db))
		protected.DELETE("/campaigns/:id", handlers.DeleteCampaign(db))

		// Join via invite
		protected.POST("/invites/:code/join", handlers.JoinCampaign(db))

		// More routes added in later phases...
	}
}
```

### Step 6: Handler Using Auth Context

Example handler using authenticated user:

```go
package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/vanguard-pbp/services/backend/internal/database"
	"github.com/yourusername/vanguard-pbp/services/backend/internal/middleware"
)

type CurrentUserResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

func GetCurrentUser(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := middleware.RequireAuth(c)
		if !ok {
			return // RequireAuth already sent error response
		}

		email, _ := middleware.GetUserEmail(c)

		c.JSON(http.StatusOK, CurrentUserResponse{
			ID:    userID,
			Email: email,
		})
	}
}
```

### Step 7: Service Layer with User Context

```go
package services

import (
	"context"
	"errors"

	"github.com/yourusername/vanguard-pbp/backend/internal/database"
)

var (
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
)

type CampaignService struct {
	db *database.DB
}

func NewCampaignService(db *database.DB) *CampaignService {
	return &CampaignService{db: db}
}

// ListCampaigns returns campaigns the user is a member of
func (s *CampaignService) ListCampaigns(ctx context.Context, userID string) ([]Campaign, error) {
	// Query campaigns where user is a member
	// Uses sqlc-generated function
	rows, err := s.db.Queries.ListUserCampaigns(ctx, userID)
	if err != nil {
		return nil, err
	}

	campaigns := make([]Campaign, len(rows))
	for i, row := range rows {
		campaigns[i] = mapCampaignFromDB(row)
	}

	return campaigns, nil
}

// GetCampaign returns a campaign if user is a member
func (s *CampaignService) GetCampaign(ctx context.Context, userID, campaignID string) (*Campaign, error) {
	// Check membership
	member, err := s.db.Queries.GetCampaignMember(ctx, database.GetCampaignMemberParams{
		CampaignID: campaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, ErrForbidden
	}

	campaign, err := s.db.Queries.GetCampaign(ctx, campaignID)
	if err != nil {
		return nil, err
	}

	return mapCampaignFromDBWithRole(campaign, member.Role), nil
}
```

---

## Testing

Testing JWKS-based authentication requires either:
1. A mock JWKS server for unit tests
2. Integration tests against Supabase

### Unit Tests with Mock JWKS

Create **services/backend/internal/middleware/auth_test.go**:

```go
package middleware_test

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/yourusername/vanguard-pbp/services/backend/internal/middleware"
)

var testPrivateKey *rsa.PrivateKey
var testKeyID = "test-key-id"

func init() {
	// Generate RSA key pair for testing
	var err error
	testPrivateKey, err = rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		panic(err)
	}
}

// createMockJWKSServer creates a test server that serves a JWKS endpoint
func createMockJWKSServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Serve a minimal JWKS with our test public key
		jwks := map[string]interface{}{
			"keys": []map[string]interface{}{
				{
					"kty": "RSA",
					"kid": testKeyID,
					"use": "sig",
					"alg": "RS256",
					"n":   base64URLEncode(testPrivateKey.PublicKey.N.Bytes()),
					"e":   base64URLEncode(big.NewInt(int64(testPrivateKey.PublicKey.E)).Bytes()),
				},
			},
		}
		json.NewEncoder(w).Encode(jwks)
	}))
}

func createTestToken(userID, email string, expiry time.Time) string {
	claims := &middleware.Claims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			ExpiresAt: jwt.NewNumericDate(expiry),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
		Email: email,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = testKeyID
	tokenString, _ := token.SignedString(testPrivateKey)
	return tokenString
}

func TestAuthMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Start mock JWKS server
	jwksServer := createMockJWKSServer()
	defer jwksServer.Close()

	// Initialize JWKS from mock server
	jwks, err := middleware.NewJWKS(jwksServer.URL)
	if err != nil {
		t.Fatalf("Failed to create JWKS: %v", err)
	}
	defer jwks.Close()

	tests := []struct {
		name           string
		authHeader     string
		expectedStatus int
	}{
		{
			name:           "No auth header",
			authHeader:     "",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Invalid format",
			authHeader:     "InvalidToken",
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Expired token",
			authHeader:     "Bearer " + createTestToken("user1", "test@example.com", time.Now().Add(-time.Hour)),
			expectedStatus: http.StatusUnauthorized,
		},
		{
			name:           "Valid token",
			authHeader:     "Bearer " + createTestToken("user1", "test@example.com", time.Now().Add(time.Hour)),
			expectedStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.Use(middleware.Auth(jwks))
			router.GET("/test", func(c *gin.Context) {
				c.Status(http.StatusOK)
			})

			req, _ := http.NewRequest("GET", "/test", nil)
			if tt.authHeader != "" {
				req.Header.Set("Authorization", tt.authHeader)
			}

			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			if resp.Code != tt.expectedStatus {
				t.Errorf("Expected status %d, got %d", tt.expectedStatus, resp.Code)
			}
		})
	}
}

func TestGetUserID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Start mock JWKS server
	jwksServer := createMockJWKSServer()
	defer jwksServer.Close()

	jwks, err := middleware.NewJWKS(jwksServer.URL)
	if err != nil {
		t.Fatalf("Failed to create JWKS: %v", err)
	}
	defer jwks.Close()

	router := gin.New()
	router.Use(middleware.Auth(jwks))
	router.GET("/test", func(c *gin.Context) {
		userID, ok := middleware.GetUserID(c)
		if !ok {
			c.Status(http.StatusUnauthorized)
			return
		}
		c.String(http.StatusOK, userID)
	})

	req, _ := http.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+createTestToken("user123", "test@example.com", time.Now().Add(time.Hour)))

	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", resp.Code)
	}

	if resp.Body.String() != "user123" {
		t.Errorf("Expected user ID 'user123', got '%s'", resp.Body.String())
	}
}

// Helper for base64 URL encoding (you'll need to import "encoding/base64" and "math/big")
func base64URLEncode(data []byte) string {
	return base64.RawURLEncoding.EncodeToString(data)
}
```

### Required Imports for Tests

```go
import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)
```

---

## Edge Cases

1. **Malformed JWT**: Return 401 with clear error message
2. **Expired token**: Return specific "TOKEN_EXPIRED" code so frontend can refresh
3. **Invalid signature**: JWKS validates against public key; invalid signatures rejected
4. **Unknown key ID**: JWKS auto-refreshes to fetch new keys
5. **JWKS endpoint down**: Cached keys used; fails if no cache available
6. **Key rotation**: JWKS automatically refreshes hourly; handles rotation gracefully
7. **Clock skew**: Allow small window (handled by jwt-go automatically)

---

## Security Considerations

1. **Always use HTTPS**: JWTs in transit must be encrypted
2. **Never log tokens**: Sensitive data
3. **Use JWKS for asymmetric verification**: More secure than shared secrets
4. **Check expiration**: Handled by jwt-go automatically
5. **Validate key ID (kid)**: JWKS library handles this automatically
6. **Refresh keys periodically**: JWKS library refreshes hourly by default

---

## Verification

```bash
# Get a valid token from Supabase (via frontend login or Supabase Auth API)
TOKEN="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ii4uLiJ9..."

# Test authenticated endpoint
curl -H "Authorization: Bearer $TOKEN" http://localhost:8080/api/v1/me

# Test without auth (should fail)
curl http://localhost:8080/api/v1/me
# Expected: {"code":"UNAUTHORIZED","message":"Authorization header required"}

# Verify JWKS endpoint is accessible
curl https://[PROJECT_REF].supabase.co/auth/v1/.well-known/jwks.json
# Should return JSON with "keys" array
```

---

## Next Step

Proceed to [03-frontend-auth.md](./03-frontend-auth.md) to implement frontend authentication UI.
