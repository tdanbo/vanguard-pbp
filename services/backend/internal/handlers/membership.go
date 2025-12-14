package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/middleware"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/models"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/service"
)

// TransferGmRequest represents the request to transfer GM role.
type TransferGmRequest struct {
	NewGmUserID string `json:"newGmUserId" binding:"required"`
}

// LeaveCampaign allows a player to leave a campaign.
func LeaveCampaign(db *database.DB) gin.HandlerFunc {
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
		svc := service.NewMembershipService(db.Pool)

		err := svc.LeaveCampaign(c.Request.Context(), campaignID, userID)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Left campaign successfully"})
	}
}

// RemoveMember allows GM to remove a player from the campaign.
//
//nolint:dupl // Handler patterns are intentionally similar across resources
func RemoveMember(db *database.DB) gin.HandlerFunc {
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

		memberIDStr := c.Param("memberId")
		memberID := parseUUID(memberIDStr)
		if !memberID.Valid {
			models.ValidationError(c, "Invalid member ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewMembershipService(db.Pool)

		err := svc.RemoveMember(c.Request.Context(), campaignID, userID, memberID)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Member removed successfully"})
	}
}

// TransferGm transfers GM role to another member.
//
//nolint:dupl // Handler patterns are intentionally similar across resources
func TransferGm(db *database.DB) gin.HandlerFunc {
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

		var req TransferGmRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "New GM user ID is required")
			return
		}

		newGmID := parseUUID(req.NewGmUserID)
		if !newGmID.Valid {
			models.ValidationError(c, "Invalid new GM user ID format")
			return
		}

		userID := parseUUID(userIDStr)
		svc := service.NewMembershipService(db.Pool)

		err := svc.TransferGmRole(c.Request.Context(), campaignID, userID, newGmID)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "GM role transferred successfully"})
	}
}

// ClaimGm allows a player to claim GM role after 30 days of GM inactivity.
func ClaimGm(db *database.DB) gin.HandlerFunc {
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
		svc := service.NewMembershipService(db.Pool)

		err := svc.ClaimAbandonedGmRole(c.Request.Context(), campaignID, userID)
		if err != nil {
			handleServiceError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "GM role claimed successfully"})
	}
}
