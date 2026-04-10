-- ============================================================
-- EzTrips SaaS — Full Supabase Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- 1. users
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('agent', 'super_admin')),
  agency_name text,
  logo_url text,
  whatsapp_number text,
  default_currency text DEFAULT 'INR',
  default_payment_terms jsonb DEFAULT '{"deposit_pct": 25, "balance_days_before": 30}'::jsonb,
  margin_threshold_pct numeric DEFAULT 12,
  rounding_unit integer DEFAULT 0,
  tc_content text,
  tc_version integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 2. clients
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  nationality text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 3. suppliers
CREATE TABLE suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  type text CHECK (type IN ('DMC','hotel','airline','car','activity','other')),
  country text,
  contact_name text,
  contact_email text,
  contact_phone text,
  payment_terms_days integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 4. supplier_surcharges
CREATE TABLE supplier_surcharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES suppliers(id) ON DELETE CASCADE,
  label text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  surcharge_type text CHECK (surcharge_type IN ('per_night','flat','percent')),
  amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'INR',
  created_at timestamptz DEFAULT now()
);

-- 5. proposals
CREATE TABLE proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  parent_proposal_id uuid REFERENCES proposals(id) ON DELETE SET NULL,
  version integer DEFAULT 1,
  status text CHECK (status IN ('draft','sent','viewed','confirmed','cancelled')) DEFAULT 'draft',
  pricing_mode text CHECK (pricing_mode IN ('standard','tiered')) DEFAULT 'standard',

  -- Trip details
  title text,
  destination text,
  travel_start date,
  travel_end date,
  pax_adults integer DEFAULT 1,
  pax_children integer DEFAULT 0,
  children_ages integer[],
  currency text DEFAULT 'INR',
  special_notes text,
  dietary_notes text,

  -- Financial
  gst_enabled boolean DEFAULT false,
  gst_rate numeric DEFAULT 5,
  tcs_enabled boolean DEFAULT false,
  rounding_unit integer,
  discount_amount numeric(12,2) DEFAULT 0,
  discount_note text,

  -- Cover + image
  cover_image_url text,
  cover_image_source text CHECK (cover_image_source IN ('curated','ai_suggested','approved')),
  cover_image_approved_at timestamptz,
  cover_image_approved_by uuid REFERENCES users(id),

  -- Sharing + versioning
  share_token text UNIQUE,
  published_data jsonb,
  draft_data jsonb,
  draft_differs_from_published boolean DEFAULT false,

  -- Proposal-level terms
  payment_terms jsonb,
  tc_version integer,

  -- Compliance
  visa_check_source text DEFAULT 'static',
  visa_section_enabled boolean DEFAULT false,

  -- TTL
  flight_expires_at timestamptz,
  land_expires_at timestamptz,

  -- Tracking
  last_viewed_at timestamptz,
  view_count integer DEFAULT 0,
  confirmed_at timestamptz,
  confirmed_by text,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 6. proposal_versions
CREATE TABLE proposal_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot jsonb NOT NULL,
  published_at timestamptz DEFAULT now(),
  published_by uuid REFERENCES users(id)
);

-- 7. proposal_tiers
CREATE TABLE proposal_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  label text NOT NULL,
  pax_count integer NOT NULL,
  sort_order integer DEFAULT 0
);

-- 8. hotels
CREATE TABLE hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  tier_id uuid REFERENCES proposal_tiers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  name text NOT NULL,
  city text NOT NULL,
  check_in date NOT NULL,
  check_out date NOT NULL,
  nights integer GENERATED ALWAYS AS (check_out - check_in) STORED,
  room_type text,
  meal_plan text CHECK (meal_plan IN ('RO','BB','HB','FB','AI')),
  star_rating integer,
  room_view text,
  is_non_refundable boolean DEFAULT false,
  hotel_cancellation_slabs jsonb,

  cp_per_night numeric(12,2),
  sp_per_night numeric(12,2),
  cwb_cp numeric(12,2),
  cwb_sp numeric(12,2),
  cnb_cp numeric(12,2),
  cnb_sp numeric(12,2),

  description text,
  description_approved boolean DEFAULT false,

  early_checkin_requested boolean DEFAULT false,
  late_checkout_requested boolean DEFAULT false,

  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 9. flights
CREATE TABLE flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  tier_id uuid REFERENCES proposal_tiers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,

  flight_number text NOT NULL,
  airline text,
  origin_iata text,
  origin_city text,
  destination_iata text,
  destination_city text,
  departure_at timestamptz,
  arrival_at timestamptz,
  aircraft_type text,

  cabin_class text,
  baggage_allowance text,
  is_non_refundable boolean DEFAULT false,

  cp_total numeric(12,2),
  sp_total numeric(12,2),

  fare_expires_at timestamptz,

  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 10. itinerary_days
CREATE TABLE itinerary_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  date date NOT NULL,
  city text,
  heading text,
  description text,
  overnight_city text,
  created_at timestamptz DEFAULT now()
);

-- 11. itinerary_activities
CREATE TABLE itinerary_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_day_id uuid REFERENCES itinerary_days(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  tier_id uuid REFERENCES proposal_tiers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,

  type text CHECK (type IN ('transfer','sightseeing','meal','activity','free_time','other')),

  option_mode text CHECK (option_mode IN ('pvt_only','sic_only','tbd','dual')),
  client_choice text CHECK (client_choice IN ('pvt','sic')),
  confirmed_cp numeric(12,2),
  confirmed_sp numeric(12,2),
  confirmed_basis text CHECK (confirmed_basis IN ('per_vehicle','per_person')),

  pvt_cp numeric(12,2),
  pvt_sp numeric(12,2),
  pvt_basis text CHECK (pvt_basis IN ('per_vehicle','per_person')),
  pvt_vehicle_type text,

  sic_cp numeric(12,2),
  sic_sp numeric(12,2),
  sic_basis text CHECK (sic_basis IN ('per_vehicle','per_person')),

  start_time time,
  end_time time,
  location text,

  details jsonb,

  is_optional boolean DEFAULT false,
  show_in_pdf boolean DEFAULT true,
  conflict_flagged boolean DEFAULT false,
  conflict_acknowledged boolean DEFAULT false,
  conflict_note text,

  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 12. line_items
CREATE TABLE line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  tier_id uuid REFERENCES proposal_tiers(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  type text CHECK (type IN ('transfer','activity','visa','surcharge','other')),
  description text NOT NULL,
  date date,
  cp numeric(12,2) DEFAULT 0,
  sp numeric(12,2) DEFAULT 0,
  pricing_basis text CHECK (pricing_basis IN ('per_vehicle','per_person','flat')),
  is_optional boolean DEFAULT false,
  is_included boolean DEFAULT true,
  show_in_pdf boolean DEFAULT true,
  sort_order integer DEFAULT 0
);

-- 13. proposal_content_blocks
CREATE TABLE proposal_content_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  type text CHECK (type IN ('packing_list','weather','why_book_us','destination_highlights','insurance_upsell','lounge_upsell','custom')),
  content jsonb NOT NULL,
  is_included boolean DEFAULT false,
  created_by text CHECK (created_by IN ('ai','agent')),
  sort_order integer DEFAULT 0
);

-- 14. visa_compliance_rules
CREATE TABLE visa_compliance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_country text NOT NULL,
  nationality text NOT NULL,
  visa_required boolean DEFAULT false,
  visa_type text,
  passport_validity_months integer,
  transit_visa_note text,
  notes text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(destination_country, nationality)
);

-- 15. travel_time_cache
CREATE TABLE travel_time_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_a text NOT NULL,
  city_b text NOT NULL,
  country text,
  estimated_minutes integer NOT NULL,
  cached_at timestamptz DEFAULT now(),
  UNIQUE(city_a, city_b)
);

-- 16. receivables
CREATE TABLE receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  due_date date NOT NULL,
  status text CHECK (status IN ('pending','paid','overdue')) DEFAULT 'pending',
  paid_at timestamptz,
  payment_method text,
  razorpay_payment_id text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 17. payables
CREATE TABLE payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  description text NOT NULL,
  amount numeric(12,2) NOT NULL,
  due_date date NOT NULL,
  status text CHECK (status IN ('pending','paid','overdue')) DEFAULT 'pending',
  paid_at timestamptz,
  reference text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- 18. client_ledger (APPEND-ONLY)
CREATE TABLE client_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES proposals(id) ON DELETE SET NULL,
  type text CHECK (type IN ('credit','debit')) NOT NULL,
  amount numeric(12,2) NOT NULL,
  description text NOT NULL,
  reference text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- 19. forex_locks
CREATE TABLE forex_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  from_currency text NOT NULL,
  to_currency text DEFAULT 'INR',
  locked_rate numeric(12,6) NOT NULL,
  locked_at timestamptz DEFAULT now(),
  last_checked_at timestamptz,
  current_rate numeric(12,6),
  drift_pct numeric,
  alert_fired boolean DEFAULT false,
  UNIQUE(proposal_id, from_currency)
);

-- 20. raw_quotes
CREATE TABLE raw_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  source_type text CHECK (source_type IN ('pdf','excel','text')),
  file_url text,
  raw_text text,
  parsed_json jsonb,
  sanitisation_flags jsonb,
  created_at timestamptz DEFAULT now()
);

-- 21. proposal_acceptance_log (APPEND-ONLY)
CREATE TABLE proposal_acceptance_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  version integer NOT NULL,
  event_type text CHECK (event_type IN ('viewed','tc_accepted','visa_acknowledged','confirmed','addon_selected','tier_selected')),
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- 22. proposal_comments (APPEND-ONLY)
CREATE TABLE proposal_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  message text NOT NULL,
  mentions uuid[],
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_clients_created_by ON clients(created_by);
CREATE INDEX idx_clients_full_name ON clients(full_name);
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_email ON clients(email);

CREATE INDEX idx_suppliers_created_by ON suppliers(created_by);
CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_suppliers_type ON suppliers(type);

CREATE INDEX idx_supplier_surcharges_supplier ON supplier_surcharges(supplier_id);
CREATE INDEX idx_supplier_surcharges_dates ON supplier_surcharges(start_date, end_date);

CREATE INDEX idx_proposals_created_by ON proposals(created_by);
CREATE INDEX idx_proposals_client_id ON proposals(client_id);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_share_token ON proposals(share_token);
CREATE INDEX idx_proposals_destination ON proposals(destination);

CREATE INDEX idx_proposal_versions_proposal ON proposal_versions(proposal_id);
CREATE INDEX idx_proposal_tiers_proposal ON proposal_tiers(proposal_id);

CREATE INDEX idx_hotels_proposal ON hotels(proposal_id);
CREATE INDEX idx_flights_proposal ON flights(proposal_id);
CREATE INDEX idx_itinerary_days_proposal ON itinerary_days(proposal_id);
CREATE INDEX idx_itinerary_activities_day ON itinerary_activities(itinerary_day_id);
CREATE INDEX idx_itinerary_activities_proposal ON itinerary_activities(proposal_id);
CREATE INDEX idx_line_items_proposal ON line_items(proposal_id);

CREATE INDEX idx_proposal_content_blocks_proposal ON proposal_content_blocks(proposal_id);

CREATE INDEX idx_receivables_proposal ON receivables(proposal_id);
CREATE INDEX idx_receivables_client ON receivables(client_id);
CREATE INDEX idx_receivables_status ON receivables(status);

CREATE INDEX idx_payables_proposal ON payables(proposal_id);
CREATE INDEX idx_payables_supplier ON payables(supplier_id);
CREATE INDEX idx_payables_status ON payables(status);

CREATE INDEX idx_client_ledger_client ON client_ledger(client_id);
CREATE INDEX idx_client_ledger_proposal ON client_ledger(proposal_id);

CREATE INDEX idx_forex_locks_proposal ON forex_locks(proposal_id);
CREATE INDEX idx_raw_quotes_proposal ON raw_quotes(proposal_id);
CREATE INDEX idx_acceptance_log_proposal ON proposal_acceptance_log(proposal_id);
CREATE INDEX idx_comments_proposal ON proposal_comments(proposal_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- APPEND-ONLY ENFORCEMENT
-- ============================================================

-- client_ledger: no UPDATE or DELETE
CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'client_ledger is append-only. UPDATE and DELETE are not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_client_ledger_append_only_update
  BEFORE UPDATE ON client_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

CREATE TRIGGER enforce_client_ledger_append_only_delete
  BEFORE DELETE ON client_ledger
  FOR EACH ROW
  EXECUTE FUNCTION prevent_ledger_modification();

-- proposal_acceptance_log: no UPDATE or DELETE
CREATE OR REPLACE FUNCTION prevent_acceptance_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'proposal_acceptance_log is append-only. UPDATE and DELETE are not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_acceptance_log_append_only_update
  BEFORE UPDATE ON proposal_acceptance_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_acceptance_log_modification();

CREATE TRIGGER enforce_acceptance_log_append_only_delete
  BEFORE DELETE ON proposal_acceptance_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_acceptance_log_modification();

-- proposal_comments: no UPDATE or DELETE
CREATE OR REPLACE FUNCTION prevent_comments_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'proposal_comments is append-only. UPDATE and DELETE are not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_comments_append_only_update
  BEFORE UPDATE ON proposal_comments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_comments_modification();

CREATE TRIGGER enforce_comments_append_only_delete
  BEFORE DELETE ON proposal_comments
  FOR EACH ROW
  EXECUTE FUNCTION prevent_comments_modification();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_surcharges ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE itinerary_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE forex_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_acceptance_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_comments ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Users: see own profile, super_admin sees all
CREATE POLICY users_select ON users FOR SELECT
  USING (id = auth.uid() OR is_super_admin());
CREATE POLICY users_update ON users FOR UPDATE
  USING (id = auth.uid() OR is_super_admin());

-- Clients: agents see own, super_admin sees all
CREATE POLICY clients_select ON clients FOR SELECT
  USING (created_by = auth.uid() OR is_super_admin());
CREATE POLICY clients_insert ON clients FOR INSERT
  WITH CHECK (created_by = auth.uid() OR is_super_admin());
CREATE POLICY clients_update ON clients FOR UPDATE
  USING (created_by = auth.uid() OR is_super_admin());
CREATE POLICY clients_delete ON clients FOR DELETE
  USING (created_by = auth.uid() OR is_super_admin());

-- Suppliers: agents see own, super_admin sees all
CREATE POLICY suppliers_select ON suppliers FOR SELECT
  USING (created_by = auth.uid() OR is_super_admin());
CREATE POLICY suppliers_insert ON suppliers FOR INSERT
  WITH CHECK (created_by = auth.uid() OR is_super_admin());
CREATE POLICY suppliers_update ON suppliers FOR UPDATE
  USING (created_by = auth.uid() OR is_super_admin());
CREATE POLICY suppliers_delete ON suppliers FOR DELETE
  USING (created_by = auth.uid() OR is_super_admin());

-- Supplier surcharges: through supplier ownership
CREATE POLICY surcharges_select ON supplier_surcharges FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM suppliers WHERE suppliers.id = supplier_id
    AND (suppliers.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY surcharges_insert ON supplier_surcharges FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM suppliers WHERE suppliers.id = supplier_id
    AND (suppliers.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY surcharges_update ON supplier_surcharges FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM suppliers WHERE suppliers.id = supplier_id
    AND (suppliers.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY surcharges_delete ON supplier_surcharges FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM suppliers WHERE suppliers.id = supplier_id
    AND (suppliers.created_by = auth.uid() OR is_super_admin())
  ));

-- Proposals: agents see own, super_admin sees all
CREATE POLICY proposals_select ON proposals FOR SELECT
  USING (created_by = auth.uid() OR is_super_admin());
CREATE POLICY proposals_insert ON proposals FOR INSERT
  WITH CHECK (created_by = auth.uid() OR is_super_admin());
CREATE POLICY proposals_update ON proposals FOR UPDATE
  USING (created_by = auth.uid() OR is_super_admin());
CREATE POLICY proposals_delete ON proposals FOR DELETE
  USING (created_by = auth.uid() OR is_super_admin());

-- Proposal child tables: through proposal ownership
CREATE POLICY versions_select ON proposal_versions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY versions_insert ON proposal_versions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));

CREATE POLICY tiers_select ON proposal_tiers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY tiers_insert ON proposal_tiers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY tiers_update ON proposal_tiers FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY tiers_delete ON proposal_tiers FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));

-- Hotels
CREATE POLICY hotels_select ON hotels FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY hotels_insert ON hotels FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY hotels_update ON hotels FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY hotels_delete ON hotels FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));

-- Flights
CREATE POLICY flights_select ON flights FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY flights_insert ON flights FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY flights_update ON flights FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY flights_delete ON flights FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));

-- Itinerary days
CREATE POLICY days_select ON itinerary_days FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY days_insert ON itinerary_days FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY days_update ON itinerary_days FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY days_delete ON itinerary_days FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));

-- Itinerary activities
CREATE POLICY activities_select ON itinerary_activities FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY activities_insert ON itinerary_activities FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY activities_update ON itinerary_activities FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY activities_delete ON itinerary_activities FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));

-- Line items
CREATE POLICY line_items_select ON line_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY line_items_insert ON line_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY line_items_update ON line_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY line_items_delete ON line_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));

-- Content blocks
CREATE POLICY content_blocks_select ON proposal_content_blocks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY content_blocks_insert ON proposal_content_blocks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY content_blocks_update ON proposal_content_blocks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY content_blocks_delete ON proposal_content_blocks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));

-- Receivables
CREATE POLICY receivables_select ON receivables FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY receivables_insert ON receivables FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY receivables_update ON receivables FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));

-- Payables
CREATE POLICY payables_select ON payables FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY payables_insert ON payables FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY payables_update ON payables FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));

-- Client ledger (insert only via RLS, append-only enforced by trigger)
CREATE POLICY ledger_select ON client_ledger FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM clients WHERE clients.id = client_id
    AND (clients.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY ledger_insert ON client_ledger FOR INSERT
  WITH CHECK (created_by = auth.uid() OR is_super_admin());

-- Forex locks
CREATE POLICY forex_select ON forex_locks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY forex_insert ON forex_locks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY forex_update ON forex_locks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));

-- Raw quotes
CREATE POLICY raw_quotes_select ON raw_quotes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY raw_quotes_insert ON raw_quotes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));

-- Acceptance log (insert-only for public share link)
CREATE POLICY acceptance_log_select ON proposal_acceptance_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY acceptance_log_insert ON proposal_acceptance_log FOR INSERT
  WITH CHECK (true); -- public share link can insert

-- Comments
CREATE POLICY comments_select ON proposal_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM proposals WHERE proposals.id = proposal_id
    AND (proposals.created_by = auth.uid() OR is_super_admin())
  ));
CREATE POLICY comments_insert ON proposal_comments FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_super_admin());

-- Visa compliance rules: readable by all authenticated users
ALTER TABLE visa_compliance_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY visa_rules_select ON visa_compliance_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY visa_rules_manage ON visa_compliance_rules FOR ALL
  USING (is_super_admin());

-- Travel time cache: readable by all authenticated users
ALTER TABLE travel_time_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY travel_time_select ON travel_time_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE POLICY travel_time_insert ON travel_time_cache FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
