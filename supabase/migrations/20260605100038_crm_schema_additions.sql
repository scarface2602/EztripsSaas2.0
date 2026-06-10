-- Phase 1: CRM & Workflow Schema Additions

-- Enums
CREATE TYPE enquiry_temperature AS ENUM ('hot', 'warm', 'cold', 'archive');
CREATE TYPE pipeline_stage AS ENUM ('in_progress', 'proposal_sent', 'verbal_confirmed', 'rejected');
CREATE TYPE supplier_category AS ENUM ('dmc', 'offline_hotel', 'online_portal', 'transporter');

-- website_enquiries additions
ALTER TABLE website_enquiries
  ADD COLUMN IF NOT EXISTS temperature enquiry_temperature DEFAULT 'warm',
  ADD COLUMN IF NOT EXISTS pipeline_stage pipeline_stage DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS service_requirements jsonb DEFAULT '[]'::jsonb;

-- suppliers additions
ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS category supplier_category,
  ADD COLUMN IF NOT EXISTS payment_terms text;

-- booking_items additions
ALTER TABLE booking_items
  ADD COLUMN IF NOT EXISTS property_contact_email text,
  ADD COLUMN IF NOT EXISTS portal_confirmation_id text;
