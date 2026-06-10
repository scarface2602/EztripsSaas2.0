-- ============================================================
-- Trip ID unification
--
-- One trip_id from enquiry → proposal → booking → documents:
--   1. Enquiries draw from the SAME sequence as the app (trip_sequences),
--      and query_id/trip_id become one value (query_id kept as legacy alias).
--   2. A trips master-folder row is born at enquiry time (status ENQUIRY).
--   3. Backfill trip_id across enquiries/proposals/bookings, create missing
--      trips rows, then enforce referential integrity with FKs.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Rewrite the enquiry trigger: shared sequence, single ID,
--    and create the trips master row at enquiry time.
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_enquiry_query_id()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_str text;
  v_type_str text;
  v_seq integer;
  v_trip_id text;
BEGIN
  -- Respect an explicitly provided trip_id (e.g. agent attaching an
  -- enquiry to an existing trip); otherwise generate one.
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
    v_trip_id := 'EZQ' || v_type_str || v_date_str || lpad(v_seq::text, 3, '0');

    NEW.trip_id := v_trip_id;
  END IF;

  -- query_id is a legacy alias for trip_id on new rows.
  NEW.query_id := COALESCE(NEW.query_id, NEW.trip_id);

  -- Birth of the trip master folder.
  INSERT INTO trips (trip_id, status, destination, created_at)
  VALUES (NEW.trip_id, 'ENQUIRY', NEW.destination, COALESCE(NEW.created_at, now()))
  ON CONFLICT (trip_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ────────────────────────────────────────────────────────────
-- 2. Backfill trip_id down the chain
-- ────────────────────────────────────────────────────────────

-- Columns may be missing on drifted databases — create before backfilling.
ALTER TABLE website_enquiries ADD COLUMN IF NOT EXISTS trip_id text;
ALTER TABLE website_enquiries ADD COLUMN IF NOT EXISTS query_id text;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS trip_id text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS trip_id text;

UPDATE website_enquiries SET trip_id = query_id WHERE trip_id IS NULL AND query_id IS NOT NULL;

UPDATE proposals p
SET trip_id = e.trip_id
FROM website_enquiries e
WHERE p.enquiry_id = e.id AND p.trip_id IS NULL AND e.trip_id IS NOT NULL;

UPDATE bookings b
SET trip_id = p.trip_id
FROM proposals p
WHERE b.proposal_id = p.id AND b.trip_id IS NULL AND p.trip_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 3. Create missing trips master rows for every trip_id in use.
--    Status reflects the furthest stage the trip reached.
-- ────────────────────────────────────────────────────────────

INSERT INTO trips (trip_id, status, destination, travel_start, travel_end, created_at)
SELECT DISTINCT ON (e.trip_id) e.trip_id, 'ENQUIRY', e.destination, NULL, NULL, e.created_at
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

-- Keep proposal linkage on the master folder accurate.
UPDATE trips t
SET proposal_ids = sub.ids
FROM (
  SELECT trip_id, array_agg(id ORDER BY created_at) AS ids
  FROM proposals WHERE trip_id IS NOT NULL GROUP BY trip_id
) sub
WHERE t.trip_id = sub.trip_id;

-- ────────────────────────────────────────────────────────────
-- 4. Referential integrity: trip_id columns now reference trips.
-- ────────────────────────────────────────────────────────────

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
-- 5. Trip completion timestamp (set by the completion cron).
-- ────────────────────────────────────────────────────────────

ALTER TABLE trips ADD COLUMN IF NOT EXISTS completed_at timestamptz;
