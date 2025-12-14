-- ============================================
-- DICE ROLLING: GM OVERRIDE FIELDS
-- ============================================

-- Add GM override fields to rolls table
ALTER TABLE rolls
ADD COLUMN IF NOT EXISTS overridden_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS override_reason TEXT,
ADD COLUMN IF NOT EXISTS override_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS manual_result INTEGER,
ADD COLUMN IF NOT EXISTS manually_resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS manual_resolution_reason TEXT,
ADD COLUMN IF NOT EXISTS rolled_at TIMESTAMPTZ;

-- Index for unresolved rolls dashboard
CREATE INDEX IF NOT EXISTS idx_rolls_pending_scene ON rolls(scene_id, status) WHERE status = 'pending';

-- Index for rolls by character
CREATE INDEX IF NOT EXISTS idx_rolls_character_status ON rolls(character_id, status);

-- Comment on columns
COMMENT ON COLUMN rolls.overridden_by IS 'GM who overrode the intention';
COMMENT ON COLUMN rolls.override_reason IS 'Reason for intention override';
COMMENT ON COLUMN rolls.override_timestamp IS 'When intention was overridden';
COMMENT ON COLUMN rolls.manual_result IS 'GM-assigned result (bypasses dice)';
COMMENT ON COLUMN rolls.manually_resolved_by IS 'GM who manually resolved';
COMMENT ON COLUMN rolls.manual_resolution_reason IS 'Reason for manual resolution';
COMMENT ON COLUMN rolls.rolled_at IS 'When the roll was executed';
