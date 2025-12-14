-- name: CreateCharacter :one
INSERT INTO characters (
    campaign_id,
    display_name,
    description,
    character_type
) VALUES (
    $1, $2, $3, $4
)
RETURNING *;

-- name: GetCharacter :one
SELECT * FROM characters WHERE id = $1;

-- name: GetCharacterWithAssignment :one
SELECT
    c.*,
    ca.user_id AS assigned_user_id,
    ca.assigned_at
FROM characters c
LEFT JOIN character_assignments ca ON c.id = ca.character_id
WHERE c.id = $1;

-- name: ListCampaignCharacters :many
SELECT
    c.*,
    ca.user_id AS assigned_user_id,
    ca.assigned_at
FROM characters c
LEFT JOIN character_assignments ca ON c.id = ca.character_id
WHERE c.campaign_id = $1
ORDER BY c.is_archived ASC, c.created_at ASC;

-- name: ListUserCharactersInCampaign :many
SELECT
    c.*,
    ca.user_id AS assigned_user_id,
    ca.assigned_at
FROM characters c
INNER JOIN character_assignments ca ON c.id = ca.character_id
WHERE c.campaign_id = $1 AND ca.user_id = $2 AND c.is_archived = false
ORDER BY c.created_at ASC;

-- name: UpdateCharacter :one
UPDATE characters
SET
    display_name = COALESCE($2, display_name),
    description = COALESCE($3, description),
    avatar_url = COALESCE($4, avatar_url),
    character_type = COALESCE($5, character_type),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ArchiveCharacter :one
UPDATE characters
SET
    is_archived = true,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UnarchiveCharacter :one
UPDATE characters
SET
    is_archived = false,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: AssignCharacter :one
INSERT INTO character_assignments (
    character_id,
    user_id
) VALUES (
    $1, $2
)
ON CONFLICT (character_id) DO UPDATE
SET
    user_id = $2,
    assigned_at = NOW()
RETURNING *;

-- name: UnassignCharacter :exec
DELETE FROM character_assignments WHERE character_id = $1;

-- name: GetCharacterAssignment :one
SELECT * FROM character_assignments WHERE character_id = $1;

-- name: GetOrphanedCharacters :many
SELECT c.*
FROM characters c
LEFT JOIN character_assignments ca ON c.id = ca.character_id
WHERE c.campaign_id = $1 AND ca.id IS NULL AND c.is_archived = false
ORDER BY c.created_at ASC;

-- name: CountCampaignCharacters :one
SELECT COUNT(*) FROM characters WHERE campaign_id = $1;

-- name: GetCharacterCampaignID :one
SELECT campaign_id FROM characters WHERE id = $1;

-- name: UpdateCharacterAvatar :one
UPDATE characters
SET
    avatar_url = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ClearCharacterAvatar :one
UPDATE characters
SET
    avatar_url = NULL,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetUserCharactersInScene :many
SELECT
    c.*,
    ca.user_id AS assigned_user_id,
    ca.assigned_at
FROM characters c
INNER JOIN character_assignments ca ON c.id = ca.character_id
WHERE c.id = ANY(
    SELECT unnest(character_ids) FROM scenes WHERE scenes.id = $1
)
AND ca.user_id = $2
AND c.is_archived = false
ORDER BY c.display_name;
