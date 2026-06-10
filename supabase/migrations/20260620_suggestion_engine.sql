-- Suggestion Engine: route metadata columns, backfill, RPC, and indexes

-- 1. Add columns
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS cities_visited text[];
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS route_signature text;

-- 2. Backfill existing sent proposals from trip_cities JSONB
UPDATE proposals
SET
  cities_visited = sub.cities,
  route_signature = sub.sig
FROM (
  SELECT
    p.id,
    (SELECT array_agg(DISTINCT elem->>'city')
     FROM jsonb_array_elements(p.trip_cities) elem
     WHERE elem->>'city' IS NOT NULL) AS cities,
    (SELECT string_agg(tc.city || ':' || tc.nights, ',' ORDER BY tc.rn)
     FROM (
       SELECT e->>'city' AS city, e->>'nights' AS nights, row_number() OVER () AS rn
       FROM jsonb_array_elements(p.trip_cities) AS e
     ) tc
     WHERE tc.city IS NOT NULL) AS sig
  FROM proposals p
  WHERE p.status = 'sent' AND p.trip_cities IS NOT NULL
) sub
WHERE proposals.id = sub.id;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_proposals_cities_visited
  ON proposals USING gin (cities_visited)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS idx_proposals_suggestion_lookup
  ON proposals (destination, status)
  WHERE status = 'sent' AND route_signature IS NOT NULL;

-- 4. RPC: find similar proposals
CREATE OR REPLACE FUNCTION find_similar_proposals(
  p_destination text,
  p_duration int DEFAULT NULL,
  p_cities text[] DEFAULT '{}'::text[]
)
RETURNS TABLE (
  id uuid,
  title text,
  destination text,
  route_signature text,
  trip_cities jsonb,
  published_data jsonb,
  cities_visited text[],
  match_type text,
  created_at timestamptz
)
LANGUAGE sql STABLE AS $$
  (
    -- Branch A: cities provided → exact bidirectional match
    SELECT
      p.id, p.title, p.destination, p.route_signature, p.trip_cities,
      p.published_data, p.cities_visited,
      'exact'::text AS match_type,
      p.created_at
    FROM proposals p
    WHERE array_length(p_cities, 1) > 0
      AND p.status = 'sent'
      AND p.destination ILIKE p_destination
      AND p.cities_visited @> p_cities
      AND p.cities_visited <@ p_cities
      AND p.published_data IS NOT NULL
    ORDER BY p.created_at DESC
    LIMIT 10
  )

  UNION ALL

  (
    -- Branch B: no cities → distinct route signatures
    SELECT DISTINCT ON (sub.route_signature)
      sub.*
    FROM (
      SELECT
        p.id, p.title, p.destination, p.route_signature, p.trip_cities,
        p.published_data, p.cities_visited,
        'route'::text AS match_type,
        p.created_at
      FROM proposals p
      WHERE (array_length(p_cities, 1) IS NULL OR array_length(p_cities, 1) = 0)
        AND p.status = 'sent'
        AND p.destination ILIKE p_destination
        AND p.route_signature IS NOT NULL
        AND p.published_data IS NOT NULL
      ORDER BY p.route_signature, p.created_at DESC
    ) sub
    LIMIT 10
  );
$$;
