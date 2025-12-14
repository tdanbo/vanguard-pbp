package models

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// APIError represents a standardized API error response.
type APIError struct {
	Code      string    `json:"code"`
	Message   string    `json:"message"`
	Timestamp time.Time `json:"timestamp"`
	RequestID string    `json:"requestId,omitempty"`
}

// NewAPIError creates a new API error with the given code and message.
func NewAPIError(code, message string) *APIError {
	return &APIError{
		Code:      code,
		Message:   message,
		Timestamp: time.Now().UTC(),
		RequestID: "",
	}
}

// Common error codes.
const (
	ErrCodeValidation   = "VALIDATION_ERROR"
	ErrCodeUnauthorized = "UNAUTHORIZED"
	ErrCodeForbidden    = "FORBIDDEN"
	ErrCodeNotFound     = "NOT_FOUND"
	ErrCodeConflict     = "CONFLICT"
	ErrCodeInternal     = "INTERNAL_ERROR"
	ErrCodeRateLimited  = "RATE_LIMITED"
)

// RespondError sends an error response to the client.
func RespondError(c *gin.Context, status int, err *APIError) {
	err.RequestID = c.GetString("requestId")
	c.JSON(status, gin.H{"error": err})
}

// ValidationError sends a validation error response.
func ValidationError(c *gin.Context, message string) {
	RespondError(c, http.StatusBadRequest, NewAPIError(ErrCodeValidation, message))
}

// UnauthorizedError sends an unauthorized error response.
func UnauthorizedError(c *gin.Context) {
	RespondError(c, http.StatusUnauthorized, NewAPIError(ErrCodeUnauthorized, "Authentication required"))
}

// ForbiddenError sends a forbidden error response.
func ForbiddenError(c *gin.Context) {
	RespondError(c, http.StatusForbidden, NewAPIError(ErrCodeForbidden, "Access denied"))
}

// NotFoundError sends a not found error response.
func NotFoundError(c *gin.Context, resource string) {
	RespondError(c, http.StatusNotFound, NewAPIError(ErrCodeNotFound, fmt.Sprintf("%s not found", resource)))
}

// InternalError sends an internal server error response.
func InternalError(c *gin.Context) {
	RespondError(
		c,
		http.StatusInternalServerError,
		NewAPIError(ErrCodeInternal, "An internal error occurred"),
	)
}

// RateLimitedError sends a rate limited error response.
func RateLimitedError(c *gin.Context) {
	RespondError(
		c,
		http.StatusTooManyRequests,
		NewAPIError(ErrCodeRateLimited, "Rate limit exceeded. Please try again later."),
	)
}
