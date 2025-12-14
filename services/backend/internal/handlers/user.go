package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/middleware"
)

// CurrentUserResponse represents the response for the /me endpoint.
type CurrentUserResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

// GetCurrentUser returns the currently authenticated user's info.
// This endpoint extracts user data from the JWT token.
func GetCurrentUser() gin.HandlerFunc {
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
