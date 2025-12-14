package middleware

import (
	"net/http"
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

// RateLimit returns a middleware that limits requests per minute per user.
func RateLimit(requestsPerMinute int) gin.HandlerFunc {
	limiter := &rateLimiter{
		mu:      sync.Mutex{},
		buckets: make(map[string]*bucket),
	}

	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		if userID == "" {
			// If no user ID (shouldn't happen after auth middleware), use IP
			userID = c.ClientIP()
		}

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
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error": gin.H{
					"code":    "RATE_LIMITED",
					"message": "You're submitting too fast. Please wait before trying again.",
				},
			})
			c.Abort()
		}
	}
}
