package middleware

import (
	"log/slog"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Logger returns a middleware that logs request details using slog.
func Logger() gin.HandlerFunc {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))

	return func(c *gin.Context) {
		// Generate request ID
		requestID := uuid.New().String()
		c.Set("requestId", requestID)

		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()

		logger.Info(
			"request completed",
			"request_id", requestID[:8],
			"status", status,
			"method", c.Request.Method,
			"path", path,
			"latency", latency,
		)
	}
}
