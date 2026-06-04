-- Phase 2: Per-Booking Financial Dashboard — additional columns

-- Payables: add payment mode, account, bank charges
ALTER TABLE payables ADD COLUMN IF NOT EXISTS payment_mode text;
ALTER TABLE payables ADD COLUMN IF NOT EXISTS from_account_id uuid REFERENCES payment_accounts(id);
ALTER TABLE payables ADD COLUMN IF NOT EXISTS bank_charges numeric(12,2) DEFAULT 0;

-- Receivables: add TCS tracking and receipt number
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS tcs_amount numeric(12,2) DEFAULT 0;
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS receipt_number text;
