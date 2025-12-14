-- name: CreateCampaign :one
INSERT INTO campaigns (
    title,
    description,
    owner_id,
    settings,
    last_gm_activity_at
) VALUES (
    $1, $2, $3, $4, NOW()
)
RETURNING *;

-- name: AddCampaignMember :one
INSERT INTO campaign_members (
    campaign_id,
    user_id,
    role
) VALUES (
    $1, $2, $3
)
RETURNING *;

-- name: GetCampaign :one
SELECT * FROM campaigns WHERE id = $1;

-- name: GetCampaignWithMembership :one
SELECT
    c.*,
    cm.role as user_role
FROM campaigns c
LEFT JOIN campaign_members cm ON c.id = cm.campaign_id AND cm.user_id = $2
WHERE c.id = $1;

-- name: ListUserCampaigns :many
SELECT
    c.*,
    cm.role as user_role
FROM campaigns c
INNER JOIN campaign_members cm ON c.id = cm.campaign_id
WHERE cm.user_id = $1
ORDER BY c.updated_at DESC;

-- name: CountUserOwnedCampaigns :one
SELECT COUNT(*) FROM campaigns WHERE owner_id = $1;

-- name: UpdateCampaign :one
UPDATE campaigns
SET
    title = COALESCE($2, title),
    description = COALESCE($3, description),
    settings = COALESCE($4, settings),
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateCampaignPausedState :one
UPDATE campaigns
SET
    is_paused = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteCampaign :exec
DELETE FROM campaigns WHERE id = $1;

-- name: GetCampaignMembers :many
SELECT
    cm.*
FROM campaign_members cm
WHERE cm.campaign_id = $1
ORDER BY cm.role DESC, cm.joined_at ASC;

-- name: GetCampaignMember :one
SELECT * FROM campaign_members
WHERE campaign_id = $1 AND user_id = $2;

-- name: IsCampaignMember :one
SELECT EXISTS(
    SELECT 1 FROM campaign_members
    WHERE campaign_id = $1 AND user_id = $2
) AS is_member;

-- name: IsUserGM :one
SELECT EXISTS(
    SELECT 1 FROM campaign_members
    WHERE campaign_id = $1 AND user_id = $2 AND role = 'gm'
) AS is_gm;

-- name: RemoveCampaignMember :exec
DELETE FROM campaign_members
WHERE campaign_id = $1 AND user_id = $2;

-- name: UpdateCampaignOwner :one
UPDATE campaigns
SET
    owner_id = $2,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: UpdateMemberRole :exec
UPDATE campaign_members
SET role = $3
WHERE campaign_id = $1 AND user_id = $2;

-- name: UpdateGmActivity :exec
UPDATE campaigns
SET last_gm_activity_at = NOW()
WHERE id = $1;

-- name: GetCampaignMemberCount :one
SELECT COUNT(*) FROM campaign_members
WHERE campaign_id = $1;

-- name: CheckGmInactivity :one
SELECT
    id,
    last_gm_activity_at,
    EXTRACT(EPOCH FROM (NOW() - last_gm_activity_at)) / 86400 AS days_inactive
FROM campaigns
WHERE id = $1;

-- name: UpdateCampaignPhase :exec
UPDATE campaigns
SET
    current_phase = $2,
    current_phase_started_at = NOW(),
    current_phase_expires_at = $3,
    updated_at = NOW()
WHERE id = $1;

-- name: IncrementCampaignStorage :one
UPDATE campaigns
SET
    storage_used_bytes = storage_used_bytes + $2,
    updated_at = NOW()
WHERE id = $1
RETURNING storage_used_bytes;

-- name: DecrementCampaignStorage :one
UPDATE campaigns
SET
    storage_used_bytes = GREATEST(0, storage_used_bytes - $2),
    updated_at = NOW()
WHERE id = $1
RETURNING storage_used_bytes;

-- name: GetCampaignStorage :one
SELECT storage_used_bytes FROM campaigns WHERE id = $1;
