package service

import "errors"

// Campaign errors.
var (
	ErrCampaignLimitReached = errors.New("user has reached maximum campaign limit (5)")
	ErrNotGM                = errors.New("only the GM can perform this action")
	ErrCampaignNotFound     = errors.New("campaign not found")
	ErrInvalidSettings      = errors.New("invalid campaign settings")
	ErrNotMember            = errors.New("user is not a member of this campaign")
)

// Invite errors.
var (
	ErrInviteLimitReached = errors.New("too many active invites (max ~100)")
	ErrInviteExpired      = errors.New("invite link has expired")
	ErrInviteUsed         = errors.New("invite link has already been used")
	ErrInviteRevoked      = errors.New("invite link has been revoked")
	ErrInviteNotFound     = errors.New("invite link not found")
	ErrCampaignFull       = errors.New("campaign has reached player limit (50)")
)

// Membership errors.
var (
	ErrAlreadyMember   = errors.New("user is already a member of this campaign")
	ErrCannotLeaveAsGM = errors.New("GM cannot leave campaign (transfer role first)")
	ErrGmNotAbandoned  = errors.New("GM is still active (not past 30-day threshold)")
)

// Limits.
const (
	MaxCampaignsPerUser = 5
	MaxCampaignMembers  = 50
	MaxActiveInvites    = 100
	GmInactivityDays    = 30
)
