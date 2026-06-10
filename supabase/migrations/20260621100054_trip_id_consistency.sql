-- Trip ID consistency: add trip_id to proposals and enquiries

-- 1. Add trip_id to proposals
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS trip_id text;
CREATE INDEX IF NOT EXISTS idx_proposals_trip_id ON proposals(trip_id);

-- 2. Add trip_id to website_enquiries
ALTER TABLE website_enquiries ADD COLUMN IF NOT EXISTS trip_id text;
CREATE INDEX IF NOT EXISTS idx_enquiries_trip_id ON website_enquiries(trip_id);
