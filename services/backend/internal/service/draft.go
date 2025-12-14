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

// Draft errors.
var (
	ErrDraftNotFound = errors.New("draft not found")
)

// DraftService handles compose draft business logic.
type DraftService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

// NewDraftService creates a new DraftService.
func NewDraftService(pool *pgxpool.Pool) *DraftService {
	return &DraftService{
		queries: generated.New(pool),
		pool:    pool,
	}
}

// SaveDraftRequest represents the request to save a draft.
type SaveDraftRequest struct {
	SceneID     string      `json:"sceneId"`
	CharacterID string      `json:"characterId"`
	Blocks      []PostBlock `json:"blocks"`
	OOCText     *string     `json:"oocText"`
	Intention   *string     `json:"intention"`
	Modifier    *int        `json:"modifier"`
	IsHidden    bool        `json:"isHidden"`
}

// DraftResponse represents a draft in the API response.
type DraftResponse struct {
	ID            string      `json:"id"`
	SceneID       string      `json:"sceneId"`
	CharacterID   string      `json:"characterId"`
	UserID        string      `json:"userId"`
	Blocks        []PostBlock `json:"blocks"`
	OOCText       *string     `json:"oocText"`
	Intention     *string     `json:"intention"`
	Modifier      *int        `json:"modifier"`
	IsHidden      bool        `json:"isHidden"`
	SceneTitle    *string     `json:"sceneTitle,omitempty"`
	CharacterName *string     `json:"characterName,omitempty"`
	UpdatedAt     string      `json:"updatedAt"`
}

// SaveDraft saves or updates a compose draft.
//
//nolint:gocognit,funlen // Complex validation logic with necessary nesting.
func (s *DraftService) SaveDraft(
	ctx context.Context,
	userID pgtype.UUID,
	req SaveDraftRequest,
) (*DraftResponse, error) {
	sceneID := parseUUIDString(req.SceneID)
	characterID := parseUUIDString(req.CharacterID)

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

	// Verify character is in scene
	inScene, err := s.queries.IsCharacterInScene(ctx, generated.IsCharacterInSceneParams{
		ID:      sceneID,
		Column2: characterID,
	})
	if err != nil {
		return nil, err
	}
	if !inScene {
		return nil, ErrCharacterNotInScene
	}

	// Verify user owns character or is GM
	char, err := s.queries.GetCharacter(ctx, characterID)
	if err != nil {
		return nil, err
	}

	assignment, err := s.queries.GetCharacterAssignment(ctx, characterID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	if errors.Is(err, pgx.ErrNoRows) || !assignment.UserID.Valid {
		if !isGM {
			return nil, ErrCharacterNotOwned
		}
	} else if assignment.UserID != userID && !isGM {
		return nil, ErrCharacterNotOwned
	}

	// NPCs require GM
	if char.CharacterType == generated.CharacterTypeNpc && !isGM {
		return nil, ErrCharacterNotOwned
	}

	// Marshal blocks to JSON
	blocksJSON, err := json.Marshal(req.Blocks)
	if err != nil {
		return nil, err
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

	// Upsert draft
	draft, err := s.queries.UpsertComposeDraft(ctx, generated.UpsertComposeDraftParams{
		SceneID:     sceneID,
		CharacterID: characterID,
		UserID:      userID,
		Blocks:      blocksJSON,
		OocText:     oocText,
		Intention:   intention,
		Modifier:    modifier,
		IsHidden:    req.IsHidden,
	})
	if err != nil {
		return nil, err
	}

	return s.draftToResponse(&draft), nil
}

// GetDraft retrieves a compose draft.
func (s *DraftService) GetDraft(
	ctx context.Context,
	userID pgtype.UUID,
	sceneID, characterID string,
) (*DraftResponse, error) {
	sceneUUID := parseUUIDString(sceneID)
	characterUUID := parseUUIDString(characterID)

	draft, err := s.queries.GetUserDraftInScene(ctx, generated.GetUserDraftInSceneParams{
		SceneID:     sceneUUID,
		CharacterID: characterUUID,
		UserID:      userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrDraftNotFound
		}
		return nil, err
	}

	return s.draftToResponse(&draft), nil
}

// DeleteDraft deletes a compose draft.
func (s *DraftService) DeleteDraft(
	ctx context.Context,
	userID pgtype.UUID,
	sceneID, characterID string,
) error {
	sceneUUID := parseUUIDString(sceneID)
	characterUUID := parseUUIDString(characterID)

	// Get draft to verify ownership
	draft, err := s.queries.GetUserDraftInScene(ctx, generated.GetUserDraftInSceneParams{
		SceneID:     sceneUUID,
		CharacterID: characterUUID,
		UserID:      userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil // Already deleted
		}
		return err
	}

	return s.queries.DeleteComposeDraft(ctx, draft.ID)
}

// ListUserDrafts lists all drafts for a user.
func (s *DraftService) ListUserDrafts(
	ctx context.Context,
	userID pgtype.UUID,
) ([]DraftResponse, error) {
	drafts, err := s.queries.ListUserDrafts(ctx, userID)
	if err != nil {
		return nil, err
	}

	var result []DraftResponse
	for _, d := range drafts {
		result = append(result, *s.listDraftRowToResponse(&d))
	}

	return result, nil
}

// Helper functions

func (s *DraftService) draftToResponse(d *generated.ComposeDraft) *DraftResponse {
	resp := &DraftResponse{
		ID:            formatUUID(d.ID.Bytes[:]),
		SceneID:       formatUUID(d.SceneID.Bytes[:]),
		CharacterID:   formatUUID(d.CharacterID.Bytes[:]),
		UserID:        formatUUID(d.UserID.Bytes[:]),
		Blocks:        nil,
		OOCText:       nil,
		Intention:     nil,
		Modifier:      nil,
		IsHidden:      d.IsHidden,
		SceneTitle:    nil,
		CharacterName: nil,
		UpdatedAt:     d.UpdatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
	}

	// Parse blocks
	var blocks []PostBlock
	if err := json.Unmarshal(d.Blocks, &blocks); err == nil {
		resp.Blocks = blocks
	}

	if d.OocText.Valid {
		resp.OOCText = &d.OocText.String
	}

	if d.Intention.Valid {
		resp.Intention = &d.Intention.String
	}

	if d.Modifier.Valid {
		mod := int(d.Modifier.Int32)
		resp.Modifier = &mod
	}

	return resp
}

func (s *DraftService) listDraftRowToResponse(d *generated.ListUserDraftsRow) *DraftResponse {
	resp := &DraftResponse{
		ID:            formatUUID(d.ID.Bytes[:]),
		SceneID:       formatUUID(d.SceneID.Bytes[:]),
		CharacterID:   formatUUID(d.CharacterID.Bytes[:]),
		UserID:        formatUUID(d.UserID.Bytes[:]),
		Blocks:        nil,
		OOCText:       nil,
		Intention:     nil,
		Modifier:      nil,
		IsHidden:      d.IsHidden,
		SceneTitle:    &d.SceneTitle,
		CharacterName: &d.CharacterName,
		UpdatedAt:     d.UpdatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
	}

	// Parse blocks
	var blocks []PostBlock
	if err := json.Unmarshal(d.Blocks, &blocks); err == nil {
		resp.Blocks = blocks
	}

	if d.OocText.Valid {
		resp.OOCText = &d.OocText.String
	}

	if d.Intention.Valid {
		resp.Intention = &d.Intention.String
	}

	if d.Modifier.Valid {
		mod := int(d.Modifier.Int32)
		resp.Modifier = &mod
	}

	return resp
}
