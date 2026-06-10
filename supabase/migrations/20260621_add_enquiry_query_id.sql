-- Migration to add standardized query_id to website_enquiries
-- Format: EZQ[Type][YYMMDD][Seq], e.g. EZQPKG260608001

-- 1. Create tracking table for enquiry sequences
CREATE TABLE IF NOT EXISTS enquiry_sequences (
  period_key text PRIMARY KEY, -- formatted as 'YYMMDD'
  last_seq integer NOT NULL DEFAULT 0
);

-- 2. Add query_id column (initially nullable to allow backfill)
ALTER TABLE website_enquiries ADD COLUMN IF NOT EXISTS query_id text;

-- 3. Create the sequence-generation function
CREATE OR REPLACE FUNCTION generate_enquiry_query_id()
RETURNS TRIGGER AS $$
DECLARE
  v_date_str text;
  v_type_str text;
  v_seq integer;
  v_seq_key text;
BEGIN
  -- Map requirement_type to standard abbreviation
  v_type_str := CASE COALESCE(NEW.requirement_type, 'package')
    WHEN 'package'  THEN 'PKG'
    WHEN 'flight'   THEN 'FLT'
    WHEN 'hotel'    THEN 'HTL'
    WHEN 'transfer' THEN 'TRF'
    WHEN 'visa'     THEN 'VIS'
    ELSE 'PKG'
  END;

  -- Format date as YYMMDD in Asia/Kolkata timezone (IST)
  v_date_str := to_char(timezone('Asia/Kolkata', COALESCE(NEW.created_at, now())), 'YYMMDD');
  v_seq_key := v_date_str;

  -- Atomically increment the daily sequence number
  INSERT INTO enquiry_sequences (period_key, last_seq)
  VALUES (v_seq_key, 1)
  ON CONFLICT (period_key) DO UPDATE
    SET last_seq = enquiry_sequences.last_seq + 1
  RETURNING last_seq INTO v_seq;

  -- Form the query_id: EZQ + Type + Date + 3-digit zero-padded sequence
  NEW.query_id := 'EZQ' || v_type_str || v_date_str || lpad(v_seq::text, 3, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Register trigger BEFORE INSERT
DROP TRIGGER IF EXISTS trigger_before_insert_website_enquiries ON website_enquiries;
CREATE TRIGGER trigger_before_insert_website_enquiries
  BEFORE INSERT ON website_enquiries
  FOR EACH ROW
  EXECUTE FUNCTION generate_enquiry_query_id();

-- 5. Chronologically backfill existing website_enquiries rows
DO $$
DECLARE
  r RECORD;
  v_date_str text;
  v_type_str text;
  v_seq integer;
  v_seq_key text;
  v_query_id text;
BEGIN
  -- Process each enquiry chronologically so sequence numbers match submission order
  FOR r IN SELECT id, created_at, requirement_type FROM website_enquiries ORDER BY created_at ASC LOOP
    v_type_str := CASE COALESCE(r.requirement_type, 'package')
      WHEN 'package'  THEN 'PKG'
      WHEN 'flight'   THEN 'FLT'
      WHEN 'hotel'    THEN 'HTL'
      WHEN 'transfer' THEN 'TRF'
      WHEN 'visa'     THEN 'VIS'
      ELSE 'PKG'
    END;
    
    v_date_str := to_char(timezone('Asia/Kolkata', COALESCE(r.created_at, now())), 'YYMMDD');
    v_seq_key := v_date_str;
    
    INSERT INTO enquiry_sequences (period_key, last_seq)
    VALUES (v_seq_key, 1)
    ON CONFLICT (period_key) DO UPDATE
      SET last_seq = enquiry_sequences.last_seq + 1
    RETURNING last_seq INTO v_seq;
    
    v_query_id := 'EZQ' || v_type_str || v_date_str || lpad(v_seq::text, 3, '0');
    
    UPDATE website_enquiries SET query_id = v_query_id WHERE id = r.id;
  END LOOP;
END;
$$;

-- 6. Make column NOT NULL and UNIQUE now that everything is backfilled
ALTER TABLE website_enquiries ALTER COLUMN query_id SET NOT NULL;
ALTER TABLE website_enquiries ADD CONSTRAINT website_enquiries_query_id_key UNIQUE (query_id);
