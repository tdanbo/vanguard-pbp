package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/dice"
)

// Roll errors.
var (
	ErrRollNotFound        = errors.New("roll not found")
	ErrRollAlreadyResolved = errors.New("roll is already resolved")
	ErrInvalidModifier     = errors.New("modifier must be between -100 and +100")
	ErrInvalidDiceCount    = errors.New("dice count must be between 1 and 100")
	ErrInvalidIntention    = errors.New("intention is required")
	ErrCannotPassPending   = errors.New("cannot pass with pending rolls")
)

// Content preview constants.
const postContentPreviewLen = 100

// RollService handles roll business logic.
type RollService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
	roller  *dice.Roller
}

// NewRollService creates a new RollService.
func NewRollService(pool *pgxpool.Pool) *RollService {
	return &RollService{
		queries: generated.New(pool),
		pool:    pool,
		roller:  dice.NewRoller(),
	}
}

// CreateRollRequest represents the request to create a roll.
type CreateRollRequest struct {
	PostID      *string `json:"postId"`
	SceneID     string  `json:"sceneId"`
	CharacterID string  `json:"characterId"`
	Intention   string  `json:"intention"`
	Modifier    int     `json:"modifier"`
	DiceType    string  `json:"diceType"`
	DiceCount   int     `json:"diceCount"`
}

// RollResponse represents a roll in API responses.
type RollResponse struct {
	ID                     string  `json:"id"`
	PostID                 *string `json:"postId"`
	SceneID                string  `json:"sceneId"`
	CharacterID            string  `json:"characterId"`
	CharacterName          *string `json:"characterName,omitempty"`
	RequestedBy            *string `json:"requestedBy"`
	Intention              string  `json:"intention"`
	OriginalIntention      *string `json:"originalIntention,omitempty"`
	Modifier               int     `json:"modifier"`
	DiceType               string  `json:"diceType"`
	DiceCount              int     `json:"diceCount"`
	Result                 []int32 `json:"result"`
	Total                  *int    `json:"total"`
	WasOverridden          bool    `json:"wasOverridden"`
	OverriddenBy           *string `json:"overriddenBy,omitempty"`
	OverrideReason         *string `json:"overrideReason,omitempty"`
	OverrideTimestamp      *string `json:"overrideTimestamp,omitempty"`
	ManualResult           *int    `json:"manualResult,omitempty"`
	ManuallyResolvedBy     *string `json:"manuallyResolvedBy,omitempty"`
	ManualResolutionReason *string `json:"manualResolutionReason,omitempty"`
	Status                 string  `json:"status"`
	RolledAt               *string `json:"rolledAt,omitempty"`
	CreatedAt              string  `json:"createdAt"`
}

// UnresolvedRollResponse includes additional context for GM dashboard.
type UnresolvedRollResponse struct {
	RollResponse `json:",inline"`

	SceneTitle  string `json:"sceneTitle"`
	PostContent string `json:"postContent,omitempty"`
}

// CreateRoll creates a new roll (initially pending).
func (s *RollService) CreateRoll(
	ctx context.Context,
	_ pgtype.UUID, // userID reserved for future authorization checks
	req CreateRollRequest,
) (*RollResponse, error) {
	// Validate inputs
	if err := dice.ValidateModifier(req.Modifier); err != nil {
		return nil, ErrInvalidModifier
	}
	if err := dice.ValidateDiceCount(req.DiceCount); err != nil {
		return nil, ErrInvalidDiceCount
	}
	if req.Intention == "" {
		return nil, ErrInvalidIntention
	}
	if !dice.IsValidDiceType(req.DiceType) {
		return nil, errors.New("invalid dice type")
	}

	sceneID := parseUUIDStringRoll(req.SceneID)
	characterID := parseUUIDStringRoll(req.CharacterID)

	var postID pgtype.UUID
	if req.PostID != nil {
		postID = parseUUIDStringRoll(*req.PostID)
	}

	// Create the roll
	//nolint:gosec,exhaustruct // req values validated above; RequestedBy intentionally empty for player-initiated rolls
	roll, err := s.queries.CreateRoll(ctx, generated.CreateRollParams{
		PostID:      postID,
		SceneID:     sceneID,
		CharacterID: characterID,
		RequestedBy: pgtype.UUID{Valid: false}, // NULL for player-initiated
		Intention:   req.Intention,
		Modifier:    int32(req.Modifier),
		DiceType:    req.DiceType,
		DiceCount:   int32(req.DiceCount),
	})
	if err != nil {
		return nil, err
	}

	// Execute roll immediately
	go s.executeRollAsync(context.Background(), roll.ID, req.DiceType, req.DiceCount, req.Modifier)

	return s.rollToResponse(&roll, nil), nil
}

// executeRollAsync executes a roll asynchronously.
func (s *RollService) executeRollAsync(
	ctx context.Context,
	rollID pgtype.UUID,
	diceType string,
	diceCount, modifier int,
) {
	logger := slog.Default()

	// Execute roll
	results, err := s.roller.Roll(diceType, diceCount)
	if err != nil {
		logger.ErrorContext(ctx, "Failed to execute roll", "rollID", rollID, "error", err)
		return
	}

	// Calculate total
	total := s.roller.CalculateTotal(results, modifier)

	// Save results
	//nolint:gosec // total is guaranteed to be small (sum of dice + small modifier)
	_, err = s.queries.ExecuteRoll(ctx, generated.ExecuteRollParams{
		ID:     rollID,
		Result: results,
		Total:  pgtype.Int4{Int32: int32(total), Valid: true},
	})
	if err != nil {
		logger.ErrorContext(ctx, "Failed to save roll results", "rollID", rollID, "error", err)
		return
	}
}

// GetRoll retrieves a single roll.
func (s *RollService) GetRoll(
	ctx context.Context,
	_ pgtype.UUID, // userID reserved for future authorization checks
	rollID string,
) (*RollResponse, error) {
	rollUUID := parseUUIDStringRoll(rollID)

	roll, err := s.queries.GetRollWithCharacter(ctx, rollUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRollNotFound
		}
		return nil, err
	}

	var charName *string
	if roll.CharacterName.Valid {
		charName = &roll.CharacterName.String
	}

	return s.rollWithCharacterToResponse(&roll, charName), nil
}

// GetRollsByPost retrieves all rolls for a post.
func (s *RollService) GetRollsByPost(
	ctx context.Context,
	_ pgtype.UUID, // userID reserved for future authorization checks
	postID string,
) ([]RollResponse, error) {
	postUUID := parseUUIDStringRoll(postID)

	rolls, err := s.queries.GetRollsByPostWithCharacter(ctx, postUUID)
	if err != nil {
		return nil, err
	}

	var result []RollResponse
	for _, r := range rolls {
		var charName *string
		if r.CharacterName.Valid {
			charName = &r.CharacterName.String
		}
		result = append(result, *s.rollWithCharacterRowToResponse(&r, charName))
	}

	return result, nil
}

// GetPendingRollsForCharacter retrieves pending rolls for a character.
func (s *RollService) GetPendingRollsForCharacter(
	ctx context.Context,
	characterID string,
) ([]RollResponse, error) {
	charUUID := parseUUIDStringRoll(characterID)

	rolls, err := s.queries.GetPendingRollsForCharacter(ctx, charUUID)
	if err != nil {
		return nil, err
	}

	var result []RollResponse
	for _, r := range rolls {
		result = append(result, *s.rollToResponse(&r, nil))
	}

	return result, nil
}

// GetUnresolvedRollsInCampaign retrieves all unresolved rolls (GM dashboard).
func (s *RollService) GetUnresolvedRollsInCampaign(
	ctx context.Context,
	userID pgtype.UUID,
	campaignID string,
) ([]UnresolvedRollResponse, error) {
	campaignUUID := parseUUIDStringRoll(campaignID)

	// Verify user is GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: campaignUUID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if !isGM {
		return nil, ErrNotGM
	}

	rolls, err := s.queries.GetUnresolvedRollsInCampaign(ctx, campaignUUID)
	if err != nil {
		return nil, err
	}

	var result []UnresolvedRollResponse
	for _, r := range rolls {
		resp := s.unresolvedRollToResponse(&r)
		result = append(result, *resp)
	}

	return result, nil
}

// OverrideIntentionRequest represents the request to override a roll's intention.
type OverrideIntentionRequest struct {
	NewIntention string `json:"newIntention"`
	Reason       string `json:"reason"`
}

// OverrideIntention overrides a roll's intention (GM only).
func (s *RollService) OverrideIntention(
	ctx context.Context,
	userID pgtype.UUID,
	rollID string,
	req OverrideIntentionRequest,
) (*RollResponse, error) {
	rollUUID := parseUUIDStringRoll(rollID)

	// Get roll to verify permissions
	roll, err := s.queries.GetRoll(ctx, rollUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRollNotFound
		}
		return nil, err
	}

	// Get scene to check GM status
	scene, err := s.queries.GetScene(ctx, roll.SceneID)
	if err != nil {
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

	// Cannot override invalidated rolls
	if roll.Status == generated.RollStatusInvalidated {
		return nil, errors.New("cannot override invalidated roll")
	}

	// Validate new intention
	if req.NewIntention == "" {
		return nil, ErrInvalidIntention
	}

	// Override intention
	var reason pgtype.Text
	if req.Reason != "" {
		reason = pgtype.Text{String: req.Reason, Valid: true}
	}

	overriddenRoll, err := s.queries.OverrideRollIntention(
		ctx,
		generated.OverrideRollIntentionParams{
			ID:             rollUUID,
			Intention:      req.NewIntention,
			OverriddenBy:   userID,
			OverrideReason: reason,
		},
	)
	if err != nil {
		return nil, err
	}

	return s.rollToResponse(&overriddenRoll, nil), nil
}

// ManualResolveRequest represents the request to manually resolve a roll.
type ManualResolveRequest struct {
	Result int    `json:"result"`
	Reason string `json:"reason"`
}

// ManuallyResolve manually resolves a roll with a GM-assigned result.
func (s *RollService) ManuallyResolve(
	ctx context.Context,
	userID pgtype.UUID,
	rollID string,
	req ManualResolveRequest,
) (*RollResponse, error) {
	rollUUID := parseUUIDStringRoll(rollID)

	// Get roll to verify permissions
	roll, err := s.queries.GetRoll(ctx, rollUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRollNotFound
		}
		return nil, err
	}

	// Only allow manual resolution on pending rolls
	if roll.Status != generated.RollStatusPending {
		return nil, ErrRollAlreadyResolved
	}

	// Get scene to check GM status
	scene, err := s.queries.GetScene(ctx, roll.SceneID)
	if err != nil {
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

	// Manually resolve
	var reason pgtype.Text
	if req.Reason != "" {
		reason = pgtype.Text{String: req.Reason, Valid: true}
	}

	//nolint:gosec // req.Result is a user input but valid for int32 range in game context
	resolvedRoll, err := s.queries.ManuallyResolveRoll(ctx, generated.ManuallyResolveRollParams{
		ID:                     rollUUID,
		ManualResult:           pgtype.Int4{Int32: int32(req.Result), Valid: true},
		ManuallyResolvedBy:     userID,
		ManualResolutionReason: reason,
	})
	if err != nil {
		return nil, err
	}

	return s.rollToResponse(&resolvedRoll, nil), nil
}

// InvalidateRoll invalidates a roll (GM only).
func (s *RollService) InvalidateRoll(
	ctx context.Context,
	userID pgtype.UUID,
	rollID string,
) (*RollResponse, error) {
	rollUUID := parseUUIDStringRoll(rollID)

	// Get roll
	roll, err := s.queries.GetRoll(ctx, rollUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrRollNotFound
		}
		return nil, err
	}

	// Get scene to check GM status
	scene, err := s.queries.GetScene(ctx, roll.SceneID)
	if err != nil {
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

	// Invalidate
	invalidatedRoll, err := s.queries.InvalidateRoll(ctx, rollUUID)
	if err != nil {
		return nil, err
	}

	return s.rollToResponse(&invalidatedRoll, nil), nil
}

// CharacterHasPendingRolls checks if a character has pending rolls.
func (s *RollService) CharacterHasPendingRolls(
	ctx context.Context,
	characterID string,
) (bool, error) {
	charUUID := parseUUIDStringRoll(characterID)

	hasPending, err := s.queries.CharacterHasPendingRolls(ctx, charUUID)
	if err != nil {
		return false, err
	}

	return hasPending, nil
}

// GetRollsInScene retrieves all rolls in a scene.
func (s *RollService) GetRollsInScene(
	ctx context.Context,
	userID pgtype.UUID,
	sceneID string,
) ([]RollResponse, error) {
	sceneUUID := parseUUIDStringRoll(sceneID)

	// Verify user has access to scene
	scene, err := s.queries.GetScene(ctx, sceneUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrSceneNotFound
		}
		return nil, err
	}

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

	rolls, err := s.queries.ListRollsByScene(ctx, sceneUUID)
	if err != nil {
		return nil, err
	}

	var result []RollResponse
	for _, r := range rolls {
		var charName *string
		if r.CharacterName.Valid {
			charName = &r.CharacterName.String
		}
		result = append(result, *s.listRollRowToResponse(&r, charName))
	}

	return result, nil
}

// Helper functions

//nolint:exhaustruct // Intentionally returning empty UUID with Valid: false
func parseUUIDStringRoll(s string) pgtype.UUID {
	var uuid pgtype.UUID
	if err := uuid.Scan(s); err != nil {
		return pgtype.UUID{Valid: false}
	}
	return uuid
}

func formatUUIDRoll(b [16]byte) string {
	return formatUUIDBytesRoll(b[:])
}

//nolint:mnd // UUID byte/string lengths are standard constants
func formatUUIDBytesRoll(b []byte) string {
	if len(b) != 16 {
		return ""
	}
	result := make([]byte, 36)
	hex := "0123456789abcdef"
	j := 0
	for i := range 16 {
		if i == 4 || i == 6 || i == 8 || i == 10 {
			result[j] = '-'
			j++
		}
		result[j] = hex[b[i]>>4]
		result[j+1] = hex[b[i]&0x0f]
		j += 2
	}
	return string(result)
}

//nolint:dupl,exhaustruct,unparam // Similar conversions for different sqlc-generated types; charName is nil for consistency
func (s *RollService) rollToResponse(r *generated.Roll, charName *string) *RollResponse {
	resp := &RollResponse{
		ID:            formatUUIDRoll(r.ID.Bytes),
		SceneID:       formatUUIDRoll(r.SceneID.Bytes),
		CharacterID:   formatUUIDRoll(r.CharacterID.Bytes),
		CharacterName: charName,
		Intention:     r.Intention,
		Modifier:      int(r.Modifier),
		DiceType:      r.DiceType,
		DiceCount:     int(r.DiceCount),
		Result:        r.Result,
		WasOverridden: r.WasOverridden,
		Status:        string(r.Status),
		CreatedAt:     r.CreatedAt.Time.Format(time.RFC3339),
	}

	if r.PostID.Valid {
		postID := formatUUIDRoll(r.PostID.Bytes)
		resp.PostID = &postID
	}

	if r.RequestedBy.Valid {
		reqBy := formatUUIDRoll(r.RequestedBy.Bytes)
		resp.RequestedBy = &reqBy
	}

	if r.Total.Valid {
		total := int(r.Total.Int32)
		resp.Total = &total
	}

	if r.OriginalIntention.Valid {
		resp.OriginalIntention = &r.OriginalIntention.String
	}

	if r.OverriddenBy.Valid {
		overBy := formatUUIDRoll(r.OverriddenBy.Bytes)
		resp.OverriddenBy = &overBy
	}

	if r.OverrideReason.Valid {
		resp.OverrideReason = &r.OverrideReason.String
	}

	if r.OverrideTimestamp.Valid {
		ts := r.OverrideTimestamp.Time.Format(time.RFC3339)
		resp.OverrideTimestamp = &ts
	}

	if r.ManualResult.Valid {
		mr := int(r.ManualResult.Int32)
		resp.ManualResult = &mr
	}

	if r.ManuallyResolvedBy.Valid {
		mrBy := formatUUIDRoll(r.ManuallyResolvedBy.Bytes)
		resp.ManuallyResolvedBy = &mrBy
	}

	if r.ManualResolutionReason.Valid {
		resp.ManualResolutionReason = &r.ManualResolutionReason.String
	}

	if r.RolledAt.Valid {
		rolledAt := r.RolledAt.Time.Format(time.RFC3339)
		resp.RolledAt = &rolledAt
	}

	return resp
}

//
//nolint:dupl,exhaustruct // Similar conversions for different sqlc-generated types; optional fields populated conditionally
func (s *RollService) rollWithCharacterToResponse(
	r *generated.GetRollWithCharacterRow,
	charName *string,
) *RollResponse {
	resp := &RollResponse{
		ID:            formatUUIDRoll(r.ID.Bytes),
		SceneID:       formatUUIDRoll(r.SceneID.Bytes),
		CharacterID:   formatUUIDRoll(r.CharacterID.Bytes),
		CharacterName: charName,
		Intention:     r.Intention,
		Modifier:      int(r.Modifier),
		DiceType:      r.DiceType,
		DiceCount:     int(r.DiceCount),
		Result:        r.Result,
		WasOverridden: r.WasOverridden,
		Status:        string(r.Status),
		CreatedAt:     r.CreatedAt.Time.Format(time.RFC3339),
	}

	if r.PostID.Valid {
		postID := formatUUIDRoll(r.PostID.Bytes)
		resp.PostID = &postID
	}

	if r.RequestedBy.Valid {
		reqBy := formatUUIDRoll(r.RequestedBy.Bytes)
		resp.RequestedBy = &reqBy
	}

	if r.Total.Valid {
		total := int(r.Total.Int32)
		resp.Total = &total
	}

	if r.OriginalIntention.Valid {
		resp.OriginalIntention = &r.OriginalIntention.String
	}

	if r.OverriddenBy.Valid {
		overBy := formatUUIDRoll(r.OverriddenBy.Bytes)
		resp.OverriddenBy = &overBy
	}

	if r.OverrideReason.Valid {
		resp.OverrideReason = &r.OverrideReason.String
	}

	if r.OverrideTimestamp.Valid {
		ts := r.OverrideTimestamp.Time.Format(time.RFC3339)
		resp.OverrideTimestamp = &ts
	}

	if r.ManualResult.Valid {
		mr := int(r.ManualResult.Int32)
		resp.ManualResult = &mr
	}

	if r.ManuallyResolvedBy.Valid {
		mrBy := formatUUIDRoll(r.ManuallyResolvedBy.Bytes)
		resp.ManuallyResolvedBy = &mrBy
	}

	if r.ManualResolutionReason.Valid {
		resp.ManualResolutionReason = &r.ManualResolutionReason.String
	}

	if r.RolledAt.Valid {
		rolledAt := r.RolledAt.Time.Format(time.RFC3339)
		resp.RolledAt = &rolledAt
	}

	return resp
}

//
//nolint:dupl,exhaustruct // Similar conversions for different sqlc-generated types; optional fields populated conditionally
func (s *RollService) rollWithCharacterRowToResponse(
	r *generated.GetRollsByPostWithCharacterRow,
	charName *string,
) *RollResponse {
	resp := &RollResponse{
		ID:            formatUUIDRoll(r.ID.Bytes),
		SceneID:       formatUUIDRoll(r.SceneID.Bytes),
		CharacterID:   formatUUIDRoll(r.CharacterID.Bytes),
		CharacterName: charName,
		Intention:     r.Intention,
		Modifier:      int(r.Modifier),
		DiceType:      r.DiceType,
		DiceCount:     int(r.DiceCount),
		Result:        r.Result,
		WasOverridden: r.WasOverridden,
		Status:        string(r.Status),
		CreatedAt:     r.CreatedAt.Time.Format(time.RFC3339),
	}

	if r.PostID.Valid {
		postID := formatUUIDRoll(r.PostID.Bytes)
		resp.PostID = &postID
	}

	if r.RequestedBy.Valid {
		reqBy := formatUUIDRoll(r.RequestedBy.Bytes)
		resp.RequestedBy = &reqBy
	}

	if r.Total.Valid {
		total := int(r.Total.Int32)
		resp.Total = &total
	}

	if r.OriginalIntention.Valid {
		resp.OriginalIntention = &r.OriginalIntention.String
	}

	if r.OverriddenBy.Valid {
		overBy := formatUUIDRoll(r.OverriddenBy.Bytes)
		resp.OverriddenBy = &overBy
	}

	if r.OverrideReason.Valid {
		resp.OverrideReason = &r.OverrideReason.String
	}

	if r.OverrideTimestamp.Valid {
		ts := r.OverrideTimestamp.Time.Format(time.RFC3339)
		resp.OverrideTimestamp = &ts
	}

	if r.ManualResult.Valid {
		mr := int(r.ManualResult.Int32)
		resp.ManualResult = &mr
	}

	if r.ManuallyResolvedBy.Valid {
		mrBy := formatUUIDRoll(r.ManuallyResolvedBy.Bytes)
		resp.ManuallyResolvedBy = &mrBy
	}

	if r.ManualResolutionReason.Valid {
		resp.ManualResolutionReason = &r.ManualResolutionReason.String
	}

	if r.RolledAt.Valid {
		rolledAt := r.RolledAt.Time.Format(time.RFC3339)
		resp.RolledAt = &rolledAt
	}

	return resp
}

//
//nolint:dupl,exhaustruct // Similar conversions for different sqlc-generated types; optional fields populated conditionally
func (s *RollService) listRollRowToResponse(
	r *generated.ListRollsBySceneRow,
	charName *string,
) *RollResponse {
	resp := &RollResponse{
		ID:            formatUUIDRoll(r.ID.Bytes),
		SceneID:       formatUUIDRoll(r.SceneID.Bytes),
		CharacterID:   formatUUIDRoll(r.CharacterID.Bytes),
		CharacterName: charName,
		Intention:     r.Intention,
		Modifier:      int(r.Modifier),
		DiceType:      r.DiceType,
		DiceCount:     int(r.DiceCount),
		Result:        r.Result,
		WasOverridden: r.WasOverridden,
		Status:        string(r.Status),
		CreatedAt:     r.CreatedAt.Time.Format(time.RFC3339),
	}

	if r.PostID.Valid {
		postID := formatUUIDRoll(r.PostID.Bytes)
		resp.PostID = &postID
	}

	if r.RequestedBy.Valid {
		reqBy := formatUUIDRoll(r.RequestedBy.Bytes)
		resp.RequestedBy = &reqBy
	}

	if r.Total.Valid {
		total := int(r.Total.Int32)
		resp.Total = &total
	}

	if r.OriginalIntention.Valid {
		resp.OriginalIntention = &r.OriginalIntention.String
	}

	if r.OverriddenBy.Valid {
		overBy := formatUUIDRoll(r.OverriddenBy.Bytes)
		resp.OverriddenBy = &overBy
	}

	if r.OverrideReason.Valid {
		resp.OverrideReason = &r.OverrideReason.String
	}

	if r.OverrideTimestamp.Valid {
		ts := r.OverrideTimestamp.Time.Format(time.RFC3339)
		resp.OverrideTimestamp = &ts
	}

	if r.ManualResult.Valid {
		mr := int(r.ManualResult.Int32)
		resp.ManualResult = &mr
	}

	if r.ManuallyResolvedBy.Valid {
		mrBy := formatUUIDRoll(r.ManuallyResolvedBy.Bytes)
		resp.ManuallyResolvedBy = &mrBy
	}

	if r.ManualResolutionReason.Valid {
		resp.ManualResolutionReason = &r.ManualResolutionReason.String
	}

	if r.RolledAt.Valid {
		rolledAt := r.RolledAt.Time.Format(time.RFC3339)
		resp.RolledAt = &rolledAt
	}

	return resp
}

// extractPostContentPreview extracts a truncated preview from post content JSON.
func extractPostContentPreview(postContent []byte) string {
	if postContent == nil {
		return ""
	}
	var blocks []map[string]any
	if err := json.Unmarshal(postContent, &blocks); err != nil || len(blocks) == 0 {
		return ""
	}
	content, ok := blocks[0]["content"].(string)
	if !ok {
		return ""
	}
	if len(content) > postContentPreviewLen {
		return content[:postContentPreviewLen] + "..."
	}
	return content
}

//
//nolint:exhaustruct // Optional response fields are populated conditionally
func (s *RollService) unresolvedRollToResponse(
	r *generated.GetUnresolvedRollsInCampaignRow,
) *UnresolvedRollResponse {
	charName := r.CharacterName

	baseResp := &RollResponse{
		ID:            formatUUIDRoll(r.ID.Bytes),
		SceneID:       formatUUIDRoll(r.SceneID.Bytes),
		CharacterID:   formatUUIDRoll(r.CharacterID.Bytes),
		CharacterName: &charName,
		Intention:     r.Intention,
		Modifier:      int(r.Modifier),
		DiceType:      r.DiceType,
		DiceCount:     int(r.DiceCount),
		Result:        r.Result,
		WasOverridden: r.WasOverridden,
		Status:        string(r.Status),
		CreatedAt:     r.CreatedAt.Time.Format(time.RFC3339),
	}

	if r.PostID.Valid {
		postID := formatUUIDRoll(r.PostID.Bytes)
		baseResp.PostID = &postID
	}

	if r.RequestedBy.Valid {
		reqBy := formatUUIDRoll(r.RequestedBy.Bytes)
		baseResp.RequestedBy = &reqBy
	}

	if r.Total.Valid {
		total := int(r.Total.Int32)
		baseResp.Total = &total
	}

	if r.OriginalIntention.Valid {
		baseResp.OriginalIntention = &r.OriginalIntention.String
	}

	// Extract post content preview
	postContent := extractPostContentPreview(r.PostContent)

	return &UnresolvedRollResponse{
		RollResponse: *baseResp,
		SceneTitle:   r.SceneTitle,
		PostContent:  postContent,
	}
}

// Suppress unused import warnings.
//
//nolint:exhaustruct // Intentionally empty struct for import preservation
var _ = sql.NullString{}
