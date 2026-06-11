-- ============================================================
-- Proposal Builder v2 schema
--
-- Cities-first structure + price groups. Three tables replace the
-- old hotels/flights/line_items split for NEW proposals (old tables
-- stay for existing proposals until they're migrated):
--
--   proposal_destinations — ordered (city, nights). This IS the trip
--     structure; stay slots derive from it, so structure/hotel night
--     mismatches are impossible by construction.
--   proposal_price_groups — one price tag (cost + markup = sell).
--     A DMC lump-sum quote is one group covering many unpriced items.
--   proposal_items — every component (hotel/flight/transfer/activity/
--     visa/other). Priced via its group, or self-priced when
--     price_group_id is NULL and sell_amount is set. provider/
--     provider_ref/provider_payload keep the schema API-ready
--     (LiteAPI/Duffel now, TBO/Tripjack later) without changes.
-- ============================================================

CREATE TABLE proposal_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  city_id bigint REFERENCES geo_cities(id),
  city_name text NOT NULL,              -- denormalised display name
  country_code text REFERENCES geo_countries(code),
  nights integer NOT NULL DEFAULT 1 CHECK (nights >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX proposal_destinations_proposal_idx
  ON proposal_destinations (proposal_id, sort_order);

CREATE TABLE proposal_price_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  name text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  cost_amount numeric(12,2) NOT NULL DEFAULT 0,
  markup_type text NOT NULL DEFAULT 'percent'
    CHECK (markup_type IN ('percent','flat')),
  markup_value numeric(12,2) NOT NULL DEFAULT 0,
  sell_amount numeric(12,2) NOT NULL DEFAULT 0,
  quoted_cost numeric(12,2),            -- frozen at publish, never edited after
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX proposal_price_groups_proposal_idx
  ON proposal_price_groups (proposal_id, sort_order);

CREATE TABLE proposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  destination_id uuid REFERENCES proposal_destinations(id) ON DELETE SET NULL,
  price_group_id uuid REFERENCES proposal_price_groups(id) ON DELETE SET NULL,
  item_type text NOT NULL
    CHECK (item_type IN ('hotel','flight','transfer','activity','visa','other')),
  title text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',  -- type-specific: room_type, meal_plan,
                                        -- flight numbers, pickup points, ...
  hotel_directory_id bigint REFERENCES hotel_directory(id),
  check_in date,
  check_out date,
  nights integer,
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual','directory','api')),
  provider text,                        -- 'liteapi' | 'duffel' | 'tbo' | ...
  provider_ref text,
  provider_payload jsonb,
  cost_amount numeric(12,2),            -- self-priced items only (no group)
  sell_amount numeric(12,2),
  quoted_cost numeric(12,2),            -- frozen at publish for self-priced items
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX proposal_items_proposal_idx
  ON proposal_items (proposal_id, sort_order);
CREATE INDEX proposal_items_group_idx ON proposal_items (price_group_id);

-- v2 marker so the app knows which editor/share renderer to use.
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS builder_version integer NOT NULL DEFAULT 1;

ALTER TABLE proposal_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_price_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_items ENABLE ROW LEVEL SECURITY;

-- Same ownership chain as the other proposal child tables.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['proposal_destinations','proposal_price_groups','proposal_items'] LOOP
    EXECUTE format($f$
      CREATE POLICY %1$s_select ON %1$s FOR SELECT
        USING (EXISTS (SELECT 1 FROM proposals WHERE proposals.id = proposal_id
          AND (proposals.created_by = auth.uid() OR is_super_admin())));
      CREATE POLICY %1$s_insert ON %1$s FOR INSERT
        WITH CHECK (EXISTS (SELECT 1 FROM proposals WHERE proposals.id = proposal_id
          AND (proposals.created_by = auth.uid() OR is_super_admin())));
      CREATE POLICY %1$s_update ON %1$s FOR UPDATE
        USING (EXISTS (SELECT 1 FROM proposals WHERE proposals.id = proposal_id
          AND (proposals.created_by = auth.uid() OR is_super_admin())));
      CREATE POLICY %1$s_delete ON %1$s FOR DELETE
        USING (EXISTS (SELECT 1 FROM proposals WHERE proposals.id = proposal_id
          AND (proposals.created_by = auth.uid() OR is_super_admin())));
    $f$, t);
  END LOOP;
END $$;
