package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/dice"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/middleware"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/models"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/service"
)

// CreateRoll creates a new dice roll.
func CreateRoll(db *database.DB) gin.HandlerFunc {
	svc := service.NewRollService(db.Pool)
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		var req service.CreateRollRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request body")
			return
		}

		userID := parseUUID(userIDStr)
		resp, err := svc.CreateRoll(c.Request.Context(), userID, req)
		if err != nil {
			handleRollError(c, err)
			return
		}

		// Broadcast roll created
		rollID := parseUUID(resp.ID)
		sceneID := parseUUID(resp.SceneID)
		characterID := parseUUID(resp.CharacterID)
		var postID pgtype.UUID
		if resp.PostID != nil {
			postID = parseUUID(*resp.PostID)
		}
		if scene, sErr := queries.GetScene(c.Request.Context(), sceneID); sErr == nil {
			BroadcastRollCreated(c, rollID, postID, sceneID, scene.CampaignID, characterID, resp.Intention)
		}

		c.JSON(http.StatusCreated, resp)
	}
}

// GetRoll retrieves a single roll.
func GetRoll(db *database.DB) gin.HandlerFunc {
	svc := service.NewRollService(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		rollID := c.Param("rollId")
		if rollID == "" {
			models.ValidationError(c, "Roll ID is required")
			return
		}

		userID := parseUUID(userIDStr)
		resp, err := svc.GetRoll(c.Request.Context(), userID, rollID)
		if err != nil {
			handleRollError(c, err)
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}

// GetRollsByPost retrieves all rolls for a post.
func GetRollsByPost(db *database.DB) gin.HandlerFunc {
	svc := service.NewRollService(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		postID := c.Param("postId")
		if postID == "" {
			models.ValidationError(c, "Post ID is required")
			return
		}

		userID := parseUUID(userIDStr)
		rolls, err := svc.GetRollsByPost(c.Request.Context(), userID, postID)
		if err != nil {
			handleRollError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"rolls": rolls})
	}
}

// GetPendingRollsForCharacter retrieves pending rolls for a character.
func GetPendingRollsForCharacter(db *database.DB) gin.HandlerFunc {
	svc := service.NewRollService(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		characterID := c.Param("characterId")
		if characterID == "" {
			models.ValidationError(c, "Character ID is required")
			return
		}

		// Note: Authorization check should be done in service layer
		_ = parseUUID(userIDStr)
		rolls, err := svc.GetPendingRollsForCharacter(c.Request.Context(), characterID)
		if err != nil {
			handleRollError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"rolls": rolls})
	}
}

// GetUnresolvedRollsInCampaign retrieves all unresolved rolls (GM dashboard).
func GetUnresolvedRollsInCampaign(db *database.DB) gin.HandlerFunc {
	svc := service.NewRollService(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		campaignID := c.Param("id")
		if campaignID == "" {
			models.ValidationError(c, "Campaign ID is required")
			return
		}

		userID := parseUUID(userIDStr)
		rolls, err := svc.GetUnresolvedRollsInCampaign(c.Request.Context(), userID, campaignID)
		if err != nil {
			handleRollError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"rolls": rolls})
	}
}

// GetRollsInScene retrieves all rolls in a scene.
func GetRollsInScene(db *database.DB) gin.HandlerFunc {
	svc := service.NewRollService(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		sceneID := c.Param("sceneId")
		if sceneID == "" {
			models.ValidationError(c, "Scene ID is required")
			return
		}

		userID := parseUUID(userIDStr)
		rolls, err := svc.GetRollsInScene(c.Request.Context(), userID, sceneID)
		if err != nil {
			handleRollError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"rolls": rolls})
	}
}

// OverrideRollIntention overrides a roll's intention (GM only).
func OverrideRollIntention(db *database.DB) gin.HandlerFunc {
	svc := service.NewRollService(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		rollID := c.Param("rollId")
		if rollID == "" {
			models.ValidationError(c, "Roll ID is required")
			return
		}

		var req service.OverrideIntentionRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request body")
			return
		}

		userID := parseUUID(userIDStr)
		resp, err := svc.OverrideIntention(c.Request.Context(), userID, rollID, req)
		if err != nil {
			handleRollError(c, err)
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}

// ManuallyResolveRoll manually resolves a roll (GM only).
func ManuallyResolveRoll(db *database.DB) gin.HandlerFunc {
	svc := service.NewRollService(db.Pool)
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		rollIDParam := c.Param("rollId")
		if rollIDParam == "" {
			models.ValidationError(c, "Roll ID is required")
			return
		}

		var req service.ManualResolveRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request body")
			return
		}

		userID := parseUUID(userIDStr)
		resp, err := svc.ManuallyResolve(c.Request.Context(), userID, rollIDParam, req)
		if err != nil {
			handleRollError(c, err)
			return
		}

		// Broadcast roll resolved
		rollID := parseUUID(resp.ID)
		sceneID := parseUUID(resp.SceneID)
		if scene, sErr := queries.GetScene(c.Request.Context(), sceneID); sErr == nil {
			BroadcastRollResolved(c, rollID, sceneID, scene.CampaignID, resp.Status)
		}

		c.JSON(http.StatusOK, resp)
	}
}

// InvalidateRoll invalidates a roll (GM only).
func InvalidateRoll(db *database.DB) gin.HandlerFunc {
	svc := service.NewRollService(db.Pool)
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		rollIDParam := c.Param("rollId")
		if rollIDParam == "" {
			models.ValidationError(c, "Roll ID is required")
			return
		}

		userID := parseUUID(userIDStr)
		resp, err := svc.InvalidateRoll(c.Request.Context(), userID, rollIDParam)
		if err != nil {
			handleRollError(c, err)
			return
		}

		// Broadcast roll resolved (status: invalidated)
		rollID := parseUUID(resp.ID)
		sceneID := parseUUID(resp.SceneID)
		if scene, sErr := queries.GetScene(c.Request.Context(), sceneID); sErr == nil {
			BroadcastRollResolved(c, rollID, sceneID, scene.CampaignID, resp.Status)
		}

		c.JSON(http.StatusOK, resp)
	}
}

// GetAvailablePresets returns all available dice system presets.
func GetAvailablePresets() gin.HandlerFunc {
	return func(c *gin.Context) {
		presets := dice.GetAvailablePresets()
		c.JSON(http.StatusOK, gin.H{"presets": presets})
	}
}

// GetValidDiceTypes returns all valid dice types.
func GetValidDiceTypes() gin.HandlerFunc {
	return func(c *gin.Context) {
		diceTypes := dice.ValidDiceTypes()
		c.JSON(http.StatusOK, gin.H{"diceTypes": diceTypes})
	}
}

// handleRollError maps service errors to HTTP responses.
func handleRollError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrRollNotFound):
		models.NotFoundError(c, "Roll")
	case errors.Is(err, service.ErrRollAlreadyResolved):
		models.ValidationError(c, "Roll is already resolved")
	case errors.Is(err, service.ErrInvalidModifier):
		models.ValidationError(c, "Modifier must be between -100 and +100")
	case errors.Is(err, service.ErrInvalidDiceCount):
		models.ValidationError(c, "Dice count must be between 1 and 100")
	case errors.Is(err, service.ErrInvalidIntention):
		models.ValidationError(c, "Intention is required")
	case errors.Is(err, service.ErrNotGM):
		models.ForbiddenError(c)
	case errors.Is(err, service.ErrNotMember):
		models.ForbiddenError(c)
	case errors.Is(err, service.ErrSceneNotFound):
		models.NotFoundError(c, "Scene")
	default:
		models.InternalError(c)
	}
}
