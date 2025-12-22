package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

// HTTP client timeout for broadcast requests.
const httpClientTimeout = 10 * time.Second

// HTTP status threshold for error responses.
const httpErrorThreshold = 400

// BroadcastService handles real-time event broadcasting via Supabase Realtime.
type BroadcastService struct {
	supabaseURL string
	supabaseKey string
	httpClient  *http.Client
}

// NewBroadcastService creates a new broadcast service.
func NewBroadcastService(supabaseURL, supabaseKey string) *BroadcastService {
	return &BroadcastService{
		supabaseURL: supabaseURL,
		supabaseKey: supabaseKey,
		httpClient: &http.Client{
			Timeout: httpClientTimeout,
		},
	}
}

// Event types for real-time broadcast.
const (
	EventPhaseTransition     = "phase_transition"
	EventPostCreated         = "post_created"
	EventPostUpdated         = "post_updated"
	EventPostDeleted         = "post_deleted"
	EventComposeLockAcquired = "compose_lock_acquired"
	EventComposeLockReleased = "compose_lock_released"
	EventPassStateChanged    = "pass_state_changed"
	EventCharacterJoined     = "character_joined"
	EventCharacterLeft       = "character_left"
	EventRollCreated         = "roll_created"
	EventRollResolved        = "roll_resolved"
	EventTimeGateWarning     = "timegate_warning"
)

// PhaseTransitionEvent represents a phase transition broadcast.
type PhaseTransitionEvent struct {
	Type             string `json:"type"`
	CampaignID       string `json:"campaign_id"`
	FromPhase        string `json:"from_phase"`
	ToPhase          string `json:"to_phase"`
	TransitionReason string `json:"transition_reason"`
	Timestamp        string `json:"timestamp"`
}

// PostEvent represents a post CRUD broadcast.
type PostEvent struct {
	Type        string   `json:"type"`
	PostID      string   `json:"post_id"`
	SceneID     string   `json:"scene_id"`
	CampaignID  string   `json:"campaign_id"`
	CharacterID string   `json:"character_id,omitempty"`
	IsHidden    bool     `json:"is_hidden"`
	WitnessList []string `json:"witness_list"`
	Timestamp   string   `json:"timestamp"`
}

// ComposeLockEvent represents a compose lock broadcast (identity protected).
type ComposeLockEvent struct {
	Type       string `json:"type"`
	SceneID    string `json:"scene_id"`
	CampaignID string `json:"campaign_id"`
	IsLocked   bool   `json:"is_locked"`
	Timestamp  string `json:"timestamp"`
	// DO NOT include character_id or user_id (identity protection)
}

// PassStateEvent represents a pass state change broadcast.
type PassStateEvent struct {
	Type        string `json:"type"`
	CampaignID  string `json:"campaign_id"`
	SceneID     string `json:"scene_id"`
	CharacterID string `json:"character_id"`
	HasPassed   bool   `json:"has_passed"`
	Timestamp   string `json:"timestamp"`
}

// CharacterPresenceEvent represents a character joining/leaving a scene.
type CharacterPresenceEvent struct {
	Type        string `json:"type"`
	SceneID     string `json:"scene_id"`
	CampaignID  string `json:"campaign_id"`
	CharacterID string `json:"character_id"`
	Timestamp   string `json:"timestamp"`
}

// RollEvent represents a roll broadcast.
type RollEvent struct {
	Type        string `json:"type"`
	RollID      string `json:"roll_id"`
	PostID      string `json:"post_id,omitempty"`
	SceneID     string `json:"scene_id"`
	CampaignID  string `json:"campaign_id"`
	CharacterID string `json:"character_id"`
	Intention   string `json:"intention"`
	Status      string `json:"status"`
	Timestamp   string `json:"timestamp"`
}

// broadcastMessage sends a message to a Supabase Realtime channel.
func (s *BroadcastService) broadcastMessage(ctx context.Context, channel, event string, payload any) error {
	// Construct the broadcast request
	body := map[string]any{
		"type":    "broadcast",
		"event":   event,
		"payload": payload,
	}

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal broadcast payload: %w", err)
	}

	// Supabase Realtime broadcast endpoint
	url := fmt.Sprintf("%s/realtime/v1/api/broadcast", s.supabaseURL)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Apikey", s.supabaseKey)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.supabaseKey))

	// Add channel to the request
	q := req.URL.Query()
	q.Add("channel", channel)
	req.URL.RawQuery = q.Encode()

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to broadcast: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= httpErrorThreshold {
		return fmt.Errorf("broadcast failed with status: %d", resp.StatusCode)
	}

	return nil
}

// BroadcastPhaseTransition broadcasts a phase transition event.
func (s *BroadcastService) BroadcastPhaseTransition(
	ctx context.Context,
	campaignID pgtype.UUID,
	fromPhase, toPhase, reason string,
) {
	event := PhaseTransitionEvent{
		Type:             EventPhaseTransition,
		CampaignID:       uuidToString(campaignID),
		FromPhase:        fromPhase,
		ToPhase:          toPhase,
		TransitionReason: reason,
		Timestamp:        time.Now().UTC().Format(time.RFC3339),
	}

	channel := fmt.Sprintf("campaign:%s", uuidToString(campaignID))
	if err := s.broadcastMessage(ctx, channel, EventPhaseTransition, event); err != nil {
		//nolint:sloglint // Error logging in broadcast doesn't need structured logger injection
		slog.ErrorContext(ctx, "Failed to broadcast phase transition", "error", err)
	}
}

// BroadcastPostCreated broadcasts a post creation event.
func (s *BroadcastService) BroadcastPostCreated(
	ctx context.Context,
	postID, sceneID, campaignID, characterID pgtype.UUID,
	isHidden bool,
	witnesses []pgtype.UUID,
) {
	witnessList := make([]string, len(witnesses))
	for i, w := range witnesses {
		witnessList[i] = uuidToString(w)
	}

	event := PostEvent{
		Type:        EventPostCreated,
		PostID:      uuidToString(postID),
		SceneID:     uuidToString(sceneID),
		CampaignID:  uuidToString(campaignID),
		CharacterID: uuidToString(characterID),
		IsHidden:    isHidden,
		WitnessList: witnessList,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}

	channel := fmt.Sprintf("scene:%s", uuidToString(sceneID))
	if err := s.broadcastMessage(ctx, channel, EventPostCreated, event); err != nil {
		//nolint:sloglint // Error logging in broadcast doesn't need structured logger injection
		slog.ErrorContext(ctx, "Failed to broadcast post created", "error", err)
	}
}

// BroadcastPostUpdated broadcasts a post update event.
func (s *BroadcastService) BroadcastPostUpdated(
	ctx context.Context,
	postID, sceneID, campaignID pgtype.UUID,
) {
	event := map[string]any{
		"type":        EventPostUpdated,
		"post_id":     uuidToString(postID),
		"scene_id":    uuidToString(sceneID),
		"campaign_id": uuidToString(campaignID),
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
	}

	channel := fmt.Sprintf("scene:%s", uuidToString(sceneID))
	if err := s.broadcastMessage(ctx, channel, EventPostUpdated, event); err != nil {
		//nolint:sloglint // Error logging in broadcast doesn't need structured logger injection
		slog.ErrorContext(ctx, "Failed to broadcast post updated", "error", err)
	}
}

// BroadcastPostDeleted broadcasts a post deletion event.
func (s *BroadcastService) BroadcastPostDeleted(
	ctx context.Context,
	postID, sceneID, campaignID pgtype.UUID,
) {
	event := map[string]any{
		"type":        EventPostDeleted,
		"post_id":     uuidToString(postID),
		"scene_id":    uuidToString(sceneID),
		"campaign_id": uuidToString(campaignID),
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
	}

	channel := fmt.Sprintf("scene:%s", uuidToString(sceneID))
	if err := s.broadcastMessage(ctx, channel, EventPostDeleted, event); err != nil {
		//nolint:sloglint // Error logging in broadcast doesn't need structured logger injection
		slog.ErrorContext(ctx, "Failed to broadcast post deleted", "error", err)
	}
}

// BroadcastComposeLockAcquired broadcasts a compose lock acquisition (identity protected).
func (s *BroadcastService) BroadcastComposeLockAcquired(
	ctx context.Context,
	sceneID, campaignID pgtype.UUID,
) {
	event := ComposeLockEvent{
		Type:       EventComposeLockAcquired,
		SceneID:    uuidToString(sceneID),
		CampaignID: uuidToString(campaignID),
		IsLocked:   true,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
	}

	channel := fmt.Sprintf("scene:%s", uuidToString(sceneID))
	if err := s.broadcastMessage(ctx, channel, EventComposeLockAcquired, event); err != nil {
		//nolint:sloglint // Error logging in broadcast doesn't need structured logger injection
		slog.ErrorContext(ctx, "Failed to broadcast compose lock acquired", "error", err)
	}
}

// BroadcastComposeLockReleased broadcasts a compose lock release (identity protected).
func (s *BroadcastService) BroadcastComposeLockReleased(
	ctx context.Context,
	sceneID, campaignID pgtype.UUID,
) {
	event := ComposeLockEvent{
		Type:       EventComposeLockReleased,
		SceneID:    uuidToString(sceneID),
		CampaignID: uuidToString(campaignID),
		IsLocked:   false,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
	}

	channel := fmt.Sprintf("scene:%s", uuidToString(sceneID))
	if err := s.broadcastMessage(ctx, channel, EventComposeLockReleased, event); err != nil {
		//nolint:sloglint // Error logging in broadcast doesn't need structured logger injection
		slog.ErrorContext(ctx, "Failed to broadcast compose lock released", "error", err)
	}
}

// BroadcastPassStateChanged broadcasts a pass state change.
func (s *BroadcastService) BroadcastPassStateChanged(
	ctx context.Context,
	campaignID, sceneID, characterID pgtype.UUID,
	hasPassed bool,
) {
	event := PassStateEvent{
		Type:        EventPassStateChanged,
		CampaignID:  uuidToString(campaignID),
		SceneID:     uuidToString(sceneID),
		CharacterID: uuidToString(characterID),
		HasPassed:   hasPassed,
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}

	// Broadcast to both scene and campaign channels
	sceneChannel := fmt.Sprintf("scene:%s", uuidToString(sceneID))
	if err := s.broadcastMessage(ctx, sceneChannel, EventPassStateChanged, event); err != nil {
		//nolint:sloglint // Error logging in broadcast doesn't need structured logger injection
		slog.ErrorContext(ctx, "Failed to broadcast pass state to scene", "error", err)
	}

	campaignChannel := fmt.Sprintf("campaign:%s", uuidToString(campaignID))
	if err := s.broadcastMessage(ctx, campaignChannel, EventPassStateChanged, event); err != nil {
		//nolint:sloglint // Error logging in broadcast doesn't need structured logger injection
		slog.ErrorContext(ctx, "Failed to broadcast pass state to campaign", "error", err)
	}
}

// BroadcastCharacterJoinedScene broadcasts a character joining a scene.
func (s *BroadcastService) BroadcastCharacterJoinedScene(
	ctx context.Context,
	sceneID, campaignID, characterID pgtype.UUID,
) {
	event := CharacterPresenceEvent{
		Type:        EventCharacterJoined,
		SceneID:     uuidToString(sceneID),
		CampaignID:  uuidToString(campaignID),
		CharacterID: uuidToString(characterID),
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}

	channel := fmt.Sprintf("scene:%s", uuidToString(sceneID))
	if err := s.broadcastMessage(ctx, channel, EventCharacterJoined, event); err != nil {
		//nolint:sloglint // Error logging in broadcast doesn't need structured logger injection
		slog.ErrorContext(ctx, "Failed to broadcast character joined", "error", err)
	}
}

// BroadcastCharacterLeftScene broadcasts a character leaving a scene.
func (s *BroadcastService) BroadcastCharacterLeftScene(
	ctx context.Context,
	sceneID, campaignID, characterID pgtype.UUID,
) {
	event := CharacterPresenceEvent{
		Type:        EventCharacterLeft,
		SceneID:     uuidToString(sceneID),
		CampaignID:  uuidToString(campaignID),
		CharacterID: uuidToString(characterID),
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}

	channel := fmt.Sprintf("scene:%s", uuidToString(sceneID))
	if err := s.broadcastMessage(ctx, channel, EventCharacterLeft, event); err != nil {
		//nolint:sloglint // Error logging in broadcast doesn't need structured logger injection
		slog.ErrorContext(ctx, "Failed to broadcast character left", "error", err)
	}
}

// BroadcastRollCreated broadcasts a roll creation event.
func (s *BroadcastService) BroadcastRollCreated(
	ctx context.Context,
	rollID, postID, sceneID, campaignID, characterID pgtype.UUID,
	intention string,
) {
	event := RollEvent{
		Type:        EventRollCreated,
		RollID:      uuidToString(rollID),
		PostID:      uuidToString(postID),
		SceneID:     uuidToString(sceneID),
		CampaignID:  uuidToString(campaignID),
		CharacterID: uuidToString(characterID),
		Intention:   intention,
		Status:      "pending",
		Timestamp:   time.Now().UTC().Format(time.RFC3339),
	}

	channel := fmt.Sprintf("scene:%s", uuidToString(sceneID))
	if err := s.broadcastMessage(ctx, channel, EventRollCreated, event); err != nil {
		//nolint:sloglint // Error logging in broadcast doesn't need structured logger injection
		slog.ErrorContext(ctx, "Failed to broadcast roll created", "error", err)
	}
}

// BroadcastRollResolved broadcasts a roll resolution event.
func (s *BroadcastService) BroadcastRollResolved(
	ctx context.Context,
	rollID, sceneID, campaignID pgtype.UUID,
	status string,
) {
	event := map[string]any{
		"type":        EventRollResolved,
		"roll_id":     uuidToString(rollID),
		"scene_id":    uuidToString(sceneID),
		"campaign_id": uuidToString(campaignID),
		"status":      status,
		"timestamp":   time.Now().UTC().Format(time.RFC3339),
	}

	channel := fmt.Sprintf("scene:%s", uuidToString(sceneID))
	if err := s.broadcastMessage(ctx, channel, EventRollResolved, event); err != nil {
		//nolint:sloglint // Error logging in broadcast doesn't need structured logger injection
		slog.ErrorContext(ctx, "Failed to broadcast roll resolved", "error", err)
	}
}

// BroadcastTimeGateWarning broadcasts a time gate warning.
func (s *BroadcastService) BroadcastTimeGateWarning(
	ctx context.Context,
	campaignID pgtype.UUID,
	remainingMinutes int,
) {
	event := map[string]any{
		"type":              EventTimeGateWarning,
		"campaign_id":       uuidToString(campaignID),
		"remaining_minutes": remainingMinutes,
		"timestamp":         time.Now().UTC().Format(time.RFC3339),
	}

	channel := fmt.Sprintf("campaign:%s", uuidToString(campaignID))
	if err := s.broadcastMessage(ctx, channel, EventTimeGateWarning, event); err != nil {
		//nolint:sloglint // Error logging in broadcast doesn't need structured logger injection
		slog.ErrorContext(ctx, "Failed to broadcast time gate warning", "error", err)
	}
}
