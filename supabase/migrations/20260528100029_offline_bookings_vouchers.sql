-- ============================================================
-- Phase 1: Offline Bookings & Voucher System
-- ============================================================

-- 1. Update organisations table with voucher branding
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS footer_text text DEFAULT 'EzTrips Travel | www.eztrips.com';
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS company_phone text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS company_email text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS company_website text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS terms_and_conditions text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS cancellation_policy text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS logo_file_path text;

-- 2. Extend booking_items for vehicle-specific data and voucher config
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS availability_type text CHECK (availability_type IN ('point_to_point', 'at_disposal'));
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS daily_start_time time;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS daily_end_time time;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS driver_name text;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS driver_license text;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS driver_license_valid_until date;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS driver_insurance_type text CHECK (driver_insurance_type IN ('basic', 'premium'));
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS driver_notes text;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS itinerary jsonb DEFAULT '[]'::jsonb;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS include_payment_in_voucher boolean DEFAULT false;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS manager_approved boolean DEFAULT false;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS manager_approved_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS manager_approved_at timestamptz;
ALTER TABLE booking_items ADD COLUMN IF NOT EXISTS approval_notes text;

-- 3. Create booking_vouchers table
CREATE TABLE IF NOT EXISTS booking_vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES booking_items(id) ON DELETE CASCADE,

  -- Voucher identification
  voucher_number text NOT NULL UNIQUE,
  voucher_type text NOT NULL CHECK (voucher_type IN ('hotel', 'flight', 'vehicle')),

  -- Status tracking
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'downloaded', 'used', 'expired')),

  -- What triggered the generation
  triggered_by text CHECK (triggered_by IN ('payment_received', 'manager_approved', 'driver_assigned', 'manual')),

  -- PDF storage
  pdf_url text,
  pdf_generated_at timestamptz,

  -- Download tracking
  download_count int DEFAULT 0,
  last_downloaded_at timestamptz,

  -- Email delivery tracking
  sent_to_email text,
  sent_at timestamptz,

  -- Notes
  generation_notes text,

  -- Metadata snapshot
  data_snapshot jsonb,

  -- Audit
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_vouchers_booking ON booking_vouchers(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_vouchers_item ON booking_vouchers(item_id);
CREATE INDEX IF NOT EXISTS idx_booking_vouchers_number ON booking_vouchers(voucher_number);
CREATE INDEX IF NOT EXISTS idx_booking_vouchers_type ON booking_vouchers(voucher_type);
CREATE INDEX IF NOT EXISTS idx_booking_vouchers_status ON booking_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_booking_vouchers_created_by ON booking_vouchers(created_by);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_booking_vouchers_updated_at') THEN
    CREATE TRIGGER set_booking_vouchers_updated_at
      BEFORE UPDATE ON booking_vouchers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- 4. Extend booking_package_payments with payment visibility & approval
ALTER TABLE booking_package_payments ADD COLUMN IF NOT EXISTS include_in_voucher boolean DEFAULT false;
ALTER TABLE booking_package_payments ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));
ALTER TABLE booking_package_payments ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE booking_package_payments ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- 5. RLS Policies for booking_vouchers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_vouchers' AND policyname = 'Users can view vouchers for their bookings') THEN
    CREATE POLICY "Users can view vouchers for their bookings"
      ON booking_vouchers FOR SELECT
      USING (
        booking_id IN (
          SELECT id FROM bookings WHERE created_by = auth.uid()::uuid
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_vouchers' AND policyname = 'Users can insert vouchers for their bookings') THEN
    CREATE POLICY "Users can insert vouchers for their bookings"
      ON booking_vouchers FOR INSERT
      WITH CHECK (
        booking_id IN (
          SELECT id FROM bookings WHERE created_by = auth.uid()::uuid
        )
        AND created_by = auth.uid()::uuid
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_vouchers' AND policyname = 'Users can update vouchers they created') THEN
    CREATE POLICY "Users can update vouchers they created"
      ON booking_vouchers FOR UPDATE
      USING (created_by = auth.uid()::uuid);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'booking_vouchers' AND policyname = 'Users can delete vouchers they created') THEN
    CREATE POLICY "Users can delete vouchers they created"
      ON booking_vouchers FOR DELETE
      USING (created_by = auth.uid()::uuid);
  END IF;
END $$;

ALTER TABLE booking_vouchers ENABLE ROW LEVEL SECURITY;

-- 6. Update booking_items item_type to include vehicle (skip if constraint exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_items_item_type_check'
  ) THEN
    ALTER TABLE booking_items ADD CONSTRAINT booking_items_item_type_check
      CHECK (item_type IN ('flight_segment', 'hotel_room', 'transfer', 'activity', 'meal_plan', 'vehicle'))
      NOT VALID;
  END IF;
END $$;

-- 7. Voucher counter sequence
CREATE SEQUENCE IF NOT EXISTS voucher_number_seq
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

-- 8. Function to generate next voucher number
CREATE OR REPLACE FUNCTION generate_voucher_number(voucher_year integer DEFAULT NULL)
RETURNS text AS $$
DECLARE
  current_year integer;
  counter integer;
  padded_counter text;
BEGIN
  IF voucher_year IS NULL THEN
    current_year := EXTRACT(YEAR FROM now())::integer;
  ELSE
    current_year := voucher_year;
  END IF;

  counter := nextval('voucher_number_seq');
  padded_counter := LPAD(counter::text, 6, '0');

  RETURN 'VCH-' || current_year || '-' || padded_counter;
END;
$$ LANGUAGE plpgsql;

-- 9. Create voucher_config table
CREATE TABLE IF NOT EXISTS voucher_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,

  next_voucher_number integer DEFAULT 1,
  voucher_number_format text DEFAULT 'VCH-YYYY-XXXXXX',

  header_text text,
  footer_text text,
  terms_text text,

  logo_url text,
  logo_position text DEFAULT 'top-left' CHECK (logo_position IN ('top-left', 'top-center', 'top-right')),

  email_subject_template text DEFAULT 'Your {VOUCHER_TYPE} Confirmation - {VOUCHER_NUMBER}',
  email_body_template text,

  auto_generate_on_payment_received boolean DEFAULT true,
  auto_generate_on_manager_approval boolean DEFAULT false,
  auto_send_to_client boolean DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voucher_config_org ON voucher_config(org_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_voucher_config_updated_at') THEN
    CREATE TRIGGER set_voucher_config_updated_at
      BEFORE UPDATE ON voucher_config
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- 10. RLS for voucher_config
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voucher_config' AND policyname = 'Users can view their org''s voucher config') THEN
    CREATE POLICY "Users can view their org's voucher config"
      ON voucher_config FOR SELECT
      USING (
        org_id IN (
          SELECT org_id FROM users WHERE id = auth.uid()::uuid
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voucher_config' AND policyname = 'Only org admins can update voucher config') THEN
    CREATE POLICY "Only org admins can update voucher config"
      ON voucher_config FOR UPDATE
      USING (
        org_id IN (
          SELECT org_id FROM users WHERE id = auth.uid()::uuid AND role = 'super_admin'
        )
      );
  END IF;
END $$;

ALTER TABLE voucher_config ENABLE ROW LEVEL SECURITY;

-- 11. Voucher audit log
CREATE TABLE IF NOT EXISTS voucher_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES booking_vouchers(id) ON DELETE CASCADE,

  action text NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,

  details jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_voucher_audit_voucher ON voucher_audit(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_audit_action ON voucher_audit(action);
CREATE INDEX IF NOT EXISTS idx_voucher_audit_actor ON voucher_audit(actor_id);

-- 12. RLS for voucher_audit
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voucher_audit' AND policyname = 'Users can view audit logs for their vouchers') THEN
    CREATE POLICY "Users can view audit logs for their vouchers"
      ON voucher_audit FOR SELECT
      USING (
        voucher_id IN (
          SELECT id FROM booking_vouchers
          WHERE booking_id IN (
            SELECT id FROM bookings WHERE created_by = auth.uid()::uuid
          )
        )
      );
  END IF;
END $$;

ALTER TABLE voucher_audit ENABLE ROW LEVEL SECURITY;

-- 13. Insert default voucher_config for existing organisations
INSERT INTO voucher_config (org_id, header_text, footer_text, logo_url)
SELECT
  id,
  'EzTrips Travel',
  'EzTrips Travel | www.eztrips.com',
  logo_url
FROM organisations
ON CONFLICT DO NOTHING;

-- 14. Comments
COMMENT ON TABLE booking_vouchers IS 'Stores generated vouchers for bookings - PDF confirmations for clients';
COMMENT ON TABLE voucher_config IS 'Organization-level voucher branding and configuration';
COMMENT ON TABLE voucher_audit IS 'Audit trail for all voucher actions (generation, download, send)';
COMMENT ON COLUMN booking_items.include_payment_in_voucher IS 'If false, payment details omitted from voucher';
COMMENT ON COLUMN booking_items.itinerary IS 'JSON array of {date, time, location, notes} for vehicle bookings';
COMMENT ON COLUMN booking_package_payments.include_in_voucher IS 'If false, payment section omitted from voucher';
COMMENT ON FUNCTION generate_voucher_number IS 'Generates unique voucher numbers (VCH-YYYY-XXXXXX)';
