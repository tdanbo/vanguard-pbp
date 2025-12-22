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

// TransitionPhaseRequest represents the request body for transitioning phases.
type TransitionPhaseRequest struct {
	ToPhase string `binding:"required,oneof=pc_phase gm_phase" json:"toPhase"`
}

// GetPhaseStatus returns the current phase status of a campaign.
func GetPhaseStatus(db *database.DB) gin.HandlerFunc {
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

		svc := service.NewPhaseService(db.Pool)
		status, err := svc.GetPhaseStatus(c.Request.Context(), campaignID, userID)
		if err != nil {
			handlePhaseError(c, err)
			return
		}

		c.JSON(http.StatusOK, status)
	}
}

// TransitionPhase transitions a campaign to a new phase.
func TransitionPhase(db *database.DB) gin.HandlerFunc {
	return handleTransitionPhase(db, false)
}

// ForceTransitionPhase allows GM to force transition without checks.
func ForceTransitionPhase(db *database.DB) gin.HandlerFunc {
	return handleTransitionPhase(db, true)
}

// handleTransitionPhase is the common implementation for phase transitions.
func handleTransitionPhase(db *database.DB, force bool) gin.HandlerFunc {
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

		var req TransitionPhaseRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request. toPhase must be 'pc_phase' or 'gm_phase'.")
			return
		}

		userID := parseUUID(userIDStr)
		campaignID := parseUUID(campaignIDStr)

		// Get current phase before transition for broadcast
		queries := generated.New(db.Pool)
		currentCampaign, _ := queries.GetCampaign(c.Request.Context(), campaignID)
		fromPhase := string(currentCampaign.CurrentPhase)

		svc := service.NewPhaseService(db.Pool)
		svcReq := service.TransitionPhaseRequest{ToPhase: req.ToPhase}

		var campaign *generated.Campaign
		var err error
		if force {
			campaign, err = svc.ForceTransitionPhase(c.Request.Context(), campaignID, userID, svcReq)
		} else {
			campaign, err = svc.TransitionPhase(c.Request.Context(), campaignID, userID, svcReq)
		}
		if err != nil {
			handlePhaseError(c, err)
			return
		}

		// Broadcast phase transition
		reason := "gm_action"
		if force {
			reason = "gm_force"
		}
		BroadcastPhaseTransition(c, campaignID, fromPhase, req.ToPhase, reason)

		// Fetch campaign with user_role for proper response
		campaignWithRole, err := queries.GetCampaignWithMembership(c.Request.Context(),
			generated.GetCampaignWithMembershipParams{
				ID:     campaignID,
				UserID: userID,
			})
		if err != nil {
			// Fall back to the basic campaign if membership lookup fails
			// This shouldn't happen since we already verified GM status
			c.JSON(http.StatusOK, gin.H{
				"message":  "Phase transitioned successfully",
				"campaign": campaign,
			})
			return
		}

		message := "Phase transitioned successfully"
		if force {
			message = "Phase force transitioned successfully"
		}

		c.JSON(http.StatusOK, gin.H{
			"message":  message,
			"campaign": ToCampaignResponse(&campaignWithRole),
		})
	}
}

// handlePhaseError handles phase-related errors and sends appropriate HTTP responses.
func handlePhaseError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrNotGM):
		models.ForbiddenError(c)
	case errors.Is(err, service.ErrNotMember):
		models.ForbiddenError(c)
	case errors.Is(err, service.ErrCampaignNotFound):
		models.NotFoundError(c, "Campaign")
	case errors.Is(err, service.ErrAlreadyInPhase):
		models.ValidationError(c, "Campaign is already in this phase")
	case errors.Is(err, service.ErrCampaignPaused):
		models.ValidationError(c, "Cannot transition while campaign is paused")
	case errors.Is(err, service.ErrActiveComposeLocks):
		models.ValidationError(c, "Cannot transition: players are still composing posts")
	case errors.Is(err, service.ErrPendingRolls):
		models.ValidationError(c, "Cannot transition: there are pending rolls to resolve")
	case errors.Is(err, service.ErrNotAllPassed):
		models.ValidationError(c, "Cannot transition to GM phase: not all characters have passed")
	default:
		models.InternalError(c)
	}
}
