-- Add loss reason tracking to website_enquiries
ALTER TABLE website_enquiries
  ADD COLUMN IF NOT EXISTS lost_reason text,
  ADD COLUMN IF NOT EXISTS lost_notes text;
