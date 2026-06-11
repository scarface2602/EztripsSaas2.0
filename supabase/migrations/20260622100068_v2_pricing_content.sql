-- Builder v2: per-person price basis on groups + proposal-level content
-- sections (inclusions / exclusions / payment terms / T&C). Occupancy
-- (EB/CWB/CNB/child-free, refundable) lives in proposal_items.details
-- JSONB — no schema change needed there.

ALTER TABLE proposal_price_groups
  ADD COLUMN IF NOT EXISTS price_basis text NOT NULL DEFAULT 'total'
    CHECK (price_basis IN ('total', 'per_person'));

-- proposals.payment_terms (jsonb) is the legacy v1 structure; v2 stores
-- the supplier-quote text verbatim in payment_terms_text.
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS inclusions text[],
  ADD COLUMN IF NOT EXISTS exclusions text[],
  ADD COLUMN IF NOT EXISTS payment_terms_text text,
  ADD COLUMN IF NOT EXISTS terms_conditions text;

-- ── Fix next_trip_sequence: ambiguous period_key ──
-- The original (20260607100040) names its parameter the same as the
-- trip_sequences.period_key column, so every call dies with 42702
-- "column reference period_key is ambiguous" — the app only survived via
-- generateTripIdFromDb's timestamp fallback, and the enquiry trigger
-- would crash outright. Parameter name must stay (the app calls the RPC
-- with named args); #variable_conflict resolves references to the
-- variable, and the alias keeps column references explicit.
CREATE OR REPLACE FUNCTION next_trip_sequence(period_key text)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  p_key text := period_key; -- assignment context: parameter is unambiguous here
  next_val integer;
BEGIN
  -- ON CONSTRAINT instead of ON CONFLICT (period_key): the column form is
  -- an expression position where the parameter name would be ambiguous.
  INSERT INTO trip_sequences AS ts (period_key, last_seq)
  VALUES (p_key, 1)
  ON CONFLICT ON CONSTRAINT trip_sequences_pkey DO UPDATE
    SET last_seq = ts.last_seq + 1
  RETURNING ts.last_seq INTO next_val;

  RETURN next_val;
END;
$$;

-- ── Backfill trip_id for standalone proposals ──
-- Proposals created without an enquiry (walk-in/phone) never got a
-- trip_id; the create route now mints one at creation, this covers the
-- existing rows. Same format and shared sequence as the enquiry trigger.
DO $$
DECLARE
  p RECORD;
  v_date text;
  v_seq integer;
  v_trip_id text;
BEGIN
  FOR p IN
    SELECT id, created_at, client_id, destination, travel_start, travel_end, created_by
    FROM proposals WHERE trip_id IS NULL
  LOOP
    v_date := to_char(timezone('Asia/Kolkata', COALESCE(p.created_at, now())), 'YYMMDD');
    v_seq := next_trip_sequence(v_date);
    v_trip_id := 'EZQPKG' || v_date || lpad(v_seq::text, 3, '0');

    INSERT INTO trips (trip_id, status, client_id, destination, travel_start, travel_end, proposal_ids, created_by, created_at)
    VALUES (v_trip_id, 'PROPOSING', p.client_id, p.destination, p.travel_start, p.travel_end, ARRAY[p.id]::uuid[], p.created_by, COALESCE(p.created_at, now()))
    ON CONFLICT (trip_id) DO NOTHING;

    UPDATE proposals SET trip_id = v_trip_id WHERE id = p.id;
  END LOOP;
END $$;

-- Bookings converted from those proposals inherited the NULL — cascade.
UPDATE bookings b
SET trip_id = p.trip_id
FROM proposals p
WHERE b.proposal_id = p.id AND b.trip_id IS NULL AND p.trip_id IS NOT NULL;
