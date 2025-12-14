-- ============================================
-- PHASE 9: REAL-TIME SYNC & NOTIFICATIONS
-- ============================================

-- Add missing columns to notifications table
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS link TEXT,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
ADD COLUMN IF NOT EXISTS character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for expiration
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_urgent ON notifications(user_id, is_urgent) WHERE is_urgent = true;

-- ============================================
-- QUIET HOURS ENHANCEMENTS
-- ============================================

-- Add urgent bypass to quiet hours
ALTER TABLE quiet_hours
ADD COLUMN IF NOT EXISTS urgent_bypass BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- NOTIFICATION QUEUE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    queued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deliver_after TIMESTAMPTZ NOT NULL,
    delivered_at TIMESTAMPTZ,

    UNIQUE(notification_id) -- One queue entry per notification
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_deliver ON notification_queue(deliver_after) WHERE delivered_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notification_queue_user ON notification_queue(user_id);

-- RLS for notification queue
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own queued notifications"
ON notification_queue FOR SELECT
USING (user_id = auth.uid());

-- ============================================
-- EMAIL DIGESTS TRACKING TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS email_digests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    digest_type TEXT NOT NULL CHECK (digest_type IN ('daily', 'weekly')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notification_count INT NOT NULL,
    campaign_ids UUID[] NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_email_digests_user ON email_digests(user_id, sent_at DESC);

-- RLS for email digests
ALTER TABLE email_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email digests"
ON email_digests FOR SELECT
USING (user_id = auth.uid());

-- ============================================
-- NOTIFICATION TYPES REFERENCE (for documentation)
-- ============================================

COMMENT ON COLUMN notifications.type IS 'Notification types:
Player:
- pc_phase_started: PC Phase has started
- new_post_in_scene: New post in a scene
- roll_requested: GM requested a roll
- intention_overridden: GM changed intention
- character_added_to_scene: Character added to scene
- compose_lock_released: Compose lock released
- time_gate_warning_24h: 24 hours remaining
- time_gate_warning_6h: 6 hours remaining
- time_gate_warning_1h: 1 hour remaining
- pass_state_cleared: Pass state was cleared
- gm_role_available: GM role is available

GM:
- all_characters_passed: All characters have passed
- time_gate_expired: Time gate has expired
- hidden_post_submitted: Hidden post was submitted
- player_joined: Player joined campaign
- player_roll_submitted: Player submitted a roll
- unresolved_rolls_exist: Unresolved rolls exist
- campaign_at_player_limit: Campaign at player limit
- scene_limit_warning: Scene limit warning
';

-- ============================================
-- REALTIME SUBSCRIPTIONS SETUP
-- ============================================

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE compose_locks;
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE campaigns;
ALTER PUBLICATION supabase_realtime ADD TABLE scenes;

-- ============================================
-- FUNCTION: Cleanup expired notifications
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE expires_at < NOW();

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Deliver queued notifications
-- ============================================

CREATE OR REPLACE FUNCTION get_notifications_ready_for_delivery()
RETURNS SETOF notification_queue AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM notification_queue
    WHERE deliver_after <= NOW()
    AND delivered_at IS NULL
    ORDER BY deliver_after ASC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;
