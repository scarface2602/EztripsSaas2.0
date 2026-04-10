-- Final updates: pricing fields, trip_cities (if not already added)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS trip_cities jsonb;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS land_cp numeric(12,2);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS land_sp numeric(12,2);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS pricing_display_mode text DEFAULT 'per_person'
  CHECK (pricing_display_mode IN ('per_person','total','both'));
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS total_sp numeric(12,2);
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS gst_enabled boolean DEFAULT false;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS gst_rate numeric DEFAULT 5;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS tcs_enabled boolean DEFAULT false;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS tcs_rate numeric DEFAULT 5;

-- Organisations table
CREATE TABLE IF NOT EXISTS organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  phone text,
  address text,
  email text,
  website text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES organisations(id);
