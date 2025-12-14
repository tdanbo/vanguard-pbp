package service

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
)

// Character errors.
var (
	ErrCharacterNotFound   = errors.New("character not found")
	ErrCharacterNotInScene = errors.New("character is not in this scene")
	ErrCharacterArchived   = errors.New("character is archived")
)

// CharacterService handles character business logic.
type CharacterService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

// NewCharacterService creates a new CharacterService.
func NewCharacterService(pool *pgxpool.Pool) *CharacterService {
	return &CharacterService{
		queries: generated.New(pool),
		pool:    pool,
	}
}

// CreateCharacterRequest represents the request to create a character.
type CreateCharacterRequest struct {
	DisplayName   string  `json:"displayName"`
	Description   string  `json:"description"`
	CharacterType string  `json:"characterType"`
	AssignToUser  *string `json:"assignToUser,omitempty"`
}

// CreateCharacter creates a new character in a campaign (GM only).
func (s *CharacterService) CreateCharacter(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
	req CreateCharacterRequest,
) (*generated.ListCampaignCharactersRow, error) {
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

	// Validate character type
	var charType generated.CharacterType
	switch req.CharacterType {
	case "pc":
		charType = generated.CharacterTypePc
	case "npc":
		charType = generated.CharacterTypeNpc
	default:
		charType = generated.CharacterTypePc
	}

	// Start transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	// Create character
	char, err := qtx.CreateCharacter(ctx, generated.CreateCharacterParams{
		CampaignID:    campaignID,
		DisplayName:   req.DisplayName,
		Description:   pgtype.Text{String: req.Description, Valid: req.Description != ""},
		CharacterType: charType,
	})
	if err != nil {
		return nil, err
	}

	// Assign to user if provided
	if req.AssignToUser != nil && *req.AssignToUser != "" {
		assignUserID := parseUUIDString(*req.AssignToUser)
		if assignUserID.Valid {
			_, err = qtx.AssignCharacter(ctx, generated.AssignCharacterParams{
				CharacterID: char.ID,
				UserID:      assignUserID,
			})
			if err != nil {
				return nil, err
			}
		}
	}

	if commitErr := tx.Commit(ctx); commitErr != nil {
		return nil, commitErr
	}

	// Fetch the full character with assignment
	return s.GetCharacter(ctx, char.ID, userID)
}

// GetCharacter retrieves a character with its assignment.
func (s *CharacterService) GetCharacter(
	ctx context.Context,
	characterID, userID pgtype.UUID,
) (*generated.ListCampaignCharactersRow, error) {
	char, err := s.queries.GetCharacterWithAssignment(ctx, characterID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCharacterNotFound
		}
		return nil, err
	}

	// Verify user is a member of the campaign
	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: char.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, ErrNotMember
	}

	return &generated.ListCampaignCharactersRow{
		ID:             char.ID,
		CampaignID:     char.CampaignID,
		DisplayName:    char.DisplayName,
		Description:    char.Description,
		AvatarUrl:      char.AvatarUrl,
		CharacterType:  char.CharacterType,
		IsArchived:     char.IsArchived,
		CreatedAt:      char.CreatedAt,
		UpdatedAt:      char.UpdatedAt,
		AssignedUserID: char.AssignedUserID,
		AssignedAt:     char.AssignedAt,
	}, nil
}

// ListCampaignCharacters returns all characters in a campaign.
func (s *CharacterService) ListCampaignCharacters(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
) ([]generated.ListCampaignCharactersRow, error) {
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

	return s.queries.ListCampaignCharacters(ctx, campaignID)
}

// UpdateCharacterRequest represents the request to update a character.
type UpdateCharacterRequest struct {
	DisplayName   *string `json:"displayName,omitempty"`
	Description   *string `json:"description,omitempty"`
	CharacterType *string `json:"characterType,omitempty"`
}

// UpdateCharacter updates a character (GM only).
func (s *CharacterService) UpdateCharacter(
	ctx context.Context,
	characterID, userID pgtype.UUID,
	req UpdateCharacterRequest,
) (*generated.Character, error) {
	// Get character to verify campaign
	char, err := s.queries.GetCharacter(ctx, characterID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCharacterNotFound
		}
		return nil, err
	}

	// Verify user is GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: char.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isGM {
		return nil, ErrNotGM
	}

	// Build update params - start with current values
	params := generated.UpdateCharacterParams{
		ID:            characterID,
		DisplayName:   char.DisplayName,
		Description:   char.Description,
		AvatarUrl:     char.AvatarUrl,
		CharacterType: char.CharacterType,
	}

	if req.DisplayName != nil {
		params.DisplayName = *req.DisplayName
	}

	if req.Description != nil {
		params.Description = pgtype.Text{String: *req.Description, Valid: true}
	}

	if req.CharacterType != nil {
		switch *req.CharacterType {
		case "pc":
			params.CharacterType = generated.CharacterTypePc
		case "npc":
			params.CharacterType = generated.CharacterTypeNpc
		}
	}

	updated, err := s.queries.UpdateCharacter(ctx, params)
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

// ArchiveCharacter archives a character (GM only).
func (s *CharacterService) ArchiveCharacter(
	ctx context.Context,
	characterID, userID pgtype.UUID,
) (*generated.Character, error) {
	// Get character to verify campaign
	char, err := s.queries.GetCharacter(ctx, characterID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCharacterNotFound
		}
		return nil, err
	}

	// Verify user is GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: char.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isGM {
		return nil, ErrNotGM
	}

	archived, err := s.queries.ArchiveCharacter(ctx, characterID)
	if err != nil {
		return nil, err
	}

	return &archived, nil
}

// UnarchiveCharacter unarchives a character (GM only).
func (s *CharacterService) UnarchiveCharacter(
	ctx context.Context,
	characterID, userID pgtype.UUID,
) (*generated.Character, error) {
	// Get character to verify campaign
	char, err := s.queries.GetCharacter(ctx, characterID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCharacterNotFound
		}
		return nil, err
	}

	// Verify user is GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: char.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isGM {
		return nil, ErrNotGM
	}

	unarchived, err := s.queries.UnarchiveCharacter(ctx, characterID)
	if err != nil {
		return nil, err
	}

	return &unarchived, nil
}

// AssignCharacter assigns a character to a user (GM only).
func (s *CharacterService) AssignCharacter(
	ctx context.Context,
	characterID, userID, targetUserID pgtype.UUID,
) error {
	// Get character to verify campaign
	char, err := s.queries.GetCharacter(ctx, characterID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrCharacterNotFound
		}
		return err
	}

	// Verify caller is GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: char.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return err
	}
	if !isGM {
		return ErrNotGM
	}

	// Verify target user is a member
	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: char.CampaignID,
		UserID:     targetUserID,
	})
	if err != nil {
		return err
	}
	if !isMember {
		return ErrNotMember
	}

	_, err = s.queries.AssignCharacter(ctx, generated.AssignCharacterParams{
		CharacterID: characterID,
		UserID:      targetUserID,
	})
	return err
}

// UnassignCharacter removes assignment from a character (GM only).
func (s *CharacterService) UnassignCharacter(
	ctx context.Context,
	characterID, userID pgtype.UUID,
) error {
	// Get character to verify campaign
	char, err := s.queries.GetCharacter(ctx, characterID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrCharacterNotFound
		}
		return err
	}

	// Verify caller is GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: char.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return err
	}
	if !isGM {
		return ErrNotGM
	}

	return s.queries.UnassignCharacter(ctx, characterID)
}

// GetOrphanedCharacters returns characters without assignments in a campaign (GM only).
func (s *CharacterService) GetOrphanedCharacters(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
) ([]generated.Character, error) {
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

	return s.queries.GetOrphanedCharacters(ctx, campaignID)
}

// parseUUIDString parses a string into a pgtype.UUID.
//
//nolint:exhaustruct // Intentionally returning empty UUID with Valid: false
func parseUUIDString(s string) pgtype.UUID {
	var uuid pgtype.UUID
	if err := uuid.Scan(s); err != nil {
		return pgtype.UUID{Valid: false}
	}
	return uuid
}
