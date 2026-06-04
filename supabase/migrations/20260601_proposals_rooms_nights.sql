-- Add num_rooms, extra_beds, num_nights to proposals
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS num_rooms integer DEFAULT 1;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS extra_beds integer DEFAULT 0;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS num_nights integer;
