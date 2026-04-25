-- ============================================================
-- Bookings Module Rebuild
-- Simplified: one booking = one supplier + payment schedule
-- ============================================================

-- Drop old sub-tables and parent (order matters for FK deps)
DROP TABLE IF EXISTS booking_emails CASCADE;
DROP TABLE IF EXISTS booking_logs CASCADE;
DROP TABLE IF EXISTS booking_payments CASCADE;
DROP TABLE IF EXISTS booking_activities CASCADE;
DROP TABLE IF EXISTS booking_transport CASCADE;
DROP TABLE IF EXISTS booking_flights CASCADE;
DROP TABLE IF EXISTS booking_hotels CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;

-- Drop old trigger functions
DROP FUNCTION IF EXISTS prevent_booking_log_mutation CASCADE;

-- 1. Bookings (one per supplier per trip)
CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid REFERENCES proposals(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,

  booking_type text NOT NULL CHECK (booking_type IN ('package','hotel','land','flight')),
  title text NOT NULL,
  reference_number text,

  destination text,
  travel_start date,
  travel_end date,
  pax_adults integer DEFAULT 1,
  pax_children integer DEFAULT 0,
  currency text DEFAULT 'INR',

  cost_price numeric(12,2) DEFAULT 0,
  sell_price numeric(12,2) DEFAULT 0,

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','blocked','confirmed','in_progress','completed','cancelled')),

  -- Hotel blocking
  blocking_reference text,
  blocking_expires_at timestamptz,

  -- Denormalized payment summary (auto-updated by trigger)
  total_paid numeric(12,2) DEFAULT 0,
  next_payment_date date,
  next_payment_amount numeric(12,2),

  internal_notes text,
  assigned_to uuid REFERENCES users(id),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_proposal ON bookings(proposal_id);
CREATE INDEX idx_bookings_supplier ON bookings(supplier_id);
CREATE INDEX idx_bookings_client ON bookings(client_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_travel_start ON bookings(travel_start);
CREATE INDEX idx_bookings_type ON bookings(booking_type);
CREATE INDEX idx_bookings_next_payment ON bookings(next_payment_date) WHERE next_payment_date IS NOT NULL;

CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Booking Payments (installment schedule)
CREATE TABLE booking_payments (
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

CREATE INDEX idx_booking_payments_booking ON booking_payments(booking_id);
CREATE INDEX idx_booking_payments_due_date ON booking_payments(due_date);
CREATE INDEX idx_booking_payments_status ON booking_payments(status);

CREATE TRIGGER set_booking_payments_updated_at
  BEFORE UPDATE ON booking_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Auto-refresh denormalized payment fields on bookings
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

CREATE TRIGGER update_booking_payment_summary
  AFTER INSERT OR UPDATE OR DELETE ON booking_payments
  FOR EACH ROW EXECUTE FUNCTION refresh_booking_next_payment();

-- 4. Booking Logs (audit trail — append only)
CREATE TABLE booking_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_logs_booking ON booking_logs(booking_id);
CREATE INDEX idx_booking_logs_created_at ON booking_logs(created_at DESC);

CREATE OR REPLACE FUNCTION prevent_booking_log_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'booking_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER booking_logs_no_update
  BEFORE UPDATE ON booking_logs FOR EACH ROW EXECUTE FUNCTION prevent_booking_log_mutation();
CREATE TRIGGER booking_logs_no_delete
  BEFORE DELETE ON booking_logs FOR EACH ROW EXECUTE FUNCTION prevent_booking_log_mutation();

-- 5. Booking Emails (supplier communications)
CREATE TABLE booking_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  to_email text,
  cc_email text,
  subject text NOT NULL,
  body text NOT NULL,
  template_type text,

  direction text DEFAULT 'outbound' CHECK (direction IN ('outbound','inbound')),
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','failed')),
  sent_at timestamptz,
  sent_by uuid REFERENCES users(id),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_emails_booking ON booking_emails(booking_id);
