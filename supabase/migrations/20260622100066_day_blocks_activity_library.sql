-- ============================================================
-- Multi-block itinerary days + reusable activity library
--
-- A day can hold several blocks (internal flight + evening tour, two
-- tours, etc.). Blocks live in the existing itinerary_activities table
-- (title/description in its details JSONB); 'flight' joins its type
-- CHECK for internal-flight blocks.
--
-- activity_library makes blocks reusable across proposals: "Nusa Penida
-- West Tour — same day from Bali" is typed once with its full
-- description, then searched and dropped into any future itinerary.
-- ============================================================

ALTER TABLE itinerary_activities DROP CONSTRAINT IF EXISTS itinerary_activities_type_check;
ALTER TABLE itinerary_activities ADD CONSTRAINT itinerary_activities_type_check
  CHECK (type IN ('transfer', 'sightseeing', 'meal', 'activity', 'free_time', 'flight', 'other'));

CREATE TABLE activity_library (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'activity'
    CHECK (type IN ('transfer', 'sightseeing', 'meal', 'activity', 'free_time', 'flight', 'other')),
  city_id bigint REFERENCES geo_cities(id),
  city_name text,
  description text,
  default_transfer_mode text CHECK (default_transfer_mode IN ('SIC', 'PVT')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_library_name_trgm
  ON activity_library USING gin (name gin_trgm_ops);
CREATE INDEX activity_library_city_idx ON activity_library (city_id);

ALTER TABLE activity_library ENABLE ROW LEVEL SECURITY;

-- Org-shared: anyone signed in can read, add, and refine entries.
CREATE POLICY activity_library_read ON activity_library
  FOR SELECT TO authenticated USING (true);
CREATE POLICY activity_library_insert ON activity_library
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY activity_library_update ON activity_library
  FOR UPDATE TO authenticated USING (true);
