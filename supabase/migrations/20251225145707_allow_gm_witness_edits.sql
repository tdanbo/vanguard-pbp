-- ============================================
-- ALLOW GM WITNESS EDITS
-- ============================================
--
-- Update the witness immutability trigger to allow any witness modification.
-- GM permission check is enforced at the API layer in UpdatePostWitnesses.
--
-- Previously, this trigger raised an exception for all witness modifications
-- except unhide operations and initial submission. This caused a 500 error
-- when GMs tried to edit witnesses via the API.

CREATE OR REPLACE FUNCTION prevent_witness_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow unhide operation (empty -> populated)
  IF (OLD.witnesses = '{}' OR array_length(OLD.witnesses, 1) IS NULL) AND
     (NEW.witnesses != '{}' AND array_length(NEW.witnesses, 1) > 0) THEN
    RETURN NEW;
  END IF;

  -- Allow setting witnesses on initial submission (is_draft changes from true to false)
  IF OLD.is_draft = true AND NEW.is_draft = false THEN
    RETURN NEW;
  END IF;

  -- Allow any witness modification (GM check is at API layer)
  -- This removes the previous restriction that raised an exception
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
