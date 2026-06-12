-- ============================================================
-- GST engine: org tax identity + per-invoice tax detail.
-- Note: the invoice route already selected organisations.gstin,
-- which never existed — this migration makes it real.
-- ============================================================

ALTER TABLE organisations ADD COLUMN IF NOT EXISTS gstin text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS gst_legal_name text;
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS gst_state_code text;
-- { air_agent_method: 'MARGIN' | 'BASIC_FARE', cab_fuel_included: bool,
--   tcs_threshold, tcs_rate_below, tcs_rate_above } — overrides engine defaults
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS tax_config jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Tax invoice fields. Snapshots (recipient GSTIN/name) are stored on the
-- invoice because the client record can change after issue.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_tax_invoice boolean NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recipient_gstin text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS recipient_legal_name text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS place_of_supply text;          -- GST state code
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS taxable_value numeric(12,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cgst_amount numeric(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sgst_amount numeric(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS igst_amount numeric(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS sac_code text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tax_class text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tcs_amount numeric(12,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS overseas_package boolean NOT NULL DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reference_invoice_id uuid REFERENCES invoices(id);

CREATE INDEX IF NOT EXISTS idx_invoices_tax ON invoices(is_tax_invoice) WHERE is_tax_invoice;
CREATE INDEX IF NOT EXISTS idx_invoices_client_created ON invoices(client_id, created_at);

-- The invoice route reads ifsc_code from payment_accounts — the column
-- never existed, so bank details silently never printed on invoices.
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS ifsc_code text;
ALTER TABLE payment_accounts ADD COLUMN IF NOT EXISTS branch_name text;
