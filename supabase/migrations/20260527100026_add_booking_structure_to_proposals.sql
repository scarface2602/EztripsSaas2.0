-- Add booking_structure_type to proposals
-- Helps signal intent for package organization at booking time

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS booking_structure_type text CHECK (booking_structure_type IN ('full_dmc', 'partial_dmc', 'mixed', 'undecided', NULL)),
  ADD COLUMN IF NOT EXISTS booking_structure_notes text;

CREATE INDEX IF NOT EXISTS idx_proposals_booking_structure ON proposals(booking_structure_type) WHERE booking_structure_type IS NOT NULL;
