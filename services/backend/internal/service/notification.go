package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
)

// Time constants for notification calculations.
const (
	minutesPerHour     = 60
	microsecondsPerMin = 60000000
	hoursPerDay        = 24
	timeGateWarning24h = 24
	timeGateWarning6h  = 6
	timeGateWarning1h  = 1
)

// emptyUUID returns an invalid/empty UUID for optional fields.
func emptyUUID() pgtype.UUID {
	return pgtype.UUID{Bytes: [16]byte{}, Valid: false}
}

// Notification types for various game events.
const (
	// NotifPCPhaseStarted is sent when PC Phase begins.
	NotifPCPhaseStarted      = "pc_phase_started"
	NotifNewPostInScene      = "new_post_in_scene"
	NotifRollRequested       = "roll_requested"
	NotifIntentionOverridden = "intention_overridden"
	NotifCharacterAddedScene = "character_added_to_scene"
	NotifComposeLockReleased = "compose_lock_released"
	NotifTimeGateWarning24h  = "time_gate_warning_24h"
	NotifTimeGateWarning6h   = "time_gate_warning_6h"
	NotifTimeGateWarning1h   = "time_gate_warning_1h"
	NotifPassStateCleared    = "pass_state_cleared"
	NotifGMRoleAvailable     = "gm_role_available"

	// NotifAllCharactersPassed is sent when all PCs have passed.
	NotifAllCharactersPassed   = "all_characters_passed"
	NotifTimeGateExpired       = "time_gate_expired"
	NotifHiddenPostSubmitted   = "hidden_post_submitted"
	NotifPlayerJoined          = "player_joined"
	NotifPlayerRollSubmitted   = "player_roll_submitted"
	NotifUnresolvedRollsExist  = "unresolved_rolls_exist"
	NotifCampaignAtPlayerLimit = "campaign_at_player_limit"
	NotifSceneLimitWarning     = "scene_limit_warning"
)

// NotificationService handles notification creation and delivery.
type NotificationService struct {
	db      *database.DB
	queries *generated.Queries
}

// NewNotificationService creates a new notification service.
func NewNotificationService(db *database.DB, queries *generated.Queries) *NotificationService {
	return &NotificationService{
		db:      db,
		queries: queries,
	}
}

// CreateNotificationParams contains parameters for creating a notification.
type CreateNotificationParams struct {
	UserID      pgtype.UUID
	CampaignID  pgtype.UUID
	SceneID     pgtype.UUID
	PostID      pgtype.UUID
	CharacterID pgtype.UUID
	Type        string
	Title       string
	Body        string
	Link        string
	IsUrgent    bool
	Metadata    map[string]interface{}
}

// CreateNotification creates a new notification.
func (s *NotificationService) CreateNotification(
	ctx context.Context,
	params CreateNotificationParams,
) (*generated.Notification, error) {
	// Marshal metadata to JSON
	metadataJSON, err := json.Marshal(params.Metadata)
	if err != nil {
		metadataJSON = []byte("{}")
	}

	// Create notification
	notification, err := s.queries.CreateNotification(ctx, generated.CreateNotificationParams{
		UserID:      params.UserID,
		Title:       params.Title,
		Body:        params.Body,
		Type:        params.Type,
		CampaignID:  params.CampaignID,
		SceneID:     params.SceneID,
		PostID:      params.PostID,
		CharacterID: params.CharacterID,
		IsUrgent:    params.IsUrgent,
		Link:        pgtype.Text{String: params.Link, Valid: params.Link != ""},
		Metadata:    metadataJSON,
		Column12:    nil, // Uses COALESCE default (90 days)
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create notification: %w", err)
	}

	// Handle email delivery asynchronously
	go s.handleEmailDelivery(context.Background(), &notification)

	return &notification, nil
}

// handleEmailDelivery handles email notification delivery based on user preferences.
func (s *NotificationService) handleEmailDelivery(ctx context.Context, notification *generated.Notification) {
	// Get notification preferences
	prefs, err := s.queries.GetNotificationPreferences(ctx, notification.UserID)
	if err != nil {
		// No preferences set, use defaults (skip email)
		return
	}

	if !prefs.EmailEnabled {
		return
	}

	switch prefs.EmailFrequency {
	case generated.NotificationFrequencyOff:
		return

	case generated.NotificationFrequencyRealtime:
		// Check quiet hours
		inQuietHours := s.isInQuietHours(ctx, notification.UserID)

		if inQuietHours {
			if notification.IsUrgent {
				// Check if urgent bypass is enabled
				quietHours, qhErr := s.queries.GetQuietHours(ctx, notification.UserID)
				if qhErr == nil && quietHours.UrgentBypass {
					// Send immediately despite quiet hours
					s.sendImmediateEmail(ctx, notification)
					return
				}
			}
			// Queue for later
			s.queueForLater(ctx, notification)
		} else {
			s.sendImmediateEmail(ctx, notification)
		}

	case generated.NotificationFrequencyDigestDaily, generated.NotificationFrequencyDigestWeekly:
		// Will be handled by cron job
		return
	}
}

// isInQuietHours checks if the current time is within the user's quiet hours.
func (s *NotificationService) isInQuietHours(ctx context.Context, userID pgtype.UUID) bool {
	quietHours, err := s.queries.GetQuietHours(ctx, userID)
	if err != nil {
		// No quiet hours configured
		return false
	}

	if !quietHours.Enabled {
		return false
	}

	// Load timezone
	loc, err := time.LoadLocation(quietHours.Timezone)
	if err != nil {
		loc = time.UTC
	}

	// Get current time in user's timezone
	now := time.Now().In(loc)
	currentMinutes := now.Hour()*minutesPerHour + now.Minute()

	// Parse start and end times
	startMinutes := int(quietHours.StartTime.Microseconds / microsecondsPerMin)
	endMinutes := int(quietHours.EndTime.Microseconds / microsecondsPerMin)

	// Handle overnight quiet hours (e.g., 22:00 - 08:00)
	if startMinutes > endMinutes {
		return currentMinutes >= startMinutes || currentMinutes < endMinutes
	}

	return currentMinutes >= startMinutes && currentMinutes < endMinutes
}

// queueForLater queues a notification for delivery after quiet hours end.
func (s *NotificationService) queueForLater(ctx context.Context, notification *generated.Notification) {
	quietHours, err := s.queries.GetQuietHours(ctx, notification.UserID)
	if err != nil {
		return
	}

	// Calculate delivery time
	loc, err := time.LoadLocation(quietHours.Timezone)
	if err != nil {
		loc = time.UTC
	}

	now := time.Now().In(loc)
	endMinutes := int(quietHours.EndTime.Microseconds / microsecondsPerMin)
	endHour := endMinutes / minutesPerHour
	endMin := endMinutes % minutesPerHour

	deliveryTime := time.Date(
		now.Year(), now.Month(), now.Day(),
		endHour, endMin, 0, 0, loc,
	)

	if deliveryTime.Before(now) {
		deliveryTime = deliveryTime.Add(hoursPerDay * time.Hour)
	}

	_, err = s.queries.QueueNotification(ctx, generated.QueueNotificationParams{
		UserID:         notification.UserID,
		NotificationID: notification.ID,
		DeliverAfter:   pgtype.Timestamptz{Time: deliveryTime.UTC(), Valid: true, InfinityModifier: pgtype.Finite},
	})
	if err != nil {
		//nolint:sloglint // Error logging doesn't need structured logger injection
		slog.Error("Failed to queue notification", "error", err)
	}
}

// sendImmediateEmail sends an email notification immediately.
func (s *NotificationService) sendImmediateEmail(ctx context.Context, notification *generated.Notification) {
	// TODO: Implement email sending via Resend or similar service
	// For now, just mark as sent
	err := s.queries.MarkNotificationEmailSent(ctx, notification.ID)
	if err != nil {
		//nolint:sloglint // Error logging doesn't need structured logger injection
		slog.Error("Failed to mark notification email as sent", "error", err)
	}
	//nolint:sloglint // Info logging doesn't need structured logger injection
	slog.Info("Would send email for notification", "id", notification.ID.Bytes, "title", notification.Title)
}

// NotifyPCPhaseStarted notifies all PCs in a campaign that PC Phase has started.
func (s *NotificationService) NotifyPCPhaseStarted(
	ctx context.Context,
	campaignID pgtype.UUID,
	campaignTitle string,
) error {
	pcUsers, err := s.queries.GetPCUsersInCampaign(ctx, campaignID)
	if err != nil {
		return fmt.Errorf("failed to get PC users: %w", err)
	}

	for _, pc := range pcUsers {
		if _, createErr := s.CreateNotification(ctx, CreateNotificationParams{
			UserID:      pc.UserID,
			CampaignID:  campaignID,
			SceneID:     emptyUUID(),
			PostID:      emptyUUID(),
			CharacterID: pc.CharacterID,
			Type:        NotifPCPhaseStarted,
			Title:       "PC Phase Started",
			Body:        fmt.Sprintf("It's your turn in %s! The PC Phase has started.", campaignTitle),
			Link:        fmt.Sprintf("/campaigns/%s", uuidToString(campaignID)),
			IsUrgent:    true,
			Metadata:    nil,
		}); createErr != nil {
			//nolint:sloglint // Error logging doesn't need structured logger injection
			slog.Error("Failed to notify user", "user", uuidToString(pc.UserID), "error", createErr)
		}
	}

	return nil
}

// NotifyNewPostInScene notifies users in a scene about a new post.
//
//nolint:gocognit,nestif // Complex notification logic with witness filtering
func (s *NotificationService) NotifyNewPostInScene(
	ctx context.Context,
	post *generated.Post,
	sceneName string,
	authorUserID pgtype.UUID,
	isHidden bool,
) error {
	var usersToNotify []pgtype.UUID

	if isHidden && len(post.Witnesses) > 0 {
		// Only notify witnesses
		witnessIDs := make([]pgtype.UUID, len(post.Witnesses))
		copy(witnessIDs, post.Witnesses)
		witnessUserIDs, err := s.queries.GetWitnessUsers(ctx, witnessIDs)
		if err != nil {
			return err
		}
		// GetWitnessUsers returns []pgtype.UUID directly
		for _, userID := range witnessUserIDs {
			if userID != authorUserID {
				usersToNotify = append(usersToNotify, userID)
			}
		}
	} else {
		// Notify all users in scene
		sceneUsers, err := s.queries.GetUsersInScene(ctx, post.SceneID)
		if err != nil {
			return err
		}
		for _, u := range sceneUsers {
			if u.UserID != authorUserID {
				usersToNotify = append(usersToNotify, u.UserID)
			}
		}
	}

	// Deduplicate
	seen := make(map[string]bool)
	for _, userID := range usersToNotify {
		key := uuidToString(userID)
		if seen[key] {
			continue
		}
		seen[key] = true

		// Get campaign ID from scene
		scene, err := s.queries.GetScene(ctx, post.SceneID)
		if err != nil {
			continue
		}

		if _, createErr := s.CreateNotification(ctx, CreateNotificationParams{
			UserID:      userID,
			CampaignID:  scene.CampaignID,
			SceneID:     post.SceneID,
			PostID:      post.ID,
			CharacterID: emptyUUID(),
			Type:        NotifNewPostInScene,
			Title:       "New Post",
			Body:        fmt.Sprintf("New post in %s", sceneName),
			Link: fmt.Sprintf(
				"/campaigns/%s/scenes/%s",
				uuidToString(scene.CampaignID),
				uuidToString(post.SceneID),
			),
			IsUrgent: false,
			Metadata: nil,
		}); createErr != nil {
			//nolint:sloglint // Error logging doesn't need structured logger injection
			slog.Error("Failed to notify user", "error", createErr)
		}
	}

	return nil
}

// NotifyGMHiddenPost notifies the GM about a hidden post submission.
func (s *NotificationService) NotifyGMHiddenPost(
	ctx context.Context,
	campaignID pgtype.UUID,
	sceneID pgtype.UUID,
	postID pgtype.UUID,
	sceneName string,
) error {
	gmUserID, err := s.queries.GetGMUserID(ctx, campaignID)
	if err != nil {
		return fmt.Errorf("failed to get GM: %w", err)
	}

	_, createErr := s.CreateNotification(ctx, CreateNotificationParams{
		UserID:      gmUserID,
		CampaignID:  campaignID,
		SceneID:     sceneID,
		PostID:      postID,
		CharacterID: emptyUUID(),
		Type:        NotifHiddenPostSubmitted,
		Title:       "Hidden Post Submitted",
		Body:        fmt.Sprintf("A player submitted a hidden post in %s", sceneName),
		Link: fmt.Sprintf(
			"/campaigns/%s/scenes/%s/posts/%s",
			uuidToString(campaignID),
			uuidToString(sceneID),
			uuidToString(postID),
		),
		IsUrgent: false,
		Metadata: nil,
	})
	return createErr
}

// NotifyAllCharactersPassed notifies the GM when all characters have passed.
func (s *NotificationService) NotifyAllCharactersPassed(
	ctx context.Context,
	campaignID pgtype.UUID,
	campaignTitle string,
) error {
	gmUserID, err := s.queries.GetGMUserID(ctx, campaignID)
	if err != nil {
		return fmt.Errorf("failed to get GM: %w", err)
	}

	_, createErr := s.CreateNotification(ctx, CreateNotificationParams{
		UserID:      gmUserID,
		CampaignID:  campaignID,
		SceneID:     emptyUUID(),
		PostID:      emptyUUID(),
		CharacterID: emptyUUID(),
		Type:        NotifAllCharactersPassed,
		Title:       "All Characters Passed",
		Body:        fmt.Sprintf("All PCs have passed in %s. Ready to transition to GM Phase.", campaignTitle),
		Link:        fmt.Sprintf("/campaigns/%s", uuidToString(campaignID)),
		IsUrgent:    true,
		Metadata:    nil,
	})
	return createErr
}

// NotifyTimeGateWarning notifies users about time gate expiration.
func (s *NotificationService) NotifyTimeGateWarning(
	ctx context.Context,
	campaignID pgtype.UUID,
	campaignTitle string,
	hoursRemaining int,
) error {
	var notifType string
	switch hoursRemaining {
	case timeGateWarning24h:
		notifType = NotifTimeGateWarning24h
	case timeGateWarning6h:
		notifType = NotifTimeGateWarning6h
	case timeGateWarning1h:
		notifType = NotifTimeGateWarning1h
	default:
		return nil
	}

	pcUsers, err := s.queries.GetPCUsersInCampaign(ctx, campaignID)
	if err != nil {
		return err
	}

	for _, pc := range pcUsers {
		if _, createErr := s.CreateNotification(ctx, CreateNotificationParams{
			UserID:      pc.UserID,
			CampaignID:  campaignID,
			SceneID:     emptyUUID(),
			PostID:      emptyUUID(),
			CharacterID: pc.CharacterID,
			Type:        notifType,
			Title:       fmt.Sprintf("%d Hour Warning", hoursRemaining),
			Body: fmt.Sprintf(
				"PC Phase ends in %d hours in %s. Post or pass now!",
				hoursRemaining,
				campaignTitle,
			),
			Link:     fmt.Sprintf("/campaigns/%s", uuidToString(campaignID)),
			IsUrgent: hoursRemaining <= timeGateWarning1h,
			Metadata: nil,
		}); createErr != nil {
			//nolint:sloglint // Error logging doesn't need structured logger injection
			slog.Error("Failed to notify user", "error", createErr)
		}
	}

	// Also notify GM
	gmUserID, gmErr := s.queries.GetGMUserID(ctx, campaignID)
	if gmErr == nil {
		_, _ = s.CreateNotification(ctx, CreateNotificationParams{
			UserID:      gmUserID,
			CampaignID:  campaignID,
			SceneID:     emptyUUID(),
			PostID:      emptyUUID(),
			CharacterID: emptyUUID(),
			Type:        notifType,
			Title:       fmt.Sprintf("Time Gate: %d Hour Warning", hoursRemaining),
			Body:        fmt.Sprintf("PC Phase ends in %d hours in %s", hoursRemaining, campaignTitle),
			Link:        fmt.Sprintf("/campaigns/%s", uuidToString(campaignID)),
			IsUrgent:    hoursRemaining <= timeGateWarning1h,
			Metadata:    nil,
		})
	}

	return nil
}

// NotifyRollRequested notifies a player that the GM has requested a roll.
func (s *NotificationService) NotifyRollRequested(
	ctx context.Context,
	campaignID pgtype.UUID,
	sceneID pgtype.UUID,
	postID pgtype.UUID,
	characterID pgtype.UUID,
	intention string,
) error {
	ownerUserID, err := s.queries.GetCharacterOwner(ctx, characterID)
	if err != nil {
		return err
	}

	_, err = s.CreateNotification(ctx, CreateNotificationParams{
		UserID:      ownerUserID,
		CampaignID:  campaignID,
		SceneID:     sceneID,
		PostID:      postID,
		CharacterID: characterID,
		Type:        NotifRollRequested,
		Title:       "Roll Requested",
		Body:        fmt.Sprintf("The GM has requested a %s roll", intention),
		Link:        fmt.Sprintf("/campaigns/%s/scenes/%s", uuidToString(campaignID), uuidToString(sceneID)),
		IsUrgent:    false,
		Metadata:    nil,
	})
	return err
}

// NotifyComposeLockReleased notifies waiting users that a compose lock was released.
func (s *NotificationService) NotifyComposeLockReleased(
	ctx context.Context,
	sceneID pgtype.UUID,
	excludeUserID pgtype.UUID,
) error {
	// Get all users in the scene
	sceneUsers, err := s.queries.GetUsersInScene(ctx, sceneID)
	if err != nil {
		return err
	}

	scene, err := s.queries.GetScene(ctx, sceneID)
	if err != nil {
		return err
	}

	for _, u := range sceneUsers {
		if u.UserID == excludeUserID {
			continue
		}

		if _, createErr := s.CreateNotification(ctx, CreateNotificationParams{
			UserID:      u.UserID,
			CampaignID:  scene.CampaignID,
			SceneID:     sceneID,
			PostID:      emptyUUID(),
			CharacterID: emptyUUID(),
			Type:        NotifComposeLockReleased,
			Title:       "Compose Available",
			Body:        fmt.Sprintf("The compose lock in %s has been released", scene.Title),
			Link:        fmt.Sprintf("/campaigns/%s/scenes/%s", uuidToString(scene.CampaignID), uuidToString(sceneID)),
			IsUrgent:    false,
			Metadata:    nil,
		}); createErr != nil {
			//nolint:sloglint // Error logging doesn't need structured logger injection
			slog.Error("Failed to notify user", "error", createErr)
		}
	}

	return nil
}

// GetNotifications retrieves notifications for a user.
func (s *NotificationService) GetNotifications(
	ctx context.Context,
	userID pgtype.UUID,
	limit, offset int32,
) ([]generated.Notification, error) {
	return s.queries.GetNotificationsByUser(ctx, generated.GetNotificationsByUserParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
}

// GetUnreadCount returns the count of unread notifications for a user.
func (s *NotificationService) GetUnreadCount(ctx context.Context, userID pgtype.UUID) (int64, error) {
	return s.queries.GetUnreadNotificationCount(ctx, userID)
}

// MarkAsRead marks a notification as read.
func (s *NotificationService) MarkAsRead(
	ctx context.Context,
	notificationID pgtype.UUID,
	userID pgtype.UUID,
) (generated.Notification, error) {
	return s.queries.MarkNotificationAsRead(ctx, generated.MarkNotificationAsReadParams{
		ID:     notificationID,
		UserID: userID,
	})
}

// MarkAllAsRead marks all notifications for a user as read.
func (s *NotificationService) MarkAllAsRead(ctx context.Context, userID pgtype.UUID) (int64, error) {
	return s.queries.MarkAllNotificationsAsRead(ctx, userID)
}

// Helper to convert UUID to string.
func uuidToString(id pgtype.UUID) string {
	if !id.Valid {
		return ""
	}
	return fmt.Sprintf("%x-%x-%x-%x-%x",
		id.Bytes[0:4],
		id.Bytes[4:6],
		id.Bytes[6:8],
		id.Bytes[8:10],
		id.Bytes[10:16],
	)
}
