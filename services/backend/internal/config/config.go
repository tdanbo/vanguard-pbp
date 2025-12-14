package config

import (
	"errors"
	"os"
	"strings"
)

// Config holds the application configuration.
type Config struct {
	Port                   string
	Environment            string
	DatabaseURL            string
	SupabaseURL            string
	SupabasePublishableKey string
	SupabaseSecretKey      string
	SupabaseJWKSURL        string
	SupabaseJWTSecret      string // JWT secret for HS256 validation (local dev)
	CORSAllowedOrigins     []string
}

// Load reads configuration from environment variables.
func Load() (*Config, error) {
	cfg := &Config{
		Port:                   getEnv("PORT", "8080"),
		Environment:            getEnv("GIN_MODE", "debug"),
		DatabaseURL:            os.Getenv("DATABASE_URL"),
		SupabaseURL:            os.Getenv("SUPABASE_URL"),
		SupabasePublishableKey: getEnvWithFallback("SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"),
		SupabaseSecretKey:      getEnvWithFallback("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"),
		SupabaseJWKSURL:        os.Getenv("SUPABASE_JWKS_URL"),
		SupabaseJWTSecret:      os.Getenv("SUPABASE_JWT_SECRET"),
		CORSAllowedOrigins:     strings.Split(getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173"), ","),
	}

	// Validate required fields
	if cfg.DatabaseURL == "" {
		return nil, errors.New("DATABASE_URL is required")
	}
	// Either JWKS URL or JWT Secret is required for auth
	if cfg.SupabaseJWKSURL == "" && cfg.SupabaseJWTSecret == "" {
		return nil, errors.New("either SUPABASE_JWKS_URL or SUPABASE_JWT_SECRET is required")
	}

	return cfg, nil
}

// getEnvWithFallback tries the primary key first, then falls back to the legacy key.
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
