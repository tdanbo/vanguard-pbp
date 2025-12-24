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

// AcquireComposeLock acquires a compose lock for a character in a scene.
func AcquireComposeLock(db *database.DB) gin.HandlerFunc {
	svc := service.NewComposeService(db.Pool)
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		var req service.AcquireLockRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request body")
			return
		}

		userID := parseUUID(userIDStr)
		resp, err := svc.AcquireLock(c.Request.Context(), userID, req)
		if err != nil {
			handleComposeError(c, err)
			return
		}

		// Broadcast compose lock acquired (identity protected)
		sceneID := parseUUID(req.SceneID)
		if scene, sErr := queries.GetScene(c.Request.Context(), sceneID); sErr == nil {
			BroadcastComposeLockAcquired(c, sceneID, scene.CampaignID)
		}

		c.JSON(http.StatusOK, resp)
	}
}

// HeartbeatComposeLock refreshes a compose lock's expiration.
func HeartbeatComposeLock(db *database.DB) gin.HandlerFunc {
	svc := service.NewComposeService(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		var req service.HeartbeatRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request body")
			return
		}

		userID := parseUUID(userIDStr)
		resp, err := svc.Heartbeat(c.Request.Context(), userID, req)
		if err != nil {
			handleComposeError(c, err)
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}

// releaseComposeLockHandler is a shared implementation for release and force-release.
func releaseComposeLockHandler(
	db *database.DB,
	releaseFunc func(svc *service.ComposeService, c *gin.Context, userID, lockID string) error,
) gin.HandlerFunc {
	svc := service.NewComposeService(db.Pool)
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		lockID := c.Param("lockId")
		if lockID == "" {
			models.ValidationError(c, "Lock ID is required")
			return
		}

		// Get lock info for broadcast before releasing
		lockUUID := parseUUID(lockID)
		lock, lockErr := queries.GetComposeLockByID(c.Request.Context(), lockUUID)

		if err := releaseFunc(svc, c, userIDStr, lockID); err != nil {
			handleComposeError(c, err)
			return
		}

		// Broadcast compose lock released (identity protected)
		if lockErr == nil {
			if scene, sErr := queries.GetScene(c.Request.Context(), lock.SceneID); sErr == nil {
				BroadcastComposeLockReleased(c, lock.SceneID, scene.CampaignID)
			}
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// ReleaseComposeLock releases a compose lock.
func ReleaseComposeLock(db *database.DB) gin.HandlerFunc {
	return releaseComposeLockHandler(
		db,
		func(svc *service.ComposeService, c *gin.Context, userIDStr, lockID string) error {
			userID := parseUUID(userIDStr)
			return svc.ReleaseLock(c.Request.Context(), userID, lockID)
		},
	)
}

// ForceReleaseComposeLock releases a compose lock by GM force.
func ForceReleaseComposeLock(db *database.DB) gin.HandlerFunc {
	return releaseComposeLockHandler(
		db,
		func(svc *service.ComposeService, c *gin.Context, userIDStr, lockID string) error {
			userID := parseUUID(userIDStr)
			return svc.ForceReleaseLock(c.Request.Context(), userID, lockID)
		},
	)
}

// GetSceneComposeLocks returns all active locks in a scene.
func GetSceneComposeLocks(db *database.DB) gin.HandlerFunc {
	svc := service.NewComposeService(db.Pool)

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
		locks, isGM, err := svc.GetSceneLocks(c.Request.Context(), userID, sceneID)
		if err != nil {
			handleComposeError(c, err)
			return
		}

		// Lock info is already processed by the service with hidden post handling
		// GM sees all details, players see generic "Another player" for hidden posts
		c.JSON(http.StatusOK, gin.H{
			"locks":    locks,
			"isLocked": len(locks) > 0,
			"isGM":     isGM,
		})
	}
}

// UpdateComposeLockHidden updates whether a compose lock is for a hidden post.
func UpdateComposeLockHidden(db *database.DB) gin.HandlerFunc {
	svc := service.NewComposeService(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		lockID := c.Param("lockId")
		if lockID == "" {
			models.ValidationError(c, "Lock ID is required")
			return
		}

		var req struct {
			IsHidden bool `json:"isHidden"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request body")
			return
		}

		userID := parseUUID(userIDStr)
		if err := svc.UpdateLockHidden(c.Request.Context(), userID, lockID, req.IsHidden); err != nil {
			handleComposeError(c, err)
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

func handleComposeError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrLockNotFound):
		models.NotFoundError(c, "Compose lock")
	case errors.Is(err, service.ErrLockAlreadyHeld):
		models.RespondError(
			c,
			http.StatusConflict,
			models.NewAPIError("LOCK_HELD", "Another player is currently posting"),
		)
	case errors.Is(err, service.ErrNotLockOwner):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("NOT_LOCK_OWNER", "You do not own this compose lock"),
		)
	case errors.Is(err, service.ErrCharacterNotOwned):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("NOT_CHARACTER_OWNER", "You do not own this character"),
		)
	case errors.Is(err, service.ErrCharacterNotInScene):
		models.ValidationError(c, "Character is not in this scene")
	case errors.Is(err, service.ErrNotInPCPhase):
		models.ValidationError(c, "Posts can only be created during PC Phase")
	case errors.Is(err, service.ErrTimeGateExpired):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("TIME_GATE_EXPIRED", "Time gate has expired. Waiting for GM to transition phase."),
		)
	case errors.Is(err, service.ErrSceneNotFound):
		models.NotFoundError(c, "Scene")
	case errors.Is(err, service.ErrNotGM):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("NOT_GM", "Only the GM can perform this action"),
		)
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
