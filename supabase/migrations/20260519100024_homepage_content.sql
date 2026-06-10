-- Homepage editable content blocks
CREATE TABLE IF NOT EXISTS website_homepage_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,  -- 'hero', 'testimonials', 'featured_itineraries', 'experience_cards'
  content jsonb NOT NULL DEFAULT '{}',
  sort_order integer DEFAULT 0,
  published boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE website_homepage_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read published" ON website_homepage_content FOR SELECT USING (published = true);
CREATE POLICY "Auth manage" ON website_homepage_content FOR ALL TO authenticated USING (true) WITH CHECK (true);
