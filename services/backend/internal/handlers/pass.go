package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/middleware"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/models"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/service"
)

// SetPassRequest represents the request body for setting a pass state.
type SetPassRequest struct {
	PassState string `binding:"required,oneof=none passed hard_passed" json:"passState"`
}

// GetCampaignPassSummary returns the pass summary for a campaign.
func GetCampaignPassSummary(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		campaignIDStr := c.Param("id")
		if campaignIDStr == "" {
			models.ValidationError(c, "Campaign ID is required")
			return
		}

		userID := parseUUID(userIDStr)
		campaignID := parseUUID(campaignIDStr)

		svc := service.NewPassService(db.Pool)
		summary, err := svc.GetCampaignPassSummary(c.Request.Context(), campaignID, userID)
		if err != nil {
			handlePassError(c, err)
			return
		}

		c.JSON(http.StatusOK, summary)
	}
}

// GetScenePassStates returns the pass states for a specific scene.
func GetScenePassStates(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		sceneIDStr := c.Param("sceneId")
		if sceneIDStr == "" {
			models.ValidationError(c, "Scene ID is required")
			return
		}

		userID := parseUUID(userIDStr)
		sceneID := parseUUID(sceneIDStr)

		svc := service.NewPassService(db.Pool)
		passStates, err := svc.GetScenePassStates(c.Request.Context(), sceneID, userID)
		if err != nil {
			handlePassError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"passStates": passStates})
	}
}

// SetPass sets the pass state for a character in a scene.
func SetPass(db *database.DB) gin.HandlerFunc {
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		sceneIDStr := c.Param("sceneId")
		characterIDStr := c.Param("characterId")
		if sceneIDStr == "" || characterIDStr == "" {
			models.ValidationError(c, "Scene ID and Character ID are required")
			return
		}

		var req SetPassRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request. passState must be 'none', 'passed', or 'hard_passed'.")
			return
		}

		userID := parseUUID(userIDStr)
		sceneID := parseUUID(sceneIDStr)
		characterID := parseUUID(characterIDStr)

		svc := service.NewPassService(db.Pool)
		err := svc.SetPass(c.Request.Context(), userID, sceneID, characterID, req.PassState)
		if err != nil {
			handlePassError(c, err)
			return
		}

		// Broadcast pass state changed
		hasPassed := req.PassState == "passed" || req.PassState == "hard_passed"
		if scene, sErr := queries.GetScene(c.Request.Context(), sceneID); sErr == nil {
			BroadcastPassStateChanged(c, scene.CampaignID, sceneID, characterID, hasPassed)
		}

		c.JSON(http.StatusOK, gin.H{"message": "Pass state updated successfully"})
	}
}

// ClearPass clears (sets to 'none') the pass state for a character.
func ClearPass(db *database.DB) gin.HandlerFunc {
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		sceneIDStr := c.Param("sceneId")
		characterIDStr := c.Param("characterId")
		if sceneIDStr == "" || characterIDStr == "" {
			models.ValidationError(c, "Scene ID and Character ID are required")
			return
		}

		userID := parseUUID(userIDStr)
		sceneID := parseUUID(sceneIDStr)
		characterID := parseUUID(characterIDStr)

		svc := service.NewPassService(db.Pool)
		err := svc.ClearPass(c.Request.Context(), userID, sceneID, characterID)
		if err != nil {
			handlePassError(c, err)
			return
		}

		// Broadcast pass state cleared (hasPassed = false)
		if scene, sErr := queries.GetScene(c.Request.Context(), sceneID); sErr == nil {
			BroadcastPassStateChanged(c, scene.CampaignID, sceneID, characterID, false)
		}

		c.JSON(http.StatusOK, gin.H{"message": "Pass state cleared successfully"})
	}
}

// handlePassError handles pass-related errors and sends appropriate HTTP responses.
func handlePassError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrNotMember):
		models.ForbiddenError(c)
	case errors.Is(err, service.ErrNotGM):
		models.ForbiddenError(c)
	case errors.Is(err, service.ErrCharacterNotOwned):
		models.ForbiddenError(c)
	case errors.Is(err, service.ErrSceneNotFound):
		models.NotFoundError(c, "Scene")
	case errors.Is(err, service.ErrCharacterNotFound):
		models.NotFoundError(c, "Character")
	case errors.Is(err, service.ErrCharacterNotInScene):
		models.ValidationError(c, "Character is not in this scene")
	case errors.Is(err, service.ErrNotInPCPhase):
		models.ValidationError(c, "Can only pass during PC phase")
	case errors.Is(err, service.ErrCannotPassPendingRolls):
		models.ValidationError(c, "Cannot pass with pending rolls")
	case errors.Is(err, service.ErrInvalidPassState):
		models.ValidationError(c, "Invalid pass state")
	default:
		models.InternalError(c)
	}
}
