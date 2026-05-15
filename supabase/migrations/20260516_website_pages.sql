-- Website pages table for CMS-managed pages
CREATE TABLE IF NOT EXISTS website_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  content text DEFAULT '',
  hero_image text,
  seo_title text,
  seo_description text,
  published boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE website_pages ENABLE ROW LEVEL SECURITY;

-- Public read for published pages
CREATE POLICY "Public can read published pages"
  ON website_pages FOR SELECT
  USING (published = true);

-- Authenticated users can manage
CREATE POLICY "Authenticated users can manage pages"
  ON website_pages FOR ALL
  USING (auth.role() = 'authenticated');

-- Index for slug lookups
CREATE INDEX idx_website_pages_slug ON website_pages(slug);
CREATE INDEX idx_website_pages_published ON website_pages(published);
