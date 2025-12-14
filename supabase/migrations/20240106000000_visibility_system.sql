-- ============================================
-- PHASE 6: VISIBILITY & WITNESS SYSTEM
-- ============================================

-- ============================================
-- WITNESS IMMUTABILITY TRIGGER
-- ============================================

-- Prevent modification of witness lists except for unhide operations
CREATE OR REPLACE FUNCTION prevent_witness_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow unhide operation (empty → populated)
  IF (OLD.witnesses = '{}' OR array_length(OLD.witnesses, 1) IS NULL) AND
     (NEW.witnesses != '{}' AND array_length(NEW.witnesses, 1) > 0) THEN
    -- This is an unhide operation - allow it
    RETURN NEW;
  END IF;

  -- Prevent all other witness changes after initial set
  IF OLD.witnesses IS DISTINCT FROM NEW.witnesses THEN
    -- Allow setting witnesses on initial submission (is_draft changes from true to false)
    IF OLD.is_draft = true AND NEW.is_draft = false THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Witness lists are immutable once set (except unhide operation)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_witness_immutability
  BEFORE UPDATE ON posts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_witness_modification();

-- ============================================
-- COMPOSE LOCK HIDDEN POST TRACKING
-- ============================================

-- Add is_hidden column to compose_locks
ALTER TABLE compose_locks
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- SCENE VISIBILITY QUERIES SUPPORT
-- ============================================

-- Index to optimize visible scenes queries
CREATE INDEX IF NOT EXISTS idx_posts_scene_witnesses
ON posts USING GIN (scene_id, witnesses);

-- ============================================
-- PARTIAL INDEX FOR HIDDEN POSTS (GM QUERIES)
-- ============================================

CREATE INDEX IF NOT EXISTS idx_posts_hidden_scene
ON posts(scene_id, created_at DESC)
WHERE is_hidden = true;

-- ============================================
-- ADDITIONAL POST INDEXES FOR VISIBILITY
-- ============================================

-- Index for cursor-based pagination with witnesses
CREATE INDEX IF NOT EXISTS idx_posts_scene_created_witnesses
ON posts(scene_id, created_at) INCLUDE (witnesses);

