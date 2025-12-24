package service

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
)

// Phase errors.
var (
	ErrAlreadyInPhase        = errors.New("campaign is already in this phase")
	ErrCampaignPaused        = errors.New("cannot transition while campaign is paused")
	ErrActiveComposeLocks    = errors.New("cannot transition: players are still composing posts")
	ErrPendingRolls          = errors.New("cannot transition: there are pending rolls to resolve")
	ErrNotAllPassed          = errors.New("cannot transition to GM phase: not all characters have passed")
	ErrInvalidTimeGatePreset = errors.New("invalid time gate preset")
)

// Time gate duration constants (in hours).
const (
	hours24  = 24
	hours48  = 48
	hours72  = 72
	hours96  = 96
	hours120 = 120
)

// Phase constants.
const (
	PhasePCPhase = "pc_phase"
	PhaseGMPhase = "gm_phase"
)

// TimeGatePresets maps preset strings to durations.
//
//nolint:gochecknoglobals // Package-level map for time gate configuration
var TimeGatePresets = map[string]time.Duration{
	"24h": hours24 * time.Hour,
	"2d":  hours48 * time.Hour,
	"3d":  hours72 * time.Hour,
	"4d":  hours96 * time.Hour,
	"5d":  hours120 * time.Hour,
}

// PhaseService handles phase transition business logic.
type PhaseService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

// NewPhaseService creates a new PhaseService.
func NewPhaseService(pool *pgxpool.Pool) *PhaseService {
	return &PhaseService{
		queries: generated.New(pool),
		pool:    pool,
	}
}

// PhaseStatus represents the current phase status of a campaign.
type PhaseStatus struct {
	CurrentPhase    string     `json:"currentPhase"`
	StartedAt       *time.Time `json:"startedAt,omitempty"`
	ExpiresAt       *time.Time `json:"expiresAt,omitempty"`
	IsPaused        bool       `json:"isPaused"`
	IsExpired       bool       `json:"isExpired"`
	TimeGatePreset  string     `json:"timeGatePreset,omitempty"`
	PassedCount     int64      `json:"passedCount"`
	TotalCount      int64      `json:"totalCount"`
	AllPassed       bool       `json:"allPassed"`
	CanTransition   bool       `json:"canTransition"`
	TransitionBlock string     `json:"transitionBlock,omitempty"`
}

// GetPhaseStatus returns the current phase status of a campaign.
//
//nolint:gocognit,funlen // Phase status collection requires multiple condition checks
func (s *PhaseService) GetPhaseStatus(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
) (*PhaseStatus, error) {
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

	// Get campaign phase info
	phaseInfo, err := s.queries.GetCampaignPhaseStatus(ctx, campaignID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCampaignNotFound
		}
		return nil, err
	}

	// Get pass counts
	passedCount, err := s.queries.CountPassedCharactersInCampaign(ctx, campaignID)
	if err != nil {
		return nil, err
	}

	totalCount, err := s.queries.CountUnpassedCharactersInCampaign(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	totalCount += passedCount

	// Check if all characters have passed
	allPassed, err := s.queries.CheckAllCharactersPassed(ctx, campaignID)
	if err != nil {
		return nil, err
	}

	// Determine if transition is possible and what's blocking it
	canTransition := true
	transitionBlock := ""

	if phaseInfo.IsPaused {
		canTransition = false
		transitionBlock = "Campaign is paused"
	} else if string(phaseInfo.CurrentPhase) == PhasePCPhase {
		// PC -> GM transition checks
		if !allPassed && totalCount > 0 {
			canTransition = false
			transitionBlock = "Not all characters have passed"
		}

		// Check for pending rolls
		pendingRolls, rollErr := s.queries.CountPendingRollsInCampaign(ctx, campaignID)
		if rollErr == nil && pendingRolls > 0 {
			canTransition = false
			transitionBlock = "There are pending rolls to resolve"
		}

		// Check for active compose locks
		activeLocks, lockErr := s.queries.CountActiveLocksInCampaign(ctx, campaignID)
		if lockErr == nil && activeLocks > 0 {
			canTransition = false
			transitionBlock = "Players are still composing posts"
		}
	}

	//nolint:exhaustruct // Optional fields are set conditionally below
	status := &PhaseStatus{
		CurrentPhase:    string(phaseInfo.CurrentPhase),
		IsPaused:        phaseInfo.IsPaused,
		PassedCount:     passedCount,
		TotalCount:      totalCount,
		AllPassed:       allPassed,
		CanTransition:   canTransition,
		TransitionBlock: transitionBlock,
	}

	if phaseInfo.CurrentPhaseStartedAt.Valid {
		t := phaseInfo.CurrentPhaseStartedAt.Time
		status.StartedAt = &t
	}

	if phaseInfo.CurrentPhaseExpiresAt.Valid {
		t := phaseInfo.CurrentPhaseExpiresAt.Time
		status.ExpiresAt = &t
	}

	if preset, ok := phaseInfo.TimeGatePreset.(string); ok {
		status.TimeGatePreset = preset
	}

	// Check if time gate has expired (PC Phase only)
	if status.CurrentPhase == PhasePCPhase && status.ExpiresAt != nil {
		status.IsExpired = time.Now().After(*status.ExpiresAt)
	}

	// When expired, auto-pass all characters and update counts
	if status.IsExpired && status.CurrentPhase == PhasePCPhase {
		// Auto-pass all characters (lazy processing)
		passSvc := NewPassService(s.pool)
		_ = passSvc.AutoPassAllCharacters(ctx, campaignID) // Best effort

		// Update counts to reflect auto-pass (all characters now passed)
		status.PassedCount = totalCount
		status.AllPassed = true

		// Update transition logic - expired means can transition
		// Check for pending rolls first
		pendingRolls, rollErr := s.queries.CountPendingRollsInCampaign(ctx, campaignID)
		if rollErr == nil && pendingRolls == 0 {
			// No pending rolls - allow transition when expired
			status.CanTransition = true
			status.TransitionBlock = ""
		}
	}

	return status, nil
}

// TransitionPhaseRequest represents a request to transition phases.
type TransitionPhaseRequest struct {
	ToPhase string `binding:"required,oneof=pc_phase gm_phase" json:"toPhase"`
}

// TransitionPhase transitions the campaign to a new phase.
//
//nolint:gocognit,nestif,funlen // Phase transition guards require nested condition checks
func (s *PhaseService) TransitionPhase(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
	req TransitionPhaseRequest,
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

	// Start transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	// Get current campaign state
	campaign, err := qtx.GetCampaign(ctx, campaignID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCampaignNotFound
		}
		return nil, err
	}

	// Check if already in target phase
	if string(campaign.CurrentPhase) == req.ToPhase {
		return nil, ErrAlreadyInPhase
	}

	// Check if campaign is paused
	if campaign.IsPaused {
		return nil, ErrCampaignPaused
	}

	// Apply transition guards based on direction
	if req.ToPhase == PhaseGMPhase {
		// PC -> GM transition requires additional checks

		// Check for active compose locks
		activeLocks, lockErr := qtx.CountActiveLocksInCampaign(ctx, campaignID)
		if lockErr != nil {
			return nil, lockErr
		}
		if activeLocks > 0 {
			return nil, ErrActiveComposeLocks
		}

		// Check for pending rolls
		pendingRolls, rollErr := qtx.CountPendingRollsInCampaign(ctx, campaignID)
		if rollErr != nil {
			return nil, rollErr
		}
		if pendingRolls > 0 {
			return nil, ErrPendingRolls
		}

		// Check if all characters have passed (only if there are characters)
		allPassed, passErr := qtx.CheckAllCharactersPassed(ctx, campaignID)
		if passErr != nil {
			return nil, passErr
		}

		// Count total characters to know if we need pass check
		unpassedCount, countErr := qtx.CountUnpassedCharactersInCampaign(ctx, campaignID)
		if countErr != nil {
			return nil, countErr
		}

		if unpassedCount > 0 && !allPassed {
			return nil, ErrNotAllPassed
		}
	}

	// Calculate expiration time for PC phase
	var expiresAt pgtype.Timestamptz
	if req.ToPhase == PhasePCPhase {
		// Get time gate preset from settings
		phaseStatus, statusErr := qtx.GetCampaignPhaseStatus(ctx, campaignID)
		if statusErr != nil {
			return nil, statusErr
		}

		if preset, ok := phaseStatus.TimeGatePreset.(string); ok {
			if duration, presetOk := TimeGatePresets[preset]; presetOk {
				expiresAt = pgtype.Timestamptz{
					Time:             time.Now().Add(duration),
					Valid:            true,
					InfinityModifier: 0, // pgtype.Finite
				}
			}
		}
	}

	// Perform the transition
	toPhase := generated.CampaignPhase(req.ToPhase)
	updatedCampaign, err := qtx.TransitionCampaignPhase(ctx, generated.TransitionCampaignPhaseParams{
		ID:                    campaignID,
		CurrentPhase:          toPhase,
		CurrentPhaseExpiresAt: expiresAt,
	})
	if err != nil {
		return nil, err
	}

	// Reset all pass states on transition
	if resetErr := qtx.ResetAllPassStatesInCampaign(ctx, campaignID); resetErr != nil {
		return nil, resetErr
	}

	// Update GM activity timestamp
	if gmErr := qtx.UpdateGmActivity(ctx, campaignID); gmErr != nil {
		return nil, gmErr
	}

	if commitErr := tx.Commit(ctx); commitErr != nil {
		return nil, commitErr
	}

	return &updatedCampaign, nil
}

// ForceTransitionPhase allows GM to force transition without checks (for edge cases).
func (s *PhaseService) ForceTransitionPhase(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
	req TransitionPhaseRequest,
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

	// Start transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	// Get current campaign state
	campaign, err := qtx.GetCampaign(ctx, campaignID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCampaignNotFound
		}
		return nil, err
	}

	// Check if already in target phase
	if string(campaign.CurrentPhase) == req.ToPhase {
		return nil, ErrAlreadyInPhase
	}

	// Calculate expiration time for PC phase
	var expiresAt pgtype.Timestamptz
	if req.ToPhase == PhasePCPhase {
		phaseStatus, statusErr := qtx.GetCampaignPhaseStatus(ctx, campaignID)
		if statusErr != nil {
			return nil, statusErr
		}

		if preset, ok := phaseStatus.TimeGatePreset.(string); ok {
			if duration, presetOk := TimeGatePresets[preset]; presetOk {
				expiresAt = pgtype.Timestamptz{
					Time:             time.Now().Add(duration),
					Valid:            true,
					InfinityModifier: 0, // pgtype.Finite
				}
			}
		}
	}

	// Perform the transition (no guards)
	toPhase := generated.CampaignPhase(req.ToPhase)
	updatedCampaign, err := qtx.TransitionCampaignPhase(ctx, generated.TransitionCampaignPhaseParams{
		ID:                    campaignID,
		CurrentPhase:          toPhase,
		CurrentPhaseExpiresAt: expiresAt,
	})
	if err != nil {
		return nil, err
	}

	// Reset all pass states
	if resetErr := qtx.ResetAllPassStatesInCampaign(ctx, campaignID); resetErr != nil {
		return nil, resetErr
	}

	// Update GM activity
	if gmErr := qtx.UpdateGmActivity(ctx, campaignID); gmErr != nil {
		return nil, gmErr
	}

	if commitErr := tx.Commit(ctx); commitErr != nil {
		return nil, commitErr
	}

	return &updatedCampaign, nil
}
