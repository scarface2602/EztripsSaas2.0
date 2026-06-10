ALTER TABLE website_packages
  ADD COLUMN IF NOT EXISTS sample_hotels jsonb;
