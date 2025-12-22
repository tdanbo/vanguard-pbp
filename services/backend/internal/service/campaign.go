package service

import (
	"context"
	"encoding/json"
	"errors"
	"maps"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
)

const (
	defaultCharacterLimit   = 3000
	defaultRollTimeoutHours = 24
	defaultTimeGatePreset   = "3d"
	defaultOOCVisibility    = "gm_only"
	defaultSystemPresetName = "D&D 5e"
	defaultDiceType         = "d20"
)

// CampaignService handles campaign business logic.
type CampaignService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

// NewCampaignService creates a new CampaignService.
func NewCampaignService(pool *pgxpool.Pool) *CampaignService {
	return &CampaignService{
		queries: generated.New(pool),
		pool:    pool,
	}
}

// CreateCampaignRequest represents the request to create a campaign.
type CreateCampaignRequest struct {
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Settings    map[string]any `json:"settings,omitempty"`
}

// CreateCampaign creates a new campaign and adds the creator as GM.
func (s *CampaignService) CreateCampaign(
	ctx context.Context,
	userID pgtype.UUID,
	req CreateCampaignRequest,
) (*generated.Campaign, error) {
	// Check campaign limit
	count, err := s.queries.CountUserOwnedCampaigns(ctx, userID)
	if err != nil {
		return nil, err
	}
	if count >= int64(MaxCampaignsPerUser) {
		return nil, ErrCampaignLimitReached
	}

	// Use default settings if not provided
	settings := defaultCampaignSettings()
	if req.Settings != nil {
		if validateErr := validateSettings(req.Settings); validateErr != nil {
			return nil, validateErr
		}
		// Merge provided settings with defaults
		maps.Copy(settings, req.Settings)
	}

	settingsJSON, err := json.Marshal(settings)
	if err != nil {
		return nil, err
	}

	// Start transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	// Create campaign
	campaign, err := qtx.CreateCampaign(ctx, generated.CreateCampaignParams{
		Title:       req.Title,
		Description: pgtype.Text{String: req.Description, Valid: req.Description != ""},
		OwnerID:     userID,
		Settings:    settingsJSON,
	})
	if err != nil {
		return nil, err
	}

	// Add creator as GM member
	_, err = qtx.AddCampaignMember(ctx, generated.AddCampaignMemberParams{
		CampaignID: campaign.ID,
		UserID:     userID,
		Role:       generated.MemberRoleGm,
	})
	if err != nil {
		return nil, err
	}

	if commitErr := tx.Commit(ctx); commitErr != nil {
		return nil, commitErr
	}

	return &campaign, nil
}

// GetCampaign retrieves a campaign with membership info for the user.
func (s *CampaignService) GetCampaign(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
) (*generated.GetCampaignWithMembershipRow, error) {
	campaign, err := s.queries.GetCampaignWithMembership(
		ctx,
		generated.GetCampaignWithMembershipParams{
			ID:     campaignID,
			UserID: userID,
		},
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCampaignNotFound
		}
		return nil, err
	}

	// Check if user is a member
	if !campaign.UserRole.Valid {
		return nil, ErrNotMember
	}

	return &campaign, nil
}

// ListUserCampaigns returns all campaigns for a user.
func (s *CampaignService) ListUserCampaigns(
	ctx context.Context,
	userID pgtype.UUID,
) ([]generated.ListUserCampaignsRow, error) {
	return s.queries.ListUserCampaigns(ctx, userID)
}

// UpdateCampaignRequest represents the request to update a campaign.
type UpdateCampaignRequest struct {
	Title       *string         `json:"title,omitempty"`
	Description *string         `json:"description,omitempty"`
	Settings    *map[string]any `json:"settings,omitempty"`
}

// UpdateCampaign updates a campaign (GM only).
func (s *CampaignService) UpdateCampaign(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
	req UpdateCampaignRequest,
) (*generated.Campaign, error) {
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

	// Build update params
	//nolint:exhaustruct // Only ID is required, other fields are set conditionally
	params := generated.UpdateCampaignParams{
		ID: campaignID,
	}

	if req.Title != nil {
		params.Title = *req.Title
	}

	if req.Description != nil {
		params.Description = pgtype.Text{String: *req.Description, Valid: true}
	}

	if req.Settings != nil {
		if validateErr := validateSettings(*req.Settings); validateErr != nil {
			return nil, validateErr
		}
		settingsJSON, marshalErr := json.Marshal(*req.Settings)
		if marshalErr != nil {
			return nil, marshalErr
		}
		params.Settings = settingsJSON
	}

	campaign, err := s.queries.UpdateCampaign(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCampaignNotFound
		}
		return nil, err
	}

	return &campaign, nil
}

// DeleteCampaign deletes a campaign (GM only, requires title confirmation).
func (s *CampaignService) DeleteCampaign(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
	confirmTitle string,
) error {
	// Verify user is GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: campaignID,
		UserID:     userID,
	})
	if err != nil {
		return err
	}
	if !isGM {
		return ErrNotGM
	}

	// Get campaign to verify title
	campaign, err := s.queries.GetCampaign(ctx, campaignID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrCampaignNotFound
		}
		return err
	}

	if campaign.Title != confirmTitle {
		return errors.New("confirmation title does not match campaign title")
	}

	return s.queries.DeleteCampaign(ctx, campaignID)
}

// PauseCampaign pauses a campaign (GM only).
func (s *CampaignService) PauseCampaign(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
) (*generated.Campaign, error) {
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

	campaign, err := s.queries.UpdateCampaignPausedState(
		ctx,
		generated.UpdateCampaignPausedStateParams{
			ID:       campaignID,
			IsPaused: true,
		},
	)
	if err != nil {
		return nil, err
	}

	return &campaign, nil
}

// ResumeCampaign resumes a paused campaign (GM only).
func (s *CampaignService) ResumeCampaign(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
) (*generated.Campaign, error) {
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

	campaign, err := s.queries.UpdateCampaignPausedState(
		ctx,
		generated.UpdateCampaignPausedStateParams{
			ID:       campaignID,
			IsPaused: false,
		},
	)
	if err != nil {
		return nil, err
	}

	return &campaign, nil
}

// GetCampaignMembers returns all members of a campaign.
func (s *CampaignService) GetCampaignMembers(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
) ([]generated.CampaignMember, error) {
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

	return s.queries.GetCampaignMembers(ctx, campaignID)
}

// Helper functions

func defaultCampaignSettings() map[string]any {
	return map[string]any{
		"timeGatePreset":          defaultTimeGatePreset,
		"fogOfWar":                true,
		"hiddenPosts":             true,
		"oocVisibility":           defaultOOCVisibility,
		"characterLimit":          defaultCharacterLimit,
		"rollRequestTimeoutHours": defaultRollTimeoutHours,
		"systemPreset": map[string]any{
			"name": defaultSystemPresetName,
			"intentions": []string{
				"Acrobatics", "Animal Handling", "Arcana", "Athletics",
				"Deception", "History", "Insight", "Intimidation",
				"Investigation", "Medicine", "Nature", "Perception",
				"Performance", "Persuasion", "Religion", "Sleight of Hand",
				"Stealth", "Survival",
			},
			"diceType": defaultDiceType,
		},
	}
}

func validateSettings(settings map[string]any) error {
	// Validate time gate preset
	if timeGate, ok := settings["timeGatePreset"].(string); ok {
		validPresets := map[string]bool{"24h": true, "2d": true, "3d": true, "4d": true, "5d": true}
		if !validPresets[timeGate] {
			return ErrInvalidSettings
		}
	}

	// Validate character limit
	if charLimit, ok := settings["characterLimit"]; ok {
		var limit int
		switch v := charLimit.(type) {
		case float64:
			limit = int(v)
		case int:
			limit = v
		default:
			return ErrInvalidSettings
		}
		validLimits := map[int]bool{1000: true, 3000: true, 6000: true, 10000: true}
		if !validLimits[limit] {
			return ErrInvalidSettings
		}
	}

	// Validate OOC visibility
	if oocVis, ok := settings["oocVisibility"].(string); ok {
		if oocVis != "all" && oocVis != "gm_only" {
			return ErrInvalidSettings
		}
	}

	// Validate booleans
	if fog, ok := settings["fogOfWar"]; ok {
		if _, isBool := fog.(bool); !isBool {
			return ErrInvalidSettings
		}
	}

	if hidden, ok := settings["hiddenPosts"]; ok {
		if _, isBool := hidden.(bool); !isBool {
			return ErrInvalidSettings
		}
	}

	return nil
}
