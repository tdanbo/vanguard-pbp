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
	router := setupRouter(cfg, jwtValidator, db, imageHandler)

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

	registerAPIRoutes(api, db, imageHandler)

	return router
}

func registerAPIRoutes(api *gin.RouterGroup, db *database.DB, imageHandler *handlers.ImageHandler) {
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
}
