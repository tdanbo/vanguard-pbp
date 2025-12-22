package handlers

import (
	"encoding/base64"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
)

// CampaignResponse is the API response format for a campaign with membership info.
type CampaignResponse struct {
	ID                    string     `json:"id"`
	Title                 string     `json:"title"`
	Description           *string    `json:"description"`
	OwnerID               *string    `json:"owner_id"`
	Settings              any        `json:"settings"`
	CurrentPhase          string     `json:"current_phase"`
	CurrentPhaseStartedAt *time.Time `json:"current_phase_started_at"`
	CurrentPhaseExpiresAt *time.Time `json:"current_phase_expires_at"`
	IsPaused              bool       `json:"is_paused"`
	LastGmActivityAt      *time.Time `json:"last_gm_activity_at"`
	StorageUsedBytes      int64      `json:"storage_used_bytes"`
	SceneCount            int32      `json:"scene_count"`
	CreatedAt             *time.Time `json:"created_at"`
	UpdatedAt             *time.Time `json:"updated_at"`
	UserRole              *string    `json:"user_role"`
}

// CampaignListResponse is the API response format for campaign list items.
type CampaignListResponse struct {
	ID                    string     `json:"id"`
	Title                 string     `json:"title"`
	Description           *string    `json:"description"`
	OwnerID               *string    `json:"owner_id"`
	Settings              any        `json:"settings"`
	CurrentPhase          string     `json:"current_phase"`
	CurrentPhaseStartedAt *time.Time `json:"current_phase_started_at"`
	CurrentPhaseExpiresAt *time.Time `json:"current_phase_expires_at"`
	IsPaused              bool       `json:"is_paused"`
	LastGmActivityAt      *time.Time `json:"last_gm_activity_at"`
	StorageUsedBytes      int64      `json:"storage_used_bytes"`
	SceneCount            int32      `json:"scene_count"`
	CreatedAt             *time.Time `json:"created_at"`
	UpdatedAt             *time.Time `json:"updated_at"`
	UserRole              string     `json:"user_role"`
}

// ToCampaignResponse converts a GetCampaignWithMembershipRow to CampaignResponse.
func ToCampaignResponse(row *generated.GetCampaignWithMembershipRow) CampaignResponse {
	//nolint:exhaustruct // Optional fields are set conditionally below
	resp := CampaignResponse{
		ID:               uuidToString(row.ID),
		Title:            row.Title,
		Description:      textToStringPtr(row.Description),
		OwnerID:          uuidToStringPtr(row.OwnerID),
		Settings:         decodeSettings(row.Settings),
		CurrentPhase:     string(row.CurrentPhase),
		IsPaused:         row.IsPaused,
		StorageUsedBytes: row.StorageUsedBytes,
		SceneCount:       row.SceneCount,
	}

	if row.CurrentPhaseStartedAt.Valid {
		t := row.CurrentPhaseStartedAt.Time
		resp.CurrentPhaseStartedAt = &t
	}
	if row.CurrentPhaseExpiresAt.Valid {
		t := row.CurrentPhaseExpiresAt.Time
		resp.CurrentPhaseExpiresAt = &t
	}
	if row.LastGmActivityAt.Valid {
		t := row.LastGmActivityAt.Time
		resp.LastGmActivityAt = &t
	}
	if row.CreatedAt.Valid {
		t := row.CreatedAt.Time
		resp.CreatedAt = &t
	}
	if row.UpdatedAt.Valid {
		t := row.UpdatedAt.Time
		resp.UpdatedAt = &t
	}

	// Convert user_role from NullMemberRole to simple string pointer
	if row.UserRole.Valid {
		role := string(row.UserRole.MemberRole)
		resp.UserRole = &role
	}

	return resp
}

// ToCampaignListResponses converts a slice of ListUserCampaignsRow to CampaignListResponse.
func ToCampaignListResponses(rows []generated.ListUserCampaignsRow) []CampaignListResponse {
	responses := make([]CampaignListResponse, len(rows))
	for i, row := range rows {
		//nolint:exhaustruct // Optional fields are set conditionally below
		responses[i] = CampaignListResponse{
			ID:               uuidToString(row.ID),
			Title:            row.Title,
			Description:      textToStringPtr(row.Description),
			OwnerID:          uuidToStringPtr(row.OwnerID),
			Settings:         decodeSettings(row.Settings),
			CurrentPhase:     string(row.CurrentPhase),
			IsPaused:         row.IsPaused,
			StorageUsedBytes: row.StorageUsedBytes,
			SceneCount:       row.SceneCount,
			UserRole:         string(row.UserRole),
		}

		if row.CurrentPhaseStartedAt.Valid {
			t := row.CurrentPhaseStartedAt.Time
			responses[i].CurrentPhaseStartedAt = &t
		}
		if row.CurrentPhaseExpiresAt.Valid {
			t := row.CurrentPhaseExpiresAt.Time
			responses[i].CurrentPhaseExpiresAt = &t
		}
		if row.LastGmActivityAt.Valid {
			t := row.LastGmActivityAt.Time
			responses[i].LastGmActivityAt = &t
		}
		if row.CreatedAt.Valid {
			t := row.CreatedAt.Time
			responses[i].CreatedAt = &t
		}
		if row.UpdatedAt.Valid {
			t := row.UpdatedAt.Time
			responses[i].UpdatedAt = &t
		}
	}
	return responses
}

// Helper functions

func uuidToString(u pgtype.UUID) string {
	if !u.Valid {
		return ""
	}
	return formatUUID(u.Bytes)
}

func uuidToStringPtr(u pgtype.UUID) *string {
	if !u.Valid {
		return nil
	}
	s := formatUUID(u.Bytes)
	return &s
}

func formatUUID(b [16]byte) string {
	return formatUUIDBytes(b[:])
}

//nolint:mnd // UUID byte/string lengths are standard constants
func formatUUIDBytes(b []byte) string {
	if len(b) != 16 {
		return ""
	}
	result := make([]byte, 36)
	hex := "0123456789abcdef"
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

func textToStringPtr(t pgtype.Text) *string {
	if !t.Valid {
		return nil
	}
	return &t.String
}

func decodeSettings(settings []byte) any {
	if len(settings) == 0 {
		return nil
	}

	// Check if it looks like base64 encoded JSON
	decoded, decodeErr := base64.StdEncoding.DecodeString(string(settings))
	if decodeErr == nil && len(decoded) > 0 && decoded[0] == '{' {
		// It was base64 encoded, return the decoded JSON
		var result map[string]any
		if unmarshalErr := json.Unmarshal(decoded, &result); unmarshalErr == nil {
			return result
		}
	}

	// Try to parse as direct JSON
	var result map[string]any
	if unmarshalErr := json.Unmarshal(settings, &result); unmarshalErr == nil {
		return result
	}

	// Return as string if all else fails
	return string(settings)
}
