package handlers

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/middleware"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/models"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/service"
)

// emptyUUID returns an empty/invalid UUID.
func emptyUUID() pgtype.UUID {
	return pgtype.UUID{}
}

// CreatePost creates a new post.
func CreatePost(db *database.DB) gin.HandlerFunc {
	svc := service.NewPostService(db.Pool)
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		var req service.CreatePostRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request body")
			return
		}

		// Check if submitting immediately (default) or creating draft
		submitImmediately := true
		if submit := c.Query("submit"); submit == "false" {
			submitImmediately = false
		}

		userID := parseUUID(userIDStr)
		log.Printf("[DEBUG] CreatePost request: sceneId=%s, characterId=%v, blocks=%d, isHidden=%v",
			req.SceneID, req.CharacterID, len(req.Blocks), req.IsHidden)
		resp, err := svc.CreatePost(c.Request.Context(), userID, req, submitImmediately)
		if err != nil {
			log.Printf("[ERROR] CreatePost failed: %v", err)
			handlePostError(c, err)
			return
		}

		// Broadcast post created (only if submitted, not drafts)
		if submitImmediately && !resp.IsDraft {
			sceneID := parseUUID(resp.SceneID)
			postID := parseUUID(resp.ID)
			if scene, sErr := queries.GetScene(c.Request.Context(), sceneID); sErr == nil {
				var characterID = emptyUUID()
				if resp.CharacterID != nil {
					characterID = parseUUID(*resp.CharacterID)
				}
				var witnesses []string
				witnesses = append(witnesses, resp.Witnesses...)
				witnessUUIDs := make([]pgtype.UUID, 0, len(witnesses))
				for _, w := range witnesses {
					witnessUUIDs = append(witnessUUIDs, parseUUID(w))
				}
				BroadcastPostCreated(c, postID, sceneID, scene.CampaignID, characterID, resp.IsHidden, witnessUUIDs)
			}
		}

		c.JSON(http.StatusCreated, resp)
	}
}

// SubmitPost submits a draft post.
func SubmitPost(db *database.DB) gin.HandlerFunc {
	svc := service.NewPostService(db.Pool)
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		postIDParam := c.Param("postId")
		if postIDParam == "" {
			models.ValidationError(c, "Post ID is required")
			return
		}

		var req struct {
			IsHidden bool `json:"isHidden"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			req.IsHidden = false
		}

		userID := parseUUID(userIDStr)
		resp, err := svc.SubmitPost(c.Request.Context(), userID, postIDParam, req.IsHidden)
		if err != nil {
			handlePostError(c, err)
			return
		}

		// Broadcast post created when draft is submitted
		sceneID := parseUUID(resp.SceneID)
		postID := parseUUID(resp.ID)
		if scene, sErr := queries.GetScene(c.Request.Context(), sceneID); sErr == nil {
			var characterID = emptyUUID()
			if resp.CharacterID != nil {
				characterID = parseUUID(*resp.CharacterID)
			}
			witnessUUIDs := make([]pgtype.UUID, 0, len(resp.Witnesses))
			for _, w := range resp.Witnesses {
				witnessUUIDs = append(witnessUUIDs, parseUUID(w))
			}
			BroadcastPostCreated(c, postID, sceneID, scene.CampaignID, characterID, resp.IsHidden, witnessUUIDs)
		}

		c.JSON(http.StatusOK, resp)
	}
}

// UpdatePost updates a post.
func UpdatePost(db *database.DB) gin.HandlerFunc {
	svc := service.NewPostService(db.Pool)
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		postIDParam := c.Param("postId")
		if postIDParam == "" {
			models.ValidationError(c, "Post ID is required")
			return
		}

		var req service.UpdatePostRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request body")
			return
		}

		userID := parseUUID(userIDStr)
		resp, err := svc.UpdatePost(c.Request.Context(), userID, postIDParam, req)
		if err != nil {
			handlePostError(c, err)
			return
		}

		// Broadcast post updated
		sceneID := parseUUID(resp.SceneID)
		postID := parseUUID(resp.ID)
		if scene, sErr := queries.GetScene(c.Request.Context(), sceneID); sErr == nil {
			BroadcastPostUpdated(c, postID, sceneID, scene.CampaignID)
		}

		c.JSON(http.StatusOK, resp)
	}
}

// DeletePost deletes a post (GM only).
func DeletePost(db *database.DB) gin.HandlerFunc {
	svc := service.NewPostService(db.Pool)
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		postIDParam := c.Param("postId")
		if postIDParam == "" {
			models.ValidationError(c, "Post ID is required")
			return
		}

		// Get post info for broadcast before deleting
		postUUID := parseUUID(postIDParam)
		post, postErr := queries.GetPost(c.Request.Context(), postUUID)

		userID := parseUUID(userIDStr)
		if err := svc.DeletePost(c.Request.Context(), userID, postIDParam); err != nil {
			handlePostError(c, err)
			return
		}

		// Broadcast post deleted
		if postErr == nil {
			if scene, sErr := queries.GetScene(c.Request.Context(), post.SceneID); sErr == nil {
				BroadcastPostDeleted(c, postUUID, post.SceneID, scene.CampaignID)
			}
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// GetPost returns a single post.
func GetPost(db *database.DB) gin.HandlerFunc {
	svc := service.NewPostService(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		postID := c.Param("postId")
		if postID == "" {
			models.ValidationError(c, "Post ID is required")
			return
		}

		userID := parseUUID(userIDStr)
		resp, err := svc.GetPost(c.Request.Context(), userID, postID)
		if err != nil {
			handlePostError(c, err)
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}

// ListScenePosts lists all posts in a scene.
func ListScenePosts(db *database.DB) gin.HandlerFunc {
	svc := service.NewPostService(db.Pool)

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

		// Optional character ID for witness filtering
		var viewAsCharacterID *string
		if charID := c.Query("characterId"); charID != "" {
			viewAsCharacterID = &charID
		}

		userID := parseUUID(userIDStr)
		posts, err := svc.ListScenePosts(c.Request.Context(), userID, sceneID, viewAsCharacterID)
		if err != nil {
			handlePostError(c, err)
			return
		}

		if posts == nil {
			posts = []service.PostResponse{}
		}

		c.JSON(http.StatusOK, gin.H{"posts": posts})
	}
}

// UnhidePost reveals a hidden post (GM only).
// Accepts optional witnesses array for custom witness selection.
func UnhidePost(db *database.DB) gin.HandlerFunc {
	svc := service.NewPostService(db.Pool)
	queries := generated.New(db.Pool)

	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}

		postIDParam := c.Param("postId")
		if postIDParam == "" {
			models.ValidationError(c, "Post ID is required")
			return
		}

		// Parse optional request body with custom witnesses
		var req service.UnhidePostRequest
		_ = c.ShouldBindJSON(&req) // Ignore error if no body

		userID := parseUUID(userIDStr)
		resp, err := svc.UnhidePost(c.Request.Context(), userID, postIDParam, &req)
		if err != nil {
			handlePostError(c, err)
			return
		}

		// Broadcast post updated (visibility changed)
		sceneID := parseUUID(resp.SceneID)
		postID := parseUUID(resp.ID)
		if scene, sErr := queries.GetScene(c.Request.Context(), sceneID); sErr == nil {
			BroadcastPostUpdated(c, postID, sceneID, scene.CampaignID)
		}

		c.JSON(http.StatusOK, resp)
	}
}

// ListHiddenPosts lists all hidden posts in a scene (GM only).
func ListHiddenPosts(db *database.DB) gin.HandlerFunc {
	svc := service.NewPostService(db.Pool)

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
		posts, err := svc.ListHiddenPosts(c.Request.Context(), userID, sceneID)
		if err != nil {
			handlePostError(c, err)
			return
		}

		if posts == nil {
			posts = []service.PostResponse{}
		}

		c.JSON(http.StatusOK, gin.H{"posts": posts})
	}
}

func handlePostError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrPostNotFound):
		models.NotFoundError(c, "Post")
	case errors.Is(err, service.ErrPostLocked):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("POST_LOCKED", "Post is locked and cannot be edited"),
		)
	case errors.Is(err, service.ErrNotPostOwner):
		models.RespondError(
			c,
			http.StatusForbidden,
			models.NewAPIError("NOT_POST_OWNER", "You do not own this post"),
		)
	case errors.Is(err, service.ErrSceneNotFound):
		models.NotFoundError(c, "Scene")
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
		// Log the actual error for debugging
		log.Printf("[ERROR] CreatePost unhandled error: %v", err)
		c.Error(err)
		models.InternalError(c)
	}
}
