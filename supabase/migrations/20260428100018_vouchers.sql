-- ============================================================
-- Vouchers — PDF confirmations sent to customers
-- ============================================================

CREATE TABLE IF NOT EXISTS vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  supplier_type text NOT NULL CHECK (supplier_type IN ('hotel', 'flight', 'activity', 'transfer')),
  supplier_name text,
  booking_reference text,
  content jsonb NOT NULL DEFAULT '{}',
  pdf_url text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vouchers_booking ON vouchers(booking_id);

CREATE TRIGGER set_vouchers_updated_at
  BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
