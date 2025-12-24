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

// Pass errors (using existing errors from other services where applicable).
// Note: ErrTimeGateExpired is defined in compose.go and reused here.
var (
	ErrCannotPassPendingRolls = errors.New("cannot pass with pending rolls")
	ErrInvalidPassState       = errors.New("invalid pass state")
)

// Valid pass states.
const (
	PassStateNone       = "none"
	PassStatePassed     = "passed"
	PassStateHardPassed = "hard_passed"
)

// PassService handles pass state business logic.
type PassService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

// NewPassService creates a new PassService.
func NewPassService(pool *pgxpool.Pool) *PassService {
	return &PassService{
		queries: generated.New(pool),
		pool:    pool,
	}
}

// CharacterPassInfo represents pass information for a character.
type CharacterPassInfo struct {
	CharacterID   string `json:"characterId"`
	CharacterName string `json:"characterName"`
	PassState     string `json:"passState"`
	SceneID       string `json:"sceneId"`
	SceneTitle    string `json:"sceneTitle"`
}

// CampaignPassSummary represents pass summary for a campaign.
type CampaignPassSummary struct {
	PassedCount int64               `json:"passedCount"`
	TotalCount  int64               `json:"totalCount"`
	AllPassed   bool                `json:"allPassed"`
	Characters  []CharacterPassInfo `json:"characters"`
}

// SetPassRequest represents a request to set a character's pass state.
type SetPassRequest struct {
	SceneID     pgtype.UUID `binding:"-"                                      json:"-"`
	CharacterID pgtype.UUID `binding:"-"                                      json:"-"`
	PassState   string      `binding:"required,oneof=none passed hard_passed" json:"passState"`
}

// SetPass sets the pass state for a character in a scene.
//
//nolint:gocognit,nestif // GM authorization logic requires nested permission checks
func (s *PassService) SetPass(
	ctx context.Context,
	userID pgtype.UUID,
	sceneID, characterID pgtype.UUID,
	passState string,
) error {
	// Validate pass state
	if passState != PassStateNone && passState != PassStatePassed && passState != PassStateHardPassed {
		return ErrInvalidPassState
	}

	// Get scene with campaign info
	scene, err := s.queries.GetSceneWithCampaign(ctx, sceneID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrSceneNotFound
		}
		return err
	}

	// Check campaign is in PC phase
	if scene.CurrentPhase != generated.CampaignPhasePcPhase {
		return ErrNotInPCPhase
	}

	// Verify user is a member
	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return err
	}
	if !isMember {
		return ErrNotMember
	}

	// Check if user owns the character (or is GM)
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return err
	}

	if !isGM {
		// Check if time gate has expired (players cannot pass after expiration)
		if scene.CurrentPhaseExpiresAt.Valid && time.Now().After(scene.CurrentPhaseExpiresAt.Time) {
			return ErrTimeGateExpired
		}

		// Get character to verify it exists
		_, charErr := s.queries.GetCharacter(ctx, characterID)
		if charErr != nil {
			if errors.Is(charErr, pgx.ErrNoRows) {
				return ErrCharacterNotFound
			}
			return charErr
		}

		// Check if character is assigned to user
		assignment, assignErr := s.queries.GetCharacterAssignment(ctx, characterID)
		if assignErr != nil {
			if errors.Is(assignErr, pgx.ErrNoRows) {
				return ErrCharacterNotOwned
			}
			return assignErr
		}

		if assignment.UserID != userID {
			return ErrCharacterNotOwned
		}

		// Check if character is in the scene
		if !slices.Contains(scene.CharacterIds, characterID) {
			return ErrCharacterNotInScene
		}
	}

	// Check for pending rolls if trying to pass
	if passState == PassStatePassed || passState == PassStateHardPassed {
		hasPending, rollErr := s.checkCharacterHasPendingRolls(ctx, characterID)
		if rollErr != nil {
			return rollErr
		}
		if hasPending {
			return ErrCannotPassPendingRolls
		}
	}

	// Set the pass state
	charIDStr := formatPgtypeUUID(characterID)
	_, err = s.queries.SetCharacterPassState(ctx, generated.SetCharacterPassStateParams{
		ID:      sceneID,
		Column2: charIDStr,
		Column3: passState,
	})
	if err != nil {
		return err
	}

	return nil
}

// ClearPass clears (sets to 'none') the pass state for a character.
func (s *PassService) ClearPass(
	ctx context.Context,
	userID pgtype.UUID,
	sceneID, characterID pgtype.UUID,
) error {
	return s.SetPass(ctx, userID, sceneID, characterID, PassStateNone)
}

// AutoClearPass clears pass on post (unless hard passed). This is called internally.
func (s *PassService) AutoClearPass(
	ctx context.Context,
	sceneID, characterID pgtype.UUID,
) error {
	// Get current pass state
	scene, err := s.queries.GetScene(ctx, sceneID)
	if err != nil {
		return err
	}

	// Check current pass state from JSONB
	var passStates map[string]string
	if unmarshalErr := json.Unmarshal(scene.PassStates, &passStates); unmarshalErr != nil {
		passStates = make(map[string]string)
	}

	charIDStr := formatPgtypeUUID(characterID)
	currentState := passStates[charIDStr]

	// Only clear if regular pass (not hard pass)
	if currentState == PassStatePassed {
		_, clearErr := s.queries.SetCharacterPassState(ctx, generated.SetCharacterPassStateParams{
			ID:      sceneID,
			Column2: charIDStr,
			Column3: PassStateNone,
		})
		if clearErr != nil {
			return clearErr
		}
	}

	return nil
}

// GetCampaignPassSummary returns the pass summary for a campaign.
func (s *PassService) GetCampaignPassSummary(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
) (*CampaignPassSummary, error) {
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

	// Get pass counts
	passedCount, err := s.queries.CountPassedCharactersInCampaign(ctx, campaignID)
	if err != nil {
		return nil, err
	}

	unpassedCount, err := s.queries.CountUnpassedCharactersInCampaign(ctx, campaignID)
	if err != nil {
		return nil, err
	}

	totalCount := passedCount + unpassedCount

	// Check if all passed
	allPassed, err := s.queries.CheckAllCharactersPassed(ctx, campaignID)
	if err != nil {
		return nil, err
	}

	// Get detailed pass states
	sceneStates, err := s.queries.GetAllPassStatesInCampaign(ctx, campaignID)
	if err != nil {
		return nil, err
	}

	// Build character info list
	characters := []CharacterPassInfo{}
	seenCharacters := make(map[string]bool)

	for _, scene := range sceneStates {
		var passStates map[string]string
		if unmarshalErr := json.Unmarshal(scene.PassStates, &passStates); unmarshalErr != nil {
			passStates = make(map[string]string)
		}

		// Get character details for characters in this scene
		sceneChars, charErr := s.queries.GetSceneCharacters(ctx, scene.SceneID)
		if charErr != nil {
			continue
		}

		for _, char := range sceneChars {
			charIDStr := formatPgtypeUUID(char.ID)
			if seenCharacters[charIDStr] {
				continue
			}
			seenCharacters[charIDStr] = true

			passState := passStates[charIDStr]
			if passState == "" {
				passState = PassStateNone
			}

			characters = append(characters, CharacterPassInfo{
				CharacterID:   charIDStr,
				CharacterName: char.DisplayName,
				PassState:     passState,
				SceneID:       formatPgtypeUUID(scene.SceneID),
				SceneTitle:    scene.SceneTitle,
			})
		}
	}

	return &CampaignPassSummary{
		PassedCount: passedCount,
		TotalCount:  totalCount,
		AllPassed:   allPassed,
		Characters:  characters,
	}, nil
}

// GetScenePassStates returns pass states for a specific scene.
func (s *PassService) GetScenePassStates(
	ctx context.Context,
	sceneID, userID pgtype.UUID,
) (map[string]string, error) {
	// Get scene with campaign
	scene, err := s.queries.GetSceneWithCampaign(ctx, sceneID)
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

	// Get pass states
	sceneData, err := s.queries.GetScene(ctx, sceneID)
	if err != nil {
		return nil, err
	}

	var passStates map[string]string
	if unmarshalErr := json.Unmarshal(sceneData.PassStates, &passStates); unmarshalErr != nil {
		passStates = make(map[string]string)
	}

	return passStates, nil
}

// AutoPassAllCharacters sets all unpassed PCs in the campaign to "passed" state.
// Called lazily when time gate has expired and a user interacts with the system.
func (s *PassService) AutoPassAllCharacters(ctx context.Context, campaignID pgtype.UUID) error {
	scenes, err := s.queries.GetAllActiveScenesInCampaign(ctx, campaignID)
	if err != nil {
		return err
	}

	for _, scene := range scenes {
		// Process each scene individually, continue on error (best effort)
		_ = s.autoPassCharactersInScene(ctx, scene)
	}

	return nil
}

// autoPassCharactersInScene marks all unpassed PCs in a single scene as passed.
func (s *PassService) autoPassCharactersInScene(
	ctx context.Context,
	scene generated.Scene,
) error {
	var passStates map[string]string
	if unmarshalErr := json.Unmarshal(scene.PassStates, &passStates); unmarshalErr != nil {
		passStates = make(map[string]string)
	}

	chars, charsErr := s.queries.GetSceneCharacters(ctx, scene.ID)
	if charsErr != nil {
		return charsErr
	}

	needsUpdate := false
	for _, char := range chars {
		if char.CharacterType != generated.CharacterTypePc {
			continue
		}

		charIDStr := formatPgtypeUUID(char.ID)
		if passStates[charIDStr] != PassStateHardPassed {
			// Use hard_passed for time gate expiration (system-enforced, can't be cleared)
			// This upgrades both "none" and "passed" to "hard_passed"
			passStates[charIDStr] = PassStateHardPassed
			needsUpdate = true
		}
	}

	if !needsUpdate {
		return nil
	}

	passStatesJSON, marshalErr := json.Marshal(passStates)
	if marshalErr != nil {
		return marshalErr
	}

	_, updateErr := s.queries.UpdateScenePassStates(ctx, generated.UpdateScenePassStatesParams{
		ID:         scene.ID,
		PassStates: passStatesJSON,
	})

	return updateErr
}

// checkCharacterHasPendingRolls checks if a character has any pending rolls.
func (s *PassService) checkCharacterHasPendingRolls(
	_ context.Context,
	_ pgtype.UUID,
) (bool, error) {
	// This would query the rolls table - for now return false as rolls aren't implemented yet
	// When Phase 8 is implemented, this should check:
	// SELECT EXISTS(SELECT 1 FROM rolls WHERE character_id = $1 AND status = 'pending')
	return false, nil
}

// UUID formatting constants.
const uuidStringLen = 36

// formatPgtypeUUID converts a pgtype.UUID to string.
func formatPgtypeUUID(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	b := id.Bytes
	hex := "0123456789abcdef"
	result := make([]byte, uuidStringLen)
	result[8] = '-'
	result[13] = '-'
	result[18] = '-'
	result[23] = '-'

	result[0] = hex[b[0]>>4]
	result[1] = hex[b[0]&0x0f]
	result[2] = hex[b[1]>>4]
	result[3] = hex[b[1]&0x0f]
	result[4] = hex[b[2]>>4]
	result[5] = hex[b[2]&0x0f]
	result[6] = hex[b[3]>>4]
	result[7] = hex[b[3]&0x0f]

	result[9] = hex[b[4]>>4]
	result[10] = hex[b[4]&0x0f]
	result[11] = hex[b[5]>>4]
	result[12] = hex[b[5]&0x0f]

	result[14] = hex[b[6]>>4]
	result[15] = hex[b[6]&0x0f]
	result[16] = hex[b[7]>>4]
	result[17] = hex[b[7]&0x0f]

	result[19] = hex[b[8]>>4]
	result[20] = hex[b[8]&0x0f]
	result[21] = hex[b[9]>>4]
	result[22] = hex[b[9]&0x0f]

	result[24] = hex[b[10]>>4]
	result[25] = hex[b[10]&0x0f]
	result[26] = hex[b[11]>>4]
	result[27] = hex[b[11]&0x0f]
	result[28] = hex[b[12]>>4]
	result[29] = hex[b[12]&0x0f]
	result[30] = hex[b[13]>>4]
	result[31] = hex[b[13]&0x0f]
	result[32] = hex[b[14]>>4]
	result[33] = hex[b[14]&0x0f]
	result[34] = hex[b[15]>>4]
	result[35] = hex[b[15]&0x0f]

	return string(result)
}
