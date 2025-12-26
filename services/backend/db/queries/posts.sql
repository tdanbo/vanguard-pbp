-- name: CreatePost :one
INSERT INTO posts (
    scene_id,
    character_id,
    user_id,
    blocks,
    ooc_text,
    witnesses,
    is_hidden,
    is_draft,
    intention,
    modifier
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
)
RETURNING *;

-- name: GetPost :one
SELECT * FROM posts WHERE id = $1;

-- name: GetPostWithCharacter :one
SELECT
    p.*,
    c.display_name AS character_name,
    c.avatar_url AS character_avatar,
    c.character_type
FROM posts p
LEFT JOIN characters c ON p.character_id = c.id
WHERE p.id = $1;

-- name: ListScenePosts :many
SELECT
    p.*,
    c.display_name AS character_name,
    c.avatar_url AS character_avatar,
    c.character_type
FROM posts p
LEFT JOIN characters c ON p.character_id = c.id
WHERE p.scene_id = $1 AND p.is_draft = false
ORDER BY p.created_at ASC;

-- name: ListScenePostsForCharacter :many
SELECT
    p.*,
    c.display_name AS character_name,
    c.avatar_url AS character_avatar,
    c.character_type
FROM posts p
LEFT JOIN characters c ON p.character_id = c.id
WHERE p.scene_id = $1
    AND p.is_draft = false
    AND ($2::uuid = ANY(p.witnesses) OR $3 = true)
ORDER BY p.created_at ASC;

-- name: GetLastScenePost :one
SELECT * FROM posts
WHERE scene_id = $1 AND is_draft = false
ORDER BY created_at DESC
LIMIT 1;

-- name: GetUserDraftPost :one
SELECT * FROM posts
WHERE scene_id = $1 AND character_id = $2 AND user_id = $3 AND is_draft = true
LIMIT 1;

-- name: CountScenePosts :one
SELECT COUNT(*) FROM posts
WHERE scene_id = $1 AND is_draft = false;

-- name: UpdatePost :one
UPDATE posts
SET
    blocks = COALESCE($2, blocks),
    ooc_text = COALESCE($3, ooc_text),
    intention = COALESCE($4, intention),
    modifier = COALESCE($5, modifier),
    edited_by_gm = COALESCE($6, edited_by_gm),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: SubmitPost :one
UPDATE posts
SET
    is_draft = false,
    witnesses = $2,
    is_hidden = $3,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: LockPost :exec
UPDATE posts
SET
    is_locked = true,
    locked_at = NOW()
WHERE id = $1;

-- name: UnlockPost :exec
UPDATE posts
SET
    is_locked = false,
    locked_at = NULL
WHERE id = $1;

-- name: DeletePost :exec
DELETE FROM posts WHERE id = $1;

-- name: GetPreviousPost :one
SELECT * FROM posts
WHERE scene_id = $1
    AND is_draft = false
    AND created_at < $2
ORDER BY created_at DESC
LIMIT 1;

-- name: UpdatePostWitnesses :exec
UPDATE posts
SET
    witnesses = $2,
    is_hidden = false,
    updated_at = NOW()
WHERE id = $1;

-- name: GetScenePostCount :one
SELECT COUNT(*) FROM posts
WHERE scene_id = $1 AND is_draft = false;

-- name: GetCharacterPostCountInScene :one
SELECT COUNT(*) FROM posts
WHERE scene_id = $1 AND character_id = $2 AND is_draft = false;

-- name: ListHiddenPostsInScene :many
SELECT
    p.*,
    c.display_name AS character_name,
    c.avatar_url AS character_avatar,
    c.character_type
FROM posts p
LEFT JOIN characters c ON p.character_id = c.id
WHERE p.scene_id = $1 AND p.is_hidden = true AND p.is_draft = false
ORDER BY p.created_at ASC;

-- name: UnhidePostWithCustomWitnesses :one
-- GM can unhide a post and set specific witnesses
UPDATE posts
SET
    witnesses = $2,
    is_hidden = false,
    updated_at = NOW()
WHERE id = $1 AND is_hidden = true
RETURNING *;

-- name: GetPostCountForCharacterInScene :one
-- Count posts visible to a specific character in a scene
SELECT COUNT(*)
FROM posts
WHERE scene_id = $1
  AND $2::uuid = ANY(witnesses)
  AND is_draft = false;

-- name: ListScenePostsPaginated :many
-- Cursor-based pagination for posts
SELECT
    p.*,
    c.display_name AS character_name,
    c.avatar_url AS character_avatar,
    c.character_type
FROM posts p
LEFT JOIN characters c ON p.character_id = c.id
WHERE p.scene_id = $1
    AND p.is_draft = false
    AND ($2::uuid = ANY(p.witnesses) OR $3 = true)
    AND ($4::timestamptz IS NULL OR p.created_at > $4)
ORDER BY p.created_at ASC
LIMIT $5;

-- name: EditPostWitnesses :one
-- GM-only: Update witnesses on a post without changing hidden status
UPDATE posts
SET
    witnesses = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;
