package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/database/generated"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/middleware"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/models"
	"github.com/tdanbo/vanguard-pbp/services/backend/internal/service"
)

// Notification query constants.
const (
	defaultNotificationLimit = 50
	maxNotificationLimit     = 100
	secondsPerMinute         = 60
	secondsPerHour           = 3600
	microsecondsPerSecond    = 1000000
	minTimeStringLength      = 5
)

// NotificationHandler handles notification-related requests.
type NotificationHandler struct {
	notificationService *service.NotificationService
	queries             *generated.Queries
}

// NewNotificationHandler creates a new notification handler.
func NewNotificationHandler(db *database.DB) *NotificationHandler {
	queries := generated.New(db.Pool)
	return &NotificationHandler{
		notificationService: service.NewNotificationService(db, queries),
		queries:             queries,
	}
}

// GetNotifications returns a paginated list of notifications for the current user.
func (h *NotificationHandler) GetNotifications() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}
		userID := parseUUID(userIDStr)

		limit := int32(defaultNotificationLimit)
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= maxNotificationLimit {
				limit = safeInt32(parsed)
			}
		}

		offset := int32(0)
		if o := c.Query("offset"); o != "" {
			if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
				offset = safeInt32(parsed)
			}
		}

		notifications, err := h.notificationService.GetNotifications(c.Request.Context(), userID, limit, offset)
		if err != nil {
			models.InternalError(c)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"notifications": notifications,
			"limit":         limit,
			"offset":        offset,
		})
	}
}

// GetUnreadNotifications returns only unread notifications for the current user.
func (h *NotificationHandler) GetUnreadNotifications() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}
		userID := parseUUID(userIDStr)

		limit := int32(defaultNotificationLimit)
		if l := c.Query("limit"); l != "" {
			if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= maxNotificationLimit {
				limit = safeInt32(parsed)
			}
		}

		offset := int32(0)
		if o := c.Query("offset"); o != "" {
			if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
				offset = safeInt32(parsed)
			}
		}

		notifications, err := h.queries.GetUnreadNotificationsByUser(
			c.Request.Context(),
			generated.GetUnreadNotificationsByUserParams{
				UserID: userID,
				Limit:  limit,
				Offset: offset,
			},
		)
		if err != nil {
			models.InternalError(c)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"notifications": notifications,
			"limit":         limit,
			"offset":        offset,
		})
	}
}

// GetUnreadCount returns the count of unread notifications.
func (h *NotificationHandler) GetUnreadCount() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}
		userID := parseUUID(userIDStr)

		count, err := h.notificationService.GetUnreadCount(c.Request.Context(), userID)
		if err != nil {
			models.InternalError(c)
			return
		}

		c.JSON(http.StatusOK, gin.H{"count": count})
	}
}

// GetUnreadCountByCampaign returns the count of unread notifications for a specific campaign.
func (h *NotificationHandler) GetUnreadCountByCampaign() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}
		userID := parseUUID(userIDStr)

		campaignID := parseUUID(c.Param("id"))
		if !campaignID.Valid {
			models.ValidationError(c, "Invalid campaign ID")
			return
		}

		count, err := h.queries.GetUnreadNotificationCountByCampaign(
			c.Request.Context(),
			generated.GetUnreadNotificationCountByCampaignParams{
				UserID:     userID,
				CampaignID: campaignID,
			},
		)
		if err != nil {
			models.InternalError(c)
			return
		}

		c.JSON(http.StatusOK, gin.H{"count": count})
	}
}

// MarkAsRead marks a notification as read.
func (h *NotificationHandler) MarkAsRead() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}
		userID := parseUUID(userIDStr)

		notificationID := parseUUID(c.Param("notificationId"))
		if !notificationID.Valid {
			models.ValidationError(c, "Invalid notification ID")
			return
		}

		notification, err := h.notificationService.MarkAsRead(c.Request.Context(), notificationID, userID)
		if err != nil {
			models.InternalError(c)
			return
		}

		c.JSON(http.StatusOK, &notification)
	}
}

// MarkAllAsRead marks all notifications for the current user as read.
func (h *NotificationHandler) MarkAllAsRead() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}
		userID := parseUUID(userIDStr)

		count, err := h.notificationService.MarkAllAsRead(c.Request.Context(), userID)
		if err != nil {
			models.InternalError(c)
			return
		}

		c.JSON(http.StatusOK, gin.H{"marked_count": count})
	}
}

// DeleteNotification deletes a notification.
func (h *NotificationHandler) DeleteNotification() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}
		userID := parseUUID(userIDStr)

		notificationID := parseUUID(c.Param("notificationId"))
		if !notificationID.Valid {
			models.ValidationError(c, "Invalid notification ID")
			return
		}

		err := h.queries.DeleteNotification(c.Request.Context(), generated.DeleteNotificationParams{
			ID:     notificationID,
			UserID: userID,
		})
		if err != nil {
			models.InternalError(c)
			return
		}

		c.JSON(http.StatusOK, gin.H{"success": true})
	}
}

// GetNotificationPreferences returns the user's notification preferences.
func (h *NotificationHandler) GetNotificationPreferences() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}
		userID := parseUUID(userIDStr)

		prefs, err := h.queries.GetNotificationPreferences(c.Request.Context(), userID)
		if err != nil {
			// Return defaults if no preferences set
			c.JSON(http.StatusOK, gin.H{
				"email_enabled":   true,
				"email_frequency": "realtime",
				"in_app_enabled":  true,
			})
			return
		}

		c.JSON(http.StatusOK, prefs)
	}
}

// UpdateNotificationPreferencesRequest represents the request body for updating preferences.
type UpdateNotificationPreferencesRequest struct {
	EmailEnabled   bool   `json:"email_enabled"`
	EmailFrequency string `json:"email_frequency"`
	InAppEnabled   bool   `json:"in_app_enabled"`
}

// UpdateNotificationPreferences updates the user's notification preferences.
func (h *NotificationHandler) UpdateNotificationPreferences() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}
		userID := parseUUID(userIDStr)

		var req UpdateNotificationPreferencesRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request body")
			return
		}

		// Validate email frequency
		var emailFreq generated.NotificationFrequency
		switch req.EmailFrequency {
		case "realtime":
			emailFreq = generated.NotificationFrequencyRealtime
		case "digest_daily":
			emailFreq = generated.NotificationFrequencyDigestDaily
		case "digest_weekly":
			emailFreq = generated.NotificationFrequencyDigestWeekly
		case "off":
			emailFreq = generated.NotificationFrequencyOff
		default:
			models.ValidationError(
				c,
				"Invalid email_frequency. Must be one of: realtime, digest_daily, digest_weekly, off",
			)
			return
		}

		prefs, err := h.queries.UpsertNotificationPreferences(
			c.Request.Context(),
			generated.UpsertNotificationPreferencesParams{
				UserID:         userID,
				EmailEnabled:   req.EmailEnabled,
				EmailFrequency: emailFreq,
				InAppEnabled:   req.InAppEnabled,
			},
		)
		if err != nil {
			models.InternalError(c)
			return
		}

		c.JSON(http.StatusOK, prefs)
	}
}

// GetQuietHours returns the user's quiet hours settings.
func (h *NotificationHandler) GetQuietHours() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}
		userID := parseUUID(userIDStr)

		quietHours, err := h.queries.GetQuietHours(c.Request.Context(), userID)
		if err != nil {
			// Return defaults if no quiet hours set
			c.JSON(http.StatusOK, gin.H{
				"enabled":       false,
				"start_time":    "22:00",
				"end_time":      "08:00",
				"timezone":      "UTC",
				"urgent_bypass": false,
			})
			return
		}

		c.JSON(http.StatusOK, quietHours)
	}
}

// UpdateQuietHoursRequest represents the request body for updating quiet hours.
type UpdateQuietHoursRequest struct {
	Enabled      bool   `json:"enabled"`
	StartTime    string `json:"start_time"`
	EndTime      string `json:"end_time"`
	Timezone     string `json:"timezone"`
	UrgentBypass bool   `json:"urgent_bypass"`
}

// UpdateQuietHours updates the user's quiet hours settings.
func (h *NotificationHandler) UpdateQuietHours() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}
		userID := parseUUID(userIDStr)

		var req UpdateQuietHoursRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			models.ValidationError(c, "Invalid request body")
			return
		}

		// Parse time strings to pgtype.Time
		startTime, err := parseTimeString(req.StartTime)
		if err != nil {
			models.ValidationError(c, "Invalid start_time format. Use HH:MM")
			return
		}

		endTime, err := parseTimeString(req.EndTime)
		if err != nil {
			models.ValidationError(c, "Invalid end_time format. Use HH:MM")
			return
		}

		// Validate timezone
		if req.Timezone == "" {
			req.Timezone = "UTC"
		}

		quietHours, err := h.queries.UpsertQuietHours(c.Request.Context(), generated.UpsertQuietHoursParams{
			UserID:       userID,
			Enabled:      req.Enabled,
			StartTime:    startTime,
			EndTime:      endTime,
			Timezone:     req.Timezone,
			UrgentBypass: req.UrgentBypass,
		})
		if err != nil {
			models.InternalError(c)
			return
		}

		c.JSON(http.StatusOK, quietHours)
	}
}

// GetQueuedNotifications returns the user's queued notifications.
func (h *NotificationHandler) GetQueuedNotifications() gin.HandlerFunc {
	return func(c *gin.Context) {
		userIDStr, ok := middleware.GetUserID(c)
		if !ok {
			models.UnauthorizedError(c)
			return
		}
		userID := parseUUID(userIDStr)

		queued, err := h.queries.GetUserQueuedNotifications(c.Request.Context(), userID)
		if err != nil {
			models.InternalError(c)
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"queued": queued,
			"count":  len(queued),
		})
	}
}

// Helper function to parse time string (HH:MM) to pgtype.Time.
func parseTimeString(s string) (pgtype.Time, error) {
	var t pgtype.Time
	if len(s) < minTimeStringLength {
		return t, errors.New("time string too short")
	}

	hours, err := strconv.Atoi(s[:2])
	if err != nil {
		return t, errors.New("invalid hours format")
	}
	minutes, err := strconv.Atoi(s[3:5])
	if err != nil {
		return t, errors.New("invalid minutes format")
	}

	// Convert to microseconds since midnight
	microseconds := int64(hours*secondsPerHour+minutes*secondsPerMinute) * microsecondsPerSecond
	t.Microseconds = microseconds
	t.Valid = true

	return t, nil
}

// safeInt32 safely converts an int to int32 with bounds checking.
func safeInt32(n int) int32 {
	if n > int(^int32(0)) {
		return ^int32(0) // max int32
	}
	if n < int(-^int32(0)-1) {
		return -^int32(0) - 1 // min int32
	}
	return int32(n)
}
