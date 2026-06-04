-- Phase 5: Voucher enhancements, min confirmation, TCS, discount codes

-- TCS rate per proposal (default 0 = disabled; set to 2 for international packages)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS tcs_rate numeric(5,2) DEFAULT 0;

-- Minimum confirmation amount on bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS min_confirmation_amount numeric(12,2);

-- PAN number on clients (for TCS compliance)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pan_number text;

-- Discount codes with flexible usage control
CREATE TABLE IF NOT EXISTS discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES users(id),
  code text UNIQUE NOT NULL,
  discount_type text CHECK (discount_type IN ('percentage','fixed')) NOT NULL,
  discount_value numeric(12,2) NOT NULL,
  -- Usage mode: 'single' = one-time globally, 'per_customer' = once per customer,
  -- 'n_per_customer' = max_uses_per_customer times per customer, 'unlimited' = no limits
  usage_mode text DEFAULT 'unlimited'
    CHECK (usage_mode IN ('single','per_customer','n_per_customer','unlimited')),
  max_uses integer,              -- global max (null = unlimited)
  max_uses_per_customer integer,  -- per-customer max (used when usage_mode = 'n_per_customer')
  used_count integer DEFAULT 0,
  valid_from date,
  valid_to date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);

-- Track per-customer usage of discount codes
CREATE TABLE IF NOT EXISTS discount_code_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id uuid NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id),
  proposal_id uuid REFERENCES proposals(id),
  client_email text,
  used_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dcu_code ON discount_code_usage(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_dcu_client ON discount_code_usage(client_id);
