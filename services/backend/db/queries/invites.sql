-- name: CreateInviteLink :one
INSERT INTO invite_links (
    campaign_id,
    code,
    created_by,
    expires_at
) VALUES (
    $1, $2, $3, $4
)
RETURNING *;

-- name: GetInviteLinkByCode :one
SELECT
    il.*,
    c.title as campaign_title,
    c.owner_id as campaign_owner_id
FROM invite_links il
INNER JOIN campaigns c ON il.campaign_id = c.id
WHERE il.code = $1;

-- name: ListCampaignInvites :many
SELECT * FROM invite_links
WHERE campaign_id = $1
ORDER BY created_at DESC;

-- name: MarkInviteUsed :one
UPDATE invite_links
SET
    used_at = NOW(),
    used_by = $2
WHERE id = $1
RETURNING *;

-- name: RevokeInvite :one
UPDATE invite_links
SET revoked_at = NOW()
WHERE id = $1 AND campaign_id = $2
RETURNING *;

-- name: CountActiveCampaignInvites :one
SELECT COUNT(*) FROM invite_links
WHERE campaign_id = $1
  AND used_at IS NULL
  AND revoked_at IS NULL
  AND expires_at > NOW();
