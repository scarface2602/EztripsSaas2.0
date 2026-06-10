ALTER TABLE website_packages
  ADD COLUMN IF NOT EXISTS terms text,
  ADD COLUMN IF NOT EXISTS price_valid_from date,
  ADD COLUMN IF NOT EXISTS price_valid_to date,
  ADD COLUMN IF NOT EXISTS gallery text[];

-- Create storage bucket for website images
INSERT INTO storage.buckets (id, name, public) VALUES ('website-images', 'website-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public read website-images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'website-images');

-- Allow authenticated users to upload
CREATE POLICY "Auth upload website-images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'website-images');
CREATE POLICY "Auth update website-images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'website-images');
CREATE POLICY "Auth delete website-images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'website-images');
