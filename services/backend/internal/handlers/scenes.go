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

// CreateSceneRequest represents the request body for creating a scene.
type CreateSceneRequest struct {
	Title       string `binding:"required,min=1,max=200" json:"title"`
	Description string `binding:"max=2000"               json:"description"`
}

// UpdateSceneRequest represents the request body for updating a scene.
type UpdateSceneRequest struct {
	Title       *string `binding:"omitempty,min=1,max=200" json:"title,omitempty"`
	Description *string `binding:"omitempty,max=2000"      json:"description,omitempty"`
}

// SceneCharacterRequest represents the request body for adding/removing a character.
type SceneCharacterRequest struct {
	CharacterID string `binding:"required" json:"characterId"`
}

// ListCampaignScenes returns all scenes in a campaign.
func ListCampaignScenes(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		campaignIDStr := c.Param("id")
		campaignID := parseUUID(campaignIDStr)
		if !campaignID.Valid {
			models.ValidationError(c, "Invalid campaign ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewSceneService(db.Pool)

		scenes, err := svc.ListCampaignScenes(c.Request.Context(), campaignID, userID)
		if err != nil {
			handleSceneServiceError(c, err)
			return
		}

		// Get scene count and warning
		count, warning, _ := svc.GetSceneCount(c.Request.Context(), campaignID, userID)

		c.JSON(http.StatusOK, gin.H{
			"scenes":  scenes,
			"count":   count,
			"warning": warning,
		})
	}
}

// CreateScene creates a new scene in a campaign.
//
//nolint:dupl // Handler patterns are intentionally similar across resources
func CreateScene(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		campaignIDStr := c.Param("id")
		campaignID := parseUUID(campaignIDStr)
		if !campaignID.Valid {
			models.ValidationError(c, "Invalid campaign ID format")
			return
		}

		var req CreateSceneRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request. Title is required (max 200 characters).")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewSceneService(db.Pool)

		response, err := svc.CreateScene(
			c.Request.Context(),
			campaignID,
			userID,
			service.CreateSceneRequest{
				Title:       req.Title,
				Description: req.Description,
			},
		)
		if err != nil {
			handleSceneServiceError(c, err)
			return
		}

		c.JSON(http.StatusCreated, response)
	}
}

// GetScene returns a single scene by ID.
func GetScene(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		sceneIDStr := c.Param("sceneId")
		sceneID := parseUUID(sceneIDStr)
		if !sceneID.Valid {
			models.ValidationError(c, "Invalid scene ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewSceneService(db.Pool)

		scene, err := svc.GetScene(c.Request.Context(), sceneID, userID)
		if err != nil {
			handleSceneServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, scene)
	}
}

// UpdateScene updates a scene.
//
//nolint:dupl // Handler patterns are intentionally similar across resources
func UpdateScene(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		sceneIDStr := c.Param("sceneId")
		sceneID := parseUUID(sceneIDStr)
		if !sceneID.Valid {
			models.ValidationError(c, "Invalid scene ID format")
			return
		}

		var req UpdateSceneRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewSceneService(db.Pool)

		scene, err := svc.UpdateScene(
			c.Request.Context(),
			sceneID,
			userID,
			service.UpdateSceneRequest{
				Title:       req.Title,
				Description: req.Description,
			},
		)
		if err != nil {
			handleSceneServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, scene)
	}
}

// ArchiveScene archives a scene.
func ArchiveScene(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		sceneIDStr := c.Param("sceneId")
		sceneID := parseUUID(sceneIDStr)
		if !sceneID.Valid {
			models.ValidationError(c, "Invalid scene ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewSceneService(db.Pool)

		scene, err := svc.ArchiveScene(c.Request.Context(), sceneID, userID)
		if err != nil {
			handleSceneServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, scene)
	}
}

// UnarchiveScene unarchives a scene.
func UnarchiveScene(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		sceneIDStr := c.Param("sceneId")
		sceneID := parseUUID(sceneIDStr)
		if !sceneID.Valid {
			models.ValidationError(c, "Invalid scene ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewSceneService(db.Pool)

		scene, err := svc.UnarchiveScene(c.Request.Context(), sceneID, userID)
		if err != nil {
			handleSceneServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, scene)
	}
}

// AddCharacterToScene adds a character to a scene.
func AddCharacterToScene(db *database.DB) gin.HandlerFunc {
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		sceneIDStr := c.Param("sceneId")
		sceneID := parseUUID(sceneIDStr)
		if !sceneID.Valid {
			models.ValidationError(c, "Invalid scene ID format")
			return
		}

		var req SceneCharacterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Character ID is required")
			return
		}

		characterID := parseUUID(req.CharacterID)
		if !characterID.Valid {
			models.ValidationError(c, "Invalid character ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewSceneService(db.Pool)

		scene, err := svc.AddCharacterToScene(c.Request.Context(), sceneID, characterID, userID)
		if err != nil {
			handleSceneServiceError(c, err)
			return
		}

		// Broadcast character joined scene
		if sceneData, sErr := queries.GetScene(c.Request.Context(), sceneID); sErr == nil {
			BroadcastCharacterJoinedScene(c, sceneID, sceneData.CampaignID, characterID)
		}

		c.JSON(http.StatusOK, scene)
	}
}

// RemoveCharacterFromScene removes a character from a scene.
func RemoveCharacterFromScene(db *database.DB) gin.HandlerFunc {
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		sceneIDStr := c.Param("sceneId")
		sceneID := parseUUID(sceneIDStr)
		if !sceneID.Valid {
			models.ValidationError(c, "Invalid scene ID format")
			return
		}

		characterIDStr := c.Param("characterId")
		characterID := parseUUID(characterIDStr)
		if !characterID.Valid {
			models.ValidationError(c, "Invalid character ID format")
			return
		}

		// Get campaign ID before removing character
		sceneData, sceneErr := queries.GetScene(c.Request.Context(), sceneID)

		userID := parseUUID(userIDStr)
		svc := service.NewSceneService(db.Pool)

		scene, err := svc.RemoveCharacterFromScene(
			c.Request.Context(),
			sceneID,
			characterID,
			userID,
		)
		if err != nil {
			handleSceneServiceError(c, err)
			return
		}

		// Broadcast character left scene
		if sceneErr == nil {
			BroadcastCharacterLeftScene(c, sceneID, sceneData.CampaignID, characterID)
		}

		c.JSON(http.StatusOK, scene)
	}
}

// GetSceneCharacters returns all characters in a scene.
func GetSceneCharacters(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		sceneIDStr := c.Param("sceneId")
		sceneID := parseUUID(sceneIDStr)
		if !sceneID.Valid {
			models.ValidationError(c, "Invalid scene ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewSceneService(db.Pool)

		characters, err := svc.GetSceneCharacters(c.Request.Context(), sceneID, userID)
		if err != nil {
			handleSceneServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"characters": characters})
	}
}

func handleSceneServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrNotGM):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("NOT_GM", "Only the GM can perform this action."),
		)
	case errors.Is(err, service.ErrSceneNotFound):
		models.NotFoundError(c, "Scene")
	case errors.Is(err, service.ErrNotMember):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("NOT_MEMBER", "You are not a member of this campaign."),
		)
	case errors.Is(err, service.ErrNoArchivedScenes):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError(
				"SCENE_LIMIT_NO_ARCHIVED",
				"Scene limit reached (25 max). No archived scenes available to delete.",
			),
		)
	case errors.Is(err, service.ErrNotGMPhase):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("NOT_GM_PHASE", "Characters can only be moved during GM Phase."),
		)
	case errors.Is(err, service.ErrCharacterNotFound):
		models.NotFoundError(c, "Character")
	default:
		models.InternalError(c)
	}
}
