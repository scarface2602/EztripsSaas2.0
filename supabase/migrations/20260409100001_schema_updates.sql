-- 1. Unique constraint on clients.phone
ALTER TABLE clients ADD CONSTRAINT clients_phone_unique UNIQUE (phone);

-- 2. Add quote_type and package pricing fields to proposals
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS quote_type text DEFAULT 'itemised'
    CHECK (quote_type IN ('package', 'itemised')),
  ADD COLUMN IF NOT EXISTS package_cp_per_person numeric(12,2),
  ADD COLUMN IF NOT EXISTS package_sp_per_person numeric(12,2);

-- 3. Add refundable_status and cancellation_policy_text to flights
ALTER TABLE flights
  ADD COLUMN IF NOT EXISTS refundable_status text DEFAULT 'non_refundable'
    CHECK (refundable_status IN ('refundable', 'non_refundable', 'partially_refundable')),
  ADD COLUMN IF NOT EXISTS cancellation_policy_text text;

-- 4. Ensure city column exists on hotels (spec says NOT NULL, add default for existing rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hotels' AND column_name = 'city'
  ) THEN
    ALTER TABLE hotels ADD COLUMN city text NOT NULL DEFAULT '';
  END IF;
END $$;

-- 5. Allow 'ancillary' as a line_items type
ALTER TABLE line_items DROP CONSTRAINT IF EXISTS line_items_type_check;
ALTER TABLE line_items ADD CONSTRAINT line_items_type_check
  CHECK (type IN ('transfer', 'activity', 'visa', 'surcharge', 'other', 'ancillary'));

-- 6. Add ancillary-specific columns to line_items
ALTER TABLE line_items
  ADD COLUMN IF NOT EXISTS per_person boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_in_total boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_addon boolean DEFAULT false;
