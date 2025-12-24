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

// Compose lock constants.
const (
	LockTimeoutMinutes = 10
	HeartbeatInterval  = 2 * time.Second
	SecondsPerMinute   = 60
)

// Compose lock errors.
var (
	ErrLockNotFound      = errors.New("compose lock not found")
	ErrLockAlreadyHeld   = errors.New("compose lock already held by another user")
	ErrNotLockOwner      = errors.New("you do not own this compose lock")
	ErrCharacterNotOwned = errors.New("you do not own this character")
	ErrNotInPCPhase      = errors.New("posts can only be created during PC Phase")
	ErrTimeGateExpired   = errors.New("time gate has expired, cannot compose posts")
)

// ComposeService handles compose lock business logic.
type ComposeService struct {
	queries *generated.Queries
	pool    *pgxpool.Pool
}

// NewComposeService creates a new ComposeService.
func NewComposeService(pool *pgxpool.Pool) *ComposeService {
	return &ComposeService{
		queries: generated.New(pool),
		pool:    pool,
	}
}

// AcquireLockRequest represents the request to acquire a compose lock.
type AcquireLockRequest struct {
	SceneID     string `json:"sceneId"`
	CharacterID string `json:"characterId"`
	IsHidden    bool   `json:"isHidden"` // Whether the user is composing a hidden post
}

// AcquireLockResponse represents the response from acquiring a compose lock.
type AcquireLockResponse struct {
	LockID           string `json:"lockId"`
	ExpiresAt        string `json:"expiresAt"`
	RemainingSeconds int    `json:"remainingSeconds"`
}

// AcquireLock acquires a compose lock for a character in a scene.
//
//nolint:gocognit,nestif,funlen // Complex lock acquisition logic with necessary nesting.
func (s *ComposeService) AcquireLock(
	ctx context.Context,
	userID pgtype.UUID,
	req AcquireLockRequest,
) (*AcquireLockResponse, error) {
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

	// Verify PC Phase (players can only post during PC Phase)
	// GMs can post during any phase
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: sceneWithCampaign.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, err
	}

	if !isGM && sceneWithCampaign.CurrentPhase != generated.CampaignPhasePcPhase {
		return nil, ErrNotInPCPhase
	}

	// Check if time gate has expired (lazy processing)
	if !isGM && sceneWithCampaign.CurrentPhase == generated.CampaignPhasePcPhase {
		if sceneWithCampaign.CurrentPhaseExpiresAt.Valid &&
			time.Now().After(sceneWithCampaign.CurrentPhaseExpiresAt.Time) {
			// Time gate expired - auto-pass all characters
			passSvc := NewPassService(s.pool)
			if passErr := passSvc.AutoPassAllCharacters(ctx, sceneWithCampaign.CampaignID); passErr != nil {
				// Log error but continue - auto-pass is best-effort
				_ = passErr
			}

			// Block lock acquisition for players
			return nil, ErrTimeGateExpired
		}
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

	// Verify user owns this character (or is GM for NPCs)
	char, err := s.queries.GetCharacter(ctx, characterID)
	if err != nil {
		return nil, err
	}

	assignment, err := s.queries.GetCharacterAssignment(ctx, characterID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	// For NPCs or unassigned characters, only GM can use them
	if errors.Is(err, pgx.ErrNoRows) || !assignment.UserID.Valid {
		if !isGM {
			return nil, ErrCharacterNotOwned
		}
	} else if assignment.UserID != userID {
		return nil, ErrCharacterNotOwned
	}

	// Check for NPC - only GM can post as NPCs
	if char.CharacterType == generated.CharacterTypeNpc && !isGM {
		return nil, ErrCharacterNotOwned
	}

	// Check if lock already exists
	existingLock, err := s.queries.GetComposeLock(ctx, generated.GetComposeLockParams{
		SceneID:     sceneID,
		CharacterID: characterID,
	})
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	now := time.Now()
	expiresAt := now.Add(LockTimeoutMinutes * time.Minute)

	// If lock exists, check if it's expired or owned by same user
	if err == nil {
		// Lock exists
		if existingLock.UserID == userID {
			// Same user - refresh the lock
			if updateErr := s.queries.UpdateComposeLockActivity(ctx, generated.UpdateComposeLockActivityParams{
				ID:             existingLock.ID,
				LastActivityAt: pgtype.Timestamptz{Time: now, Valid: true, InfinityModifier: pgtype.Finite},
				ExpiresAt:      pgtype.Timestamptz{Time: expiresAt, Valid: true, InfinityModifier: pgtype.Finite},
			}); updateErr != nil {
				return nil, updateErr
			}

			return &AcquireLockResponse{
				LockID:           formatUUID(existingLock.ID.Bytes[:]),
				ExpiresAt:        expiresAt.Format(time.RFC3339),
				RemainingSeconds: LockTimeoutMinutes * SecondsPerMinute,
			}, nil
		}

		// Different user - check if expired
		if existingLock.ExpiresAt.Time.After(now) {
			return nil, ErrLockAlreadyHeld
		}

		// Lock expired - delete it first
		if deleteErr := s.queries.DeleteComposeLock(ctx, existingLock.ID); deleteErr != nil {
			return nil, deleteErr
		}
	}

	// Create new lock
	lock, err := s.queries.AcquireComposeLock(ctx, generated.AcquireComposeLockParams{
		SceneID:     sceneID,
		CharacterID: characterID,
		UserID:      userID,
		ExpiresAt:   pgtype.Timestamptz{Time: expiresAt, Valid: true, InfinityModifier: pgtype.Finite},
		IsHidden:    req.IsHidden,
	})
	if err != nil {
		return nil, err
	}

	return &AcquireLockResponse{
		LockID:           formatUUID(lock.ID.Bytes[:]),
		ExpiresAt:        expiresAt.Format(time.RFC3339),
		RemainingSeconds: LockTimeoutMinutes * SecondsPerMinute,
	}, nil
}

// HeartbeatRequest represents a heartbeat request to refresh lock expiration.
type HeartbeatRequest struct {
	LockID string `json:"lockId"`
}

// HeartbeatResponse represents the response from a heartbeat.
type HeartbeatResponse struct {
	Acknowledged     bool   `json:"acknowledged"`
	ExpiresAt        string `json:"expiresAt"`
	RemainingSeconds int    `json:"remainingSeconds"`
}

// Heartbeat refreshes a compose lock's expiration time.
func (s *ComposeService) Heartbeat(
	ctx context.Context,
	userID pgtype.UUID,
	req HeartbeatRequest,
) (*HeartbeatResponse, error) {
	lockID := parseUUIDString(req.LockID)

	lock, err := s.queries.GetComposeLockByID(ctx, lockID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrLockNotFound
		}
		return nil, err
	}

	// Verify ownership
	if lock.UserID != userID {
		return nil, ErrNotLockOwner
	}

	// Update activity
	now := time.Now()
	expiresAt := now.Add(LockTimeoutMinutes * time.Minute)

	if updateErr := s.queries.UpdateComposeLockActivity(ctx, generated.UpdateComposeLockActivityParams{
		ID:             lockID,
		LastActivityAt: pgtype.Timestamptz{Time: now, Valid: true, InfinityModifier: pgtype.Finite},
		ExpiresAt:      pgtype.Timestamptz{Time: expiresAt, Valid: true, InfinityModifier: pgtype.Finite},
	}); updateErr != nil {
		return nil, updateErr
	}

	return &HeartbeatResponse{
		Acknowledged:     true,
		ExpiresAt:        expiresAt.Format(time.RFC3339),
		RemainingSeconds: LockTimeoutMinutes * SecondsPerMinute,
	}, nil
}

// ReleaseLock releases a compose lock.
func (s *ComposeService) ReleaseLock(
	ctx context.Context,
	userID pgtype.UUID,
	lockID string,
) error {
	lockUUID := parseUUIDString(lockID)

	lock, err := s.queries.GetComposeLockByID(ctx, lockUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil // Already released
		}
		return err
	}

	// Verify ownership
	if lock.UserID != userID {
		return ErrNotLockOwner
	}

	return s.queries.DeleteComposeLock(ctx, lockUUID)
}

// ForceReleaseLock releases a compose lock by GM force.
func (s *ComposeService) ForceReleaseLock(
	ctx context.Context,
	userID pgtype.UUID,
	lockID string,
) error {
	lockUUID := parseUUIDString(lockID)

	lock, err := s.queries.GetComposeLockByID(ctx, lockUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrLockNotFound
		}
		return err
	}

	// Get scene to check GM status
	scene, err := s.queries.GetScene(ctx, lock.SceneID)
	if err != nil {
		return err
	}

	// Verify user is GM
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return err
	}
	if !isGM {
		return ErrNotGM
	}

	return s.queries.DeleteComposeLock(ctx, lockUUID)
}

// UpdateLockHidden updates whether a compose lock is for a hidden post.
func (s *ComposeService) UpdateLockHidden(
	ctx context.Context,
	userID pgtype.UUID,
	lockID string,
	isHidden bool,
) error {
	lockUUID := parseUUIDString(lockID)

	lock, err := s.queries.GetComposeLockByID(ctx, lockUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrLockNotFound
		}
		return err
	}

	// Verify ownership
	if lock.UserID != userID {
		return ErrNotLockOwner
	}

	return s.queries.UpdateComposeLockHidden(ctx, generated.UpdateComposeLockHiddenParams{
		ID:       lockUUID,
		IsHidden: isHidden,
	})
}

// SceneLockInfo represents lock information for display.
type SceneLockInfo struct {
	ID              string `json:"id"`
	SceneID         string `json:"sceneId"`
	CharacterID     string `json:"characterId"`
	UserID          string `json:"userId"`
	CharacterName   string `json:"characterName"`
	CharacterAvatar string `json:"characterAvatar,omitempty"`
	ExpiresAt       string `json:"expiresAt"`
	IsHidden        bool   `json:"isHidden"`
}

// GetSceneLocks returns all active locks in a scene.
func (s *ComposeService) GetSceneLocks(
	ctx context.Context,
	userID pgtype.UUID,
	sceneID string,
) ([]SceneLockInfo, bool, error) {
	sceneUUID := parseUUIDString(sceneID)

	// Verify access
	scene, err := s.queries.GetScene(ctx, sceneUUID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, false, ErrSceneNotFound
		}
		return nil, false, err
	}

	isMember, err := s.queries.IsCampaignMember(ctx, generated.IsCampaignMemberParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, false, err
	}
	if !isMember {
		return nil, false, ErrNotMember
	}

	// Check if user is GM (for full lock visibility)
	isGM, err := s.queries.IsUserGM(ctx, generated.IsUserGMParams{
		CampaignID: scene.CampaignID,
		UserID:     userID,
	})
	if err != nil {
		return nil, false, err
	}

	// Delete expired locks first
	if deleteErr := s.queries.DeleteExpiredComposeLocks(ctx, pgtype.Timestamptz{
		Time:             time.Now(),
		Valid:            true,
		InfinityModifier: pgtype.Finite,
	}); deleteErr != nil {
		return nil, false, deleteErr
	}

	locks, err := s.queries.GetComposeLockByScene(ctx, sceneUUID)
	if err != nil {
		return nil, false, err
	}

	// Convert to response format with hidden post handling
	result := make([]SceneLockInfo, 0, len(locks))
	for _, lock := range locks {
		charName := lock.CharacterName
		charAvatar := ""
		if lock.CharacterAvatar.Valid {
			charAvatar = lock.CharacterAvatar.String
		}

		// For hidden posts, show generic message to non-GM players
		if lock.IsHidden && !isGM && lock.UserID != userID {
			charName = "Another player"
			charAvatar = ""
		}

		info := SceneLockInfo{
			ID:              formatUUID(lock.ID.Bytes[:]),
			SceneID:         formatUUID(lock.SceneID.Bytes[:]),
			CharacterID:     formatUUID(lock.CharacterID.Bytes[:]),
			UserID:          formatUUID(lock.UserID.Bytes[:]),
			CharacterName:   charName,
			CharacterAvatar: charAvatar,
			ExpiresAt:       lock.ExpiresAt.Time.Format(time.RFC3339),
			IsHidden:        lock.IsHidden,
		}

		result = append(result, info)
	}

	return result, isGM, nil
}
