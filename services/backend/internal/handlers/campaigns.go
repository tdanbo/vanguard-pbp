package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/middleware"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/models"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/service"
)

// CreateCampaignRequest represents the request body for creating a campaign.
type CreateCampaignRequest struct {
	Title       string         `binding:"required,min=1,max=255" json:"title"`
	Description string         `binding:"max=2000"               json:"description"`
	Settings    map[string]any `binding:"-"                      json:"settings,omitempty"`
}

// UpdateCampaignRequest represents the request body for updating a campaign.
type UpdateCampaignRequest struct {
	Title       *string         `binding:"omitempty,min=1,max=255" json:"title,omitempty"`
	Description *string         `binding:"omitempty,max=2000"      json:"description,omitempty"`
	Settings    *map[string]any `binding:"-"                       json:"settings,omitempty"`
}

// DeleteCampaignRequest represents the request body for deleting a campaign.
type DeleteCampaignRequest struct {
	ConfirmTitle string `binding:"required" json:"confirmTitle"`
}

// CampaignMemberResponse represents a campaign member with alias and email.
type CampaignMemberResponse struct {
	ID         string `json:"id"`
	CampaignID string `json:"campaign_id"`
	UserID     string `json:"user_id"`
	Role       string `json:"role"`
	Alias      string `json:"alias,omitempty"`
	Email      string `json:"email,omitempty"`
	JoinedAt   string `json:"joined_at"`
}

// ListCampaigns returns campaigns for the authenticated user.
func ListCampaigns(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewCampaignService(db.Pool)

		campaigns, err := svc.ListUserCampaigns(c.Request.Context(), userID)
		if err != nil {
			models.InternalError(c)
			return
		}

		// Ensure we always return an array, not null
		if campaigns == nil {
			campaigns = []generated.ListUserCampaignsRow{}
		}

		// Convert to API response format
		response := ToCampaignListResponses(campaigns)
		c.JSON(http.StatusOK, gin.H{"campaigns": response})
	}
}

// CreateCampaign creates a new campaign.
func CreateCampaign(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		var req CreateCampaignRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request. Title is required (max 255 characters).")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewCampaignService(db.Pool)

		campaign, err := svc.CreateCampaign(
			c.Request.Context(),
			userID,
			service.CreateCampaignRequest{
				Title:       req.Title,
				Description: req.Description,
				Settings:    req.Settings,
			},
		)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		c.JSON(http.StatusCreated, campaign)
	}
}

// GetCampaign returns a single campaign by ID.
func GetCampaign(db *database.DB) gin.HandlerFunc {
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
		svc := service.NewCampaignService(db.Pool)

		campaign, err := svc.GetCampaign(c.Request.Context(), campaignID, userID)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		// Convert to API response format
		response := ToCampaignResponse(campaign)
		c.JSON(http.StatusOK, response)
	}
}

// UpdateCampaign updates a campaign.
//
//nolint:dupl // Handler patterns are intentionally similar across resources
func UpdateCampaign(db *database.DB) gin.HandlerFunc {
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

		var req UpdateCampaignRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewCampaignService(db.Pool)

		campaign, err := svc.UpdateCampaign(
			c.Request.Context(),
			campaignID,
			userID,
			service.UpdateCampaignRequest{
				Title:       req.Title,
				Description: req.Description,
				Settings:    req.Settings,
			},
		)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, campaign)
	}
}

// DeleteCampaign deletes a campaign.
func DeleteCampaign(db *database.DB) gin.HandlerFunc {
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

		var req DeleteCampaignRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Confirmation title is required")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewCampaignService(db.Pool)

		err := svc.DeleteCampaign(c.Request.Context(), campaignID, userID, req.ConfirmTitle)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Campaign deleted successfully"})
	}
}

// PauseCampaign pauses a campaign.
func PauseCampaign(db *database.DB) gin.HandlerFunc {
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
		svc := service.NewCampaignService(db.Pool)

		campaign, err := svc.PauseCampaign(c.Request.Context(), campaignID, userID)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, campaign)
	}
}

// ResumeCampaign resumes a paused campaign.
func ResumeCampaign(db *database.DB) gin.HandlerFunc {
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
		svc := service.NewCampaignService(db.Pool)

		campaign, err := svc.ResumeCampaign(c.Request.Context(), campaignID, userID)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, campaign)
	}
}

// GetCampaignMembers returns all members of a campaign.
func GetCampaignMembers(db *database.DB) gin.HandlerFunc {
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
		svc := service.NewCampaignService(db.Pool)

		members, err := svc.GetCampaignMembers(c.Request.Context(), campaignID, userID)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		// Check if current user is GM
		isGM, err := svc.IsUserGM(c.Request.Context(), campaignID, userID)
		if err != nil {
			models.InternalError(c)
			return
		}

		// Build response with alias, and email only for GMs
		response := make([]CampaignMemberResponse, len(members))
		currentUserEmail, _ := middleware.GetUserEmail(c)

		for i, member := range members {
			response[i] = CampaignMemberResponse{
				ID:         member.ID.String(),
				CampaignID: member.CampaignID.String(),
				UserID:     member.UserID.String(),
				Role:       string(member.Role),
				Alias:      member.Alias.String,
				Email:      "",
				JoinedAt:   member.JoinedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
			}

			// For GMs, include email if it's the current user
			if isGM && member.UserID == userID && currentUserEmail != "" {
				response[i].Email = currentUserEmail
			}
		}

		c.JSON(http.StatusOK, gin.H{"members": response})
	}
}

// Helper functions

//nolint:exhaustruct // Intentionally returning empty UUID with Valid: false
func parseUUID(s string) pgtype.UUID {
	u, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{Valid: false}
	}
	return pgtype.UUID{Bytes: u, Valid: true}
}

func handleServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrCampaignLimitReached):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("CAMPAIGN_LIMIT", "You can only create up to 5 campaigns."),
		)
	case errors.Is(err, service.ErrNotGM):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("NOT_GM", "Only the GM can perform this action."),
		)
	case errors.Is(err, service.ErrCampaignNotFound):
		models.NotFoundError(c, "Campaign")
	case errors.Is(err, service.ErrNotMember):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("NOT_MEMBER", "You are not a member of this campaign."),
		)
	case errors.Is(err, service.ErrInvalidSettings):
		models.ValidationError(c, "Invalid campaign settings")
	case errors.Is(err, service.ErrInviteExpired):
		models.RespondError(
			c,
			http.StatusGone,
			models.NewAPIError(
				"INVITE_EXPIRED",
				"This invite link has expired. Ask the GM for a new one.",
			),
		)
	case errors.Is(err, service.ErrInviteUsed):
		models.RespondError(
			c,
			http.StatusGone,
			models.NewAPIError("INVITE_USED", "This invite link has already been used."),
		)
	case errors.Is(err, service.ErrInviteRevoked):
		models.RespondError(
			c,
			http.StatusGone,
			models.NewAPIError("INVITE_REVOKED", "This invite link has been revoked."),
		)
	case errors.Is(err, service.ErrInviteNotFound):
		models.NotFoundError(c, "Invite")
	case errors.Is(err, service.ErrCampaignFull):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError(
				"CAMPAIGN_FULL",
				"This campaign has reached the maximum number of players (50).",
			),
		)
	case errors.Is(err, service.ErrAlreadyMember):
		models.RespondError(
			c,
			http.StatusConflict,
			models.NewAPIError("ALREADY_MEMBER", "You are already a member of this campaign."),
		)
	case errors.Is(err, service.ErrCannotLeaveAsGM):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError(
				"CANNOT_LEAVE_AS_GM",
				"You must transfer the GM role before leaving the campaign.",
			),
		)
	case errors.Is(err, service.ErrGmNotAbandoned):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError(
				"GM_NOT_ABANDONED",
				"The GM is still active. You can only claim the role after 30 days of inactivity.",
			),
		)
	case errors.Is(err, service.ErrInviteLimitReached):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError(
				"INVITE_LIMIT",
				"Too many active invites. Please revoke some before creating new ones.",
			),
		)
	default:
		if err.Error() == "confirmation title does not match campaign title" {
			models.ValidationError(c, "Confirmation title does not match the campaign title")
			return
		}
		models.InternalError(c)
	}
}
