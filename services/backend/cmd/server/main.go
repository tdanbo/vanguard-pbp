package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"

	"github.com/tdanbo/vanguard-pbp/services/backend/internal/config"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/handlers"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/middleware"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/service"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/storage"
)

func main() {
	if err := run(); err != nil {
		log.Printf("Server error: %v", err)
		os.Exit(1)
	}
}

func run() error {
	// Load environment variables from repository root
	// Try multiple paths to support running from different directories
	envPaths := []string{"../../.env", ".env"}
	for _, path := range envPaths {
		if loadErr := godotenv.Load(path); loadErr == nil {
			log.Printf("Loaded environment from %s", path)
			break
		}
	}

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	// Initialize JWT validator for token verification
	// Supports both JWKS (production) and HS256 secret (local dev)
	jwtValidator, err := middleware.NewJWTValidator(cfg.SupabaseJWKSURL, cfg.SupabaseJWTSecret)
	if err != nil {
		return err
	}
	defer jwtValidator.Close()

	// Initialize database connection
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()

	// Initialize storage client
	storageClient := storage.NewClient(cfg.SupabaseURL, cfg.SupabaseSecretKey)

	// Initialize queries and services
	queries := generated.New(db.Pool)
	imageService := service.NewImageService(queries, storageClient)
	imageHandler := handlers.NewImageHandler(imageService)

	// Set Gin mode
	if cfg.Environment == "production" || cfg.Environment == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Create router and register routes
	router := setupRouter(cfg, jwtValidator, db, imageHandler, imageService)

	// Start server
	port := cfg.Port
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	return router.Run(":" + port)
}

func setupRouter(
	cfg *config.Config,
	jwtValidator *middleware.JWTValidator,
	db *database.DB,
	imageHandler *handlers.ImageHandler,
	imageService *service.ImageService,
) *gin.Engine {
	router := gin.New()

	// Apply middleware
	router.Use(gin.Recovery())
	router.Use(middleware.Logger())
	router.Use(middleware.CORS(cfg.CORSAllowedOrigins))

	// Health check (no auth required)
	router.GET("/health", handlers.HealthCheck)

	// API routes (auth required)
	api := router.Group("/api/v1")
	api.Use(middleware.Auth(jwtValidator))

	registerAPIRoutes(api, db, imageHandler, imageService)

	return router
}

//nolint:funlen // Route registration requires many statements.
func registerAPIRoutes(
	api *gin.RouterGroup,
	db *database.DB,
	imageHandler *handlers.ImageHandler,
	imageService *service.ImageService,
) {
	// User routes
	api.GET("/me", handlers.GetCurrentUser())

	// Campaign routes
	api.GET("/campaigns", handlers.ListCampaigns(db))
	api.POST("/campaigns", handlers.CreateCampaign(db))
	api.GET("/campaigns/:id", handlers.GetCampaign(db))
	api.PATCH("/campaigns/:id", handlers.UpdateCampaign(db))
	api.DELETE("/campaigns/:id", handlers.DeleteCampaign(db))
	api.POST("/campaigns/:id/pause", handlers.PauseCampaign(db))
	api.POST("/campaigns/:id/resume", handlers.ResumeCampaign(db))

	// Campaign members routes
	api.GET("/campaigns/:id/members", handlers.GetCampaignMembers(db))
	api.POST("/campaigns/:id/leave", handlers.LeaveCampaign(db))
	api.DELETE("/campaigns/:id/members/:memberId", handlers.RemoveMember(db))
	api.POST("/campaigns/:id/transfer-gm", handlers.TransferGm(db))
	api.POST("/campaigns/:id/claim-gm", handlers.ClaimGm(db))

	// Invite routes
	api.POST("/campaigns/:id/invites", handlers.CreateInvite(db))
	api.GET("/campaigns/:id/invites", handlers.ListInvites(db))
	api.DELETE("/campaigns/:id/invites/:inviteId", handlers.RevokeInvite(db))
	api.GET("/invites/:code", handlers.ValidateInvite(db))
	api.POST("/campaigns/join", handlers.JoinCampaign(db))

	// Character routes
	api.GET("/campaigns/:id/characters", handlers.ListCampaignCharacters(db))
	api.POST("/campaigns/:id/characters", handlers.CreateCharacter(db))
	api.GET("/campaigns/:id/characters/orphaned", handlers.GetOrphanedCharacters(db))
	api.GET("/campaigns/:id/characters/:characterId", handlers.GetCharacter(db))
	api.PATCH("/campaigns/:id/characters/:characterId", handlers.UpdateCharacter(db))
	api.POST("/campaigns/:id/characters/:characterId/archive", handlers.ArchiveCharacter(db))
	api.POST("/campaigns/:id/characters/:characterId/unarchive", handlers.UnarchiveCharacter(db))
	api.POST("/campaigns/:id/characters/:characterId/assign", handlers.AssignCharacter(db))
	api.DELETE("/campaigns/:id/characters/:characterId/assign", handlers.UnassignCharacter(db))

	// Scene routes
	api.GET("/campaigns/:id/scenes", handlers.ListCampaignScenes(db))
	api.POST("/campaigns/:id/scenes", handlers.CreateScene(db))
	api.GET("/campaigns/:id/scenes/:sceneId", handlers.GetScene(db))
	api.PATCH("/campaigns/:id/scenes/:sceneId", handlers.UpdateScene(db))
	api.POST("/campaigns/:id/scenes/:sceneId/archive", handlers.ArchiveScene(db))
	api.POST("/campaigns/:id/scenes/:sceneId/unarchive", handlers.UnarchiveScene(db))
	api.DELETE("/campaigns/:id/scenes/:sceneId", handlers.DeleteScene(db, imageService))
	api.POST("/campaigns/:id/scenes/:sceneId/characters", handlers.AddCharacterToScene(db))
	api.DELETE(
		"/campaigns/:id/scenes/:sceneId/characters/:characterId",
		handlers.RemoveCharacterFromScene(db),
	)
	api.GET("/campaigns/:id/scenes/:sceneId/characters", handlers.GetSceneCharacters(db))

	// Image routes
	api.GET("/campaigns/:id/storage", imageHandler.GetStorageStatus)
	api.POST("/campaigns/:id/characters/:characterId/avatar", imageHandler.UploadAvatar)
	api.DELETE("/campaigns/:id/characters/:characterId/avatar", imageHandler.DeleteAvatar)
	api.POST("/campaigns/:id/scenes/:sceneId/header", imageHandler.UploadSceneHeader)
	api.DELETE("/campaigns/:id/scenes/:sceneId/header", imageHandler.DeleteSceneHeader)

	// Post routes
	api.GET("/campaigns/:id/scenes/:sceneId/posts", handlers.ListScenePosts(db))
	api.POST("/campaigns/:id/scenes/:sceneId/posts", handlers.CreatePost(db))
	api.GET("/campaigns/:id/scenes/:sceneId/posts/hidden", handlers.ListHiddenPosts(db))
	api.GET("/posts/:postId", handlers.GetPost(db))
	api.PATCH("/posts/:postId", handlers.UpdatePost(db))
	api.DELETE("/posts/:postId", handlers.DeletePost(db))
	api.POST("/posts/:postId/submit", handlers.SubmitPost(db))
	api.POST("/posts/:postId/unhide", handlers.UnhidePost(db))
	api.PATCH("/posts/:postId/witnesses", handlers.UpdatePostWitnesses(db))

	// Compose lock routes
	api.POST("/compose/acquire", handlers.AcquireComposeLock(db))
	api.POST("/compose/heartbeat", handlers.HeartbeatComposeLock(db))
	api.DELETE("/compose/:lockId", handlers.ReleaseComposeLock(db))
	api.DELETE("/compose/:lockId/force", handlers.ForceReleaseComposeLock(db))
	api.PATCH("/compose/:lockId/hidden", handlers.UpdateComposeLockHidden(db))
	api.GET("/campaigns/:id/scenes/:sceneId/compose-locks", handlers.GetSceneComposeLocks(db))

	// Draft routes
	api.POST("/drafts", handlers.SaveDraft(db))
	api.GET("/drafts", handlers.ListUserDrafts(db))
	api.GET("/drafts/:sceneId/:characterId", handlers.GetDraft(db))
	api.DELETE("/drafts/:sceneId/:characterId", handlers.DeleteDraft(db))

	// Phase management routes
	api.GET("/campaigns/:id/phase", handlers.GetPhaseStatus(db))
	api.POST("/campaigns/:id/phase/transition", handlers.TransitionPhase(db))
	api.POST("/campaigns/:id/phase/force-transition", handlers.ForceTransitionPhase(db))

	// Pass management routes
	api.GET("/campaigns/:id/pass", handlers.GetCampaignPassSummary(db))
	api.GET("/campaigns/:id/scenes/:sceneId/pass", handlers.GetScenePassStates(db))
	api.POST("/campaigns/:id/scenes/:sceneId/characters/:characterId/pass", handlers.SetPass(db))
	api.DELETE("/campaigns/:id/scenes/:sceneId/characters/:characterId/pass", handlers.ClearPass(db))

	// Dice system routes
	api.GET("/dice/presets", handlers.GetAvailablePresets())
	api.GET("/dice/types", handlers.GetValidDiceTypes())

	// Roll routes
	api.POST("/rolls", handlers.CreateRoll(db))
	api.GET("/rolls/:rollId", handlers.GetRoll(db))
	api.POST("/rolls/:rollId/override-intention", handlers.OverrideRollIntention(db))
	api.POST("/rolls/:rollId/resolve", handlers.ManuallyResolveRoll(db))
	api.POST("/rolls/:rollId/invalidate", handlers.InvalidateRoll(db))
	api.GET("/posts/:postId/rolls", handlers.GetRollsByPost(db))
	api.GET("/characters/:characterId/rolls/pending", handlers.GetPendingRollsForCharacter(db))
	api.GET("/campaigns/:id/rolls/unresolved", handlers.GetUnresolvedRollsInCampaign(db))
	api.GET("/scenes/:sceneId/rolls", handlers.GetRollsInScene(db))

	// Notification routes
	notificationHandler := handlers.NewNotificationHandler(db)
	api.GET("/notifications", notificationHandler.GetNotifications())
	api.GET("/notifications/unread", notificationHandler.GetUnreadNotifications())
	api.GET("/notifications/unread/count", notificationHandler.GetUnreadCount())
	api.GET("/campaigns/:id/notifications/unread/count", notificationHandler.GetUnreadCountByCampaign())
	api.POST("/notifications/:notificationId/read", notificationHandler.MarkAsRead())
	api.POST("/notifications/read-all", notificationHandler.MarkAllAsRead())
	api.DELETE("/notifications/:notificationId", notificationHandler.DeleteNotification())
	api.GET("/notifications/queued", notificationHandler.GetQueuedNotifications())

	// Notification preferences routes
	api.GET("/notification-preferences", notificationHandler.GetNotificationPreferences())
	api.PUT("/notification-preferences", notificationHandler.UpdateNotificationPreferences())
	api.GET("/quiet-hours", notificationHandler.GetQuietHours())
	api.PUT("/quiet-hours", notificationHandler.UpdateQuietHours())
}
