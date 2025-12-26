package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/middleware"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/models"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/service"
)

// JoinCampaignRequest represents the request to join a campaign via invite code.
type JoinCampaignRequest struct {
	Code  string `binding:"required"          json:"code"`
	Alias string `binding:"omitempty,max=255" json:"alias"`
}

// RevokeInviteRequest represents the request to revoke an invite.
type RevokeInviteRequest struct {
	InviteID string `binding:"required" json:"inviteId"`
}

// CreateInvite creates a new invite link for a campaign.
func CreateInvite(db *database.DB) gin.HandlerFunc {
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
		svc := service.NewInviteService(db.Pool)

		invite, err := svc.CreateInviteLink(c.Request.Context(), campaignID, userID)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		c.JSON(http.StatusCreated, invite)
	}
}

// ListInvites returns all invites for a campaign.
func ListInvites(db *database.DB) gin.HandlerFunc {
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
		svc := service.NewInviteService(db.Pool)

		invites, err := svc.ListCampaignInvites(c.Request.Context(), campaignID, userID)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"invites": invites})
	}
}

// RevokeInvite revokes an invite link.
//
//nolint:dupl // Handler patterns are intentionally similar across resources
func RevokeInvite(db *database.DB) gin.HandlerFunc {
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

		inviteIDStr := c.Param("inviteId")
		inviteID := parseUUID(inviteIDStr)
		if !inviteID.Valid {
			models.ValidationError(c, "Invalid invite ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewInviteService(db.Pool)

		err := svc.RevokeInvite(c.Request.Context(), inviteID, campaignID, userID)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Invite revoked successfully"})
	}
}

// ValidateInvite validates an invite code without using it.
func ValidateInvite(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		code := c.Param("code")
		if code == "" {
			models.ValidationError(c, "Invite code is required")
			return
		}

		svc := service.NewInviteService(db.Pool)

		invite, err := svc.ValidateInviteCode(c.Request.Context(), code)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		// Return campaign info without joining
		c.JSON(http.StatusOK, gin.H{
			"campaignId":    invite.CampaignID,
			"campaignTitle": invite.CampaignTitle,
		})
	}
}

// JoinCampaign joins a campaign using an invite code.
func JoinCampaign(db *database.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		var req JoinCampaignRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invite code is required")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewInviteService(db.Pool)

		campaign, err := svc.UseInviteCode(c.Request.Context(), req.Code, userID, req.Alias)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, campaign)
	}
}
