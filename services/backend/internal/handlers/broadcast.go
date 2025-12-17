package handlers

import (
	"os"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/service"
)

//nolint:gochecknoglobals // Singleton pattern for broadcast service
var (
	broadcastService *service.BroadcastService
	broadcastOnce    sync.Once
)

// getBroadcastService returns a singleton broadcast service.
func getBroadcastService() *service.BroadcastService {
	broadcastOnce.Do(func() {
		supabaseURL := os.Getenv("SUPABASE_URL")
		supabaseKey := os.Getenv("SUPABASE_SECRET_KEY")
		if supabaseKey == "" {
			supabaseKey = os.Getenv("SUPABASE_SERVICE_ROLE_KEY")
		}

		if supabaseURL != "" && supabaseKey != "" {
			broadcastService = service.NewBroadcastService(supabaseURL, supabaseKey)
		}
	})
	return broadcastService
}

// BroadcastPhaseTransition broadcasts a phase transition event.
func BroadcastPhaseTransition(
	c *gin.Context,
	campaignID pgtype.UUID,
	fromPhase, toPhase string,
	reason string,
) {
	svc := getBroadcastService()
	if svc == nil {
		return
	}
	go svc.BroadcastPhaseTransition(c.Request.Context(), campaignID, fromPhase, toPhase, reason)
}

// BroadcastPostCreated broadcasts a post creation event.
func BroadcastPostCreated(
	c *gin.Context,
	postID, sceneID, campaignID, characterID pgtype.UUID,
	isHidden bool,
	witnesses []pgtype.UUID,
) {
	svc := getBroadcastService()
	if svc == nil {
		return
	}
	go svc.BroadcastPostCreated(c.Request.Context(), postID, sceneID, campaignID, characterID, isHidden, witnesses)
}

// BroadcastPostUpdated broadcasts a post update event.
func BroadcastPostUpdated(
	c *gin.Context,
	postID, sceneID, campaignID pgtype.UUID,
) {
	svc := getBroadcastService()
	if svc == nil {
		return
	}
	go svc.BroadcastPostUpdated(c.Request.Context(), postID, sceneID, campaignID)
}

// BroadcastPostDeleted broadcasts a post deletion event.
func BroadcastPostDeleted(
	c *gin.Context,
	postID, sceneID, campaignID pgtype.UUID,
) {
	svc := getBroadcastService()
	if svc == nil {
		return
	}
	go svc.BroadcastPostDeleted(c.Request.Context(), postID, sceneID, campaignID)
}

// BroadcastComposeLockAcquired broadcasts a compose lock acquisition event (identity protected).
func BroadcastComposeLockAcquired(
	c *gin.Context,
	sceneID, campaignID pgtype.UUID,
) {
	svc := getBroadcastService()
	if svc == nil {
		return
	}
	go svc.BroadcastComposeLockAcquired(c.Request.Context(), sceneID, campaignID)
}

// BroadcastComposeLockReleased broadcasts a compose lock release event (identity protected).
func BroadcastComposeLockReleased(
	c *gin.Context,
	sceneID, campaignID pgtype.UUID,
) {
	svc := getBroadcastService()
	if svc == nil {
		return
	}
	go svc.BroadcastComposeLockReleased(c.Request.Context(), sceneID, campaignID)
}

// BroadcastPassStateChanged broadcasts a pass state change event.
func BroadcastPassStateChanged(
	c *gin.Context,
	campaignID, sceneID, characterID pgtype.UUID,
	hasPassed bool,
) {
	svc := getBroadcastService()
	if svc == nil {
		return
	}
	go svc.BroadcastPassStateChanged(c.Request.Context(), campaignID, sceneID, characterID, hasPassed)
}

// BroadcastCharacterJoinedScene broadcasts a character joining a scene.
func BroadcastCharacterJoinedScene(
	c *gin.Context,
	sceneID, campaignID, characterID pgtype.UUID,
) {
	svc := getBroadcastService()
	if svc == nil {
		return
	}
	go svc.BroadcastCharacterJoinedScene(c.Request.Context(), sceneID, campaignID, characterID)
}

// BroadcastCharacterLeftScene broadcasts a character leaving a scene.
func BroadcastCharacterLeftScene(
	c *gin.Context,
	sceneID, campaignID, characterID pgtype.UUID,
) {
	svc := getBroadcastService()
	if svc == nil {
		return
	}
	go svc.BroadcastCharacterLeftScene(c.Request.Context(), sceneID, campaignID, characterID)
}

// BroadcastRollCreated broadcasts a roll creation event.
func BroadcastRollCreated(
	c *gin.Context,
	rollID, postID, sceneID, campaignID, characterID pgtype.UUID,
	intention string,
) {
	svc := getBroadcastService()
	if svc == nil {
		return
	}
	go svc.BroadcastRollCreated(c.Request.Context(), rollID, postID, sceneID, campaignID, characterID, intention)
}

// BroadcastRollResolved broadcasts a roll resolution event.
func BroadcastRollResolved(
	c *gin.Context,
	rollID, sceneID, campaignID pgtype.UUID,
	status string,
) {
	svc := getBroadcastService()
	if svc == nil {
		return
	}
	go svc.BroadcastRollResolved(c.Request.Context(), rollID, sceneID, campaignID, status)
}
