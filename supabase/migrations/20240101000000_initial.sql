-- ============================================
-- VANGUARD PBP DATABASE SCHEMA
-- ============================================

-- gen_random_uuid() is built into PostgreSQL 13+, no extension needed

-- ============================================
-- ENUM TYPES
-- ============================================

CREATE TYPE campaign_phase AS ENUM ('pc_phase', 'gm_phase');
CREATE TYPE member_role AS ENUM ('gm', 'player');
CREATE TYPE character_type AS ENUM ('pc', 'npc');
CREATE TYPE pass_state AS ENUM ('none', 'passed', 'hard_passed');
CREATE TYPE post_block_type AS ENUM ('action', 'dialog');
CREATE TYPE roll_status AS ENUM ('pending', 'completed', 'invalidated');
CREATE TYPE invite_status AS ENUM ('active', 'used', 'expired', 'revoked');
CREATE TYPE time_gate_preset AS ENUM ('24h', '2d', '3d', '4d', '5d');
CREATE TYPE ooc_visibility AS ENUM ('all', 'gm_only');
CREATE TYPE character_limit AS ENUM ('1000', '3000', '6000', '10000');
CREATE TYPE notification_frequency AS ENUM ('realtime', 'digest_daily', 'digest_weekly', 'off');
CREATE TYPE bookmark_type AS ENUM ('character', 'scene', 'post');

-- ============================================
-- CAMPAIGNS TABLE
-- ============================================

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Settings (JSON for flexibility)
    settings JSONB NOT NULL DEFAULT '{
        "timeGatePreset": "3d",
        "fogOfWar": true,
        "hiddenPosts": true,
        "oocVisibility": "gm_only",
        "characterLimit": "3000",
        "systemPreset": {
            "name": "custom",
            "diceType": "d20",
            "intentions": []
        }
    }'::jsonb,

    -- State
    current_phase campaign_phase NOT NULL DEFAULT 'gm_phase',
    current_phase_started_at TIMESTAMPTZ,
    current_phase_expires_at TIMESTAMPTZ,
    is_paused BOOLEAN NOT NULL DEFAULT false,

    -- Tracking
    last_gm_activity_at TIMESTAMPTZ DEFAULT NOW(),
    storage_used_bytes BIGINT NOT NULL DEFAULT 0,
    scene_count INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user's campaigns
CREATE INDEX idx_campaigns_owner_id ON campaigns(owner_id);

-- ============================================
-- CAMPAIGN MEMBERS TABLE
-- ============================================

CREATE TABLE campaign_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role member_role NOT NULL DEFAULT 'player',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(campaign_id, user_id)
);

-- Index for user's memberships
CREATE INDEX idx_campaign_members_user_id ON campaign_members(user_id);
CREATE INDEX idx_campaign_members_campaign_id ON campaign_members(campaign_id);

-- ============================================
-- INVITE LINKS TABLE
-- ============================================

CREATE TABLE invite_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    code VARCHAR(32) NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES auth.users(id),

    -- Status tracking
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    used_by UUID REFERENCES auth.users(id),
    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for code lookup
CREATE INDEX idx_invite_links_code ON invite_links(code);
CREATE INDEX idx_invite_links_campaign_id ON invite_links(campaign_id);

-- ============================================
-- CHARACTERS TABLE
-- ============================================

CREATE TABLE characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    character_type character_type NOT NULL DEFAULT 'pc',
    is_archived BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for campaign's characters
CREATE INDEX idx_characters_campaign_id ON characters(campaign_id);

-- ============================================
-- CHARACTER ASSIGNMENTS TABLE
-- ============================================

CREATE TABLE character_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One user per character at a time
    UNIQUE(character_id)
);

-- Index for user's characters
CREATE INDEX idx_character_assignments_user_id ON character_assignments(user_id);

-- ============================================
-- SCENES TABLE
-- ============================================

CREATE TABLE scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    header_image_url TEXT,

    -- Characters in scene (array of character IDs)
    character_ids UUID[] NOT NULL DEFAULT '{}',

    -- Pass states per character (JSON object: {characterId: 'none'|'passed'|'hard_passed'})
    pass_states JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Scene status
    is_archived BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for campaign's scenes
CREATE INDEX idx_scenes_campaign_id ON scenes(campaign_id);

-- ============================================
-- POSTS TABLE
-- ============================================

CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    character_id UUID REFERENCES characters(id) ON DELETE SET NULL, -- NULL for Narrator
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Content (array of blocks)
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Block structure: [{"type": "action"|"dialog", "content": "...", "order": 0}]

    ooc_text TEXT,

    -- Visibility
    witnesses UUID[] NOT NULL DEFAULT '{}', -- Empty = hidden post
    is_hidden BOOLEAN NOT NULL DEFAULT false,

    -- State
    is_draft BOOLEAN NOT NULL DEFAULT true,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    locked_at TIMESTAMPTZ,
    edited_by_gm BOOLEAN NOT NULL DEFAULT false,

    -- Intention (for dice rolling)
    intention VARCHAR(100),
    modifier INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_posts_scene_id ON posts(scene_id);
CREATE INDEX idx_posts_character_id ON posts(character_id);
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_witnesses ON posts USING GIN(witnesses);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);

-- ============================================
-- COMPOSE LOCKS TABLE
-- ============================================

CREATE TABLE compose_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,

    -- One lock per character per scene
    UNIQUE(scene_id, character_id)
);

-- Index for active locks
CREATE INDEX idx_compose_locks_expires_at ON compose_locks(expires_at);

-- ============================================
-- COMPOSE DRAFTS TABLE
-- ============================================

CREATE TABLE compose_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Draft content (same structure as post)
    blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
    ooc_text TEXT,
    intention VARCHAR(100),
    modifier INTEGER DEFAULT 0,
    is_hidden BOOLEAN NOT NULL DEFAULT false,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One draft per character per scene
    UNIQUE(scene_id, character_id)
);

-- ============================================
-- ROLLS TABLE
-- ============================================

CREATE TABLE rolls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    scene_id UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,

    -- Who requested (NULL = player-initiated)
    requested_by UUID REFERENCES auth.users(id),

    -- Roll specification
    intention VARCHAR(100) NOT NULL,
    modifier INTEGER NOT NULL DEFAULT 0,
    dice_type VARCHAR(10) NOT NULL, -- d4, d6, d8, d10, d12, d20, d100
    dice_count INTEGER NOT NULL DEFAULT 1,

    -- Results
    result INTEGER[], -- Array of individual die results
    total INTEGER,    -- Sum + modifier

    -- Override tracking
    was_overridden BOOLEAN NOT NULL DEFAULT false,
    original_intention VARCHAR(100),

    -- Status
    status roll_status NOT NULL DEFAULT 'pending',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rolls_post_id ON rolls(post_id);
CREATE INDEX idx_rolls_scene_id ON rolls(scene_id);
CREATE INDEX idx_rolls_character_id ON rolls(character_id);
CREATE INDEX idx_rolls_status ON rolls(status);

-- ============================================
-- BOOKMARKS TABLE
-- ============================================

CREATE TABLE bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    bookmark_type bookmark_type NOT NULL,
    referenced_entity_id UUID NOT NULL,
    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One bookmark per character per entity
    UNIQUE(character_id, bookmark_type, referenced_entity_id)
);

-- Index for character's bookmarks
CREATE INDEX idx_bookmarks_character_id ON bookmarks(character_id);

-- ============================================
-- NOTIFICATION PREFERENCES TABLE
-- ============================================

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    email_enabled BOOLEAN NOT NULL DEFAULT true,
    email_frequency notification_frequency NOT NULL DEFAULT 'realtime',
    in_app_enabled BOOLEAN NOT NULL DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- QUIET HOURS TABLE
-- ============================================

CREATE TABLE quiet_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

    enabled BOOLEAN NOT NULL DEFAULT false,
    start_time TIME NOT NULL DEFAULT '22:00',
    end_time TIME NOT NULL DEFAULT '08:00',
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- phase_started, new_post, roll_requested, etc.

    -- Related entities
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,

    -- State
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,

    -- Delivery tracking
    email_sent_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to relevant tables
CREATE TRIGGER update_campaigns_updated_at
    BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at
    BEFORE UPDATE ON characters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenes_updated_at
    BEFORE UPDATE ON scenes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quiet_hours_updated_at
    BEFORE UPDATE ON quiet_hours
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE compose_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE compose_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiet_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CAMPAIGNS POLICIES
-- ============================================

-- Users can see campaigns they're members of
CREATE POLICY "Users can view their campaigns"
ON campaigns FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM campaign_members
        WHERE campaign_members.campaign_id = campaigns.id
        AND campaign_members.user_id = auth.uid()
    )
);

-- GMs can update their campaigns
CREATE POLICY "GMs can update campaigns"
ON campaigns FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM campaign_members
        WHERE campaign_members.campaign_id = campaigns.id
        AND campaign_members.user_id = auth.uid()
        AND campaign_members.role = 'gm'
    )
);

-- Authenticated users can create campaigns
CREATE POLICY "Users can create campaigns"
ON campaigns FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- GMs can delete their campaigns
CREATE POLICY "GMs can delete campaigns"
ON campaigns FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM campaign_members
        WHERE campaign_members.campaign_id = campaigns.id
        AND campaign_members.user_id = auth.uid()
        AND campaign_members.role = 'gm'
    )
);

-- ============================================
-- CAMPAIGN MEMBERS POLICIES
-- ============================================

-- Members can see other members
CREATE POLICY "Members can view campaign members"
ON campaign_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM campaign_members cm
        WHERE cm.campaign_id = campaign_members.campaign_id
        AND cm.user_id = auth.uid()
    )
);

-- GMs can add/remove members
CREATE POLICY "GMs can manage members"
ON campaign_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM campaign_members cm
        WHERE cm.campaign_id = campaign_members.campaign_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'gm'
    )
);

-- Users can join (via invite link)
CREATE POLICY "Users can join campaigns"
ON campaign_members FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can leave campaigns
CREATE POLICY "Users can leave campaigns"
ON campaign_members FOR DELETE
USING (user_id = auth.uid());

-- ============================================
-- INVITE LINKS POLICIES
-- ============================================

-- GMs can manage invite links
CREATE POLICY "GMs can manage invite links"
ON invite_links FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM campaign_members cm
        WHERE cm.campaign_id = invite_links.campaign_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'gm'
    )
);

-- Anyone can view active invite links (for joining)
CREATE POLICY "Anyone can view active invite links"
ON invite_links FOR SELECT
USING (
    expires_at > NOW()
    AND used_at IS NULL
    AND revoked_at IS NULL
);

-- ============================================
-- CHARACTERS POLICIES
-- ============================================

-- Members can see characters in their campaigns
CREATE POLICY "Members can view characters"
ON characters FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM campaign_members
        WHERE campaign_members.campaign_id = characters.campaign_id
        AND campaign_members.user_id = auth.uid()
    )
);

-- GMs can manage all characters
CREATE POLICY "GMs can manage characters"
ON characters FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM campaign_members
        WHERE campaign_members.campaign_id = characters.campaign_id
        AND campaign_members.user_id = auth.uid()
        AND campaign_members.role = 'gm'
    )
);

-- ============================================
-- CHARACTER ASSIGNMENTS POLICIES
-- ============================================

-- Members can see character assignments in their campaigns
CREATE POLICY "Members can view character assignments"
ON character_assignments FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM characters c
        JOIN campaign_members cm ON cm.campaign_id = c.campaign_id
        WHERE c.id = character_assignments.character_id
        AND cm.user_id = auth.uid()
    )
);

-- GMs can manage character assignments
CREATE POLICY "GMs can manage character assignments"
ON character_assignments FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM characters c
        JOIN campaign_members cm ON cm.campaign_id = c.campaign_id
        WHERE c.id = character_assignments.character_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'gm'
    )
);

-- ============================================
-- SCENES POLICIES
-- ============================================

-- Members can see scenes in their campaigns
CREATE POLICY "Members can view scenes"
ON scenes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM campaign_members cm
        WHERE cm.campaign_id = scenes.campaign_id
        AND cm.user_id = auth.uid()
    )
);

-- GMs can manage scenes
CREATE POLICY "GMs can manage scenes"
ON scenes FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM campaign_members cm
        WHERE cm.campaign_id = scenes.campaign_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'gm'
    )
);

-- ============================================
-- POSTS POLICIES (Witness-based visibility)
-- ============================================

-- Users can see posts where their characters are witnesses OR they are GM
CREATE POLICY "Users can view witnessed posts"
ON posts FOR SELECT
USING (
    -- User is GM of this campaign
    EXISTS (
        SELECT 1 FROM scenes s
        JOIN campaign_members cm ON cm.campaign_id = s.campaign_id
        WHERE s.id = posts.scene_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'gm'
    )
    OR
    -- User owns a character that is a witness
    EXISTS (
        SELECT 1 FROM character_assignments ca
        WHERE ca.user_id = auth.uid()
        AND ca.character_id = ANY(posts.witnesses)
    )
    OR
    -- User is the author of a draft
    (posts.is_draft = true AND posts.user_id = auth.uid())
);

-- Users can create posts in scenes they have characters in
CREATE POLICY "Users can create posts"
ON posts FOR INSERT
WITH CHECK (
    user_id = auth.uid()
    AND (
        -- Narrator post (GM only)
        (character_id IS NULL AND EXISTS (
            SELECT 1 FROM scenes s
            JOIN campaign_members cm ON cm.campaign_id = s.campaign_id
            WHERE s.id = scene_id
            AND cm.user_id = auth.uid()
            AND cm.role = 'gm'
        ))
        OR
        -- Character post (user must own character and character must be in scene)
        EXISTS (
            SELECT 1 FROM character_assignments ca
            JOIN scenes s ON ca.character_id = ANY(s.character_ids)
            WHERE ca.user_id = auth.uid()
            AND ca.character_id = character_id
            AND s.id = scene_id
        )
    )
);

-- Users can update their own drafts
CREATE POLICY "Users can update own drafts"
ON posts FOR UPDATE
USING (user_id = auth.uid() AND is_draft = true)
WITH CHECK (user_id = auth.uid());

-- GMs can update any post
CREATE POLICY "GMs can update posts"
ON posts FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM scenes s
        JOIN campaign_members cm ON cm.campaign_id = s.campaign_id
        WHERE s.id = posts.scene_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'gm'
    )
);

-- GMs can delete posts
CREATE POLICY "GMs can delete posts"
ON posts FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM scenes s
        JOIN campaign_members cm ON cm.campaign_id = s.campaign_id
        WHERE s.id = posts.scene_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'gm'
    )
);

-- ============================================
-- COMPOSE LOCKS POLICIES
-- ============================================

-- Members can view locks in their campaigns
CREATE POLICY "Members can view compose locks"
ON compose_locks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM scenes s
        JOIN campaign_members cm ON cm.campaign_id = s.campaign_id
        WHERE s.id = compose_locks.scene_id
        AND cm.user_id = auth.uid()
    )
);

-- Users can manage their own locks
CREATE POLICY "Users can manage own locks"
ON compose_locks FOR ALL
USING (user_id = auth.uid());

-- GMs can release any lock
CREATE POLICY "GMs can release locks"
ON compose_locks FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM scenes s
        JOIN campaign_members cm ON cm.campaign_id = s.campaign_id
        WHERE s.id = compose_locks.scene_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'gm'
    )
);

-- ============================================
-- COMPOSE DRAFTS POLICIES
-- ============================================

-- Users can only see/manage their own drafts
CREATE POLICY "Users can manage own drafts"
ON compose_drafts FOR ALL
USING (user_id = auth.uid());

-- ============================================
-- ROLLS POLICIES
-- ============================================

-- Same visibility as posts (witness-based)
CREATE POLICY "Users can view witnessed rolls"
ON rolls FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM scenes s
        JOIN campaign_members cm ON cm.campaign_id = s.campaign_id
        WHERE s.id = rolls.scene_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'gm'
    )
    OR
    EXISTS (
        SELECT 1 FROM posts p
        JOIN character_assignments ca ON ca.character_id = ANY(p.witnesses)
        WHERE p.id = rolls.post_id
        AND ca.user_id = auth.uid()
    )
);

-- ============================================
-- NOTIFICATIONS POLICIES
-- ============================================

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
ON notifications FOR ALL
USING (user_id = auth.uid());

-- ============================================
-- NOTIFICATION PREFERENCES POLICIES
-- ============================================

CREATE POLICY "Users can manage own notification preferences"
ON notification_preferences FOR ALL
USING (user_id = auth.uid());

-- ============================================
-- QUIET HOURS POLICIES
-- ============================================

CREATE POLICY "Users can manage own quiet hours"
ON quiet_hours FOR ALL
USING (user_id = auth.uid());

-- ============================================
-- BOOKMARKS POLICIES
-- ============================================

-- Users can manage bookmarks for their characters
CREATE POLICY "Users can manage character bookmarks"
ON bookmarks FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM character_assignments ca
        WHERE ca.character_id = bookmarks.character_id
        AND ca.user_id = auth.uid()
    )
);
