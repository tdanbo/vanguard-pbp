-- name: CreateComposeDraft :one
INSERT INTO compose_drafts (
    scene_id,
    character_id,
    user_id,
    blocks,
    ooc_text,
    intention,
    modifier,
    is_hidden
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
RETURNING *;

-- name: GetComposeDraft :one
SELECT * FROM compose_drafts
WHERE scene_id = $1 AND character_id = $2;

-- name: GetComposeDraftByID :one
SELECT * FROM compose_drafts
WHERE id = $1;

-- name: GetUserDraftInScene :one
SELECT * FROM compose_drafts
WHERE scene_id = $1 AND character_id = $2 AND user_id = $3;

-- name: UpdateComposeDraft :one
UPDATE compose_drafts
SET
    blocks = $2,
    ooc_text = $3,
    intention = $4,
    modifier = $5,
    is_hidden = $6,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpsertComposeDraft :one
INSERT INTO compose_drafts (
    scene_id,
    character_id,
    user_id,
    blocks,
    ooc_text,
    intention,
    modifier,
    is_hidden
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8
)
ON CONFLICT (scene_id, character_id)
DO UPDATE SET
    blocks = EXCLUDED.blocks,
    ooc_text = EXCLUDED.ooc_text,
    intention = EXCLUDED.intention,
    modifier = EXCLUDED.modifier,
    is_hidden = EXCLUDED.is_hidden,
    updated_at = NOW()
RETURNING *;

-- name: DeleteComposeDraft :exec
DELETE FROM compose_drafts WHERE id = $1;

-- name: DeleteComposeDraftByCharacter :exec
DELETE FROM compose_drafts
WHERE scene_id = $1 AND character_id = $2;

-- name: ListUserDrafts :many
SELECT cd.*, s.title AS scene_title, c.display_name AS character_name
FROM compose_drafts cd
INNER JOIN scenes s ON cd.scene_id = s.id
INNER JOIN characters c ON cd.character_id = c.id
WHERE cd.user_id = $1
ORDER BY cd.updated_at DESC;
