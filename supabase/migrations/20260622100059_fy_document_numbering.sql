-- ============================================================
-- Financial-year document numbering (Indian FY: April–March)
--
-- Replaces the calendar-year count(*)+1 generators, which had two problems:
--   1. GST practice expects an unbroken series per financial year, e.g.
--      INV-25-26-000123 — not per calendar year.
--   2. count(*)+1 races under concurrency and can mint duplicate numbers.
--
-- document_sequences gives an atomic, gap-resistant counter per
-- (doc type, FY) pair, same pattern as trip_sequences.
-- ============================================================

CREATE TABLE IF NOT EXISTS document_sequences (
  doc_type text NOT NULL,        -- 'invoice' | 'receipt'
  fy_key text NOT NULL,          -- e.g. '25-26'
  last_seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (doc_type, fy_key)
);

-- Indian financial year label for a timestamp: Apr 2025–Mar 2026 → '25-26'.
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

-- Seed current-FY counters past any existing numbers so the new series
-- never collides with documents issued under the old scheme. Guarded:
-- drifted databases may not have these tables yet.
DO $$
BEGIN
  IF to_regclass('public.invoices') IS NOT NULL THEN
    INSERT INTO document_sequences (doc_type, fy_key, last_seq)
    SELECT 'invoice', indian_fy_key(), COALESCE(count(*), 0) FROM invoices
    ON CONFLICT (doc_type, fy_key) DO NOTHING;
  END IF;

  IF to_regclass('public.receipts') IS NOT NULL THEN
    INSERT INTO document_sequences (doc_type, fy_key, last_seq)
    SELECT 'receipt', indian_fy_key(), COALESCE(count(*), 0) FROM receipts
    ON CONFLICT (doc_type, fy_key) DO NOTHING;
  END IF;
END $$;

-- Rewrite the generators in place — callers don't change.
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
