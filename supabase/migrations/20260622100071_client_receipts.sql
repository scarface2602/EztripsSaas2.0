-- ============================================================
-- Money-in: client receipts with bill-wise allocation.
-- One receipt (e.g. ₹1,42,000 from Big Shop into IDBI) is recorded
-- once and allocated across N bookings; the unallocated remainder
-- stays on the payer's account as an advance.
-- Distinct from `receipts` (per-booking PDF documents sent to clients).
-- ============================================================

-- Cash floats ("Cash — Nishan") and cards become payment accounts.
ALTER TABLE payment_accounts DROP CONSTRAINT IF EXISTS payment_accounts_account_type_check;
ALTER TABLE payment_accounts ADD CONSTRAINT payment_accounts_account_type_check
  CHECK (account_type IN ('bank', 'payment_gateway', 'wallet', 'upi', 'cash', 'card'));

CREATE TABLE IF NOT EXISTS client_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  client_id uuid NOT NULL REFERENCES clients(id),          -- the payer (billing entity)
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  received_on date NOT NULL DEFAULT CURRENT_DATE,
  account_id uuid REFERENCES payment_accounts(id) ON DELETE SET NULL,
  payment_mode text,                                        -- derived from account type
  reference text,                                           -- UTR / cheque no / UPI ref
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
  voided_at timestamptz,
  void_reason text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_receipt_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES client_receipts(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES bookings(id),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_receipts_client ON client_receipts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_receipts_status ON client_receipts(status);
CREATE INDEX IF NOT EXISTS idx_client_receipt_allocs_receipt ON client_receipt_allocations(receipt_id);
CREATE INDEX IF NOT EXISTS idx_client_receipt_allocs_booking ON client_receipt_allocations(booking_id);

CREATE OR REPLACE FUNCTION generate_client_receipt_number() RETURNS text AS $$
DECLARE
  v_year text := to_char(now(), 'YYYY');
  v_count int;
BEGIN
  SELECT count(*) + 1 INTO v_count FROM client_receipts WHERE receipt_number LIKE 'RCV-' || v_year || '-%';
  RETURN 'RCV-' || v_year || '-' || lpad(v_count::text, 6, '0');
END;
$$ LANGUAGE plpgsql;
