-- Phase 3: Leads CRM enhancements

-- Requirement types and details
ALTER TABLE website_enquiries ADD COLUMN IF NOT EXISTS requirement_type text DEFAULT 'package'
  CHECK (requirement_type IN ('package','flight','hotel','transfer','visa'));
ALTER TABLE website_enquiries ADD COLUMN IF NOT EXISTS requirement_details jsonb DEFAULT '{}';

-- Dual assignment: ops person in addition to sales
ALTER TABLE website_enquiries ADD COLUMN IF NOT EXISTS assigned_to_ops uuid REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_website_enquiries_ops ON website_enquiries(assigned_to_ops);
CREATE INDEX IF NOT EXISTS idx_website_enquiries_req_type ON website_enquiries(requirement_type);
