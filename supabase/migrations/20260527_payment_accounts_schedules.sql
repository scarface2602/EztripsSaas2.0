-- ============================================================
-- Phase 1: Payment Accounts & Schedules for Custom Payment Terms
-- ============================================================

-- 1. Payment Accounts (CMS-managed)
-- Tracks all bank accounts and payment sources for an agent
CREATE TABLE payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  account_name text NOT NULL,              -- e.g., "HDFC Current", "Kotak UPI", "ICICI Savings"
  account_number text,                     -- Stored masked (last 4 digits only in UI)
  account_type text NOT NULL DEFAULT 'bank' CHECK (account_type IN ('bank', 'payment_gateway', 'wallet', 'upi')),
  bank_name text,                          -- e.g., "HDFC", "ICICI", "Kotak"

  is_active boolean NOT NULL DEFAULT true,
  sort_order integer DEFAULT 0,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_accounts_user ON payment_accounts(user_id);
CREATE INDEX idx_payment_accounts_active ON payment_accounts(user_id, is_active);

CREATE TRIGGER set_payment_accounts_updated_at
  BEFORE UPDATE ON payment_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Payment Schedules (Templates for reuse)
-- Stores reusable payment patterns
CREATE TABLE payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name text NOT NULL,                      -- e.g., "DMC Standard", "Hotel Vendor", "Flights"
  is_template boolean NOT NULL DEFAULT true, -- Can be reused if true

  -- JSONB array of payment instructions
  -- [{sequence: 1, amount: 30000, due_date: "2026-06-01", reference_number: "DMC-ADV-2024", paid_from_account_id: "uuid"}, ...]
  payments jsonb DEFAULT '[]'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_schedules_user ON payment_schedules(user_id);
CREATE INDEX idx_payment_schedules_template ON payment_schedules(user_id, is_template) WHERE is_template = true;

CREATE TRIGGER set_payment_schedules_updated_at
  BEFORE UPDATE ON payment_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 3. Booking Packages (Groups booking_items by supplier/payment model)
CREATE TABLE booking_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

  -- Type: indicates how items are grouped
  type text NOT NULL CHECK (type IN ('full_dmc', 'partial_dmc', 'mixed', 'individual')),

  -- Supplier (optional, for single-supplier packages)
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Items in this package (array of booking_item IDs)
  booking_items_ids uuid[] DEFAULT ARRAY[]::uuid[],

  -- Total cost for this package
  total_cost numeric(12, 2) DEFAULT 0,

  -- Payment schedule reference
  payment_schedule_id uuid REFERENCES payment_schedules(id) ON DELETE SET NULL,

  -- Status
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'partial_paid', 'paid', 'cancelled')),

  -- Generated payables (references to payables table entries generated from this package)
  generated_payable_ids uuid[] DEFAULT ARRAY[]::uuid[],

  -- Notes about this package
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_packages_booking ON booking_packages(booking_id);
CREATE INDEX idx_booking_packages_supplier ON booking_packages(supplier_id);
CREATE INDEX idx_booking_packages_status ON booking_packages(status);

CREATE TRIGGER set_booking_packages_updated_at
  BEFORE UPDATE ON booking_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4. Booking Package Payments (Detailed payment schedule per package)
CREATE TABLE booking_package_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES booking_packages(id) ON DELETE CASCADE,

  -- Payment sequence (1st, 2nd, 3rd, etc.)
  sequence integer NOT NULL,

  -- Custom amount & due date (not calculated from %)
  amount numeric(12, 2) NOT NULL,
  due_date date NOT NULL,

  -- Reference & account tracking
  reference_number text,

  -- Account to PAY vendor FROM (e.g., Kotak, Personal UPI)
  paid_from_account_id uuid REFERENCES payment_accounts(id) ON DELETE SET NULL,

  -- Account that RECEIVED the client payment (e.g., HDFC, ICICI)
  received_in_account_id uuid REFERENCES payment_accounts(id) ON DELETE SET NULL,

  -- Account name snapshots for audit trail (in case account is deleted)
  paid_from_account_snapshot text,
  received_in_account_snapshot text,

  -- Status tracking
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'due', 'partial_paid', 'paid', 'overdue')),

  -- Amount tracking
  amount_paid numeric(12, 2) DEFAULT 0,
  paid_date date,

  -- Notes & metadata
  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_booking_package_payments_package ON booking_package_payments(package_id);
CREATE INDEX idx_booking_package_payments_due_date ON booking_package_payments(due_date);
CREATE INDEX idx_booking_package_payments_status ON booking_package_payments(status);
CREATE INDEX idx_booking_package_payments_sequence ON booking_package_payments(package_id, sequence);

CREATE TRIGGER set_booking_package_payments_updated_at
  BEFORE UPDATE ON booking_package_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. RLS Policies for payment_accounts (user can only see their own)
CREATE POLICY "Users can view their own payment accounts"
  ON payment_accounts FOR SELECT
  USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can insert their own payment accounts"
  ON payment_accounts FOR INSERT
  WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update their own payment accounts"
  ON payment_accounts FOR UPDATE
  USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can delete their own payment accounts"
  ON payment_accounts FOR DELETE
  USING (auth.uid()::uuid = user_id);

ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for payment_schedules
CREATE POLICY "Users can view their own payment schedules"
  ON payment_schedules FOR SELECT
  USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can insert their own payment schedules"
  ON payment_schedules FOR INSERT
  WITH CHECK (auth.uid()::uuid = user_id);

CREATE POLICY "Users can update their own payment schedules"
  ON payment_schedules FOR UPDATE
  USING (auth.uid()::uuid = user_id);

CREATE POLICY "Users can delete their own payment schedules"
  ON payment_schedules FOR DELETE
  USING (auth.uid()::uuid = user_id);

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for booking_packages (via booking ownership)
CREATE POLICY "Users can view booking packages they created"
  ON booking_packages FOR SELECT
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE created_by = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can insert booking packages for their bookings"
  ON booking_packages FOR INSERT
  WITH CHECK (
    booking_id IN (
      SELECT id FROM bookings WHERE created_by = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can update booking packages they created"
  ON booking_packages FOR UPDATE
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE created_by = auth.uid()::uuid
    )
  );

CREATE POLICY "Users can delete booking packages they created"
  ON booking_packages FOR DELETE
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE created_by = auth.uid()::uuid
    )
  );

ALTER TABLE booking_packages ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for booking_package_payments (via package ownership)
CREATE POLICY "Users can view package payments they created"
  ON booking_package_payments FOR SELECT
  USING (
    package_id IN (
      SELECT id FROM booking_packages
      WHERE booking_id IN (
        SELECT id FROM bookings WHERE created_by = auth.uid()::uuid
      )
    )
  );

CREATE POLICY "Users can insert package payments for their packages"
  ON booking_package_payments FOR INSERT
  WITH CHECK (
    package_id IN (
      SELECT id FROM booking_packages
      WHERE booking_id IN (
        SELECT id FROM bookings WHERE created_by = auth.uid()::uuid
      )
    )
  );

CREATE POLICY "Users can update package payments they created"
  ON booking_package_payments FOR UPDATE
  USING (
    package_id IN (
      SELECT id FROM booking_packages
      WHERE booking_id IN (
        SELECT id FROM bookings WHERE created_by = auth.uid()::uuid
      )
    )
  );

CREATE POLICY "Users can delete package payments they created"
  ON booking_package_payments FOR DELETE
  USING (
    package_id IN (
      SELECT id FROM booking_packages
      WHERE booking_id IN (
        SELECT id FROM bookings WHERE created_by = auth.uid()::uuid
      )
    )
  );

ALTER TABLE booking_package_payments ENABLE ROW LEVEL SECURITY;
