package service

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
)

// MembershipService handles campaign membership business logic.
type MembershipService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

// NewMembershipService creates a new MembershipService.
func NewMembershipService(pool *pgxpool.Pool) *MembershipService {
	return &MembershipService{
		queries: generated.New(pool),
		pool:    pool,
	}
}

// LeaveCampaign allows a player to leave a campaign.
func (s *MembershipService) LeaveCampaign(ctx context.Context, campaignID, userID pgtype.UUID) error {
	// Get campaign to check if user is GM
	campaign, err := s.queries.GetCampaign(ctx, campaignID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrCampaignNotFound
		}
		return err
	}

	// GM cannot leave without transferring role
	if campaign.OwnerID.Valid && campaign.OwnerID.Bytes == userID.Bytes {
		return ErrCannotLeaveAsGM
	}

	// Check if user is a member
	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: campaignID,
		UserID:     userID,
	})
	if err != nil {
		return err
	}
	if !isMember {
		return ErrNotMember
	}

	// Remove membership
	return s.queries.RemoveCampaignMember(ctx, generated.RemoveCampaignMemberParams{
		CampaignID: campaignID,
		UserID:     userID,
	})
}

// RemoveMember allows GM to remove a player from the campaign.
func (s *MembershipService) RemoveMember(ctx context.Context, campaignID, gmUserID, targetUserID pgtype.UUID) error {
	// Verify requester is GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: campaignID,
		UserID:     gmUserID,
	})
	if err != nil {
		return err
	}
	if !isGM {
		return ErrNotGM
	}

	// Cannot remove self (must transfer first)
	if targetUserID.Bytes == gmUserID.Bytes {
		return errors.New("cannot remove yourself as GM (transfer role first)")
	}

	// Check if target is a member
	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: campaignID,
		UserID:     targetUserID,
	})
	if err != nil {
		return err
	}
	if !isMember {
		return ErrNotMember
	}

	// Remove membership
	return s.queries.RemoveCampaignMember(ctx, generated.RemoveCampaignMemberParams{
		CampaignID: campaignID,
		UserID:     targetUserID,
	})
}

// TransferGmRole transfers GM role to another member.
func (s *MembershipService) TransferGmRole(ctx context.Context, campaignID, currentGmID, newGmID pgtype.UUID) error {
	// Verify requester is current GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: campaignID,
		UserID:     currentGmID,
	})
	if err != nil {
		return err
	}
	if !isGM {
		return ErrNotGM
	}

	// Verify new GM is a member
	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: campaignID,
		UserID:     newGmID,
	})
	if err != nil {
		return err
	}
	if !isMember {
		return errors.New("new GM must be a campaign member")
	}

	// Start transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	// Update campaign owner
	_, err = qtx.UpdateCampaignOwner(ctx, generated.UpdateCampaignOwnerParams{
		ID:      campaignID,
		OwnerID: newGmID,
	})
	if err != nil {
		return err
	}

	// Update old GM to player role
	err = qtx.UpdateMemberRole(ctx, generated.UpdateMemberRoleParams{
		CampaignID: campaignID,
		UserID:     currentGmID,
		Role:       generated.MemberRolePlayer,
	})
	if err != nil {
		return err
	}

	// Update new GM to gm role
	err = qtx.UpdateMemberRole(ctx, generated.UpdateMemberRoleParams{
		CampaignID: campaignID,
		UserID:     newGmID,
		Role:       generated.MemberRoleGm,
	})
	if err != nil {
		return err
	}

	// Update GM activity
	err = qtx.UpdateGmActivity(ctx, campaignID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// ClaimAbandonedGmRole allows a player to claim GM role after 30 days of GM inactivity.
func (s *MembershipService) ClaimAbandonedGmRole(ctx context.Context, campaignID, claimantUserID pgtype.UUID) error {
	// Check GM inactivity
	inactivity, err := s.queries.CheckGmInactivity(ctx, campaignID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrCampaignNotFound
		}
		return err
	}

	if inactivity.DaysInactive < GmInactivityDays {
		return ErrGmNotAbandoned
	}

	// Verify claimant is a member
	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: campaignID,
		UserID:     claimantUserID,
	})
	if err != nil {
		return err
	}
	if !isMember {
		return errors.New("must be a campaign member to claim GM role")
	}

	// Get current GM (if exists)
	campaign, err := s.queries.GetCampaign(ctx, campaignID)
	if err != nil {
		return err
	}

	// Start transaction
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	qtx := s.queries.WithTx(tx)

	// Update campaign owner
	_, err = qtx.UpdateCampaignOwner(ctx, generated.UpdateCampaignOwnerParams{
		ID:      campaignID,
		OwnerID: claimantUserID,
	})
	if err != nil {
		return err
	}

	// If old GM still exists as member, demote to player
	if campaign.OwnerID.Valid {
		_ = qtx.UpdateMemberRole(ctx, generated.UpdateMemberRoleParams{
			CampaignID: campaignID,
			UserID:     campaign.OwnerID,
			Role:       generated.MemberRolePlayer,
		})
		// Non-critical: old GM may have been removed
	}

	// Promote claimant to GM role
	err = qtx.UpdateMemberRole(ctx, generated.UpdateMemberRoleParams{
		CampaignID: campaignID,
		UserID:     claimantUserID,
		Role:       generated.MemberRoleGm,
	})
	if err != nil {
		return err
	}

	// Reset GM activity timestamp
	err = qtx.UpdateGmActivity(ctx, campaignID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}
