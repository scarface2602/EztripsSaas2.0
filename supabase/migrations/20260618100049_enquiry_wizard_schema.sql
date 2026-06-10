-- SQL migration to support the new structured payload from the lead wizard
-- Filename: 20260618_enquiry_wizard_schema.sql

-- 1. Ensure requirement_details column exists on website_enquiries to store metadata
ALTER TABLE website_enquiries 
  ADD COLUMN IF NOT EXISTS requirement_details jsonb DEFAULT '{}';

-- 2. Ensure customer_name column exists (so we can accept both customer_name or map it to name)
ALTER TABLE website_enquiries 
  ADD COLUMN IF NOT EXISTS customer_name text;

-- 3. Ensure standard columns exist with correct types and defaults
ALTER TABLE website_enquiries 
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text;

-- Ensure status check constraint covers standard status or 'new'
ALTER TABLE website_enquiries 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'new';

-- Drop constraint if it exists and add updated one to ensure safety
ALTER TABLE website_enquiries DROP CONSTRAINT IF EXISTS website_enquiries_status_check;
ALTER TABLE website_enquiries 
  ADD CONSTRAINT website_enquiries_status_check 
  CHECK (status in ('new','contacted','qualified','proposal_sent','won','lost','spam','closed'));
