-- name: CreateScene :one
INSERT INTO scenes (
    campaign_id,
    title,
    description
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: GetScene :one
SELECT * FROM scenes WHERE id = $1;

-- name: GetSceneWithCampaign :one
SELECT
    s.*,
    c.current_phase,
    c.owner_id AS campaign_owner_id
FROM scenes s
INNER JOIN campaigns c ON s.campaign_id = c.id
WHERE s.id = $1;

-- name: ListCampaignScenes :many
SELECT * FROM scenes
WHERE campaign_id = $1
ORDER BY is_archived ASC, created_at ASC;

-- name: ListActiveScenes :many
SELECT * FROM scenes
WHERE campaign_id = $1 AND is_archived = false
ORDER BY created_at ASC;

-- name: CountCampaignScenes :one
SELECT COUNT(*) FROM scenes WHERE campaign_id = $1;

-- name: CountActiveScenes :one
SELECT COUNT(*) FROM scenes WHERE campaign_id = $1 AND is_archived = false;

-- name: UpdateScene :one
UPDATE scenes
SET
    title = COALESCE($2, title),
    description = COALESCE($3, description),
    header_image_url = COALESCE($4, header_image_url),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ArchiveScene :one
UPDATE scenes
SET
    is_archived = true,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UnarchiveScene :one
UPDATE scenes
SET
    is_archived = false,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteScene :exec
DELETE FROM scenes WHERE id = $1;

-- name: GetOldestArchivedScene :one
SELECT * FROM scenes
WHERE campaign_id = $1 AND is_archived = true
ORDER BY updated_at ASC
LIMIT 1;

-- name: AddCharacterToScene :one
UPDATE scenes
SET
    character_ids = array_append(character_ids, $2::uuid),
    updated_at = NOW()
WHERE id = $1 AND NOT ($2::uuid = ANY(character_ids))
RETURNING *;

-- name: RemoveCharacterFromScene :one
UPDATE scenes
SET
    character_ids = array_remove(character_ids, $2::uuid),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: RemoveCharacterFromAllScenes :exec
UPDATE scenes
SET
    character_ids = array_remove(character_ids, $2::uuid),
    updated_at = NOW()
WHERE campaign_id = $1 AND $2::uuid = ANY(character_ids);

-- name: GetSceneWithCharacter :one
SELECT * FROM scenes
WHERE campaign_id = $1 AND $2::uuid = ANY(character_ids) AND is_archived = false
LIMIT 1;

-- name: IsCharacterInScene :one
SELECT EXISTS(
    SELECT 1 FROM scenes
    WHERE id = $1 AND $2::uuid = ANY(character_ids)
) AS in_scene;

-- name: UpdateSceneHeaderImage :one
UPDATE scenes
SET
    header_image_url = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ClearSceneHeaderImage :one
UPDATE scenes
SET
    header_image_url = NULL,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetSceneCampaignID :one
SELECT campaign_id FROM scenes WHERE id = $1;

-- name: IncrementSceneCount :exec
UPDATE campaigns
SET
    scene_count = scene_count + 1,
    updated_at = NOW()
WHERE id = $1;

-- name: DecrementSceneCount :exec
UPDATE campaigns
SET
    scene_count = GREATEST(scene_count - 1, 0),
    updated_at = NOW()
WHERE id = $1;

-- name: UpdateScenePassStates :one
UPDATE scenes
SET
    pass_states = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetSceneCharacters :many
SELECT c.*, ca.user_id AS assigned_user_id, ca.assigned_at
FROM characters c
LEFT JOIN character_assignments ca ON c.id = ca.character_id
WHERE c.id = ANY(
    SELECT unnest(character_ids) FROM scenes WHERE scenes.id = $1
)
ORDER BY c.display_name;
