-- Add alias field to campaign_members table
ALTER TABLE campaign_members 
ADD COLUMN alias TEXT;

-- Add comment explaining the alias
COMMENT ON COLUMN campaign_members.alias IS 'Out-of-character alias for the player, can be different from character names';
