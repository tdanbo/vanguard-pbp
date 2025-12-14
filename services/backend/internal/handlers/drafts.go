package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/middleware"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/models"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/service"
)

// SaveDraft saves or updates a compose draft.
func SaveDraft(db *database.DB) gin.HandlerFunc {
	svc := service.NewDraftService(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		var req service.SaveDraftRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request body")
			return
		}

		userID := parseUUID(userIDStr)
		resp, err := svc.SaveDraft(c.Request.Context(), userID, req)
		if err != nil {
			handleDraftError(c, err)
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}

// GetDraft retrieves a compose draft.
func GetDraft(db *database.DB) gin.HandlerFunc {
	svc := service.NewDraftService(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		sceneID := c.Param("sceneId")
		characterID := c.Param("characterId")

		if sceneID == "" || characterID == "" {
			models.ValidationError(c, "Scene ID and Character ID are required")
			return
		}

		userID := parseUUID(userIDStr)
		resp, err := svc.GetDraft(c.Request.Context(), userID, sceneID, characterID)
		if err != nil {
			handleDraftError(c, err)
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}

// DeleteDraft deletes a compose draft.
func DeleteDraft(db *database.DB) gin.HandlerFunc {
	svc := service.NewDraftService(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		sceneID := c.Param("sceneId")
		characterID := c.Param("characterId")

		if sceneID == "" || characterID == "" {
			models.ValidationError(c, "Scene ID and Character ID are required")
			return
		}

		userID := parseUUID(userIDStr)
		if err := svc.DeleteDraft(c.Request.Context(), userID, sceneID, characterID); err != nil {
			handleDraftError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// ListUserDrafts lists all drafts for the current user.
func ListUserDrafts(db *database.DB) gin.HandlerFunc {
	svc := service.NewDraftService(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		userID := parseUUID(userIDStr)
		drafts, err := svc.ListUserDrafts(c.Request.Context(), userID)
		if err != nil {
			handleDraftError(c, err)
			return
		}

		if drafts == nil {
			drafts = []service.DraftResponse{}
		}

		c.JSON(http.StatusOK, gin.H{"drafts": drafts})
	}
}

func handleDraftError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrDraftNotFound):
		models.NotFoundError(c, "Draft")
	case errors.Is(err, service.ErrSceneNotFound):
		models.NotFoundError(c, "Scene")
	case errors.Is(err, service.ErrCharacterNotOwned):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("NOT_CHARACTER_OWNER", "You do not own this character"),
		)
	case errors.Is(err, service.ErrCharacterNotInScene):
		models.ValidationError(c, "Character is not in this scene")
	case errors.Is(err, service.ErrNotMember):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("NOT_MEMBER", "You are not a member of this campaign"),
		)
	default:
		models.InternalError(c)
	}
}
