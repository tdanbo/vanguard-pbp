package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
)

const (
	inviteExpirationHours = 24
	inviteCodeBytes       = 8 // Generates 16-character hex code
)

// InviteService handles invite link business logic.
type InviteService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

// NewInviteService creates a new InviteService.
func NewInviteService(pool *pgxpool.Pool) *InviteService {
	return &InviteService{
		queries: generated.New(pool),
		pool:    pool,
	}
}

// CreateInviteLink creates a new invite link for a campaign.
func (s *InviteService) CreateInviteLink(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
) (*generated.InviteLink, error) {
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

	// Check active invite limit
	activeCount, err := s.queries.CountActiveCampaignInvites(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	if activeCount >= int64(MaxActiveInvites) {
		return nil, ErrInviteLimitReached
	}

	// Generate unique code
	code, err := generateInviteCode()
	if err != nil {
		return nil, err
	}

	// Create invite with 24h expiration
	expiresAt := time.Now().Add(inviteExpirationHours * time.Hour)

	//nolint:exhaustruct // InfinityModifier not needed for normal timestamps
	invite, err := s.queries.CreateInviteLink(ctx, generated.CreateInviteLinkParams{
		CampaignID: campaignID,
		Code:       code,
		CreatedBy:  userID,
		ExpiresAt:  pgtype.Timestamptz{Time: expiresAt, Valid: true},
	})
	if err != nil {
		return nil, err
	}

	return &invite, nil
}

// ValidateInviteCode validates an invite code and returns the invite if valid.
func (s *InviteService) ValidateInviteCode(
	ctx context.Context,
	code string,
) (*generated.GetInviteLinkByCodeRow, error) {
	invite, err := s.queries.GetInviteLinkByCode(ctx, code)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrInviteNotFound
		}
		return nil, err
	}

	// Check if expired
	if invite.ExpiresAt.Valid && time.Now().After(invite.ExpiresAt.Time) {
		return nil, ErrInviteExpired
	}

	// Check if already used
	if invite.UsedAt.Valid {
		return nil, ErrInviteUsed
	}

	// Check if revoked
	if invite.RevokedAt.Valid {
		return nil, ErrInviteRevoked
	}

	return &invite, nil
}

// UseInviteCode marks an invite as used and adds user to campaign.
func (s *InviteService) UseInviteCode(
	ctx context.Context,
	code string,
	userID pgtype.UUID,
) (*generated.Campaign, error) {
	// Validate the invite
	invite, err := s.ValidateInviteCode(ctx, code)
	if err != nil {
		return nil, err
	}

	// Check if already a member
	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: invite.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}
	if isMember {
		return nil, ErrAlreadyMember
	}

	// Check campaign member limit
	memberCount, err := s.queries.GetCampaignMemberCount(ctx, invite.CampaignID)
	if err != nil {
		return nil, err
	}
	if memberCount >= int64(MaxCampaignMembers) {
		return nil, ErrCampaignFull
	}

	// Start transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	// Mark invite as used
	_, err = qtx.MarkInviteUsed(ctx, generated.MarkInviteUsedParams{
		ID:     invite.ID,
		UsedBy: userID,
	})
	if err != nil {
		return nil, err
	}

	// Add user as player member
	_, err = qtx.AddCampaignMember(ctx, generated.AddCampaignMemberParams{
		CampaignID: invite.CampaignID,
		UserID:     userID,
		Role:       generated.MemberRolePlayer,
	})
	if err != nil {
		return nil, err
	}

	if commitErr := tx.Commit(ctx); commitErr != nil {
		return nil, commitErr
	}

	// Get the campaign to return
	campaign, err := s.queries.GetCampaign(ctx, invite.CampaignID)
	if err != nil {
		return nil, err
	}

	return &campaign, nil
}

// ListCampaignInvites returns all invites for a campaign (GM only).
func (s *InviteService) ListCampaignInvites(
	ctx context.Context,
	campaignID, userID pgtype.UUID,
) ([]generated.InviteLink, error) {
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

	return s.queries.ListCampaignInvites(ctx, campaignID)
}

// RevokeInvite revokes an invite link (GM only).
func (s *InviteService) RevokeInvite(
	ctx context.Context,
	inviteID, campaignID, userID pgtype.UUID,
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

	_, err = s.queries.RevokeInvite(ctx, generated.RevokeInviteParams{
		ID:         inviteID,
		CampaignID: campaignID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInviteNotFound
		}
		return err
	}

	return nil
}

// generateInviteCode generates a random 16-character hex code.
func generateInviteCode() (string, error) {
	codeBytes := make([]byte, inviteCodeBytes)
	if _, err := rand.Read(codeBytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(codeBytes), nil
}
