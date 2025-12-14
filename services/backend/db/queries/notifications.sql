-- ============================================
-- NOTIFICATION QUERIES
-- ============================================

-- name: CreateNotification :one
INSERT INTO notifications (
    user_id,
    title,
    body,
    type,
    campaign_id,
    scene_id,
    post_id,
    character_id,
    is_urgent,
    link,
    metadata,
    expires_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
    COALESCE($12, NOW() + INTERVAL '90 days')
)
RETURNING *;

-- name: GetNotification :one
SELECT * FROM notifications
WHERE id = $1;

-- name: GetNotificationsByUser :many
SELECT * FROM notifications
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetUnreadNotificationsByUser :many
SELECT * FROM notifications
WHERE user_id = $1
  AND is_read = false
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetUnreadNotificationCount :one
SELECT COUNT(*) FROM notifications
WHERE user_id = $1
  AND is_read = false;

-- name: GetUnreadNotificationCountByCampaign :one
SELECT COUNT(*) FROM notifications
WHERE user_id = $1
  AND campaign_id = $2
  AND is_read = false;

-- name: MarkNotificationAsRead :one
UPDATE notifications
SET is_read = true, read_at = NOW()
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: MarkAllNotificationsAsRead :execrows
UPDATE notifications
SET is_read = true, read_at = NOW()
WHERE user_id = $1 AND is_read = false;

-- name: DeleteNotification :exec
DELETE FROM notifications
WHERE id = $1 AND user_id = $2;

-- name: DeleteExpiredNotifications :execrows
DELETE FROM notifications
WHERE expires_at < NOW();

-- name: FindSimilarNotification :one
SELECT * FROM notifications
WHERE user_id = $1
  AND campaign_id = $2
  AND type = $3
  AND created_at > $4
LIMIT 1;

-- name: GetNotificationsSince :many
SELECT * FROM notifications
WHERE user_id = $1
  AND is_read = false
  AND created_at > $2
ORDER BY created_at DESC;

-- ============================================
-- NOTIFICATION PREFERENCES QUERIES
-- ============================================

-- name: GetNotificationPreferences :one
SELECT * FROM notification_preferences
WHERE user_id = $1;

-- name: UpsertNotificationPreferences :one
INSERT INTO notification_preferences (
    user_id,
    email_enabled,
    email_frequency,
    in_app_enabled
) VALUES (
    $1, $2, $3, $4
)
ON CONFLICT (user_id) DO UPDATE SET
    email_enabled = EXCLUDED.email_enabled,
    email_frequency = EXCLUDED.email_frequency,
    in_app_enabled = EXCLUDED.in_app_enabled,
    updated_at = NOW()
RETURNING *;

-- ============================================
-- QUIET HOURS QUERIES
-- ============================================

-- name: GetQuietHours :one
SELECT * FROM quiet_hours
WHERE user_id = $1;

-- name: UpsertQuietHours :one
INSERT INTO quiet_hours (
    user_id,
    enabled,
    start_time,
    end_time,
    timezone,
    urgent_bypass
) VALUES (
    $1, $2, $3, $4, $5, $6
)
ON CONFLICT (user_id) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    timezone = EXCLUDED.timezone,
    urgent_bypass = EXCLUDED.urgent_bypass,
    updated_at = NOW()
RETURNING *;

-- ============================================
-- NOTIFICATION QUEUE QUERIES
-- ============================================

-- name: QueueNotification :one
INSERT INTO notification_queue (
    user_id,
    notification_id,
    deliver_after
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: GetQueuedNotificationsReadyForDelivery :many
SELECT nq.*, n.* FROM notification_queue nq
JOIN notifications n ON n.id = nq.notification_id
WHERE nq.deliver_after <= NOW()
  AND nq.delivered_at IS NULL
ORDER BY nq.deliver_after ASC
LIMIT 100;

-- name: MarkQueuedNotificationDelivered :exec
UPDATE notification_queue
SET delivered_at = NOW()
WHERE id = $1;

-- name: DeleteQueuedNotification :exec
DELETE FROM notification_queue
WHERE id = $1;

-- name: GetUserQueuedNotifications :many
SELECT * FROM notification_queue
WHERE user_id = $1
  AND delivered_at IS NULL
ORDER BY queued_at ASC;

-- name: GetUserQueuedCount :one
SELECT COUNT(*) FROM notification_queue
WHERE user_id = $1
  AND delivered_at IS NULL;

-- name: UpdateQueuedNotificationDeliveryTime :exec
UPDATE notification_queue
SET deliver_after = $2
WHERE id = $1;

-- name: DeliverAllQueuedNotifications :execrows
UPDATE notification_queue
SET delivered_at = NOW()
WHERE user_id = $1
  AND delivered_at IS NULL;

-- ============================================
-- EMAIL DIGEST QUERIES
-- ============================================

-- name: RecordEmailDigest :one
INSERT INTO email_digests (
    user_id,
    digest_type,
    notification_count,
    campaign_ids
) VALUES (
    $1, $2, $3, $4
)
RETURNING *;

-- name: GetLastDigestSent :one
SELECT * FROM email_digests
WHERE user_id = $1
  AND digest_type = $2
ORDER BY sent_at DESC
LIMIT 1;

-- name: GetUsersWithDigestPreference :many
SELECT * FROM notification_preferences
WHERE email_frequency = $1
  AND email_enabled = true;

-- ============================================
-- CAMPAIGN MEMBER NOTIFICATION HELPERS
-- ============================================

-- name: GetPCUsersInCampaign :many
SELECT DISTINCT ca.user_id, c.id as character_id, c.display_name
FROM characters c
JOIN character_assignments ca ON ca.character_id = c.id
WHERE c.campaign_id = $1
  AND c.character_type = 'pc'
  AND c.is_archived = false;

-- name: GetGMUserID :one
SELECT cm.user_id FROM campaign_members cm
WHERE cm.campaign_id = $1
  AND cm.role = 'gm'
LIMIT 1;

-- name: GetCharacterOwner :one
SELECT ca.user_id FROM character_assignments ca
WHERE ca.character_id = $1;

-- name: GetWitnessUsers :many
SELECT DISTINCT ca.user_id FROM character_assignments ca
WHERE ca.character_id = ANY($1::uuid[]);

-- name: GetUsersInScene :many
SELECT DISTINCT ca.user_id, ca.character_id
FROM character_assignments ca
JOIN scenes s ON ca.character_id = ANY(s.character_ids)
WHERE s.id = $1;

-- name: MarkNotificationEmailSent :exec
UPDATE notifications
SET email_sent_at = NOW()
WHERE id = $1;
