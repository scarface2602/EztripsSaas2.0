-- Receipts table for payment receipt generation
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  receipt_number text UNIQUE NOT NULL,
  amount numeric(12,2) NOT NULL,
  payment_mode text,
  payment_date date NOT NULL,
  balance_remaining numeric(12,2) DEFAULT 0,
  pdf_url text,
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_booking ON receipts(booking_id);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts_all" ON receipts
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = receipts.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM bookings WHERE bookings.id = receipts.booking_id AND (bookings.created_by = auth.uid() OR is_super_admin()))
  );

-- Receipt number generator
CREATE OR REPLACE FUNCTION generate_receipt_number() RETURNS text AS $$
DECLARE
  v_year text := to_char(now(), 'YYYY');
  v_count int;
BEGIN
  SELECT count(*) + 1 INTO v_count FROM receipts WHERE receipt_number LIKE 'RCT-' || v_year || '-%';
  RETURN 'RCT-' || v_year || '-' || lpad(v_count::text, 6, '0');
END;
$$ LANGUAGE plpgsql;
