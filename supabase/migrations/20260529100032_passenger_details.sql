-- Store passenger details on proposal (collected before booking exists)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS passenger_details jsonb;

-- Passenger details table for bookings (copied from proposal at confirm time)
CREATE TABLE IF NOT EXISTS booking_passenger_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pax_index integer NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  gender text CHECK (gender IN ('male','female','other')),
  date_of_birth date,
  passport_urls text[],
  pan_urls text[],
  is_child boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Flag on bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passenger_details_completed boolean DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passenger_details_completed_at timestamptz;
