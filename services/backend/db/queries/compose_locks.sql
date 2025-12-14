-- name: AcquireComposeLock :one
INSERT INTO compose_locks (
    scene_id,
    character_id,
    user_id,
    expires_at,
    is_hidden
) VALUES (
    $1, $2, $3, $4, $5
)
RETURNING *;

-- name: GetComposeLock :one
SELECT * FROM compose_locks
WHERE scene_id = $1 AND character_id = $2;

-- name: GetComposeLockByID :one
SELECT * FROM compose_locks
WHERE id = $1;

-- name: GetComposeLockByScene :many
SELECT cl.*, c.display_name AS character_name, c.avatar_url AS character_avatar
FROM compose_locks cl
INNER JOIN characters c ON cl.character_id = c.id
WHERE cl.scene_id = $1;

-- name: UpdateComposeLockActivity :exec
UPDATE compose_locks
SET
    last_activity_at = $2,
    expires_at = $3
WHERE id = $1;

-- name: DeleteComposeLock :exec
DELETE FROM compose_locks WHERE id = $1;

-- name: DeleteSceneComposeLocks :exec
DELETE FROM compose_locks WHERE scene_id = $1;

-- name: DeleteExpiredComposeLocks :exec
DELETE FROM compose_locks WHERE expires_at < $1;

-- name: GetUserComposeLockInScene :one
SELECT * FROM compose_locks
WHERE scene_id = $1 AND user_id = $2;

-- name: CountSceneComposeLocks :one
SELECT COUNT(*) FROM compose_locks WHERE scene_id = $1;

-- name: UpdateComposeLockHidden :exec
UPDATE compose_locks
SET is_hidden = $2
WHERE id = $1;

-- name: GetComposeLockWithHiddenInfo :one
SELECT
    cl.*,
    c.display_name AS character_name,
    c.avatar_url AS character_avatar
FROM compose_locks cl
INNER JOIN characters c ON cl.character_id = c.id
WHERE cl.scene_id = $1 AND cl.character_id = $2;
