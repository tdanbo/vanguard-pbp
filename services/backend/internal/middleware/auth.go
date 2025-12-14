package middleware

import (
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc/v2"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const (
	jwksRefreshRateLimitMinutes = 5
	jwksRefreshTimeoutSeconds   = 10
	bearerTokenParts            = 2

	// UserIDKey is the context key for the authenticated user's ID.
	UserIDKey = "user_id"
	// UserEmailKey is the context key for the authenticated user's email.
	UserEmailKey = "user_email"
)

// JWTValidator handles JWT validation using either JWKS or a symmetric secret.
// For local Supabase development, use HS256 with the JWT secret.
// For production Supabase, use JWKS (RS256/ES256).
type JWTValidator struct {
	jwks      *keyfunc.JWKS
	jwtSecret []byte
	useSecret bool
}

// NewJWTValidator creates a validator that tries JWKS first, falls back to secret.
// If jwksURL is empty or JWKS returns no keys, it will use the jwtSecret with HS256.
func NewJWTValidator(jwksURL, jwtSecret string) (*JWTValidator, error) {
	//nolint:exhaustruct // Fields are set conditionally below
	validator := &JWTValidator{}

	// If we have a JWT secret, we can use it as a fallback or primary method
	if jwtSecret != "" {
		validator.jwtSecret = []byte(jwtSecret)
	}

	// Try to initialize JWKS if URL is provided
	if jwksURL != "" {
		//nolint:exhaustruct // keyfunc.Options has many optional fields
		kf, err := keyfunc.Get(jwksURL, keyfunc.Options{
			RefreshInterval:   time.Hour,
			RefreshRateLimit:  time.Minute * jwksRefreshRateLimitMinutes,
			RefreshTimeout:    time.Second * jwksRefreshTimeoutSeconds,
			RefreshUnknownKID: true,
		})
		if err != nil {
			//nolint:sloglint // Using global logger during initialization is acceptable
			slog.Warn("JWKS initialization failed, will use JWT secret if available", "error", err)
		} else {
			validator.jwks = kf
		}
	}

	// Determine which method to use
	switch {
	case validator.jwks != nil:
		// Check if JWKS has keys (for local Supabase, it returns empty keys)
		// We'll determine this at validation time since keys might be loaded lazily
		validator.useSecret = false
	case len(validator.jwtSecret) > 0:
		validator.useSecret = true
		//nolint:sloglint // Using global logger during initialization is acceptable
		slog.Info("Using JWT secret for token validation (HS256)")
	default:
		return nil, errors.New("no JWT validation method available: provide either JWKS URL or JWT secret")
	}

	return validator, nil
}

// Close shuts down the JWKS background refresh if active.
func (v *JWTValidator) Close() {
	if v.jwks != nil {
		v.jwks.EndBackground()
	}
}

// Keyfunc returns the appropriate key function for JWT parsing.
func (v *JWTValidator) Keyfunc(token *jwt.Token) (interface{}, error) {
	// If using secret (HS256)
	if v.useSecret || v.jwks == nil {
		// Verify the signing method is HMAC
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method, expected HS256")
		}
		return v.jwtSecret, nil
	}

	// Try JWKS first
	key, err := v.jwks.Keyfunc(token)
	if err != nil {
		// If JWKS fails and we have a secret, try HS256
		if len(v.jwtSecret) > 0 {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); ok {
				//nolint:sloglint // Using global logger is acceptable in key function
				slog.Warn("JWKS validation failed, falling back to JWT secret", "error", err)
				return v.jwtSecret, nil
			}
		}
		return nil, err
	}
	return key, nil
}

// JWKS holds the cached JSON Web Key Set for JWT validation.
// Deprecated: Use JWTValidator instead for better local dev support.
type JWKS struct {
	keyFunc *keyfunc.JWKS
}

// NewJWKS creates a new JWKS validator from a Supabase JWKS URL.
// JWKS URL format: https://[PROJECT_REF].supabase.co/auth/v1/.well-known/jwks.json
// Deprecated: Use NewJWTValidator instead for better local dev support.
func NewJWKS(jwksURL string) (*JWKS, error) {
	//nolint:exhaustruct // keyfunc.Options has many optional fields
	kf, err := keyfunc.Get(jwksURL, keyfunc.Options{
		RefreshInterval:   time.Hour,
		RefreshRateLimit:  time.Minute * jwksRefreshRateLimitMinutes,
		RefreshTimeout:    time.Second * jwksRefreshTimeoutSeconds,
		RefreshUnknownKID: true,
	})
	if err != nil {
		return nil, err
	}
	return &JWKS{keyFunc: kf}, nil
}

// Close shuts down the JWKS background refresh.
func (j *JWKS) Close() {
	j.keyFunc.EndBackground()
}

// Claims represents the JWT claims from Supabase Auth.
type Claims struct {
	jwt.RegisteredClaims

	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Role          string `json:"role"`
}

// Auth validates JWTs using JWTValidator. Returns 401 if no valid token.
// This version supports both JWKS (production) and HS256 secret (local dev).
func Auth(validator *JWTValidator) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			abortWithAuthError(c, "MISSING_AUTH", "Authorization header required")
			return
		}

		// Extract Bearer token
		parts := strings.SplitN(authHeader, " ", bearerTokenParts)
		if len(parts) != bearerTokenParts || !strings.EqualFold(parts[0], "bearer") {
			abortWithAuthError(c, "INVALID_AUTH_FORMAT", "Invalid authorization format. Use: Bearer <token>")
			return
		}

		tokenString := parts[1]

		// Parse and validate JWT using the validator
		token, err := jwt.ParseWithClaims(tokenString, new(Claims), validator.Keyfunc)
		if err != nil {
			handleTokenError(c, err)
			return
		}

		claims, ok := token.Claims.(*Claims)
		if !ok || !token.Valid {
			abortWithAuthError(c, "INVALID_CLAIMS", "Invalid token claims")
			return
		}

		// Add user context for downstream handlers
		// Subject contains the user UUID from Supabase Auth
		c.Set(UserIDKey, claims.Subject)
		c.Set(UserEmailKey, claims.Email)
		c.Next()
	}
}

// AuthWithJWKS validates JWTs using JWKS only. Returns 401 if no valid token.
// Deprecated: Use Auth with JWTValidator instead for better local dev support.
func AuthWithJWKS(jwks *JWKS) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			abortWithAuthError(c, "MISSING_AUTH", "Authorization header required")
			return
		}

		// Extract Bearer token
		parts := strings.SplitN(authHeader, " ", bearerTokenParts)
		if len(parts) != bearerTokenParts || !strings.EqualFold(parts[0], "bearer") {
			abortWithAuthError(c, "INVALID_AUTH_FORMAT", "Invalid authorization format. Use: Bearer <token>")
			return
		}

		tokenString := parts[1]

		// Parse and validate JWT using JWKS
		token, err := jwt.ParseWithClaims(tokenString, new(Claims), jwks.keyFunc.Keyfunc)
		if err != nil {
			handleTokenError(c, err)
			return
		}

		claims, ok := token.Claims.(*Claims)
		if !ok || !token.Valid {
			abortWithAuthError(c, "INVALID_CLAIMS", "Invalid token claims")
			return
		}

		// Add user context for downstream handlers
		// Subject contains the user UUID from Supabase Auth
		c.Set(UserIDKey, claims.Subject)
		c.Set(UserEmailKey, claims.Email)
		c.Next()
	}
}

// OptionalAuth validates JWT if present but doesn't require it.
// Use for routes that work with or without authentication.
func OptionalAuth(jwks *JWKS) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next()
			return
		}

		parts := strings.SplitN(authHeader, " ", bearerTokenParts)
		if len(parts) != bearerTokenParts || !strings.EqualFold(parts[0], "bearer") {
			c.Next()
			return
		}

		tokenString := parts[1]

		token, err := jwt.ParseWithClaims(tokenString, new(Claims), jwks.keyFunc.Keyfunc)
		if err != nil {
			// Don't abort, just continue without user context
			c.Next()
			return
		}

		claims, ok := token.Claims.(*Claims)
		if !ok || !token.Valid {
			c.Next()
			return
		}

		c.Set(UserIDKey, claims.Subject)
		c.Set(UserEmailKey, claims.Email)
		c.Next()
	}
}

// GetUserID extracts the user ID from the Gin context.
// Returns empty string and false if not authenticated.
func GetUserID(c *gin.Context) (string, bool) {
	userID, exists := c.Get(UserIDKey)
	if !exists {
		return "", false
	}
	id, ok := userID.(string)
	return id, ok && id != ""
}

// GetUserEmail extracts the user email from the Gin context.
// Returns empty string and false if not authenticated.
func GetUserEmail(c *gin.Context) (string, bool) {
	email, exists := c.Get(UserEmailKey)
	if !exists {
		return "", false
	}
	e, ok := email.(string)
	return e, ok
}

// RequireAuth is a helper that returns the user ID or sends 401.
// Returns user ID and true if authenticated, empty string and false if not.
func RequireAuth(c *gin.Context) (string, bool) {
	userID, ok := GetUserID(c)
	if !ok {
		abortWithAuthError(c, "UNAUTHORIZED", "Authentication required")
		return "", false
	}
	return userID, true
}

// abortWithAuthError sends a standardized auth error response.
func abortWithAuthError(c *gin.Context, code, message string) {
	c.JSON(http.StatusUnauthorized, gin.H{"error": gin.H{
		"code":    code,
		"message": message,
	}})
	c.Abort()
}

// handleTokenError sends appropriate error response for token validation failures.
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
		code = "INVALID_TOKEN"
		message = "Invalid token"
	}

	abortWithAuthError(c, code, message)
}
