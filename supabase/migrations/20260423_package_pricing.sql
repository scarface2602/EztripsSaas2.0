-- Add hotel-tier pricing and link packages to destinations
ALTER TABLE website_packages
  ADD COLUMN IF NOT EXISTS price_3star numeric,
  ADD COLUMN IF NOT EXISTS price_4star numeric,
  ADD COLUMN IF NOT EXISTS price_5star numeric,
  ADD COLUMN IF NOT EXISTS destination_slug text REFERENCES website_destinations(slug),
  ADD COLUMN IF NOT EXISTS nights integer;

CREATE INDEX IF NOT EXISTS idx_website_packages_destination ON website_packages(destination_slug);
