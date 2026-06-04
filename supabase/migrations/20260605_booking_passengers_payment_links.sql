-- Phase 6: Booking passengers table + custom payment links

-- booking_passengers — dedicated passenger manifest (extends existing booking_passenger_details)
CREATE TABLE IF NOT EXISTS booking_passengers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('adult', 'child')) DEFAULT 'adult',
  title text,
  first_name text NOT NULL,
  last_name text,
  dob date,
  passport_number text,
  passport_expiry date,
  passport_document_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_passengers_booking ON booking_passengers(booking_id);

ALTER TABLE booking_passengers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_passengers_all" ON booking_passengers
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_passengers.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = booking_passengers.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin()))
  );

-- Custom payment links for partial payments
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

CREATE INDEX IF NOT EXISTS idx_payment_links_token ON payment_links(token);

ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_links_all" ON payment_links
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = payment_links.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = payment_links.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin()))
  );
