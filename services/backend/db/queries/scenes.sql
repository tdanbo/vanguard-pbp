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

-- name: GetVisibleScenesForCharacter :many
-- Returns scenes where the character has witnessed at least one post
SELECT DISTINCT s.*
FROM scenes s
INNER JOIN posts p ON p.scene_id = s.id
WHERE s.campaign_id = $1
  AND $2::uuid = ANY(p.witnesses)
  AND s.is_archived = false
ORDER BY s.created_at DESC;

-- name: GetPresentCharactersInScene :many
-- Returns all characters currently in a scene (for witness capture)
SELECT c.id
FROM characters c
WHERE c.id = ANY(
    SELECT unnest(character_ids) FROM scenes WHERE scenes.id = $1
)
AND c.is_archived = false;

-- ============================================
-- PASS SYSTEM QUERIES
-- ============================================

-- name: GetScenePassStates :one
SELECT pass_states FROM scenes WHERE id = $1;

-- name: SetCharacterPassState :one
UPDATE scenes
SET
    pass_states = jsonb_set(
        COALESCE(pass_states, '{}'::jsonb),
        ARRAY[$2::text],
        to_jsonb($3::text),
        true
    ),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ClearCharacterPassState :one
UPDATE scenes
SET
    pass_states = pass_states - $2::text,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ResetAllPassStatesInScene :one
UPDATE scenes
SET
    pass_states = '{}'::jsonb,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: ResetAllPassStatesInCampaign :exec
UPDATE scenes
SET
    pass_states = '{}'::jsonb,
    updated_at = NOW()
WHERE campaign_id = $1;

-- name: GetAllPassStatesInCampaign :many
SELECT
    s.id AS scene_id,
    s.title AS scene_title,
    s.pass_states,
    s.character_ids
FROM scenes s
WHERE s.campaign_id = $1
  AND s.is_archived = false
ORDER BY s.created_at;

-- name: GetActiveCharactersInCampaign :many
-- Returns all non-archived characters in active scenes for a campaign
SELECT DISTINCT c.id, c.display_name, c.campaign_id, ca.user_id AS assigned_user_id
FROM characters c
LEFT JOIN character_assignments ca ON c.id = ca.character_id
WHERE c.campaign_id = $1
  AND c.is_archived = false
  AND EXISTS (
    SELECT 1 FROM scenes s
    WHERE s.campaign_id = $1
      AND s.is_archived = false
      AND c.id = ANY(s.character_ids)
  );

-- name: CheckAllCharactersPassed :one
-- Returns true if all PCs in active scenes have passed
-- Only PCs need to pass, NPCs are excluded from this check
SELECT NOT EXISTS (
    SELECT 1
    FROM characters c
    INNER JOIN scenes s ON c.id = ANY(s.character_ids)
    WHERE s.campaign_id = $1
      AND s.is_archived = false
      AND c.is_archived = false
      AND c.character_type = 'pc'  -- Only PCs need to pass
      AND (
        s.pass_states->c.id::text IS NULL
        OR s.pass_states->c.id::text = '"none"'
      )
) AS all_passed;

-- name: GetCharacterPassStatus :one
-- Get pass status for a specific character across all their scenes
SELECT
    c.id AS character_id,
    c.display_name,
    jsonb_agg(
        jsonb_build_object(
            'scene_id', s.id,
            'scene_title', s.title,
            'pass_state', COALESCE(s.pass_states->c.id::text, '"none"')
        )
    ) AS scenes_pass_states
FROM characters c
INNER JOIN scenes s ON c.id = ANY(s.character_ids)
WHERE c.id = $1
  AND s.is_archived = false
GROUP BY c.id, c.display_name;

-- name: CountUnpassedCharactersInCampaign :one
-- Count PCs that haven't passed in at least one scene
SELECT COUNT(DISTINCT c.id)
FROM characters c
INNER JOIN scenes s ON c.id = ANY(s.character_ids)
WHERE s.campaign_id = $1
  AND s.is_archived = false
  AND c.is_archived = false
  AND c.character_type = 'pc'  -- Only PCs
  AND (
    s.pass_states->c.id::text IS NULL
    OR s.pass_states->c.id::text = '"none"'
  );

-- name: CountPassedCharactersInCampaign :one
-- Count PCs that have passed in all their scenes
SELECT COUNT(DISTINCT sub.character_id)
FROM (
    SELECT c.id AS character_id
    FROM characters c
    INNER JOIN scenes s ON c.id = ANY(s.character_ids)
    WHERE s.campaign_id = $1
      AND s.is_archived = false
      AND c.is_archived = false
      AND c.character_type = 'pc'  -- Only PCs
    GROUP BY c.id
    HAVING bool_and(
        s.pass_states->c.id::text IS NOT NULL
        AND s.pass_states->c.id::text != '"none"'
    )
) sub;
