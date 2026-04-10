-- Feature 1: day_type on itinerary_days
ALTER TABLE itinerary_days
  ADD COLUMN IF NOT EXISTS day_type text
  CHECK (day_type IN ('arrival', 'tour', 'transfer', 'departure', 'flight'));

-- Feature 4: layovers JSONB column on flights
ALTER TABLE flights
  ADD COLUMN IF NOT EXISTS layovers jsonb DEFAULT '[]'::jsonb;
