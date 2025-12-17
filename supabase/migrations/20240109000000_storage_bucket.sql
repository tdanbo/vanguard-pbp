-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================
-- Creates the campaign-assets bucket for storing
-- character avatars and scene header images.

-- Create the campaign-assets storage bucket with public access
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaign-assets', 'campaign-assets', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- STORAGE POLICIES
-- ============================================

-- Allow authenticated users to upload to campaign-assets bucket
-- (Backend uses service role key, but this covers direct Supabase client usage if needed)
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'campaign-assets');

-- Allow public read access to all files in campaign-assets
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'campaign-assets');

-- Allow authenticated users to update their uploads
CREATE POLICY "Allow authenticated updates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'campaign-assets');

-- Allow authenticated users to delete their uploads
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'campaign-assets');
