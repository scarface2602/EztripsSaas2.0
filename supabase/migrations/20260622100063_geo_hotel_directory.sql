-- ============================================================
-- Geo + hotel directory backbone (Proposal Builder v2)
--
-- Replaces free-text cities and the lookup_items('city') stopgap with
-- real geography imported from the agent's hotel database extract:
--   geo_countries  (~137 rows)  — full worldwide list
--   geo_cities     (~40k rows)  — full worldwide list
--   hotel_directory (~500k rows)— hotels for selling markets only;
--                                 also receives inline-added hotels.
-- Imported rows are global (created_by NULL); inline additions carry
-- created_by and are visible to everyone in the org. Free-tier
-- Supabase: indexes kept to the two the search APIs actually hit.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE geo_countries (
  code text PRIMARY KEY,                -- ISO-2
  name text NOT NULL UNIQUE
);

CREATE TABLE geo_cities (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  country_code text NOT NULL REFERENCES geo_countries(code),
  name text NOT NULL,
  state_region text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  source text NOT NULL DEFAULT 'import' CHECK (source IN ('import','inline')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Plain-column unique so PostgREST upserts can target it; the import
-- script and inline-add API dedupe case-insensitively before insert.
ALTER TABLE geo_cities ADD CONSTRAINT geo_cities_country_name_key
  UNIQUE (country_code, name);
CREATE INDEX geo_cities_name_trgm
  ON geo_cities USING gin (name gin_trgm_ops);

CREATE TABLE hotel_directory (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL DEFAULT 'import' CHECK (source IN ('import','inline','api')),
  source_hotel_id text,                 -- id in the source file / provider ref
  name text NOT NULL,
  country_code text REFERENCES geo_countries(code),
  city_id bigint REFERENCES geo_cities(id),
  city_name text,                       -- denormalised; survives unresolved city links
  address text,
  postal_code text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  star_rating smallint CHECK (star_rating BETWEEN 1 AND 5),
  chain_brand text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX hotel_directory_name_trgm
  ON hotel_directory USING gin (name gin_trgm_ops);
CREATE INDEX hotel_directory_city_idx ON hotel_directory (city_id);
-- city-scoped searches filter by city then match name, so the trgm
-- index plus this btree cover both search shapes.

-- Idempotent re-import support: one row per (source, source id).
-- Inline/api rows may carry NULL source_hotel_id (never conflicts).
ALTER TABLE hotel_directory ADD CONSTRAINT hotel_directory_source_key
  UNIQUE (source, source_hotel_id);

ALTER TABLE geo_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_directory ENABLE ROW LEVEL SECURITY;

-- Reference data: every signed-in user can read everything.
CREATE POLICY geo_countries_read ON geo_countries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY geo_cities_read ON geo_cities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY hotel_directory_read ON hotel_directory
  FOR SELECT TO authenticated USING (true);

-- Inline additions from the builder (imports go through the service role).
CREATE POLICY geo_cities_inline_insert ON geo_cities
  FOR INSERT TO authenticated
  WITH CHECK (source = 'inline' AND created_by = auth.uid());
CREATE POLICY hotel_directory_inline_insert ON hotel_directory
  FOR INSERT TO authenticated
  WITH CHECK (source = 'inline' AND created_by = auth.uid());
