-- ============================================================
-- Phase 1: Ops Workflow Foundation
-- Fixes schema gaps, adds missing columns, extends RLS
-- ============================================================

-- 1. Fix booking_vouchers.voucher_type to support all item types + package
ALTER TABLE booking_vouchers DROP CONSTRAINT IF EXISTS booking_vouchers_voucher_type_check;
ALTER TABLE booking_vouchers ADD CONSTRAINT booking_vouchers_voucher_type_check
  CHECK (voucher_type IN ('hotel','flight','vehicle','transfer','activity','dmc_package','package'));

-- 2. Add payment_mode to booking_package_payments (UI captures it but DB was dropping it)
ALTER TABLE booking_package_payments
  ADD COLUMN IF NOT EXISTS payment_mode text
  CHECK (payment_mode IN ('bank_transfer','upi','cash','card','cheque','gateway','portal_wallet'));

-- 3. Payment proof screenshot URL
ALTER TABLE booking_package_payments
  ADD COLUMN IF NOT EXISTS payment_proof_url text;

-- 4. Optimistic locking version columns
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE booking_package_payments ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- 5. Supplier follow-up tracking on booking_items
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS followup_count integer DEFAULT 0;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS last_followup_at timestamptz;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS escalated boolean DEFAULT false;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

-- 6. Ops assignment on items
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(id) ON DELETE SET NULL;

-- 7. Cancellation tracking on booking_items
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS cancellation_charge numeric(12,2);
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS refund_amount numeric(12,2);
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS refund_status text
  CHECK (refund_status IN ('pending','approved','processed','rejected'));

-- 8. Customer payments table (per-booking tracking)
CREATE TABLE IF NOT EXISTS customer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  payment_type text DEFAULT 'payment' CHECK (payment_type IN ('payment','refund','adjustment')),
  payment_mode text CHECK (payment_mode IN ('bank_transfer','upi','cash','card','cheque','razorpay','other')),
  reference_number text,
  received_in_account_id uuid REFERENCES payment_accounts(id) ON DELETE SET NULL,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  recorded_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_booking ON customer_payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_date ON customer_payments(received_date);

-- 9. Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  invoice_number text UNIQUE NOT NULL,
  invoice_type text NOT NULL CHECK (invoice_type IN ('proforma','final','credit_note')),
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  line_items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric(12,2) NOT NULL,
  tax_amount numeric(12,2) DEFAULT 0,
  discount_amount numeric(12,2) DEFAULT 0,
  total numeric(12,2) NOT NULL,
  currency text DEFAULT 'INR',
  amount_paid numeric(12,2) DEFAULT 0,
  status text DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','partial_paid','overdue','cancelled','void')),
  due_date date,
  notes text,
  pdf_url text,
  sent_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_booking ON invoices(booking_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- 10. Invoice number generator
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
  v_year text := to_char(now(), 'YYYY');
  v_count int;
BEGIN
  SELECT count(*) + 1 INTO v_count FROM invoices
    WHERE invoice_number LIKE 'INV-' || v_year || '-%';
  RETURN 'INV-' || v_year || '-' || lpad(v_count::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- 11. Org-wide RLS for ops/accounts/manager roles on bookings
-- Drop existing if re-running
DROP POLICY IF EXISTS "org_wide_booking_read" ON bookings;
CREATE POLICY "org_wide_booking_read" ON bookings FOR SELECT USING (
  created_by = auth.uid()::uuid
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()::uuid
      AND u.role IN ('operations','accounts','manager','super_admin')
      AND u.org_id = (SELECT org_id FROM users WHERE id = bookings.created_by)
  )
);

-- Org-wide RLS for booking_items
DROP POLICY IF EXISTS "org_wide_booking_items_read" ON booking_items;
CREATE POLICY "org_wide_booking_items_read" ON booking_items FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = booking_items.booking_id
      AND (
        b.created_by = auth.uid()::uuid
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()::uuid
            AND u.role IN ('operations','accounts','manager','super_admin')
            AND u.org_id = (SELECT org_id FROM users WHERE id = b.created_by)
        )
      )
  )
);

-- Org-wide RLS for booking_packages
DROP POLICY IF EXISTS "org_wide_booking_packages_read" ON booking_packages;
CREATE POLICY "org_wide_booking_packages_read" ON booking_packages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = booking_packages.booking_id
      AND (
        b.created_by = auth.uid()::uuid
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()::uuid
            AND u.role IN ('operations','accounts','manager','super_admin')
            AND u.org_id = (SELECT org_id FROM users WHERE id = b.created_by)
        )
      )
  )
);

-- RLS for customer_payments (same pattern)
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_payments_select" ON customer_payments;
CREATE POLICY "customer_payments_select" ON customer_payments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = customer_payments.booking_id
      AND (
        b.created_by = auth.uid()::uuid
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()::uuid
            AND u.role IN ('operations','accounts','manager','super_admin')
            AND u.org_id = (SELECT org_id FROM users WHERE id = b.created_by)
        )
      )
  )
);

DROP POLICY IF EXISTS "customer_payments_insert" ON customer_payments;
CREATE POLICY "customer_payments_insert" ON customer_payments FOR INSERT
  WITH CHECK (recorded_by = auth.uid()::uuid);

-- RLS for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM bookings b
    WHERE b.id = invoices.booking_id
      AND (
        b.created_by = auth.uid()::uuid
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = auth.uid()::uuid
            AND u.role IN ('operations','accounts','manager','super_admin')
            AND u.org_id = (SELECT org_id FROM users WHERE id = b.created_by)
        )
      )
  )
);

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices FOR INSERT
  WITH CHECK (created_by = auth.uid()::uuid);

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices FOR UPDATE USING (
  created_by = auth.uid()::uuid
  OR EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid()::uuid AND u.role = 'super_admin'
  )
);
