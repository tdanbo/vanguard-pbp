-- ============================================
-- DICE ROLLS QUERIES
-- ============================================

-- name: CreateRoll :one
INSERT INTO rolls (
    post_id,
    scene_id,
    character_id,
    requested_by,
    intention,
    modifier,
    dice_type,
    dice_count,
    status
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
RETURNING *;

-- name: GetRoll :one
SELECT * FROM rolls WHERE id = $1;

-- name: GetRollWithCharacter :one
SELECT
    r.*,
    c.display_name AS character_name
FROM rolls r
LEFT JOIN characters c ON r.character_id = c.id
WHERE r.id = $1;

-- name: ExecuteRoll :one
UPDATE rolls
SET
    result = $2,
    total = $3,
    rolled_at = NOW(),
    status = 'completed'
WHERE id = $1
RETURNING *;

-- name: GetRollsByPost :many
SELECT * FROM rolls
WHERE post_id = $1
ORDER BY created_at ASC;

-- name: GetRollsByPostWithCharacter :many
SELECT
    r.*,
    c.display_name AS character_name
FROM rolls r
LEFT JOIN characters c ON r.character_id = c.id
WHERE r.post_id = $1
ORDER BY r.created_at ASC;

-- name: GetPendingRollsForCharacter :many
SELECT r.*
FROM rolls r
WHERE r.character_id = $1
  AND r.status = 'pending'
ORDER BY r.created_at DESC;

-- name: GetPendingRollsInScene :many
SELECT
    r.*,
    c.display_name AS character_name
FROM rolls r
JOIN characters c ON c.id = r.character_id
WHERE r.scene_id = $1
  AND r.status = 'pending'
ORDER BY r.created_at ASC;

-- name: GetUnresolvedRollsInCampaign :many
SELECT
    r.*,
    c.display_name AS character_name,
    s.title AS scene_title,
    p.blocks AS post_content
FROM rolls r
JOIN characters c ON c.id = r.character_id
JOIN scenes s ON s.id = r.scene_id
LEFT JOIN posts p ON p.id = r.post_id
WHERE s.campaign_id = $1
  AND r.status = 'pending'
ORDER BY r.created_at ASC;

-- name: CountPendingRollsForCharacter :one
SELECT COUNT(*)
FROM rolls
WHERE character_id = $1
  AND status = 'pending';

-- name: OverrideRollIntention :one
UPDATE rolls
SET
    original_intention = CASE WHEN original_intention IS NULL THEN intention ELSE original_intention END,
    intention = $2,
    was_overridden = true,
    overridden_by = $3,
    override_reason = $4,
    override_timestamp = NOW()
WHERE id = $1
RETURNING *;

-- name: ManuallyResolveRoll :one
UPDATE rolls
SET
    manual_result = $2,
    manually_resolved_by = $3,
    manual_resolution_reason = $4,
    total = $2,
    status = 'completed',
    rolled_at = NOW()
WHERE id = $1
RETURNING *;

-- name: InvalidateRoll :one
UPDATE rolls
SET status = 'invalidated'
WHERE id = $1
RETURNING *;

-- name: CharacterHasPendingRolls :one
SELECT EXISTS(
    SELECT 1 FROM rolls
    WHERE character_id = $1
      AND status = 'pending'
) AS has_pending;

-- name: GetRollsInSceneByStatus :many
SELECT
    r.*,
    c.display_name AS character_name
FROM rolls r
LEFT JOIN characters c ON r.character_id = c.id
WHERE r.scene_id = $1
  AND r.status = $2
ORDER BY r.created_at DESC;

-- name: ListRollsByScene :many
SELECT
    r.*,
    c.display_name AS character_name
FROM rolls r
LEFT JOIN characters c ON r.character_id = c.id
WHERE r.scene_id = $1
ORDER BY r.created_at DESC;

-- name: GetRollCountByStatus :one
SELECT
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'invalidated') AS invalidated
FROM rolls r
JOIN scenes s ON r.scene_id = s.id
WHERE s.campaign_id = $1;

-- name: DeleteRoll :exec
DELETE FROM rolls WHERE id = $1;

-- name: GetSceneIDForRoll :one
SELECT scene_id FROM rolls WHERE id = $1;
