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

// CreateCharacterRequest represents the request body for creating a character.
type CreateCharacterRequest struct {
	DisplayName   string  `binding:"required,min=1,max=100" json:"displayName"`
	Description   string  `binding:"max=1000"               json:"description"`
	CharacterType string  `binding:"required,oneof=pc npc"  json:"characterType"`
	AssignToUser  *string `binding:"-"                      json:"assignToUser,omitempty"`
}

// UpdateCharacterRequest represents the request body for updating a character.
type UpdateCharacterRequest struct {
	DisplayName   *string `binding:"omitempty,min=1,max=100" json:"displayName,omitempty"`
	Description   *string `binding:"omitempty,max=1000"      json:"description,omitempty"`
	CharacterType *string `binding:"omitempty,oneof=pc npc"  json:"characterType,omitempty"`
}

// AssignCharacterRequest represents the request body for assigning a character.
type AssignCharacterRequest struct {
	UserID string `binding:"required" json:"userId"`
}

// ListCampaignCharacters returns all characters in a campaign.
func ListCampaignCharacters(db *database.DB) gin.HandlerFunc {
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
		svc := service.NewCharacterService(db.Pool)

		characters, err := svc.ListCampaignCharacters(c.Request.Context(), campaignID, userID)
		if err != nil {
			handleCharacterServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"characters": characters})
	}
}

// CreateCharacter creates a new character in a campaign.
func CreateCharacter(db *database.DB) gin.HandlerFunc {
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

		var req CreateCharacterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(
				c,
				"Invalid request. Display name is required (max 100 characters).",
			)
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewCharacterService(db.Pool)

		character, err := svc.CreateCharacter(
			c.Request.Context(),
			campaignID,
			userID,
			service.CreateCharacterRequest{
				DisplayName:   req.DisplayName,
				Description:   req.Description,
				CharacterType: req.CharacterType,
				AssignToUser:  req.AssignToUser,
			},
		)
		if err != nil {
			handleCharacterServiceError(c, err)
			return
		}

		c.JSON(http.StatusCreated, character)
	}
}

// GetCharacter returns a single character by ID.
func GetCharacter(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		characterIDStr := c.Param("characterId")
		characterID := parseUUID(characterIDStr)
		if !characterID.Valid {
			models.ValidationError(c, "Invalid character ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewCharacterService(db.Pool)

		character, err := svc.GetCharacter(c.Request.Context(), characterID, userID)
		if err != nil {
			handleCharacterServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, character)
	}
}

// UpdateCharacter updates a character.
//
//nolint:dupl // Handler patterns are intentionally similar across resources
func UpdateCharacter(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		characterIDStr := c.Param("characterId")
		characterID := parseUUID(characterIDStr)
		if !characterID.Valid {
			models.ValidationError(c, "Invalid character ID format")
			return
		}

		var req UpdateCharacterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewCharacterService(db.Pool)

		character, err := svc.UpdateCharacter(
			c.Request.Context(),
			characterID,
			userID,
			service.UpdateCharacterRequest{
				DisplayName:   req.DisplayName,
				Description:   req.Description,
				CharacterType: req.CharacterType,
			},
		)
		if err != nil {
			handleCharacterServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, character)
	}
}

// ArchiveCharacter archives a character.
func ArchiveCharacter(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		characterIDStr := c.Param("characterId")
		characterID := parseUUID(characterIDStr)
		if !characterID.Valid {
			models.ValidationError(c, "Invalid character ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewCharacterService(db.Pool)

		character, err := svc.ArchiveCharacter(c.Request.Context(), characterID, userID)
		if err != nil {
			handleCharacterServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, character)
	}
}

// UnarchiveCharacter unarchives a character.
func UnarchiveCharacter(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		characterIDStr := c.Param("characterId")
		characterID := parseUUID(characterIDStr)
		if !characterID.Valid {
			models.ValidationError(c, "Invalid character ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewCharacterService(db.Pool)

		character, err := svc.UnarchiveCharacter(c.Request.Context(), characterID, userID)
		if err != nil {
			handleCharacterServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, character)
	}
}

// AssignCharacter assigns a character to a user.
//
//nolint:dupl // Handler patterns are intentionally similar across resources
func AssignCharacter(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		characterIDStr := c.Param("characterId")
		characterID := parseUUID(characterIDStr)
		if !characterID.Valid {
			models.ValidationError(c, "Invalid character ID format")
			return
		}

		var req AssignCharacterRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "User ID is required")
			return
		}

		targetUserID := parseUUID(req.UserID)
		if !targetUserID.Valid {
			models.ValidationError(c, "Invalid user ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewCharacterService(db.Pool)

		err := svc.AssignCharacter(c.Request.Context(), characterID, userID, targetUserID)
		if err != nil {
			handleCharacterServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Character assigned successfully"})
	}
}

// UnassignCharacter removes assignment from a character.
func UnassignCharacter(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		characterIDStr := c.Param("characterId")
		characterID := parseUUID(characterIDStr)
		if !characterID.Valid {
			models.ValidationError(c, "Invalid character ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewCharacterService(db.Pool)

		err := svc.UnassignCharacter(c.Request.Context(), characterID, userID)
		if err != nil {
			handleCharacterServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Character unassigned successfully"})
	}
}

// GetOrphanedCharacters returns characters without assignments.
func GetOrphanedCharacters(db *database.DB) gin.HandlerFunc {
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
		svc := service.NewCharacterService(db.Pool)

		characters, err := svc.GetOrphanedCharacters(c.Request.Context(), campaignID, userID)
		if err != nil {
			handleCharacterServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"characters": characters})
	}
}

func handleCharacterServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrNotGM):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("NOT_GM", "Only the GM can perform this action."),
		)
	case errors.Is(err, service.ErrCharacterNotFound):
		models.NotFoundError(c, "Character")
	case errors.Is(err, service.ErrNotMember):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("NOT_MEMBER", "You are not a member of this campaign."),
		)
	case errors.Is(err, service.ErrCharacterArchived):
		models.RespondError(
			c,
			http.StatusBadRequest,
			models.NewAPIError("CHARACTER_ARCHIVED", "This character is archived."),
		)
	default:
		models.InternalError(c)
	}
}
