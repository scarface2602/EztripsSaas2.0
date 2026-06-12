-- ============================================================
-- Billing entities: clients gain a kind (individual | business),
-- GST identity, and an optional contact-person link so a company
-- and its owner surface together at billing time.
-- Bookings gain bill_to_client_id — the payer, when different from
-- the travelling client. NULL means the client pays (status quo).
-- ============================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_kind text NOT NULL DEFAULT 'individual';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gstin text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gst_legal_name text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS gst_state_code text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_address text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
-- pan_number already exists (20260612100042)

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_kind_check') THEN
    ALTER TABLE clients ADD CONSTRAINT clients_kind_check CHECK (client_kind IN ('individual', 'business'));
  END IF;
END $$;

-- Businesses often share the owner's phone, so the global unique on
-- phone becomes a partial unique on individuals only (website-enquiry
-- dedup still works; companies may share or omit a phone).
ALTER TABLE clients ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_phone_key;
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_phone_unique;
DROP INDEX IF EXISTS clients_phone_key;
DROP INDEX IF EXISTS clients_phone_unique;
CREATE UNIQUE INDEX IF NOT EXISTS clients_phone_unique_individual
  ON clients(phone) WHERE client_kind = 'individual' AND phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_contact ON clients(contact_client_id);
CREATE INDEX IF NOT EXISTS idx_clients_kind ON clients(client_kind);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bill_to_client_id uuid REFERENCES clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_bill_to ON bookings(bill_to_client_id);
