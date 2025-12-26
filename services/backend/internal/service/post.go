package service

import (
	"context"
	"encoding/json"
	"errors"
	"slices"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
)

// Post errors.
var (
	ErrPostNotFound      = errors.New("post not found")
	ErrPostLocked        = errors.New("post is locked and cannot be edited")
	ErrNotPostOwner      = errors.New("you do not own this post")
	ErrCannotEditAsGM    = errors.New("GMs cannot edit player posts")
	ErrNotInCorrectPhase = errors.New("action not allowed in current phase")
	ErrNotMostRecentPost = errors.New("can only edit the most recent post")
)

// PostService handles post business logic.
type PostService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

// NewPostService creates a new PostService.
func NewPostService(pool *pgxpool.Pool) *PostService {
	return &PostService{
		queries: generated.New(pool),
		pool:    pool,
	}
}

// PostBlock represents a block of content in a post.
type PostBlock struct {
	Type    string `json:"type"` // "action" or "dialog"
	Content string `json:"content"`
	Order   int    `json:"order"`
}

// CreatePostRequest represents the request to create a post.
type CreatePostRequest struct {
	SceneID     string      `json:"sceneId"`
	CharacterID *string     `json:"characterId"` // null for Narrator
	Blocks      []PostBlock `json:"blocks"`
	OOCText     *string     `json:"oocText"`
	Intention   *string     `json:"intention"`
	Modifier    *int        `json:"modifier"`
	IsHidden    bool        `json:"isHidden"`
}

// PostResponse represents a post in the API response.
type PostResponse struct {
	ID              string      `json:"id"`
	SceneID         string      `json:"sceneId"`
	CharacterID     *string     `json:"characterId"`
	UserID          string      `json:"userId"`
	Blocks          []PostBlock `json:"blocks"`
	OOCText         *string     `json:"oocText"`
	Witnesses       []string    `json:"witnesses"`
	IsHidden        bool        `json:"isHidden"`
	IsDraft         bool        `json:"isDraft"`
	IsLocked        bool        `json:"isLocked"`
	LockedAt        *string     `json:"lockedAt"`
	EditedByGM      bool        `json:"editedByGm"`
	Intention       *string     `json:"intention"`
	Modifier        *int        `json:"modifier"`
	CharacterName   *string     `json:"characterName"`
	CharacterAvatar *string     `json:"characterAvatar"`
	CharacterType   *string     `json:"characterType"`
	CreatedAt       string      `json:"createdAt"`
	UpdatedAt       string      `json:"updatedAt"`
}

// CreatePost creates a new post (initially as draft or submitted).
//
//nolint:gocognit,nestif,gocyclo,cyclop,funlen // Complex post creation logic with necessary nesting for validation.
func (s *PostService) CreatePost(
	ctx context.Context,
	userID pgtype.UUID,
	req CreatePostRequest,
	submitImmediately bool,
) (*PostResponse, error) {
	sceneID := parseUUIDString(req.SceneID)

	// Get scene with campaign info
	sceneWithCampaign, err := s.queries.GetSceneWithCampaign(ctx, sceneID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSceneNotFound
		}
		return nil, err
	}

	// Check user is a member
	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: sceneWithCampaign.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, ErrNotMember
	}

	// Check GM status
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: sceneWithCampaign.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}

	// Verify phase (players can only post during PC Phase)
	if !isGM && sceneWithCampaign.CurrentPhase != generated.CampaignPhasePcPhase {
		return nil, ErrNotInPCPhase
	}

	// Check if time gate has expired (players cannot post when expired)
	if !isGM && sceneWithCampaign.CurrentPhase == generated.CampaignPhasePcPhase {
		if sceneWithCampaign.CurrentPhaseExpiresAt.Valid &&
			time.Now().After(sceneWithCampaign.CurrentPhaseExpiresAt.Time) {
			return nil, ErrTimeGateExpired
		}
	}

	// Handle character validation
	var characterID pgtype.UUID
	if req.CharacterID != nil {
		characterID = parseUUIDString(*req.CharacterID)

		// Verify character is in scene
		inScene, inSceneErr := s.queries.IsCharacterInScene(ctx, generated.IsCharacterInSceneParams{
			ID:      sceneID,
			Column2: characterID,
		})
		if inSceneErr != nil {
			return nil, inSceneErr
		}
		if !inScene {
			return nil, ErrCharacterNotInScene
		}

		// Verify user owns character (or is GM for NPCs)
		char, charErr := s.queries.GetCharacter(ctx, characterID)
		if charErr != nil {
			return nil, charErr
		}

		assignment, assignErr := s.queries.GetCharacterAssignment(ctx, characterID)
		if assignErr != nil && !errors.Is(assignErr, pgx.ErrNoRows) {
			return nil, assignErr
		}

		if errors.Is(assignErr, pgx.ErrNoRows) || !assignment.UserID.Valid {
			if !isGM {
				return nil, ErrCharacterNotOwned
			}
		} else if assignment.UserID != userID && !isGM {
			return nil, ErrCharacterNotOwned
		}

		// NPCs can only be used by GM
		if char.CharacterType == generated.CharacterTypeNpc && !isGM {
			return nil, ErrCharacterNotOwned
		}
	} else if !isGM {
		// Narrator posts require GM
		return nil, ErrNotGM
	}

	// Marshal blocks to JSON (ensure empty array if nil)
	blocks := req.Blocks
	if blocks == nil {
		blocks = []PostBlock{}
	}
	blocksJSON, err := json.Marshal(blocks)
	if err != nil {
		return nil, err
	}

	// Prepare witnesses (ensure empty slice, not nil)
	witnesses := make([]pgtype.UUID, 0)
	if submitImmediately {
		if req.IsHidden {
			// Hidden posts: only the author's character is a witness
			// (so they can see their own hidden post)
			if characterID.Valid {
				witnesses = append(witnesses, characterID)
			}
		} else {
			// Regular posts: all scene characters are witnesses
			witnesses = append(witnesses, sceneWithCampaign.CharacterIds...)
		}
	}

	// Prepare optional fields
	var oocText pgtype.Text
	if req.OOCText != nil {
		oocText = pgtype.Text{String: *req.OOCText, Valid: true}
	}

	var intention pgtype.Text
	if req.Intention != nil {
		intention = pgtype.Text{String: *req.Intention, Valid: true}
	}

	var modifier pgtype.Int4
	if req.Modifier != nil {
		//nolint:gosec // Modifier values are bounded by game rules.
		modifier = pgtype.Int4{Int32: int32(*req.Modifier), Valid: true}
	}

	// Start transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	// Create post
	post, err := qtx.CreatePost(ctx, generated.CreatePostParams{
		SceneID:     sceneID,
		CharacterID: characterID,
		UserID:      userID,
		Blocks:      blocksJSON,
		OocText:     oocText,
		Witnesses:   witnesses,
		IsHidden:    req.IsHidden,
		IsDraft:     !submitImmediately,
		Intention:   intention,
		Modifier:    modifier,
	})
	if err != nil {
		return nil, err
	}

	// If submitting immediately, lock the previous post
	if submitImmediately {
		prevPost, prevErr := qtx.GetPreviousPost(ctx, generated.GetPreviousPostParams{
			SceneID:   sceneID,
			CreatedAt: post.CreatedAt,
		})
		if prevErr == nil {
			// Lock the previous post
			if lockErr := qtx.LockPost(ctx, prevPost.ID); lockErr != nil {
				return nil, lockErr
			}
		}
		// No error if no previous post

		// Delete compose lock if exists
		_ = qtx.DeleteComposeDraftByCharacter(ctx, generated.DeleteComposeDraftByCharacterParams{
			SceneID:     sceneID,
			CharacterID: characterID,
		})
	}

	if commitErr := tx.Commit(ctx); commitErr != nil {
		return nil, commitErr
	}

	return s.postToResponse(&post), nil
}

// SubmitPost submits a draft post.
func (s *PostService) SubmitPost(
	ctx context.Context,
	userID pgtype.UUID,
	postID string,
	isHidden bool,
) (*PostResponse, error) {
	postUUID := parseUUIDString(postID)

	// Get post
	post, err := s.queries.GetPost(ctx, postUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPostNotFound
		}
		return nil, err
	}

	// Verify ownership
	if post.UserID != userID {
		return nil, ErrNotPostOwner
	}

	// Verify it's a draft
	if !post.IsDraft {
		return nil, errors.New("post is already submitted")
	}

	// Get scene for witnesses
	scene, err := s.queries.GetScene(ctx, post.SceneID)
	if err != nil {
		return nil, err
	}

	// Prepare witnesses
	var witnesses []pgtype.UUID
	if isHidden {
		// Hidden posts: only the author's character is a witness
		// (so they can see their own hidden post)
		if post.CharacterID.Valid {
			witnesses = append(witnesses, post.CharacterID)
		}
	} else {
		// Regular posts: all scene characters are witnesses
		witnesses = scene.CharacterIds
	}

	// Start transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	// Submit post
	submittedPost, err := qtx.SubmitPost(ctx, generated.SubmitPostParams{
		ID:        postUUID,
		Witnesses: witnesses,
		IsHidden:  isHidden,
	})
	if err != nil {
		return nil, err
	}

	// Lock previous post
	prevPost, prevErr := qtx.GetPreviousPost(ctx, generated.GetPreviousPostParams{
		SceneID:   post.SceneID,
		CreatedAt: submittedPost.CreatedAt,
	})
	if prevErr == nil {
		if lockErr := qtx.LockPost(ctx, prevPost.ID); lockErr != nil {
			return nil, lockErr
		}
	}

	// Delete compose draft
	_ = qtx.DeleteComposeDraftByCharacter(ctx, generated.DeleteComposeDraftByCharacterParams{
		SceneID:     post.SceneID,
		CharacterID: post.CharacterID,
	})

	if commitErr := tx.Commit(ctx); commitErr != nil {
		return nil, commitErr
	}

	return s.postToResponse(&submittedPost), nil
}

// UpdatePostRequest represents the request to update a post.
type UpdatePostRequest struct {
	Blocks    *[]PostBlock `json:"blocks,omitempty"`
	OOCText   *string      `json:"oocText,omitempty"`
	Intention *string      `json:"intention,omitempty"`
	Modifier  *int         `json:"modifier,omitempty"`
}

// UpdatePost updates a post (only unlocked posts can be edited).
//
//nolint:gocognit // Complex update logic with multiple validation checks
func (s *PostService) UpdatePost(
	ctx context.Context,
	userID pgtype.UUID,
	postID string,
	req UpdatePostRequest,
) (*PostResponse, error) {
	postUUID := parseUUIDString(postID)

	// Get post
	post, err := s.queries.GetPost(ctx, postUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPostNotFound
		}
		return nil, err
	}

	// Get scene for GM check
	scene, err := s.queries.GetScene(ctx, post.SceneID)
	if err != nil {
		return nil, err
	}

	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}

	// Check if post is locked (only GM can edit locked posts)
	if post.IsLocked && !isGM {
		return nil, ErrPostLocked
	}

	// Verify ownership or GM status
	isOwner := post.UserID == userID
	if !isOwner && !isGM {
		return nil, ErrNotPostOwner
	}

	// Non-GM users can only edit the most recent post in the scene
	if !isGM && isOwner {
		lastPost, lastErr := s.queries.GetLastScenePost(ctx, post.SceneID)
		if lastErr == nil && lastPost.ID != postUUID {
			return nil, ErrNotMostRecentPost
		}
	}

	// Build update params
	updateParams := generated.UpdatePostParams{
		ID:         postUUID,
		Blocks:     nil,
		OocText:    pgtype.Text{String: "", Valid: false},
		Intention:  pgtype.Text{String: "", Valid: false},
		Modifier:   pgtype.Int4{Int32: 0, Valid: false},
		EditedByGm: false,
	}

	if req.Blocks != nil {
		blocksJSON, marshalErr := json.Marshal(*req.Blocks)
		if marshalErr != nil {
			return nil, marshalErr
		}
		updateParams.Blocks = blocksJSON
	}

	if req.OOCText != nil {
		updateParams.OocText = pgtype.Text{String: *req.OOCText, Valid: true}
	}

	if req.Intention != nil {
		updateParams.Intention = pgtype.Text{String: *req.Intention, Valid: true}
	}

	if req.Modifier != nil {
		//nolint:gosec // Modifier values are bounded by game rules.
		updateParams.Modifier = pgtype.Int4{Int32: int32(*req.Modifier), Valid: true}
	}

	// Mark as edited by GM if GM is editing someone else's post
	if isGM && !isOwner {
		updateParams.EditedByGm = true
	}

	updatedPost, err := s.queries.UpdatePost(ctx, updateParams)
	if err != nil {
		return nil, err
	}

	return s.postToResponse(&updatedPost), nil
}

// DeletePost deletes a post (GM or owner of unlocked most-recent post).
func (s *PostService) DeletePost(
	ctx context.Context,
	userID pgtype.UUID,
	postID string,
) error {
	postUUID := parseUUIDString(postID)

	// Get post
	post, err := s.queries.GetPost(ctx, postUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrPostNotFound
		}
		return err
	}

	// Get scene for GM check
	scene, err := s.queries.GetScene(ctx, post.SceneID)
	if err != nil {
		return err
	}

	// Check GM status
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return err
	}

	// Check ownership
	isOwner := post.UserID == userID

	// Authorization: GM can delete any post, owner can delete their own unlocked most-recent post
	if !isGM {
		if !isOwner {
			return ErrNotPostOwner
		}

		// Owner can only delete unlocked posts
		if post.IsLocked {
			return ErrPostLocked
		}

		// Owner can only delete the most recent post in the scene
		lastPost, lastErr := s.queries.GetLastScenePost(ctx, post.SceneID)
		if lastErr == nil && lastPost.ID != postUUID {
			return ErrNotMostRecentPost
		}
	}

	// Start transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	// Get the post to delete's created_at for finding previous
	createdAt := post.CreatedAt

	// Delete the post
	if deleteErr := qtx.DeletePost(ctx, postUUID); deleteErr != nil {
		return deleteErr
	}

	// Unlock previous post
	prevPost, prevErr := qtx.GetPreviousPost(ctx, generated.GetPreviousPostParams{
		SceneID:   post.SceneID,
		CreatedAt: createdAt,
	})
	if prevErr == nil {
		if unlockErr := qtx.UnlockPost(ctx, prevPost.ID); unlockErr != nil {
			return unlockErr
		}
	}

	return tx.Commit(ctx)
}

// ListScenePosts lists all posts in a scene (with witness filtering).
//
//nolint:nestif // Complex witness filtering logic.
func (s *PostService) ListScenePosts(
	ctx context.Context,
	userID pgtype.UUID,
	sceneID string,
	viewAsCharacterID *string,
) ([]PostResponse, error) {
	sceneUUID := parseUUIDString(sceneID)

	// Get scene
	scene, err := s.queries.GetScene(ctx, sceneUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSceneNotFound
		}
		return nil, err
	}

	// Verify membership
	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, ErrNotMember
	}

	// Check GM status
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}

	// Get posts (GM sees all, players see witnessed posts)
	var posts []generated.ListScenePostsRow
	var postsErr error
	if isGM {
		posts, postsErr = s.queries.ListScenePosts(ctx, sceneUUID)
	} else {
		// Get user's characters in scene for witness filtering
		var characterID pgtype.UUID
		if viewAsCharacterID != nil {
			characterID = parseUUIDString(*viewAsCharacterID)
		} else {
			// Get first user character in scene
			userChars, charsErr := s.queries.GetUserCharactersInScene(ctx, generated.GetUserCharactersInSceneParams{
				ID:     sceneUUID,
				UserID: userID,
			})
			if charsErr == nil && len(userChars) > 0 {
				characterID = userChars[0].ID
			}
		}

		posts, postsErr = s.queries.ListScenePosts(ctx, sceneUUID)
		if postsErr != nil {
			return nil, postsErr
		}

		// Filter by witness
		var filteredPosts []generated.ListScenePostsRow
		for _, p := range posts {
			// Check if character is a witness
			if slices.Contains(p.Witnesses, characterID) {
				filteredPosts = append(filteredPosts, p)
			}
		}
		posts = filteredPosts
	}

	if postsErr != nil {
		return nil, postsErr
	}

	// Convert to response
	var result []PostResponse
	for _, p := range posts {
		result = append(result, *s.listPostRowToResponse(&p))
	}

	return result, nil
}

// GetPost returns a single post.
func (s *PostService) GetPost(
	ctx context.Context,
	userID pgtype.UUID,
	postID string,
) (*PostResponse, error) {
	postUUID := parseUUIDString(postID)

	post, err := s.queries.GetPostWithCharacter(ctx, postUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPostNotFound
		}
		return nil, err
	}

	// Get scene for access check
	scene, err := s.queries.GetScene(ctx, post.SceneID)
	if err != nil {
		return nil, err
	}

	// Verify membership
	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, ErrNotMember
	}

	// Check GM or witness access
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}

	if !isGM {
		// Check if user has a character that witnessed the post
		userChars, charsErr := s.queries.GetUserCharactersInScene(ctx, generated.GetUserCharactersInSceneParams{
			ID:     post.SceneID,
			UserID: userID,
		})
		if charsErr != nil {
			return nil, charsErr
		}

		hasAccess := false
		for _, char := range userChars {
			if slices.Contains(post.Witnesses, char.ID) {
				hasAccess = true
				break
			}
		}

		if !hasAccess {
			return nil, ErrPostNotFound // Hide existence
		}
	}

	return s.postWithCharacterToResponse(&post), nil
}

// UnhidePostRequest represents the request to unhide a post.
type UnhidePostRequest struct {
	Witnesses []string `json:"witnesses,omitempty"` // Optional custom witness list
}

// UnhidePost reveals a hidden post (GM only).
// If witnesses is empty/nil, adds all current scene characters as witnesses.
// Otherwise uses the provided witness list.
func (s *PostService) UnhidePost(
	ctx context.Context,
	userID pgtype.UUID,
	postID string,
	req *UnhidePostRequest,
) (*PostResponse, error) {
	postUUID := parseUUIDString(postID)

	// Get post
	post, err := s.queries.GetPost(ctx, postUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPostNotFound
		}
		return nil, err
	}

	// Verify post is actually hidden
	if !post.IsHidden {
		return nil, errors.New("post is not hidden")
	}

	// Get scene
	scene, err := s.queries.GetScene(ctx, post.SceneID)
	if err != nil {
		return nil, err
	}

	// Only GM can unhide
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isGM {
		return nil, ErrNotGM
	}

	// Determine witnesses
	var witnesses []pgtype.UUID
	if req != nil && len(req.Witnesses) > 0 {
		// Use custom witness list provided by GM
		for _, wID := range req.Witnesses {
			witnesses = append(witnesses, parseUUIDString(wID))
		}
	} else {
		// Default to all current scene characters
		witnesses = scene.CharacterIds
	}

	// Update witnesses and unhide
	updatedPost, err := s.queries.UnhidePostWithCustomWitnesses(ctx, generated.UnhidePostWithCustomWitnessesParams{
		ID:        postUUID,
		Witnesses: witnesses,
	})
	if err != nil {
		return nil, err
	}

	return s.postToResponse(&updatedPost), nil
}

// UpdatePostWitnessesRequest represents the request to update post witnesses.
type UpdatePostWitnessesRequest struct {
	Witnesses []string `json:"witnesses"`
}

// UpdatePostWitnesses updates the witnesses on a post (GM only).
func (s *PostService) UpdatePostWitnesses(
	ctx context.Context,
	userID pgtype.UUID,
	postID string,
	req UpdatePostWitnessesRequest,
) (*PostResponse, error) {
	postUUID := parseUUIDString(postID)

	// Get post
	post, err := s.queries.GetPost(ctx, postUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPostNotFound
		}
		return nil, err
	}

	// Get scene
	scene, err := s.queries.GetScene(ctx, post.SceneID)
	if err != nil {
		return nil, err
	}

	// Only GM can update witnesses
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isGM {
		return nil, ErrNotGM
	}

	// Validate all witness IDs are characters in the scene
	sceneCharIDs := make(map[string]bool)
	for _, charID := range scene.CharacterIds {
		sceneCharIDs[formatUUID(charID.Bytes[:])] = true
	}

	witnesses := make([]pgtype.UUID, 0, len(req.Witnesses))
	for _, wID := range req.Witnesses {
		if !sceneCharIDs[wID] {
			return nil, errors.New("witness not in scene: " + wID)
		}
		witnesses = append(witnesses, parseUUIDString(wID))
	}

	// Update witnesses
	updatedPost, err := s.queries.EditPostWitnesses(ctx, generated.EditPostWitnessesParams{
		ID:        postUUID,
		Witnesses: witnesses,
	})
	if err != nil {
		return nil, err
	}

	return s.postToResponse(&updatedPost), nil
}

// ListHiddenPosts lists all hidden posts in a scene (GM only).
func (s *PostService) ListHiddenPosts(
	ctx context.Context,
	userID pgtype.UUID,
	sceneID string,
) ([]PostResponse, error) {
	sceneUUID := parseUUIDString(sceneID)

	// Get scene
	scene, err := s.queries.GetScene(ctx, sceneUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSceneNotFound
		}
		return nil, err
	}

	// Only GM can view hidden posts list
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isGM {
		return nil, ErrNotGM
	}

	posts, err := s.queries.ListHiddenPostsInScene(ctx, sceneUUID)
	if err != nil {
		return nil, err
	}

	var result []PostResponse
	for _, p := range posts {
		result = append(result, *s.listHiddenPostRowToResponse(&p))
	}

	return result, nil
}

// listHiddenPostRowAdapter wraps *generated.ListHiddenPostsInSceneRow to implement postData.
type listHiddenPostRowAdapter struct {
	p *generated.ListHiddenPostsInSceneRow
}

func (a listHiddenPostRowAdapter) getID() pgtype.UUID               { return a.p.ID }
func (a listHiddenPostRowAdapter) getSceneID() pgtype.UUID          { return a.p.SceneID }
func (a listHiddenPostRowAdapter) getCharacterID() pgtype.UUID      { return a.p.CharacterID }
func (a listHiddenPostRowAdapter) getUserID() pgtype.UUID           { return a.p.UserID }
func (a listHiddenPostRowAdapter) getBlocks() []byte                { return a.p.Blocks }
func (a listHiddenPostRowAdapter) getOocText() pgtype.Text          { return a.p.OocText }
func (a listHiddenPostRowAdapter) getWitnesses() []pgtype.UUID      { return a.p.Witnesses }
func (a listHiddenPostRowAdapter) getIsHidden() bool                { return a.p.IsHidden }
func (a listHiddenPostRowAdapter) getIsDraft() bool                 { return a.p.IsDraft }
func (a listHiddenPostRowAdapter) getIsLocked() bool                { return a.p.IsLocked }
func (a listHiddenPostRowAdapter) getLockedAt() pgtype.Timestamptz  { return a.p.LockedAt }
func (a listHiddenPostRowAdapter) getEditedByGm() bool              { return a.p.EditedByGm }
func (a listHiddenPostRowAdapter) getIntention() pgtype.Text        { return a.p.Intention }
func (a listHiddenPostRowAdapter) getModifier() pgtype.Int4         { return a.p.Modifier }
func (a listHiddenPostRowAdapter) getCreatedAt() pgtype.Timestamptz { return a.p.CreatedAt }
func (a listHiddenPostRowAdapter) getUpdatedAt() pgtype.Timestamptz { return a.p.UpdatedAt }
func (a listHiddenPostRowAdapter) getCharacterName() pgtype.Text    { return a.p.CharacterName }
func (a listHiddenPostRowAdapter) getCharacterAvatar() pgtype.Text  { return a.p.CharacterAvatar }
func (a listHiddenPostRowAdapter) getCharacterType() generated.NullCharacterType {
	return a.p.CharacterType
}

func (s *PostService) listHiddenPostRowToResponse(p *generated.ListHiddenPostsInSceneRow) *PostResponse {
	return buildPostResponse(listHiddenPostRowAdapter{p: p})
}

// Helper functions

// postData is an interface for common post data fields.
type postData interface {
	getID() pgtype.UUID
	getSceneID() pgtype.UUID
	getCharacterID() pgtype.UUID
	getUserID() pgtype.UUID
	getBlocks() []byte
	getOocText() pgtype.Text
	getWitnesses() []pgtype.UUID
	getIsHidden() bool
	getIsDraft() bool
	getIsLocked() bool
	getLockedAt() pgtype.Timestamptz
	getEditedByGm() bool
	getIntention() pgtype.Text
	getModifier() pgtype.Int4
	getCreatedAt() pgtype.Timestamptz
	getUpdatedAt() pgtype.Timestamptz
	getCharacterName() pgtype.Text
	getCharacterAvatar() pgtype.Text
	getCharacterType() generated.NullCharacterType
}

// postDataAdapter wraps *generated.Post to implement postData.
type postDataAdapter struct {
	p *generated.Post
}

func (a postDataAdapter) getID() pgtype.UUID               { return a.p.ID }
func (a postDataAdapter) getSceneID() pgtype.UUID          { return a.p.SceneID }
func (a postDataAdapter) getCharacterID() pgtype.UUID      { return a.p.CharacterID }
func (a postDataAdapter) getUserID() pgtype.UUID           { return a.p.UserID }
func (a postDataAdapter) getBlocks() []byte                { return a.p.Blocks }
func (a postDataAdapter) getOocText() pgtype.Text          { return a.p.OocText }
func (a postDataAdapter) getWitnesses() []pgtype.UUID      { return a.p.Witnesses }
func (a postDataAdapter) getIsHidden() bool                { return a.p.IsHidden }
func (a postDataAdapter) getIsDraft() bool                 { return a.p.IsDraft }
func (a postDataAdapter) getIsLocked() bool                { return a.p.IsLocked }
func (a postDataAdapter) getLockedAt() pgtype.Timestamptz  { return a.p.LockedAt }
func (a postDataAdapter) getEditedByGm() bool              { return a.p.EditedByGm }
func (a postDataAdapter) getIntention() pgtype.Text        { return a.p.Intention }
func (a postDataAdapter) getModifier() pgtype.Int4         { return a.p.Modifier }
func (a postDataAdapter) getCreatedAt() pgtype.Timestamptz { return a.p.CreatedAt }
func (a postDataAdapter) getUpdatedAt() pgtype.Timestamptz { return a.p.UpdatedAt }
func (a postDataAdapter) getCharacterName() pgtype.Text    { return pgtype.Text{} }
func (a postDataAdapter) getCharacterAvatar() pgtype.Text  { return pgtype.Text{} }
func (a postDataAdapter) getCharacterType() generated.NullCharacterType {
	return generated.NullCharacterType{}
}

// listPostRowAdapter wraps *generated.ListScenePostsRow to implement postData.
type listPostRowAdapter struct {
	p *generated.ListScenePostsRow
}

func (a listPostRowAdapter) getID() pgtype.UUID                            { return a.p.ID }
func (a listPostRowAdapter) getSceneID() pgtype.UUID                       { return a.p.SceneID }
func (a listPostRowAdapter) getCharacterID() pgtype.UUID                   { return a.p.CharacterID }
func (a listPostRowAdapter) getUserID() pgtype.UUID                        { return a.p.UserID }
func (a listPostRowAdapter) getBlocks() []byte                             { return a.p.Blocks }
func (a listPostRowAdapter) getOocText() pgtype.Text                       { return a.p.OocText }
func (a listPostRowAdapter) getWitnesses() []pgtype.UUID                   { return a.p.Witnesses }
func (a listPostRowAdapter) getIsHidden() bool                             { return a.p.IsHidden }
func (a listPostRowAdapter) getIsDraft() bool                              { return a.p.IsDraft }
func (a listPostRowAdapter) getIsLocked() bool                             { return a.p.IsLocked }
func (a listPostRowAdapter) getLockedAt() pgtype.Timestamptz               { return a.p.LockedAt }
func (a listPostRowAdapter) getEditedByGm() bool                           { return a.p.EditedByGm }
func (a listPostRowAdapter) getIntention() pgtype.Text                     { return a.p.Intention }
func (a listPostRowAdapter) getModifier() pgtype.Int4                      { return a.p.Modifier }
func (a listPostRowAdapter) getCreatedAt() pgtype.Timestamptz              { return a.p.CreatedAt }
func (a listPostRowAdapter) getUpdatedAt() pgtype.Timestamptz              { return a.p.UpdatedAt }
func (a listPostRowAdapter) getCharacterName() pgtype.Text                 { return a.p.CharacterName }
func (a listPostRowAdapter) getCharacterAvatar() pgtype.Text               { return a.p.CharacterAvatar }
func (a listPostRowAdapter) getCharacterType() generated.NullCharacterType { return a.p.CharacterType }

// postWithCharacterAdapter wraps *generated.GetPostWithCharacterRow to implement postData.
type postWithCharacterAdapter struct {
	p *generated.GetPostWithCharacterRow
}

func (a postWithCharacterAdapter) getID() pgtype.UUID               { return a.p.ID }
func (a postWithCharacterAdapter) getSceneID() pgtype.UUID          { return a.p.SceneID }
func (a postWithCharacterAdapter) getCharacterID() pgtype.UUID      { return a.p.CharacterID }
func (a postWithCharacterAdapter) getUserID() pgtype.UUID           { return a.p.UserID }
func (a postWithCharacterAdapter) getBlocks() []byte                { return a.p.Blocks }
func (a postWithCharacterAdapter) getOocText() pgtype.Text          { return a.p.OocText }
func (a postWithCharacterAdapter) getWitnesses() []pgtype.UUID      { return a.p.Witnesses }
func (a postWithCharacterAdapter) getIsHidden() bool                { return a.p.IsHidden }
func (a postWithCharacterAdapter) getIsDraft() bool                 { return a.p.IsDraft }
func (a postWithCharacterAdapter) getIsLocked() bool                { return a.p.IsLocked }
func (a postWithCharacterAdapter) getLockedAt() pgtype.Timestamptz  { return a.p.LockedAt }
func (a postWithCharacterAdapter) getEditedByGm() bool              { return a.p.EditedByGm }
func (a postWithCharacterAdapter) getIntention() pgtype.Text        { return a.p.Intention }
func (a postWithCharacterAdapter) getModifier() pgtype.Int4         { return a.p.Modifier }
func (a postWithCharacterAdapter) getCreatedAt() pgtype.Timestamptz { return a.p.CreatedAt }
func (a postWithCharacterAdapter) getUpdatedAt() pgtype.Timestamptz { return a.p.UpdatedAt }
func (a postWithCharacterAdapter) getCharacterName() pgtype.Text    { return a.p.CharacterName }
func (a postWithCharacterAdapter) getCharacterAvatar() pgtype.Text  { return a.p.CharacterAvatar }
func (a postWithCharacterAdapter) getCharacterType() generated.NullCharacterType {
	return a.p.CharacterType
}

// buildPostResponse constructs a PostResponse from any postData implementation.
func buildPostResponse(p postData) *PostResponse {
	postID := p.getID()
	sceneID := p.getSceneID()
	userID := p.getUserID()
	createdAt := p.getCreatedAt()
	updatedAt := p.getUpdatedAt()

	resp := &PostResponse{
		ID:              formatUUID(postID.Bytes[:]),
		SceneID:         formatUUID(sceneID.Bytes[:]),
		CharacterID:     nil,
		UserID:          formatUUID(userID.Bytes[:]),
		Blocks:          nil,
		OOCText:         nil,
		Witnesses:       nil,
		IsHidden:        p.getIsHidden(),
		IsDraft:         p.getIsDraft(),
		IsLocked:        p.getIsLocked(),
		LockedAt:        nil,
		EditedByGM:      p.getEditedByGm(),
		Intention:       nil,
		Modifier:        nil,
		CharacterName:   nil,
		CharacterAvatar: nil,
		CharacterType:   nil,
		CreatedAt:       createdAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:       updatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
	}

	if charID := p.getCharacterID(); charID.Valid {
		charIDStr := formatUUID(charID.Bytes[:])
		resp.CharacterID = &charIDStr
	}

	var blocks []PostBlock
	if unmarshalErr := json.Unmarshal(p.getBlocks(), &blocks); unmarshalErr == nil {
		resp.Blocks = blocks
	}

	if oocText := p.getOocText(); oocText.Valid {
		resp.OOCText = &oocText.String
	}

	for _, w := range p.getWitnesses() {
		resp.Witnesses = append(resp.Witnesses, formatUUID(w.Bytes[:]))
	}

	if lockedAt := p.getLockedAt(); lockedAt.Valid {
		lockedAtStr := lockedAt.Time.Format("2006-01-02T15:04:05Z07:00")
		resp.LockedAt = &lockedAtStr
	}

	if intention := p.getIntention(); intention.Valid {
		resp.Intention = &intention.String
	}

	if modifier := p.getModifier(); modifier.Valid {
		mod := int(modifier.Int32)
		resp.Modifier = &mod
	}

	if charName := p.getCharacterName(); charName.Valid {
		resp.CharacterName = &charName.String
	}
	if charAvatar := p.getCharacterAvatar(); charAvatar.Valid {
		resp.CharacterAvatar = &charAvatar.String
	}
	if charType := p.getCharacterType(); charType.Valid {
		ct := string(charType.CharacterType)
		resp.CharacterType = &ct
	}

	return resp
}

func (s *PostService) postToResponse(p *generated.Post) *PostResponse {
	return buildPostResponse(postDataAdapter{p: p})
}

func (s *PostService) listPostRowToResponse(p *generated.ListScenePostsRow) *PostResponse {
	return buildPostResponse(listPostRowAdapter{p: p})
}

func (s *PostService) postWithCharacterToResponse(p *generated.GetPostWithCharacterRow) *PostResponse {
	return buildPostResponse(postWithCharacterAdapter{p: p})
}
