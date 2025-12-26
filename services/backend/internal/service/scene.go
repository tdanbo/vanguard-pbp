package service

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
)

// Scene errors.
var (
	ErrSceneNotFound     = errors.New("scene not found")
	ErrSceneLimitReached = errors.New("scene limit reached (25 max)")
	ErrNoArchivedScenes  = errors.New("no archived scenes available to delete")
	ErrNotGMPhase        = errors.New("characters can only be moved during GM Phase")
	ErrCharacterInScene  = errors.New("character is already in a scene")
)

// Scene warnings.
const (
	SceneWarningThreshold20 = 20
	SceneWarningThreshold23 = 23
	SceneWarningThreshold24 = 24
	MaxScenes               = 25
)

// SceneService handles scene business logic.
type SceneService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

// NewSceneService creates a new SceneService.
func NewSceneService(pool *pgxpool.Pool) *SceneService {
	return &SceneService{
		queries: generated.New(pool),
		pool:    pool,
	}
}

// CreateSceneRequest represents the request to create a scene.
type CreateSceneRequest struct {
	Title       string `json:"title"`
	Description string `json:"description"`
}

// CreateSceneResponse includes the created scene and any warnings.
type CreateSceneResponse struct {
	Scene          *generated.Scene `json:"scene"`
	Warning        string           `json:"warning,omitempty"`
	DeletedSceneID *string          `json:"deletedSceneId,omitempty"`
}

// CreateScene creates a new scene in a campaign (GM only).
func (s *SceneService) CreateScene(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
	req CreateSceneRequest,
) (*CreateSceneResponse, error) {
	// Verify user is GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: campaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isGM {
		return nil, ErrNotGM
	}

	// Start transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	// Check scene count
	count, err := qtx.CountCampaignScenes(ctx, campaignID)
	if err != nil {
		return nil, err
	}

	//nolint:exhaustruct // Fields are set conditionally below
	response := &CreateSceneResponse{}

	// Generate warnings
	switch count {
	case SceneWarningThreshold20:
		response.Warning = "You have 20 of 25 scenes"
	case SceneWarningThreshold23:
		response.Warning = "Approaching scene limit (23/25)"
	case SceneWarningThreshold24:
		response.Warning = "Nearly at scene limit (24/25)"
	}

	// Handle auto-deletion at 25+ scenes
	if count >= MaxScenes {
		deletedIDStr, autoDeleteErr := s.autoDeleteOldestArchivedScene(ctx, qtx, campaignID)
		if autoDeleteErr != nil {
			return nil, autoDeleteErr
		}
		response.DeletedSceneID = &deletedIDStr
		response.Warning = "Created new scene. Oldest archived scene was auto-deleted."
	}

	// Create scene
	scene, err := qtx.CreateScene(ctx, generated.CreateSceneParams{
		CampaignID:  campaignID,
		Title:       req.Title,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
	})
	if err != nil {
		return nil, err
	}

	// Increment scene count
	if incrementErr := qtx.IncrementSceneCount(ctx, campaignID); incrementErr != nil {
		return nil, incrementErr
	}

	if commitErr := tx.Commit(ctx); commitErr != nil {
		return nil, commitErr
	}

	response.Scene = &scene
	return response, nil
}

// GetScene retrieves a scene.
func (s *SceneService) GetScene(
	ctx context.Context,
	sceneID, userID pgtype.UUID,
) (*generated.Scene, error) {
	scene, err := s.queries.GetScene(ctx, sceneID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSceneNotFound
		}
		return nil, err
	}

	// Verify user is a member of the campaign
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

	return &scene, nil
}

// ListCampaignScenes returns all scenes in a campaign.
// When fog of war is enabled, players only see scenes where their characters have witnessed posts.
// GMs always see all scenes.
// If characterID is provided and valid, fog of war filtering uses that specific character instead
// of aggregating across all user's characters.
func (s *SceneService) ListCampaignScenes(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
	characterID *pgtype.UUID,
) ([]generated.Scene, error) {
	// Verify user is a member
	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: campaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, ErrNotMember
	}

	// Check if user is GM - GMs always see all scenes
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: campaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if isGM {
		return s.queries.ListCampaignScenes(ctx, campaignID)
	}

	// Get campaign to check fog of war setting
	campaign, err := s.queries.GetCampaign(ctx, campaignID)
	if err != nil {
		return nil, err
	}

	// Parse settings to check fog of war
	fogOfWarEnabled := s.isFogOfWarEnabled(campaign.Settings)

	// If fog of war is disabled, show all scenes
	if !fogOfWarEnabled {
		return s.queries.ListCampaignScenes(ctx, campaignID)
	}

	// Fog of war enabled - check if we should filter by specific character
	if characterID != nil && characterID.Valid {
		// Use character-specific filtering
		return s.queries.GetVisibleScenesForCharacter(ctx, generated.GetVisibleScenesForCharacterParams{
			CampaignID: campaignID,
			Column2:    *characterID,
		})
	}

	// Fall back to aggregate visibility across all user's characters
	return s.queries.GetVisibleScenesForUser(ctx, generated.GetVisibleScenesForUserParams{
		CampaignID: campaignID,
		UserID:     userID,
	})
}

// isFogOfWarEnabled parses campaign settings and returns whether fog of war is enabled.
func (s *SceneService) isFogOfWarEnabled(settingsJSON []byte) bool {
	if len(settingsJSON) == 0 {
		return true // Default to enabled per PRD
	}

	var settings map[string]any
	if err := json.Unmarshal(settingsJSON, &settings); err != nil {
		return true // Default to enabled if parsing fails
	}

	fog, ok := settings["fogOfWar"]
	if !ok {
		return true // Default to enabled if not set
	}

	fogBool, ok := fog.(bool)
	if !ok {
		return true // Default to enabled if not a boolean
	}

	return fogBool
}

// UpdateSceneRequest represents the request to update a scene.
type UpdateSceneRequest struct {
	Title       *string `json:"title,omitempty"`
	Description *string `json:"description,omitempty"`
}

// UpdateScene updates a scene (GM only).
func (s *SceneService) UpdateScene(
	ctx context.Context,
	sceneID, userID pgtype.UUID,
	req UpdateSceneRequest,
) (*generated.Scene, error) {
	// Get scene to verify campaign
	scene, err := s.queries.GetScene(ctx, sceneID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSceneNotFound
		}
		return nil, err
	}

	// Verify user is GM
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

	// Build update params
	//nolint:exhaustruct // Only ID is required, other fields are set conditionally
	params := generated.UpdateSceneParams{
		ID: sceneID,
	}

	if req.Title != nil {
		params.Title = *req.Title
	}

	if req.Description != nil {
		params.Description = pgtype.Text{String: *req.Description, Valid: true}
	}

	updated, err := s.queries.UpdateScene(ctx, params)
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

// ArchiveScene archives a scene (GM only).
func (s *SceneService) ArchiveScene(
	ctx context.Context,
	sceneID, userID pgtype.UUID,
) (*generated.Scene, error) {
	// Get scene to verify campaign
	scene, err := s.queries.GetScene(ctx, sceneID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSceneNotFound
		}
		return nil, err
	}

	// Verify user is GM
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

	archived, err := s.queries.ArchiveScene(ctx, sceneID)
	if err != nil {
		return nil, err
	}

	return &archived, nil
}

// UnarchiveScene unarchives a scene (GM only).
func (s *SceneService) UnarchiveScene(
	ctx context.Context,
	sceneID, userID pgtype.UUID,
) (*generated.Scene, error) {
	// Get scene to verify campaign
	scene, err := s.queries.GetScene(ctx, sceneID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSceneNotFound
		}
		return nil, err
	}

	// Verify user is GM
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

	unarchived, err := s.queries.UnarchiveScene(ctx, sceneID)
	if err != nil {
		return nil, err
	}

	return &unarchived, nil
}

// AddCharacterToScene adds a character to a scene (GM only, GM Phase only).
func (s *SceneService) AddCharacterToScene(
	ctx context.Context,
	sceneID, characterID, userID pgtype.UUID,
) (*generated.Scene, error) {
	// Get scene with campaign info
	sceneWithCampaign, err := s.queries.GetSceneWithCampaign(ctx, sceneID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSceneNotFound
		}
		return nil, err
	}

	// Verify user is GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: sceneWithCampaign.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isGM {
		return nil, ErrNotGM
	}

	// Verify GM Phase
	if sceneWithCampaign.CurrentPhase != generated.CampaignPhaseGmPhase {
		return nil, ErrNotGMPhase
	}

	// Verify character exists and belongs to this campaign
	char, err := s.queries.GetCharacter(ctx, characterID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCharacterNotFound
		}
		return nil, err
	}

	if char.CampaignID != sceneWithCampaign.CampaignID {
		return nil, ErrCharacterNotFound
	}

	// Start transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	// Remove character from any other scenes first (single-scene constraint)
	err = qtx.RemoveCharacterFromAllScenes(ctx, generated.RemoveCharacterFromAllScenesParams{
		CampaignID: sceneWithCampaign.CampaignID,
		Column2:    characterID,
	})
	if err != nil {
		return nil, err
	}

	// Add to this scene
	scene, err := qtx.AddCharacterToScene(ctx, generated.AddCharacterToSceneParams{
		ID:      sceneID,
		Column2: characterID,
	})
	if err != nil {
		return nil, err
	}

	if commitErr := tx.Commit(ctx); commitErr != nil {
		return nil, commitErr
	}

	return &scene, nil
}

// RemoveCharacterFromScene removes a character from a scene (GM only, GM Phase only).
func (s *SceneService) RemoveCharacterFromScene(
	ctx context.Context,
	sceneID, characterID, userID pgtype.UUID,
) (*generated.Scene, error) {
	// Get scene with campaign info
	sceneWithCampaign, err := s.queries.GetSceneWithCampaign(ctx, sceneID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSceneNotFound
		}
		return nil, err
	}

	// Verify user is GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: sceneWithCampaign.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isGM {
		return nil, ErrNotGM
	}

	// Verify GM Phase
	if sceneWithCampaign.CurrentPhase != generated.CampaignPhaseGmPhase {
		return nil, ErrNotGMPhase
	}

	// Remove from scene
	scene, err := s.queries.RemoveCharacterFromScene(ctx, generated.RemoveCharacterFromSceneParams{
		ID:      sceneID,
		Column2: characterID,
	})
	if err != nil {
		return nil, err
	}

	return &scene, nil
}

// GetSceneCharacters returns all characters in a scene.
func (s *SceneService) GetSceneCharacters(
	ctx context.Context,
	sceneID, userID pgtype.UUID,
) ([]generated.GetSceneCharactersRow, error) {
	// Get scene to verify campaign membership
	scene, err := s.queries.GetScene(ctx, sceneID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSceneNotFound
		}
		return nil, err
	}

	// Verify user is a member
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

	return s.queries.GetSceneCharacters(ctx, sceneID)
}

// GetSceneCount returns the current scene count and warning level for a campaign.
func (s *SceneService) GetSceneCount(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
) (int64, string, error) {
	// Verify user is a member
	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: campaignID,
		UserID:     userID,
	})
	if err != nil {
		return 0, "", err
	}
	if !isMember {
		return 0, "", ErrNotMember
	}

	count, err := s.queries.CountCampaignScenes(ctx, campaignID)
	if err != nil {
		return 0, "", err
	}

	var warning string
	switch {
	case count == SceneWarningThreshold20:
		warning = "You have 20 of 25 scenes"
	case count == SceneWarningThreshold23:
		warning = "Approaching scene limit (23/25)"
	case count == SceneWarningThreshold24:
		warning = "Nearly at scene limit (24/25)"
	case count >= MaxScenes:
		warning = "At scene limit. Next scene will delete oldest archived."
	}

	return count, warning, nil
}

// autoDeleteOldestArchivedScene finds and deletes the oldest archived scene.
// Returns the deleted scene's ID string or an error.
func (s *SceneService) autoDeleteOldestArchivedScene(
	ctx context.Context,
	qtx *generated.Queries,
	campaignID pgtype.UUID,
) (string, error) {
	oldest, err := qtx.GetOldestArchivedScene(ctx, campaignID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNoArchivedScenes
		}
		return "", err
	}

	if deleteErr := qtx.DeleteScene(ctx, oldest.ID); deleteErr != nil {
		return "", deleteErr
	}

	if decrementErr := qtx.DecrementSceneCount(ctx, campaignID); decrementErr != nil {
		return "", decrementErr
	}

	return formatUUID(oldest.ID.Bytes[:]), nil
}

// DeleteScene deletes a scene (GM only).
// Returns the header image URL if present, so the caller can delete from storage.
func (s *SceneService) DeleteScene(
	ctx context.Context,
	sceneID, userID pgtype.UUID,
) (string, pgtype.UUID, error) {
	// Get scene to verify campaign and get header image URL
	scene, err := s.queries.GetScene(ctx, sceneID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", pgtype.UUID{}, ErrSceneNotFound
		}
		return "", pgtype.UUID{}, err
	}

	// Verify user is GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return "", pgtype.UUID{}, err
	}
	if !isGM {
		return "", pgtype.UUID{}, ErrNotGM
	}

	// Start transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", pgtype.UUID{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	// Delete scene (cascades to posts, compose_locks, compose_drafts via FK)
	if deleteErr := qtx.DeleteScene(ctx, sceneID); deleteErr != nil {
		return "", pgtype.UUID{}, deleteErr
	}

	// Decrement scene count
	if decrementErr := qtx.DecrementSceneCount(ctx, scene.CampaignID); decrementErr != nil {
		return "", pgtype.UUID{}, decrementErr
	}

	if commitErr := tx.Commit(ctx); commitErr != nil {
		return "", pgtype.UUID{}, commitErr
	}

	// Return header image URL for cleanup
	if scene.HeaderImageUrl.Valid {
		return scene.HeaderImageUrl.String, scene.CampaignID, nil
	}
	return "", scene.CampaignID, nil
}

// formatUUID converts a UUID byte slice to a string.
//
//nolint:mnd // UUID byte lengths and hex conversion are standard constants
func formatUUID(b []byte) string {
	if len(b) != 16 {
		return ""
	}
	return string([]byte{
		hexChar(b[0] >> 4), hexChar(b[0] & 0xf),
		hexChar(b[1] >> 4), hexChar(b[1] & 0xf),
		hexChar(b[2] >> 4), hexChar(b[2] & 0xf),
		hexChar(b[3] >> 4), hexChar(b[3] & 0xf),
		'-',
		hexChar(b[4] >> 4), hexChar(b[4] & 0xf),
		hexChar(b[5] >> 4), hexChar(b[5] & 0xf),
		'-',
		hexChar(b[6] >> 4), hexChar(b[6] & 0xf),
		hexChar(b[7] >> 4), hexChar(b[7] & 0xf),
		'-',
		hexChar(b[8] >> 4), hexChar(b[8] & 0xf),
		hexChar(b[9] >> 4), hexChar(b[9] & 0xf),
		'-',
		hexChar(b[10] >> 4), hexChar(b[10] & 0xf),
		hexChar(b[11] >> 4), hexChar(b[11] & 0xf),
		hexChar(b[12] >> 4), hexChar(b[12] & 0xf),
		hexChar(b[13] >> 4), hexChar(b[13] & 0xf),
		hexChar(b[14] >> 4), hexChar(b[14] & 0xf),
		hexChar(b[15] >> 4), hexChar(b[15] & 0xf),
	})
}

//nolint:mnd // Hex conversion constants are standard
func hexChar(b byte) byte {
	if b < 10 {
		return '0' + b
	}
	return 'a' + b - 10
}
