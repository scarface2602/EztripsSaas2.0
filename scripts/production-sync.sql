-- ============================================================
-- EzTrips PRODUCTION SYNC — v2, built against the live schema
--
-- Run this whole file once in the Supabase SQL editor.
-- Idempotent: safe to re-run.
--
-- The live DB (cloned from the original project) already has:
--   trips, trip_sequences, trip_id columns, invoices, vouchers,
--   booking_packages/payments, customer_payments, enquiry_activities.
-- It is MISSING (and this script adds):
--   receipts, payment_links, booking_payments, scheduled_reminders,
--   webhook_events, document_sequences, query_id, SLA columns,
--   quoted-cost columns, price-lock columns, check-in/out columns,
--   the 'dmc_package' item type, and several functions/triggers.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 0. Shared helper functions
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(
    (SELECT role = 'super_admin' FROM public.users WHERE id = auth.uid()),
    false
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION next_trip_sequence(period_key text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  next_val integer;
BEGIN
  INSERT INTO trip_sequences (period_key, last_seq)
  VALUES (period_key, 1)
  ON CONFLICT (period_key) DO UPDATE
    SET last_seq = trip_sequences.last_seq + 1
  RETURNING last_seq INTO next_val;
  RETURN next_val;
END;
$$;


-- ────────────────────────────────────────────────────────────
-- 1. booking_items repairs
--    a) 'dmc_package' is inserted by the booking engine for DMC land
--       packages but the live CHECK constraint doesn't allow it.
--    b) check-in/check-out columns used by the operations workflow.
-- ────────────────────────────────────────────────────────────

ALTER TABLE booking_items DROP CONSTRAINT IF EXISTS booking_items_item_type_check;
ALTER TABLE booking_items ADD CONSTRAINT booking_items_item_type_check
  CHECK (item_type = ANY (ARRAY[
    'flight_segment'::text, 'hotel_room'::text, 'transfer'::text,
    'activity'::text, 'meal_plan'::text, 'vehicle'::text, 'dmc_package'::text
  ]));

ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS checked_out_at timestamptz;

-- Quoted-vs-actual cost baseline (frozen "as sold" values).
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS quoted_cost numeric(12,2);
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS quoted_vendor_name text;

UPDATE booking_items SET quoted_cost = cost_price WHERE quoted_cost IS NULL;
UPDATE booking_items SET quoted_vendor_name = vendor_name WHERE quoted_vendor_name IS NULL;

CREATE OR REPLACE FUNCTION set_booking_item_quoted_baseline()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quoted_cost IS NULL THEN
    NEW.quoted_cost := NEW.cost_price;
  END IF;
  IF NEW.quoted_vendor_name IS NULL THEN
    NEW.quoted_vendor_name := NEW.vendor_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_items_quoted_baseline ON booking_items;
CREATE TRIGGER trg_booking_items_quoted_baseline
  BEFORE INSERT ON booking_items
  FOR EACH ROW
  EXECUTE FUNCTION set_booking_item_quoted_baseline();


-- ────────────────────────────────────────────────────────────
-- 2. Missing feature tables the app already depends on
-- ────────────────────────────────────────────────────────────

-- 2a. booking_payments (Razorpay webhook + financials write here)
CREATE TABLE IF NOT EXISTS booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  installment_label text,
  installment_number integer DEFAULT 1,
  amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'INR',
  due_date date,
  paid_date date,
  payment_mode text,
  reference_number text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','overdue','cancelled')),
  reminder_sent_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_payments_booking ON booking_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_payments_due_date ON booking_payments(due_date);
CREATE INDEX IF NOT EXISTS idx_booking_payments_status ON booking_payments(status);

ALTER TABLE booking_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "booking_payments_all" ON booking_payments;
CREATE POLICY "booking_payments_all" ON booking_payments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_payments.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_payments.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin())));

-- Keep bookings.total_paid / next_payment_* in sync
CREATE OR REPLACE FUNCTION refresh_booking_next_payment()
RETURNS TRIGGER AS $$
DECLARE
  target_booking_id uuid;
BEGIN
  target_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);
  UPDATE bookings
  SET
    total_paid = COALESCE((
      SELECT SUM(amount) FROM booking_payments
      WHERE booking_id = target_booking_id AND status = 'paid'
    ), 0),
    next_payment_date = (
      SELECT MIN(due_date) FROM booking_payments
      WHERE booking_id = target_booking_id AND status = 'pending' AND due_date IS NOT NULL
    ),
    next_payment_amount = (
      SELECT amount FROM booking_payments
      WHERE booking_id = target_booking_id AND status = 'pending' AND due_date IS NOT NULL
      ORDER BY due_date ASC LIMIT 1
    )
  WHERE id = target_booking_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_booking_payment_summary ON booking_payments;
CREATE TRIGGER update_booking_payment_summary
  AFTER INSERT OR UPDATE OR DELETE ON booking_payments
  FOR EACH ROW EXECUTE FUNCTION refresh_booking_next_payment();

-- 2b. payment_links (client payment collection, incl. fare differences)
CREATE TABLE IF NOT EXISTS payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  amount numeric(12,2) NOT NULL,
  currency text DEFAULT 'INR',
  label text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired')),
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  used_at timestamptz
);

-- Link type: regular collection vs fare-difference re-consent.
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS link_type text NOT NULL DEFAULT 'payment'
  CHECK (link_type IN ('payment', 'fare_difference'));
ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS reason text;

CREATE INDEX IF NOT EXISTS idx_payment_links_token ON payment_links(token);

ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_links_all" ON payment_links;
CREATE POLICY "payment_links_all" ON payment_links
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = payment_links.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = payment_links.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin())));

-- 2c. receipts
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  receipt_number text UNIQUE NOT NULL,
  amount numeric(12,2) NOT NULL,
  payment_mode text,
  payment_date date NOT NULL,
  balance_remaining numeric(12,2) DEFAULT 0,
  pdf_url text,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_booking ON receipts(booking_id);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "receipts_all" ON receipts;
CREATE POLICY "receipts_all" ON receipts
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = receipts.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = receipts.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin())));

-- 2d. scheduled_reminders (deferred email queue) — includes the new
--     'flight_ticketing' type used by consent-then-capture.
CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  booking_item_id uuid REFERENCES booking_items(id) ON DELETE CASCADE,
  reminder_type text NOT NULL,
  send_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scheduled_reminders DROP CONSTRAINT IF EXISTS scheduled_reminders_reminder_type_check;
ALTER TABLE scheduled_reminders ADD CONSTRAINT scheduled_reminders_reminder_type_check
  CHECK (reminder_type IN ('payment_due','supplier_followup','booking_confirmed','flight_ticketing'));

CREATE INDEX IF NOT EXISTS idx_reminders_pending ON scheduled_reminders(status, send_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_reminders_booking ON scheduled_reminders(booking_id);

ALTER TABLE scheduled_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reminders_all" ON scheduled_reminders;
CREATE POLICY "reminders_all" ON scheduled_reminders
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = scheduled_reminders.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM bookings WHERE bookings.id = scheduled_reminders.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin())));

-- 2e. Webhook idempotency ledger (service-role only — no policies)
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'razorpay',
  event_id text NOT NULL,
  event_type text,
  payload jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_webhook_events_provider_event UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events(processed_at);
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;


-- ────────────────────────────────────────────────────────────
-- 3. Trip-ID unification (trips & trip_id columns already exist)
-- ────────────────────────────────────────────────────────────

ALTER TABLE website_enquiries ADD COLUMN IF NOT EXISTS query_id text;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_enquiries_trip_id ON website_enquiries(trip_id);
CREATE INDEX IF NOT EXISTS idx_proposals_trip_id ON proposals(trip_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON bookings(trip_id);

-- Enquiry trigger: one trip_id at birth, query_id as alias,
-- trips master row created immediately.
CREATE OR REPLACE FUNCTION generate_enquiry_query_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_str text;
  v_type_str text;
  v_seq integer;
BEGIN
  IF NEW.trip_id IS NULL THEN
    v_type_str := CASE COALESCE(NEW.requirement_type, 'package')
      WHEN 'package'  THEN 'PKG'
      WHEN 'flight'   THEN 'FLT'
      WHEN 'hotel'    THEN 'HTL'
      WHEN 'transfer' THEN 'TRF'
      WHEN 'visa'     THEN 'VIS'
      ELSE 'PKG'
    END;
    v_date_str := to_char(timezone('Asia/Kolkata', COALESCE(NEW.created_at, now())), 'YYMMDD');
    v_seq := next_trip_sequence(v_date_str);
    NEW.trip_id := 'EZQ' || v_type_str || v_date_str || lpad(v_seq::text, 3, '0');
  END IF;

  NEW.query_id := COALESCE(NEW.query_id, NEW.trip_id);

  INSERT INTO trips (trip_id, status, destination, created_at)
  VALUES (NEW.trip_id, 'ENQUIRY', NEW.destination, COALESCE(NEW.created_at, now()))
  ON CONFLICT (trip_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_before_insert_website_enquiries ON website_enquiries;
CREATE TRIGGER trigger_before_insert_website_enquiries
  BEFORE INSERT ON website_enquiries
  FOR EACH ROW
  EXECUTE FUNCTION generate_enquiry_query_id();

-- Backfill: every existing enquiry gets a trip_id (chronological order).
DO $$
DECLARE
  r RECORD;
  v_type_str text;
  v_date_str text;
  v_seq integer;
BEGIN
  FOR r IN
    SELECT id, created_at, requirement_type
    FROM website_enquiries
    WHERE trip_id IS NULL
    ORDER BY created_at ASC
  LOOP
    v_type_str := CASE COALESCE(r.requirement_type, 'package')
      WHEN 'package'  THEN 'PKG'
      WHEN 'flight'   THEN 'FLT'
      WHEN 'hotel'    THEN 'HTL'
      WHEN 'transfer' THEN 'TRF'
      WHEN 'visa'     THEN 'VIS'
      ELSE 'PKG'
    END;
    v_date_str := to_char(timezone('Asia/Kolkata', COALESCE(r.created_at, now())), 'YYMMDD');
    v_seq := next_trip_sequence(v_date_str);
    UPDATE website_enquiries
    SET trip_id = 'EZQ' || v_type_str || v_date_str || lpad(v_seq::text, 3, '0')
    WHERE id = r.id;
  END LOOP;
END $$;

UPDATE website_enquiries SET query_id = trip_id WHERE query_id IS NULL AND trip_id IS NOT NULL;

UPDATE proposals p
SET trip_id = e.trip_id
FROM website_enquiries e
WHERE p.enquiry_id = e.id AND p.trip_id IS NULL AND e.trip_id IS NOT NULL;

UPDATE bookings b
SET trip_id = p.trip_id
FROM proposals p
WHERE b.proposal_id = p.id AND b.trip_id IS NULL AND p.trip_id IS NOT NULL;

-- Master rows for every trip_id in use, at the furthest stage reached.
INSERT INTO trips (trip_id, status, destination, created_at)
SELECT DISTINCT ON (e.trip_id) e.trip_id, 'ENQUIRY', e.destination, e.created_at
FROM website_enquiries e
WHERE e.trip_id IS NOT NULL
ON CONFLICT (trip_id) DO NOTHING;

INSERT INTO trips (trip_id, status, client_id, destination, travel_start, travel_end, created_at)
SELECT DISTINCT ON (p.trip_id) p.trip_id, 'PROPOSING', p.client_id, p.destination, p.travel_start, p.travel_end, p.created_at
FROM proposals p
WHERE p.trip_id IS NOT NULL
ON CONFLICT (trip_id) DO NOTHING;

UPDATE trips t SET status = 'PROPOSING'
WHERE t.status = 'ENQUIRY'
  AND EXISTS (SELECT 1 FROM proposals p WHERE p.trip_id = t.trip_id);

INSERT INTO trips (trip_id, status, client_id, destination, travel_start, travel_end, booking_id, created_at)
SELECT DISTINCT ON (b.trip_id) b.trip_id, 'ACTIVE_BOOKING', b.client_id, b.destination, b.travel_start, b.travel_end, b.id, b.created_at
FROM bookings b
WHERE b.trip_id IS NOT NULL
ON CONFLICT (trip_id) DO NOTHING;

UPDATE trips t SET status = 'ACTIVE_BOOKING'
WHERE t.status IN ('ENQUIRY', 'PROPOSING')
  AND EXISTS (SELECT 1 FROM bookings b WHERE b.trip_id = t.trip_id);

UPDATE trips t
SET proposal_ids = sub.ids
FROM (
  SELECT trip_id, array_agg(id ORDER BY created_at) AS ids
  FROM proposals WHERE trip_id IS NOT NULL GROUP BY trip_id
) sub
WHERE t.trip_id = sub.trip_id;

-- Referential integrity.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS fk_bookings_trip;
ALTER TABLE bookings
  ADD CONSTRAINT fk_bookings_trip FOREIGN KEY (trip_id)
  REFERENCES trips(trip_id) ON DELETE SET NULL;

ALTER TABLE proposals DROP CONSTRAINT IF EXISTS fk_proposals_trip;
ALTER TABLE proposals
  ADD CONSTRAINT fk_proposals_trip FOREIGN KEY (trip_id)
  REFERENCES trips(trip_id) ON DELETE SET NULL;

ALTER TABLE website_enquiries DROP CONSTRAINT IF EXISTS fk_enquiries_trip;
ALTER TABLE website_enquiries
  ADD CONSTRAINT fk_enquiries_trip FOREIGN KEY (trip_id)
  REFERENCES trips(trip_id) ON DELETE SET NULL;


-- ────────────────────────────────────────────────────────────
-- 4. Lead first-response SLA
-- ────────────────────────────────────────────────────────────

ALTER TABLE website_enquiries ADD COLUMN IF NOT EXISTS first_responded_at timestamptz;
ALTER TABLE website_enquiries ADD COLUMN IF NOT EXISTS sla_breached_at timestamptz;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS lead_sla_minutes integer NOT NULL DEFAULT 30;

UPDATE website_enquiries e
SET first_responded_at = a.first_at
FROM (
  SELECT enquiry_id, MIN(created_at) AS first_at
  FROM enquiry_activities
  GROUP BY enquiry_id
) a
WHERE a.enquiry_id = e.id AND e.first_responded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_enquiries_sla
  ON website_enquiries (created_at)
  WHERE first_responded_at IS NULL AND sla_breached_at IS NULL;


-- ────────────────────────────────────────────────────────────
-- 5. Financial-year document numbering (Indian FY, Apr–Mar)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS document_sequences (
  doc_type text NOT NULL,
  fy_key text NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, fy_key)
);

CREATE OR REPLACE FUNCTION indian_fy_key(ts timestamptz DEFAULT now())
RETURNS text AS $$
DECLARE
  d date := (timezone('Asia/Kolkata', ts))::date;
  start_year int;
BEGIN
  IF EXTRACT(MONTH FROM d) >= 4 THEN
    start_year := EXTRACT(YEAR FROM d)::int;
  ELSE
    start_year := EXTRACT(YEAR FROM d)::int - 1;
  END IF;
  RETURN lpad((start_year % 100)::text, 2, '0') || '-' || lpad(((start_year + 1) % 100)::text, 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION next_document_sequence(p_doc_type text, p_fy_key text)
RETURNS integer AS $$
DECLARE
  next_val integer;
BEGIN
  INSERT INTO document_sequences (doc_type, fy_key, last_seq)
  VALUES (p_doc_type, p_fy_key, 1)
  ON CONFLICT (doc_type, fy_key) DO UPDATE
    SET last_seq = document_sequences.last_seq + 1
  RETURNING last_seq INTO next_val;
  RETURN next_val;
END;
$$ LANGUAGE plpgsql;

INSERT INTO document_sequences (doc_type, fy_key, last_seq)
SELECT 'invoice', indian_fy_key(), COALESCE(count(*), 0) FROM invoices
ON CONFLICT (doc_type, fy_key) DO NOTHING;

INSERT INTO document_sequences (doc_type, fy_key, last_seq)
SELECT 'receipt', indian_fy_key(), COALESCE(count(*), 0) FROM receipts
ON CONFLICT (doc_type, fy_key) DO NOTHING;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  v_fy text := indian_fy_key();
  v_seq int := next_document_sequence('invoice', v_fy);
BEGIN
  RETURN 'INV-' || v_fy || '-' || lpad(v_seq::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS text AS $$
DECLARE
  v_fy text := indian_fy_key();
  v_seq int := next_document_sequence('receipt', v_fy);
BEGIN
  RETURN 'RCT-' || v_fy || '-' || lpad(v_seq::text, 6, '0');
END;
$$ LANGUAGE plpgsql;


-- ────────────────────────────────────────────────────────────
-- 6. Optimistic locking + consent-then-capture
-- ────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_proposals_updated_at ON proposals;
CREATE TRIGGER set_proposals_updated_at
  BEFORE UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE proposals ADD COLUMN IF NOT EXISTS price_locked_until timestamptz;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS price_lock_hours integer NOT NULL DEFAULT 48;

-- Fare-difference re-consent events in the acceptance log.
ALTER TABLE proposal_acceptance_log DROP CONSTRAINT IF EXISTS proposal_acceptance_log_event_type_check;
ALTER TABLE proposal_acceptance_log ADD CONSTRAINT proposal_acceptance_log_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'viewed'::text, 'tc_accepted'::text, 'visa_acknowledged'::text,
    'confirmed'::text, 'addon_selected'::text, 'tier_selected'::text,
    'fare_difference_requested'::text
  ]));


-- ────────────────────────────────────────────────────────────
-- Done. Verification:
-- ────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM trips)                                        AS trips_rows,
  (SELECT count(*) FROM website_enquiries WHERE trip_id IS NOT NULL)  AS enquiries_with_trip_id,
  (SELECT count(*) FROM proposals WHERE trip_id IS NOT NULL)          AS proposals_with_trip_id,
  (SELECT count(*) FROM bookings WHERE trip_id IS NOT NULL)           AS bookings_with_trip_id,
  (SELECT count(*) FROM booking_items WHERE quoted_cost IS NOT NULL)  AS items_with_quoted_cost,
  (SELECT to_regclass('public.receipts') IS NOT NULL)                 AS receipts_ok,
  (SELECT to_regclass('public.payment_links') IS NOT NULL)            AS payment_links_ok,
  (SELECT to_regclass('public.booking_payments') IS NOT NULL)         AS booking_payments_ok,
  (SELECT to_regclass('public.scheduled_reminders') IS NOT NULL)      AS scheduled_reminders_ok,
  (SELECT to_regclass('public.webhook_events') IS NOT NULL)           AS webhook_events_ok,
  (SELECT to_regclass('public.document_sequences') IS NOT NULL)       AS document_sequences_ok;
