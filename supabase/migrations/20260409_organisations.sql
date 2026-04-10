-- Organisations table (multi-tenancy foundation)
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

-- TCS rate column on proposals (was hardcoded to 5%, now user-configurable)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS tcs_rate numeric(5,2) DEFAULT 5;

-- Raw description on itinerary_days for AI rephrasing source material
ALTER TABLE itinerary_days ADD COLUMN IF NOT EXISTS raw_description text;
